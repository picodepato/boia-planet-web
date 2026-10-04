import { configHash, rng } from '../minigames/rng';
import { DEFAULT_SHIP_CONFIG, type ShipConfig } from '../ship/config';
import {
  IDLE_INPUT,
  type ShipInput,
  type ShipState,
  collideShip,
  createShipState,
  pushOutWrapped,
  stepShip,
} from '../ship/controller';
import type { QualityTier } from '../world/sectors';
import { wrapDelta, wrapInto } from '../world/wrap';
import {
  type EnemyDef,
  type EnemyId,
  type NoteFigure,
  type QualityCaps,
  type StatId,
  SURVIVORS_STEP_S,
  type SurvivorsConfig,
  type UpgradeDef,
  type UpgradeId,
  type WeaponDef,
  figureOf,
  survivorsShipConfig,
  trackAt,
  xpToNext,
} from './config';
import { SpatialGrid } from './grid';
import { IslandIndex, type SurvivorsWorld } from './world';

/**
 * La simulación del modo Survivors del Cañón (plan 009, beta 1), pura y
 * determinista, sin three.js ni DOM: `createSurvivors(config, seed, world)`
 * y `step(input)` a paso fijo de 1/60 s. Misma semilla + mismas entradas =
 * misma partida (`stateHash`). La pinta y la cablea `/mar` (T99–T101).
 *
 * - El barco se mueve con el controlador de `/mar` (`stepShip`) con la
 *   maniobrabilidad de la config, y choca con las islas con `collideShip`.
 * - Todo se mide por el camino más corto del mar que da la vuelta.
 * - Enemigos (pirañas, cangrejo) aparecen en un anillo fuera de cámara,
 *   rodean las islas (rumbo + deslizar por el contorno) y dañan por contacto.
 * - El Cañón de agua dispara solo al más cercano; las islas paran sus bolas.
 * - Las notas se funden y el imán las atrae; subir de nivel abre una carta
 *   (1 de 3) y la partida queda en pausa hasta elegir.
 * - Agua a bordo = vida; llena, inundado. A los 7:00 de tiempo activo,
 *   amanece. Una pausa seguida de más de 5 min abandona la partida.
 */

export type EndReason = 'survived' | 'flooded' | 'abandoned';
export type SurvivorsStatus = 'running' | 'paused' | 'card' | 'ended';

/** Entrada de un paso: el mando del barco y las órdenes de la partida. */
export interface SurvivorsInput {
  /** El mismo `ShipInput` que lleva el barco de `/mar`. */
  ship?: ShipInput;
  /** Elige la opción `choose` (0…) de la carta abierta. */
  choose?: number;
  /** true: pausa manual; false: seguir. Sin valor, no cambia. */
  pause?: boolean;
}

export type SurvivorsEvent =
  | { type: 'hit'; enemy: EnemyId; x: number; y: number; water: number }
  | { type: 'defeated'; enemy: EnemyId; id: number; x: number; y: number }
  | { type: 'fire'; x: number; y: number; count: number }
  | { type: 'blocked'; x: number; y: number }
  | { type: 'note'; figure: NoteFigure; value: number; x: number; y: number }
  | { type: 'levelUp'; level: number }
  | { type: 'end'; reason: EndReason };

export interface EnemyView {
  readonly id: number;
  readonly type: EnemyId;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly heading: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly radius: number;
}

export interface ProjectileView {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly radius: number;
}

export interface NoteView {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly value: number;
  readonly figure: NoteFigure;
  /** El imán ya la arrastra. */
  readonly magnet: boolean;
}

export interface CardOption {
  readonly upgrade: UpgradeId;
  readonly i18nKey: string;
  readonly stat: StatId;
  readonly amount: number;
  /** Veces elegida contando esta. */
  readonly nextStack: number;
  readonly maxStacks: number;
}

export interface LevelUpCard {
  readonly level: number;
  readonly options: readonly CardOption[];
}

export interface PlayerStats {
  damageBonus: number;
  fireRateBonus: number;
  extraProjectiles: number;
  speedBonus: number;
  magnetBonus: number;
  bailPerS: number;
  areaBonus: number;
  hullBonus: number;
  xpBonus: number;
}

/** Lo que la pantalla necesita, de sólo lectura. No se copia: no guardarlo entre pasos. */
export interface SurvivorsSnapshot {
  readonly status: SurvivorsStatus;
  readonly player: Readonly<ShipState> & { readonly radius: number; readonly invulnerableS: number };
  readonly enemies: readonly EnemyView[];
  readonly enemiesByType: Readonly<Partial<Record<EnemyId, readonly EnemyView[]>>>;
  readonly projectiles: readonly ProjectileView[];
  readonly notes: readonly NoteView[];
  readonly water: { readonly level: number; readonly capacity: number };
  readonly xp: { readonly level: number; readonly xp: number; readonly toNext: number };
  /** s de tiempo activo. */
  readonly activeS: number;
  readonly timeLeftS: number;
  /** s de la pausa seguida en curso (0 jugando). */
  readonly pauseRunS: number;
  /** s de pausa en total. */
  readonly pauseTotalS: number;
  readonly card: LevelUpCard | null;
  readonly end: EndReason | null;
  readonly defeated: number;
  /** Fuerza extra de lo que aparece porque el tope de enemigos está lleno (0 = nada). */
  readonly pressure: number;
  readonly notesPicked: number;
  readonly notesValue: number;
  readonly stats: Readonly<PlayerStats>;
  readonly upgrades: Readonly<Partial<Record<UpgradeId, number>>>;
}

export interface SurvivorsOptions {
  /** Calidad de `/mar`: elige los topes. Sin valor, `alta`. */
  quality?: QualityTier;
  /** Física del barco de `/mar` (sin valor, la del motor); se le aplica `handling`. */
  ship?: ShipConfig;
  /** Empezar en el segundo `t` de la partida (atajo `&t=`); determinista por semilla. */
  startAtS?: number;
}

interface Enemy {
  id: number;
  type: EnemyId;
  def: EnemyDef;
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  dead: boolean;
}

interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  damage: number;
  pierce: number;
  lastHit: number;
  dead: boolean;
}

interface Note {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  figure: NoteFigure;
  magnet: boolean;
  dead: boolean;
}

const NOTE_RADIUS = 4;
const PAUSE_EPS = 1e-6;

const ZERO_STATS = (): PlayerStats => ({
  damageBonus: 0,
  fireRateBonus: 0,
  extraProjectiles: 0,
  speedBonus: 0,
  magnetBonus: 0,
  bailPerS: 0,
  areaBonus: 0,
  hullBonus: 0,
  xpBonus: 0,
});

export class SurvivorsGame {
  readonly config: SurvivorsConfig;
  readonly seed: number;
  readonly quality: QualityTier;
  readonly caps: QualityCaps;
  readonly world: SurvivorsWorld;

  private readonly bounds: SurvivorsWorld['bounds'];
  private readonly w: number;
  private readonly h: number;
  private readonly islands: IslandIndex;
  private readonly enemyGrid: SpatialGrid;
  private readonly projectileGrid: SpatialGrid;
  private readonly noteGrid: SpatialGrid;
  private readonly spawnRng: () => number;
  private readonly cardRng: () => number;
  private readonly baseShip: ShipConfig;
  private shipCfg: ShipConfig;
  private readonly weapon: WeaponDef;
  private readonly maxEnemyRadius: number;

  private readonly player: ShipState;
  private readonly enemies: Enemy[] = [];
  private readonly projectiles: Projectile[] = [];
  private readonly notes: Note[] = [];
  private readonly byType: Partial<Record<EnemyId, Enemy[]>> = {};
  private readonly events: SurvivorsEvent[] = [];
  private readonly scratch: number[] = [];
  private readonly scratch2: number[] = [];
  private readonly trackAcc: number[];
  private readonly stats: PlayerStats = ZERO_STATS();
  private readonly stacks: Partial<Record<UpgradeId, number>> = {};

  private nextId = 1;
  private activeSteps = 0;
  private readonly durationSteps: number;
  private pauseRun = 0;
  private pauseTotal = 0;
  private manualPause = false;
  private card: LevelUpCard | null = null;
  private pendingLevels = 0;
  private endReason: EndReason | null = null;
  private water = 0;
  private invulnerable = 0;
  private level = 1;
  private xp = 0;
  private cooldown = 0;
  private overflow = 0;
  private defeated = 0;
  private notesPicked = 0;
  private notesValue = 0;
  private readonly view: {
    -readonly [K in keyof SurvivorsSnapshot]: SurvivorsSnapshot[K];
  };

  constructor(
    config: SurvivorsConfig,
    seed: number,
    world: SurvivorsWorld,
    opts: SurvivorsOptions = {},
  ) {
    this.config = config;
    this.seed = seed >>> 0 || 1;
    this.world = world;
    this.quality = opts.quality ?? 'alta';
    this.caps = config.caps[this.quality];
    this.bounds = world.bounds;
    this.w = world.bounds.right - world.bounds.left;
    this.h = world.bounds.bottom - world.bounds.top;
    this.enemyGrid = new SpatialGrid(world.bounds, config.enemyGridCell, this.caps.enemies);
    this.projectileGrid = new SpatialGrid(world.bounds, config.gridCell, this.caps.projectiles);
    this.noteGrid = new SpatialGrid(world.bounds, config.gridCell, this.caps.notes);
    this.spawnRng = rng(this.seed);
    this.cardRng = rng((this.seed ^ 0x9e3779b9) >>> 0);
    this.baseShip = opts.ship ?? DEFAULT_SHIP_CONFIG;
    this.shipCfg = survivorsShipConfig(this.baseShip, config.handling, 0);
    const weapon = config.weapons[config.startingWeapon];
    if (!weapon) throw new Error(`survivors: no weapon ${config.startingWeapon}`);
    this.weapon = weapon;
    let maxR = 0;
    for (const def of Object.values(config.enemies)) if (def && def.radius > maxR) maxR = def.radius;
    this.maxEnemyRadius = maxR;
    // Las consultas de islas de un paso (rodeo, deslizar, balas, notas) caben en `reach`.
    this.islands = new IslandIndex(
      world.bounds,
      world.obstacles,
      config.gridCell,
      config.enemyAI.lookAhead + maxR + 16,
    );
    this.trackAcc = (config.acts[0]?.tracks ?? []).map(() => 0);
    this.durationSteps = Math.round(config.durationS / SURVIVORS_STEP_S);

    const s = world.start;
    this.player = createShipState(
      wrapInto(s.x, this.bounds.left, this.bounds.right),
      wrapInto(s.y, this.bounds.top, this.bounds.bottom),
      s.heading,
    );
    // Si empieza encima de una isla, al agua.
    const water = this.islands.toWater(this.player.x, this.player.y, this.shipCfg.radius);
    if (water) this.setWrapped(this.player, water.x, water.y);

    this.view = {
      status: 'running',
      player: Object.assign(this.player, { radius: this.shipCfg.radius, invulnerableS: 0 }),
      enemies: this.enemies,
      enemiesByType: this.byType,
      projectiles: this.projectiles,
      notes: this.notes,
      water: { level: 0, capacity: config.player.waterCapacity },
      xp: { level: 1, xp: 0, toNext: xpToNext(config, 1) },
      activeS: 0,
      timeLeftS: config.durationS,
      pauseRunS: 0,
      pauseTotalS: 0,
      card: null,
      end: null,
      defeated: 0,
      pressure: 0,
      notesPicked: 0,
      notesValue: 0,
      stats: this.stats,
      upgrades: this.stacks,
    };
    for (const id of Object.keys(config.enemies) as EnemyId[]) this.byType[id] = [];

    if (opts.startAtS && opts.startAtS > 0) this.fastForward(opts.startAtS);
  }

  // --- Lectura ---------------------------------------------------------------

  get status(): SurvivorsStatus {
    if (this.endReason) return 'ended';
    if (this.card) return 'card';
    if (this.manualPause) return 'paused';
    return 'running';
  }

  get ended(): boolean {
    return this.endReason !== null;
  }

  /** s de tiempo activo (sólo los pasos jugados). */
  get activeS(): number {
    return this.activeSteps * SURVIVORS_STEP_S;
  }

  /** El estado para pintar. Se actualiza en su sitio: no guardarlo entre pasos. */
  snapshot(): SurvivorsSnapshot {
    const v = this.view;
    v.status = this.status;
    (v.player as { invulnerableS: number; radius: number }).invulnerableS = Math.max(
      0,
      this.invulnerable,
    );
    (v.player as { radius: number }).radius = this.shipCfg.radius;
    const water = v.water as { level: number };
    water.level = this.water;
    const xp = v.xp as { level: number; xp: number; toNext: number };
    xp.level = this.level;
    xp.xp = this.xp;
    xp.toNext = xpToNext(this.config, this.level);
    v.activeS = this.activeS;
    v.timeLeftS = Math.max(0, (this.durationSteps - this.activeSteps) * SURVIVORS_STEP_S);
    v.pauseRunS = this.pauseRun;
    v.pauseTotalS = this.pauseTotal;
    v.card = this.card;
    v.end = this.endReason;
    v.defeated = this.defeated;
    v.pressure = this.overflow;
    v.notesPicked = this.notesPicked;
    v.notesValue = this.notesValue;
    for (const list of Object.values(this.byType)) if (list) list.length = 0;
    for (const e of this.enemies) this.byType[e.type]?.push(e);
    return v;
  }

  /** Huella del estado entero: dos partidas iguales dan la misma. */
  stateHash(): string {
    const p = this.player;
    return configHash({
      t: this.activeSteps,
      pr: this.pauseRun,
      pt: this.pauseTotal,
      st: this.status,
      p: [p.x, p.y, p.vx, p.vy, p.heading],
      w: this.water,
      inv: this.invulnerable,
      lv: [this.level, this.xp, this.pendingLevels],
      cd: this.cooldown,
      of: this.overflow,
      acc: this.trackAcc,
      up: this.stacks,
      card: this.card?.options.map((o) => o.upgrade) ?? null,
      e: this.enemies.map((e) => [e.id, e.type, e.x, e.y, e.vx, e.vy, e.hp]),
      b: this.projectiles.map((b) => [b.id, b.x, b.y, b.life]),
      n: this.notes.map((n) => [n.id, n.x, n.y, n.value]),
      k: [this.defeated, this.notesPicked, this.notesValue, this.nextId],
      end: this.endReason,
    });
  }

  // --- Atajos de prueba (determinista: no gastan azar) ------------------------

  /**
   * Pone un enemigo en (x, y), llevado al agua; null si no cabe (tope o
   * tierra). Para pruebas y atajos de desarrollo.
   */
  spawnEnemy(type: EnemyId, x: number, y: number): EnemyView | null {
    const def = this.config.enemies[type];
    if (!def || this.enemies.length >= this.caps.enemies) return null;
    const spot = this.islands.toWater(x, y, def.radius);
    if (!spot) return null;
    const e: Enemy = {
      id: this.nextId++,
      type,
      def,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      heading: 0,
      hp: def.hp,
      maxHp: def.hp,
      radius: def.radius,
      speed: def.speed,
      dead: false,
    };
    this.setWrapped(e, spot.x, spot.y);
    this.enemies.push(e);
    this.rebuildEnemyGrid();
    return e;
  }

  /** Suelta una nota de valor `value` en (x, y). Para pruebas y atajos de desarrollo. */
  spawnNote(x: number, y: number, value: number): void {
    this.dropNote(x, y, value);
  }

  /** ¿Es tierra (una isla) el punto, o el círculo de radio `r`? */
  onLand(x: number, y: number, r = 0): boolean {
    return this.islands.onLand(x, y, r);
  }

  // --- Pausa -----------------------------------------------------------------

  /** Pausa manual (botón, Esc, menú de `/mar`). */
  setPaused(paused: boolean): void {
    if (!this.endReason) this.manualPause = paused;
  }

  /**
   * Cuenta `seconds` s de pausa (pestaña oculta, o un hueco largo entre
   * imágenes). Una pausa seguida de más de `maxPauseS` abandona la partida.
   */
  elapsePause(seconds: number): readonly SurvivorsEvent[] {
    this.events.length = 0;
    if (this.endReason || !(seconds > 0)) return this.events;
    this.pauseRun += seconds;
    this.pauseTotal += seconds;
    if (this.pauseRun > this.config.maxPauseS + PAUSE_EPS) this.finish('abandoned');
    return this.events;
  }

  // --- Paso ------------------------------------------------------------------

  /**
   * Un paso fijo de 1/60 s. En pausa (manual o con la carta abierta) sólo
   * atiende órdenes y cuenta el paso como pausa. Devuelve los sucesos del
   * paso (la lista se reutiliza: leerla antes del siguiente paso).
   */
  step(input: SurvivorsInput = {}): readonly SurvivorsEvent[] {
    this.events.length = 0;
    if (this.endReason) return this.events;
    if (input.pause !== undefined) this.manualPause = input.pause;
    if (input.choose !== undefined && this.card) this.choose(input.choose);

    const dt = SURVIVORS_STEP_S;
    if (this.card || this.manualPause) {
      this.pauseRun += dt;
      this.pauseTotal += dt;
      if (this.pauseRun > this.config.maxPauseS + PAUSE_EPS) this.finish('abandoned');
      return this.events;
    }
    this.pauseRun = 0;
    this.activeSteps++;

    this.stepPlayer(input.ship ?? IDLE_INPUT, dt);
    this.spawnFromScript(dt);
    this.stepEnemies(dt);
    this.contactDamage(dt);
    this.fireWeapon(dt);
    this.stepProjectiles(dt);
    this.compactEnemies();
    this.stepNotes(dt);

    if (this.water >= this.config.player.waterCapacity) this.finish('flooded');
    else if (this.activeSteps >= this.durationSteps) this.finish('survived');
    else this.checkLevelUp();
    return this.events;
  }

  private finish(reason: EndReason): void {
    this.endReason = reason;
    this.card = null;
    this.events.push({ type: 'end', reason });
  }

  // --- Barco -----------------------------------------------------------------

  private stepPlayer(input: ShipInput, dt: number): void {
    const p = this.player;
    stepShip(p, input, this.shipCfg, dt);
    collideShip(p, { bounds: this.bounds, obstacles: this.world.obstacles, wrap: true }, this.shipCfg, dt);
    this.invulnerable -= dt;
    const bail = this.config.player.bailPerS + this.stats.bailPerS;
    if (bail > 0) this.water = Math.max(0, this.water - bail * dt);
  }

  // --- Aparición -------------------------------------------------------------

  private minutes(): number {
    return this.activeS / 60;
  }

  private spawnFromScript(dt: number): void {
    const act = this.config.acts[0];
    if (!act) return;
    const t = this.activeS;
    act.tracks.forEach((track, i) => {
      const key = trackAt(track, t);
      if (!key) return;
      let acc = this.trackAcc[i]! + key.groupsPerS * dt;
      while (acc >= 1) {
        acc -= 1;
        const size = Math.round(key.group[0] + (key.group[1] - key.group[0]) * this.spawnRng());
        this.spawnGroup(track.enemy, size, key.hpScale, key.speedScale);
      }
      this.trackAcc[i] = acc;
    });
    if (this.enemies.length < this.caps.enemies * 0.8 && this.overflow > 0) {
      this.overflow = Math.max(0, this.overflow - 0.01 * dt);
    }
  }

  private spawnGroup(type: EnemyId, size: number, hpScale: number, speedScale: number): void {
    const def = this.config.enemies[type];
    if (!def || size <= 0) return;
    const sp = this.config.spawn;
    const p = this.player;
    // El centro del grupo en el anillo, en tierra no: hasta 6 intentos.
    let cx = 0;
    let cy = 0;
    let found = false;
    for (let tries = 0; tries < 6 && !found; tries++) {
      const a = this.spawnRng() * Math.PI * 2;
      const r = sp.ringMin + (sp.ringMax - sp.ringMin) * this.spawnRng();
      const spot = this.islands.toWater(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, def.radius);
      if (spot) {
        cx = spot.x;
        cy = spot.y;
        found = true;
      }
    }
    if (!found) return;
    const minutes = this.minutes();
    for (let k = 0; k < size; k++) {
      if (this.enemies.length >= this.caps.enemies) {
        // Tope: la oleada sube de fuerza en vez de en número.
        this.overflow = Math.min(sp.overflowMax, this.overflow + sp.overflowStrength);
        continue;
      }
      const jx = (this.spawnRng() * 2 - 1) * sp.groupSpread;
      const jy = (this.spawnRng() * 2 - 1) * sp.groupSpread;
      const spot = this.islands.toWater(cx + jx, cy + jy, def.radius);
      if (!spot) continue;
      const hp =
        def.hp * hpScale * (1 + def.growthPerMinute.hp * minutes) * (1 + this.overflow);
      const e: Enemy = {
        id: this.nextId++,
        type,
        def,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        heading: 0,
        hp,
        maxHp: hp,
        radius: def.radius,
        speed: def.speed * speedScale * (1 + def.growthPerMinute.speed * minutes),
        dead: false,
      };
      this.setWrapped(e, spot.x, spot.y);
      const dx = wd(p.x - e.x, this.w);
      const dy = wd(p.y - e.y, this.h);
      e.heading = Math.atan2(dy, dx);
      this.enemies.push(e);
    }
  }

  /** Recoloca un enemigo en el anillo, hacia donde va el barco. */
  private recycle(e: Enemy): boolean {
    const sp = this.config.spawn;
    const p = this.player;
    const moving = Math.hypot(p.vx, p.vy) > 20;
    const base = moving ? Math.atan2(p.vy, p.vx) : p.heading;
    for (let tries = 0; tries < 6; tries++) {
      const a = base + (this.spawnRng() * 2 - 1) * (Math.PI / 2);
      const r = sp.ringMin + (sp.ringMax - sp.ringMin) * this.spawnRng();
      const spot = this.islands.toWater(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, e.radius);
      if (!spot) continue;
      this.setWrapped(e, spot.x, spot.y);
      e.vx = 0;
      e.vy = 0;
      return true;
    }
    return false;
  }

  // --- Enemigos --------------------------------------------------------------

  private rebuildEnemyGrid(): void {
    const g = this.enemyGrid;
    g.clear();
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]!;
      if (!e.dead) g.insert(i, e.x, e.y);
    }
  }

  private stepEnemies(dt: number): void {
    this.rebuildEnemyGrid();
    const p = this.player;
    const ai = this.config.enemyAI;
    const isl = this.islands;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]!;
      let dx = wd(p.x - e.x, this.w);
      let dy = wd(p.y - e.y, this.h);
      const dist = Math.hypot(dx, dy);
      if (dist > this.config.spawn.recycleDistance) {
        if (!this.recycle(e)) e.dead = true;
        continue;
      }
      dx = dist > 1e-6 ? dx / dist : 1;
      dy = dist > 1e-6 ? dy / dist : 0;
      let wantX = dx * e.speed;
      let wantY = dy * e.speed;
      // Rodear islas: la que está delante empuja de lado (sin buscar caminos).
      if (!e.def.ignoresIslands) {
        const near = isl.near(e.x, e.y, ai.lookAhead + e.radius, this.scratch);
        for (const k of near) {
          const o = isl.obstacles[k]!;
          const ox = wd(o.x - e.x, this.w);
          const oy = wd(o.y - e.y, this.h);
          const proj = ox * dx + oy * dy;
          if (proj < -o.radius || proj > ai.lookAhead + o.radius) continue;
          const lat = -ox * dy + oy * dx;
          const clear = o.radius + e.radius + 8;
          if (Math.abs(lat) >= clear) continue;
          const push = (clear - Math.abs(lat)) / clear;
          const side = lat > 0 ? -1 : 1;
          wantX += -dy * side * push * ai.avoidStrength * e.speed;
          wantY += dx * side * push * ai.avoidStrength * e.speed;
        }
      }
      // Separarse de los vecinos: el enjambre no se apelotona en un punto.
      const neigh = this.enemyGrid.query(e.x, e.y, e.radius + this.maxEnemyRadius, this.scratch2);
      let close = 0;
      for (const j of neigh) {
        if (j === i) continue;
        const o = this.enemies[j]!;
        const sx = wd(e.x - o.x, this.w);
        const sy = wd(e.y - o.y, this.h);
        const min = e.radius + o.radius;
        const d2 = sx * sx + sy * sy;
        if (d2 >= min * min || d2 < 1e-9) continue;
        const d = Math.sqrt(d2);
        const push = ((min - d) / min) * ai.separation * e.speed * 4;
        wantX += (sx / d) * push;
        wantY += (sy / d) * push;
        if (++close >= ai.maxNeighbours) break;
      }
      // Acercar la velocidad a la deseada con la inercia del tipo.
      const ddx = wantX - e.vx;
      const ddy = wantY - e.vy;
      const dl = Math.hypot(ddx, ddy);
      const maxDv = e.def.acceleration * dt;
      if (dl > maxDv) {
        e.vx += (ddx / dl) * maxDv;
        e.vy += (ddy / dl) * maxDv;
      } else {
        e.vx = wantX;
        e.vy = wantY;
      }
      const sp = Math.hypot(e.vx, e.vy);
      const top = e.speed * 1.5;
      if (sp > top) {
        e.vx *= top / sp;
        e.vy *= top / sp;
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (sp > 1) e.heading = Math.atan2(e.vy, e.vx);
      const touching = !e.def.ignoresIslands && this.slideOffIslands(e, e.radius);
      e.x = wrapInto(e.x, this.bounds.left, this.bounds.right);
      e.y = wrapInto(e.y, this.bounds.top, this.bounds.bottom);
      // Encajado entre islas: se recicla (nunca se queda en tierra).
      if (touching && isl.onLand(e.x, e.y) && !this.recycle(e)) e.dead = true;
    }
    this.rebuildEnemyGrid();
  }

  /**
   * La colisión del barco con las islas (`pushOutWrapped`), sin rebote:
   * desliza por el contorno. Devuelve si en la última pasada aún tocaba
   * alguna (entonces puede haber quedado entre dos).
   */
  private slideOffIslands(b: { x: number; y: number; vx: number; vy: number }, r: number): boolean {
    const isl = this.islands;
    let hit = false;
    for (let pass = 0; pass < 2; pass++) {
      const near = isl.near(b.x, b.y, r, this.scratch);
      hit = false;
      for (const k of near) {
        if (pushOutWrapped(b, r, isl.obstacles[k]!, this.w, this.h, 0)) hit = true;
      }
      if (!hit) break;
    }
    return hit;
  }

  private contactDamage(_dt: number): void {
    if (this.invulnerable > 0) return;
    const p = this.player;
    const pr = this.shipCfg.radius;
    const near = this.enemyGrid.query(p.x, p.y, pr + this.maxEnemyRadius, this.scratch);
    for (const i of near) {
      const e = this.enemies[i]!;
      if (e.dead) continue;
      const dx = wd(e.x - p.x, this.w);
      const dy = wd(e.y - p.y, this.h);
      const min = pr + e.radius;
      if (dx * dx + dy * dy >= min * min) continue;
      const amount = e.def.contactWater * Math.max(0, 1 - this.stats.hullBonus);
      this.water = Math.min(this.config.player.waterCapacity, this.water + amount);
      this.invulnerable = this.config.player.invulnerableS;
      this.events.push({ type: 'hit', enemy: e.type, x: e.x, y: e.y, water: this.water });
      return;
    }
  }

  private compactEnemies(): void {
    let n = 0;
    for (const e of this.enemies) if (!e.dead) this.enemies[n++] = e;
    this.enemies.length = n;
  }

  // --- Cañón de agua ---------------------------------------------------------

  private nearestEnemy(range: number): Enemy | null {
    const p = this.player;
    const near = this.enemyGrid.query(p.x, p.y, range + this.maxEnemyRadius, this.scratch);
    let best: Enemy | null = null;
    let bestD = range * range;
    let bestId = Infinity;
    for (const i of near) {
      const e = this.enemies[i]!;
      if (e.dead) continue;
      const dx = wd(e.x - p.x, this.w);
      const dy = wd(e.y - p.y, this.h);
      const d2 = dx * dx + dy * dy;
      // Empate: el de id menor (el orden de la rejilla no decide).
      if (d2 < bestD || (d2 === bestD && e.id < bestId)) {
        best = e;
        bestD = d2;
        bestId = e.id;
      }
    }
    return best;
  }

  private fireWeapon(dt: number): void {
    const wpn = this.weapon;
    this.cooldown -= dt * (1 + this.stats.fireRateBonus);
    if (this.cooldown > 0) return;
    const target = this.nearestEnemy(wpn.range);
    if (!target) {
      this.cooldown = 0;
      return;
    }
    const p = this.player;
    const aim = Math.atan2(wd(target.y - p.y, this.h), wd(target.x - p.x, this.w));
    const count = wpn.projectiles + Math.round(this.stats.extraProjectiles);
    let fired = 0;
    for (let k = 0; k < count; k++) {
      if (this.projectiles.length >= this.caps.projectiles) break;
      const a = aim + (k - (count - 1) / 2) * wpn.spreadRad;
      this.projectiles.push({
        id: this.nextId++,
        x: p.x,
        y: p.y,
        vx: Math.cos(a) * wpn.speed,
        vy: Math.sin(a) * wpn.speed,
        radius: wpn.radius * (1 + this.stats.areaBonus),
        life: (wpn.range / wpn.speed) * 1.2,
        damage: wpn.damage * (1 + this.stats.damageBonus),
        pierce: wpn.pierce,
        lastHit: -1,
        dead: false,
      });
      fired++;
    }
    this.cooldown += wpn.cooldownS;
    if (fired > 0) this.events.push({ type: 'fire', x: p.x, y: p.y, count: fired });
  }

  private stepProjectiles(dt: number): void {
    const isl = this.islands;
    for (const b of this.projectiles) {
      const sx = b.vx * dt;
      const sy = b.vy * dt;
      const len = Math.hypot(sx, sy);
      const ss = sx * sx + sy * sy;
      // Islas: el tramo de este paso contra cada isla cercana.
      if (this.weapon.blockedByIslands) {
        let blockT = Infinity;
        const near = isl.near(b.x + sx / 2, b.y + sy / 2, len / 2 + b.radius, this.scratch);
        for (const k of near) {
          const o = isl.obstacles[k]!;
          const t = segmentHit(
            wd(b.x - o.x, this.w),
            wd(b.y - o.y, this.h),
            sx,
            sy,
            ss,
            o.radius + b.radius,
          );
          if (t < blockT) blockT = t;
        }
        if (blockT !== Infinity) {
          b.dead = true;
          this.events.push({
            type: 'blocked',
            x: wrapInto(b.x + sx * blockT, this.bounds.left, this.bounds.right),
            y: wrapInto(b.y + sy * blockT, this.bounds.top, this.bounds.bottom),
          });
          continue;
        }
      }
      // Enemigos: el primero que toca el tramo.
      const near = this.enemyGrid.query(
        b.x + sx / 2,
        b.y + sy / 2,
        len / 2 + b.radius + this.maxEnemyRadius,
        this.scratch,
      );
      let hit: Enemy | null = null;
      let hitT = Infinity;
      for (const i of near) {
        const e = this.enemies[i]!;
        if (e.dead || e.id === b.lastHit) continue;
        const t = segmentHit(
          wd(b.x - e.x, this.w),
          wd(b.y - e.y, this.h),
          sx,
          sy,
          ss,
          e.radius + b.radius,
        );
        if (t < hitT || (t === hitT && hit && e.id < hit.id)) {
          hit = e;
          hitT = t;
        }
      }
      if (hit) {
        hit.hp -= b.damage;
        b.lastHit = hit.id;
        if (hit.hp <= 0) this.defeat(hit);
        if (b.pierce <= 0) {
          b.dead = true;
          continue;
        }
        b.pierce--;
      }
      b.x = wrapInto(b.x + sx, this.bounds.left, this.bounds.right);
      b.y = wrapInto(b.y + sy, this.bounds.top, this.bounds.bottom);
      b.life -= dt;
      if (b.life <= 0) b.dead = true;
    }
    let n = 0;
    for (const b of this.projectiles) if (!b.dead) this.projectiles[n++] = b;
    this.projectiles.length = n;
    const g = this.projectileGrid;
    g.clear();
    this.projectiles.forEach((b, i) => g.insert(i, b.x, b.y));
  }

  private defeat(e: Enemy): void {
    e.dead = true;
    this.defeated++;
    this.events.push({ type: 'defeated', enemy: e.type, id: e.id, x: e.x, y: e.y });
    this.dropNote(e.x, e.y, e.def.noteValue);
  }

  // --- Notas -----------------------------------------------------------------

  private dropNote(x: number, y: number, value: number): void {
    if (value <= 0) return;
    if (this.notes.length >= this.caps.notes) {
      // Tope: se suma a la más cercana (como las gemas de VS).
      let best: Note | null = null;
      let bestD = Infinity;
      for (const n of this.notes) {
        const dx = wd(n.x - x, this.w);
        const dy = wd(n.y - y, this.h);
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD) {
          best = n;
          bestD = d2;
        }
      }
      if (best) {
        best.value += value;
        best.figure = figureOf(this.config, best.value);
      }
      return;
    }
    // Al agua siempre (el enemigo ya estaba en agua; por si acaso).
    const spot = this.islands.toWater(x, y, NOTE_RADIUS) ?? { x, y };
    const n: Note = {
      id: this.nextId++,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      value,
      figure: figureOf(this.config, value),
      magnet: false,
      dead: false,
    };
    this.setWrapped(n, spot.x, spot.y);
    this.notes.push(n);
  }

  private magnetRadius(): number {
    return this.config.player.magnetRadius * (1 + this.stats.magnetBonus);
  }

  private stepNotes(dt: number): void {
    const p = this.player;
    const g = this.noteGrid;
    g.clear();
    this.notes.forEach((n, i) => g.insert(i, n.x, n.y));
    // Imán: las que entran en su radio ya no se sueltan.
    const mr = this.magnetRadius();
    for (const i of g.query(p.x, p.y, mr, this.scratch)) {
      const n = this.notes[i]!;
      const dx = wd(n.x - p.x, this.w);
      const dy = wd(n.y - p.y, this.h);
      if (dx * dx + dy * dy <= mr * mr) n.magnet = true;
    }
    const pickup = this.config.player.pickupRadius + this.shipCfg.radius;
    const pull = this.config.player.magnetSpeed + Math.hypot(p.vx, p.vy);
    for (const n of this.notes) {
      if (!n.magnet) continue;
      let dx = wd(p.x - n.x, this.w);
      let dy = wd(p.y - n.y, this.h);
      let d = Math.hypot(dx, dy);
      if (d > pickup) {
        const stepLen = Math.min(d, pull * dt);
        n.vx = (dx / d) * pull;
        n.vy = (dy / d) * pull;
        n.x += (dx / d) * stepLen;
        n.y += (dy / d) * stepLen;
        this.slideOffIslands(n, NOTE_RADIUS);
        n.x = wrapInto(n.x, this.bounds.left, this.bounds.right);
        n.y = wrapInto(n.y, this.bounds.top, this.bounds.bottom);
        dx = wd(p.x - n.x, this.w);
        dy = wd(p.y - n.y, this.h);
        d = Math.hypot(dx, dy);
      }
      if (d <= pickup) {
        n.dead = true;
        const value = n.value * (1 + this.stats.xpBonus);
        this.xp += value;
        this.notesPicked++;
        this.notesValue += n.value;
        this.events.push({ type: 'note', figure: n.figure, value: n.value, x: n.x, y: n.y });
      }
    }
    const every = Math.max(1, Math.round(this.config.notes.mergeEveryS / SURVIVORS_STEP_S));
    if (this.activeSteps % every === 0) this.mergeNotes();
    let k = 0;
    for (const n of this.notes) if (!n.dead) this.notes[k++] = n;
    this.notes.length = k;
  }

  /** Funde las notas cercanas: la de menor id se queda con el valor de las demás. */
  private mergeNotes(): void {
    const g = this.noteGrid;
    const r = this.config.notes.mergeRadius;
    g.clear();
    this.notes.forEach((n, i) => {
      if (!n.dead) g.insert(i, n.x, n.y);
    });
    for (let i = 0; i < this.notes.length; i++) {
      const a = this.notes[i]!;
      if (a.dead || a.magnet) continue;
      for (const j of g.query(a.x, a.y, r, this.scratch)) {
        if (j === i) continue;
        const b = this.notes[j]!;
        if (b.dead || b.magnet || b.id < a.id) continue;
        const dx = wd(b.x - a.x, this.w);
        const dy = wd(b.y - a.y, this.h);
        if (dx * dx + dy * dy > r * r) continue;
        a.value += b.value;
        b.dead = true;
      }
      a.figure = figureOf(this.config, a.value);
    }
  }

  // --- Niveles ---------------------------------------------------------------

  private checkLevelUp(): void {
    let need = xpToNext(this.config, this.level);
    while (this.xp >= need) {
      this.xp -= need;
      this.level++;
      this.pendingLevels++;
      this.events.push({ type: 'levelUp', level: this.level });
      need = xpToNext(this.config, this.level);
    }
    this.openCard();
  }

  private available(): UpgradeDef[] {
    return this.config.upgrades.filter((u) => (this.stacks[u.id] ?? 0) < u.maxStacks);
  }

  private openCard(): void {
    while (!this.card && this.pendingLevels > 0) {
      const pool = this.available();
      if (pool.length === 0) {
        // Todo al máximo: el nivel sube sin carta.
        this.pendingLevels = 0;
        return;
      }
      const picks: UpgradeDef[] = [];
      while (picks.length < this.config.cardChoices && pool.length > 0) {
        const k = Math.floor(this.cardRng() * pool.length);
        picks.push(pool.splice(k, 1)[0]!);
      }
      this.card = {
        level: this.level - this.pendingLevels + 1,
        options: picks.map((u) => ({
          upgrade: u.id,
          i18nKey: u.i18nKey,
          stat: u.stat,
          amount: u.amount,
          nextStack: (this.stacks[u.id] ?? 0) + 1,
          maxStacks: u.maxStacks,
        })),
      };
    }
  }

  private choose(index: number): void {
    const opt = this.card?.options[index];
    if (!opt) return;
    this.apply(opt.upgrade);
    this.card = null;
    this.pendingLevels--;
    this.openCard();
  }

  private apply(id: UpgradeId): void {
    const u = this.config.upgrades.find((x) => x.id === id);
    if (!u) return;
    this.stacks[id] = (this.stacks[id] ?? 0) + 1;
    this.stats[u.stat] += u.amount;
    if (u.stat === 'speedBonus') {
      this.shipCfg = survivorsShipConfig(this.baseShip, this.config.handling, this.stats.speedBonus);
    }
  }

  // --- Atajo &t= ------------------------------------------------------------

  /**
   * Empieza en el segundo `t`: el reloj en `t`, los niveles que da
   * `devStart.levelsPerMinute` con mejoras al azar (de la semilla) y el
   * anillo lleno con lo que el guion echa en `devStart.prefillS` s.
   */
  private fastForward(t: number): void {
    const maxS = this.config.durationS - SURVIVORS_STEP_S;
    const s = Math.min(Math.max(0, t), maxS);
    this.activeSteps = Math.round(s / SURVIVORS_STEP_S);
    const levels = Math.floor((s / 60) * this.config.devStart.levelsPerMinute);
    for (let k = 0; k < levels; k++) {
      this.level++;
      const pool = this.available();
      if (pool.length === 0) continue;
      this.apply(pool[Math.floor(this.cardRng() * pool.length)]!.id);
    }
    const act = this.config.acts[0];
    if (!act) return;
    for (const track of act.tracks) {
      const key = trackAt(track, this.activeS);
      if (!key) continue;
      const groups = Math.round(key.groupsPerS * this.config.devStart.prefillS);
      for (let g = 0; g < groups; g++) {
        const size = Math.round(key.group[0] + (key.group[1] - key.group[0]) * this.spawnRng());
        this.spawnGroup(track.enemy, size, key.hpScale, key.speedScale);
      }
    }
  }

  // --- Útiles ----------------------------------------------------------------

  private setWrapped(o: { x: number; y: number }, x: number, y: number): void {
    o.x = wrapInto(x, this.bounds.left, this.bounds.right);
    o.y = wrapInto(y, this.bounds.top, this.bounds.bottom);
  }
}

/**
 * `wrapDelta` para lo que ya está dentro del periodo (la diferencia cae en
 * (−p, p)): el mismo resultado sin dividir; fuera de ese caso, `wrapDelta`.
 */
function wd(d: number, p: number): number {
  const h = p * 0.5;
  if (d >= h) return d - p < h ? d - p : wrapDelta(d, p);
  if (d < -h) return d + p >= -h ? d + p : wrapDelta(d, p);
  return d;
}

/**
 * Primer instante (0…1) del tramo `a → a + s` en que un punto a distancia
 * relativa (ax, ay) del centro de un círculo de radio `r` lo toca; Infinity
 * si no lo toca.
 */
function segmentHit(ax: number, ay: number, sx: number, sy: number, ss: number, r: number): number {
  const c = ax * ax + ay * ay - r * r;
  if (c <= 0) return 0;
  if (ss <= 1e-12) return Infinity;
  const bq = ax * sx + ay * sy;
  if (bq >= 0) return Infinity;
  const disc = bq * bq - ss * c;
  if (disc < 0) return Infinity;
  const t = (-bq - Math.sqrt(disc)) / ss;
  return t >= 0 && t <= 1 ? t : Infinity;
}

/** Crea una partida. Igual que `new SurvivorsGame(…)`. */
export function createSurvivors(
  config: SurvivorsConfig,
  seed: number,
  world: SurvivorsWorld,
  opts: SurvivorsOptions = {},
): SurvivorsGame {
  return new SurvivorsGame(config, seed, world, opts);
}
