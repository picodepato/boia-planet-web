import { configHash, rng } from '../minigames/rng';
import { DEFAULT_SHIP_CONFIG, type ShipConfig } from '../ship/config';
import {
  IDLE_INPUT,
  type ShipInput,
  type ShipState,
  createShipState,
  pushOutWrapped,
} from '../ship/controller';
import type { QualityTier } from '../world/sectors';
import { wrapDelta, wrapInto } from '../world/wrap';
import {
  type ElitesDef,
  type EnemyDef,
  type EnemyId,
  type EnemyPhase,
  type MareaDef,
  type NoteFigure,
  type QualityCaps,
  type ScriptEvent,
  type StatId,
  SURVIVORS_STEP_S,
  type SurvivorsConfig,
  type UpgradeDef,
  type UpgradeId,
  type WeaponDef,
  type WeaponId,
  type WeaponKind,
  type WeaponStats,
  figureOf,
  resolveWeaponStats,
  survivorsShipConfig,
  trackAt,
  xpToNext,
} from './config';
import { SpatialGrid } from './grid';
import { SurvivorsMovement, type MovementView } from './movement';
import type { JumpEvent } from '../circuit/jump';
import { IslandIndex, type SurvivorsWorld } from './world';

/**
 * La simulación del modo Survivors del Cañón (planes 010 y 011), pura y
 * determinista, sin three.js ni DOM: `createSurvivors(config, seed, world)`
 * y `step(input)` a paso fijo de 1/60 s. Misma semilla + mismas entradas =
 * misma partida (`stateHash`). La pinta y la cablea `/mar` (T99–T101).
 *
 * - El barco se mueve con el controlador de `/mar` (`stepShip`) con la
 *   maniobrabilidad de la config, y choca con las islas con `collideShip`.
 * - Todo se mide por el camino más corto del mar que da la vuelta.
 * - Los enemigos aparecen en un anillo fuera de cámara según el guion por
 *   datos (`acts`) y dañan por contacto. Por comportamiento (§6): pirañas,
 *   cangrejos y medusas rodean las islas (rumbo + deslizar por el
 *   contorno); la gaviota vuela por encima; el pirata se para a distancia
 *   y dispara recto (las islas paran sus disparos); el pez espada avisa con
 *   una línea en el agua y embiste recto; la medusa se parte en dos al caer.
 * - Desde el hito `elites` del guion una parte sale élite (más aguante,
 *   mejor nota); la «Marea» echa anillos enteros durante 20 s; con el tope
 *   lleno la oleada gana fuerza en vez de número.
 * - Las armas (§5) son datos: cada una lleva su forma (`WeaponKind`) y su
 *   tabla por nivel; `resolveWeaponStats` le aplica las mejoras y los
 *   vinilos. El Cañón de agua y el de confeti disparan recto y las islas los
 *   paran; el aura del Subwoofer, el Láser que gira, las Boyas orbitales, los
 *   cohetes de los Fuegos y la nube de la Lluvia ácida pasan por encima.
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
  /** Pulsación de turbo de este paso; forma parte del replay. */
  turbo?: boolean;
  /** Elige la opción `choose` (0…) de la carta abierta. */
  choose?: number;
  /** true: pausa manual; false: seguir. Sin valor, no cambia. */
  pause?: boolean;
}

export type SurvivorsEvent =
  | JumpEvent
  /** Un golpe al barco: por contacto o por un disparo enemigo (`enemy` es quien lo hizo). */
  | { type: 'hit'; enemy: EnemyId; x: number; y: number; water: number }
  | { type: 'defeated'; enemy: EnemyId; id: number; x: number; y: number; elite: boolean }
  /** Un arma dispara: `count` bolas, confetis, cohetes o nubes salen de (x, y). */
  | { type: 'fire'; weapon: WeaponId; x: number; y: number; count: number }
  /** Un cohete explota en (x, y) con ese radio. */
  | { type: 'explode'; weapon: WeaponId; x: number; y: number; radius: number }
  /** Una bola del jugador o un disparo enemigo (`owner`) parado por una isla. */
  | { type: 'blocked'; x: number; y: number; owner: 'player' | 'enemy' }
  | { type: 'enemyFire'; enemy: EnemyId; id: number; x: number; y: number }
  /** Empieza el aviso de una embestida: la línea en el agua desde (x, y), `length` u. */
  | { type: 'telegraph'; enemy: EnemyId; id: number; x: number; y: number; heading: number; length: number }
  | { type: 'split'; enemy: EnemyId; id: number; x: number; y: number; count: number }
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
  /** Élite: brilla y suelta mejor nota. */
  readonly elite: boolean;
  /** Tamaño respecto al tipo (1; los trozos de una medusa, menos). */
  readonly scale: number;
  /** Qué hace: quieto apuntando, avisando, embistiendo, descansando o moviéndose. */
  readonly phase: EnemyPhase;
}

export interface ProjectileView {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly radius: number;
}

/** Una bola, un confeti o un cohete del jugador: `weapon` y `kind` dicen cuál pintar. */
export interface PlayerProjectileView extends ProjectileView {
  readonly weapon: WeaponId;
  readonly kind: WeaponKind;
}

/** El aura de un arma alrededor del barco (Subwoofer). */
export interface AuraView {
  readonly weapon: WeaponId;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** 0 justo tras un golpe, 1 al siguiente: el pulso. */
  readonly progress: number;
}

/** Un rayo desde el barco (Láser de festival). */
export interface BeamView {
  readonly weapon: WeaponId;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly length: number;
  readonly halfWidth: number;
}

/** Una boya en órbita (Boyas orbitales). */
export interface OrbitalView {
  readonly weapon: WeaponId;
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly angle: number;
}

/** Una zona que daña en el agua (la nube de la Lluvia ácida). */
export interface ZoneView {
  readonly id: number;
  readonly weapon: WeaponId;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** s que le quedan y lo que duró al nacer. */
  readonly lifeS: number;
  readonly durationS: number;
  /** 0 justo tras un golpe, 1 al siguiente. */
  readonly progress: number;
}

/** Un arma del barco: su nivel y los números con que ataca ahora (ya con mejoras). */
export interface WeaponView {
  readonly id: WeaponId;
  readonly kind: WeaponKind;
  readonly level: number;
  readonly maxLevel: number;
  readonly stats: Readonly<WeaponStats>;
  /** s hasta el próximo disparo (0 si dispara en cuanto haya blanco). */
  readonly cooldownS: number;
}

/** La línea de aviso de una embestida, para pintarla en el agua. */
export interface TelegraphView {
  /** El enemigo que avisa. */
  readonly id: number;
  readonly type: EnemyId;
  readonly x: number;
  readonly y: number;
  readonly heading: number;
  readonly length: number;
  /** 0 al empezar el aviso, 1 cuando embiste. */
  readonly progress: number;
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
  readonly movement: MovementView;
  readonly player: Readonly<ShipState> & {
    readonly radius: number;
    readonly invulnerableS: number;
  };
  readonly enemies: readonly EnemyView[];
  readonly enemiesByType: Readonly<Partial<Record<EnemyId, readonly EnemyView[]>>>;
  /** Bolas, confetis y cohetes del jugador (todas las armas que vuelan). */
  readonly projectiles: readonly PlayerProjectileView[];
  /** Disparos de los enemigos (pistolas de agua). */
  readonly enemyProjectiles: readonly ProjectileView[];
  /** Avisos de embestida en curso. */
  readonly telegraphs: readonly TelegraphView[];
  /** Las armas del barco, en el orden en que se cogieron. */
  readonly weapons: readonly WeaponView[];
  readonly auras: readonly AuraView[];
  readonly beams: readonly BeamView[];
  readonly orbitals: readonly OrbitalView[];
  readonly zones: readonly ZoneView[];
  readonly notes: readonly NoteView[];
  /** Ya salen élites (hito `elites` del guion). */
  readonly elitesActive: boolean;
  /** La «Marea» está cayendo. */
  readonly mareaActive: boolean;
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
  elite: boolean;
  scale: number;
  /** Nota que suelta (ya con élite y trozo aplicados). */
  noteValue: number;
  /** Veces que ya se partió (medusas). */
  generation: number;
  phase: EnemyPhase;
  /** s que quedan de la fase (aviso, descanso) o hasta el próximo disparo. */
  timer: number;
  /** Embestida: rumbo fijo y u que quedan. */
  chargeX: number;
  chargeY: number;
  chargeLeft: number;
  dead: boolean;
}

/** Un disparo enemigo (pistola de agua): recto, lo paran las islas y el barco. */
interface EnemyShot {
  id: number;
  enemy: EnemyId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  water: number;
  dead: boolean;
}

interface Projectile {
  id: number;
  weapon: WeaponId;
  kind: WeaponKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  damage: number;
  pierce: number;
  /** Las islas lo paran (las formas rectas). */
  blocked: boolean;
  /** Cohetes: el enemigo al que va (−1: ninguno) y el radio de la explosión. */
  target: number;
  burst: number;
  speed: number;
  lastHit: number;
  dead: boolean;
}

/** Una nube de lluvia ácida: quieta, daña cada `tickS` a lo que tiene debajo. */
interface Zone {
  id: number;
  weapon: WeaponId;
  x: number;
  y: number;
  radius: number;
  damage: number;
  tickS: number;
  tick: number;
  life: number;
  durationS: number;
  /** Para la pantalla (`ZoneView`), puestos en `snapshot()`. */
  lifeS: number;
  progress: number;
  dead: boolean;
}

/** Un arma del barco: su definición, nivel, números resueltos y relojes. */
interface WeaponSlot {
  def: WeaponDef;
  level: number;
  stats: WeaponStats;
  /** s hasta el próximo disparo (formas con `cooldownS`). */
  cooldown: number;
  /** s hasta el próximo golpe (formas con `tickS`). */
  tick: number;
  /** rad: giro del rayo o de las boyas. */
  angle: number;
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
/** u de choque de un cohete en vuelo (la explosión es `area`). */
const ROCKET_RADIUS = 6;
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
  readonly movement: SurvivorsMovement;

  private readonly bounds: SurvivorsWorld['bounds'];
  private readonly w: number;
  private readonly h: number;
  private readonly islands: IslandIndex;
  private readonly enemyGrid: SpatialGrid;
  private readonly projectileGrid: SpatialGrid;
  private readonly enemyShotGrid: SpatialGrid;
  private readonly noteGrid: SpatialGrid;
  private readonly spawnRng: () => number;
  private readonly cardRng: () => number;
  /** El azar de las armas (blancos de los cohetes): aparte, para no mover el guion. */
  private readonly weaponRng: () => number;
  private readonly baseShip: ShipConfig;
  private shipCfg: ShipConfig;
  private readonly weapons: WeaponSlot[] = [];
  private readonly maxEnemyRadius: number;
  private readonly maxShotRadius: number;
  /** s de partida desde los que salen élites (Infinity: nunca) y su definición. */
  private readonly elitesFromS: number;
  private readonly elitesDef: ElitesDef | null;
  /** Hitos «Marea» activos del guion y, para cada uno, cuándo cae el próximo anillo. */
  private readonly mareas: { ev: ScriptEvent; def: MareaDef }[];
  private readonly mareaNext: number[];

  private readonly player: ShipState;
  private readonly enemies: Enemy[] = [];
  private readonly projectiles: Projectile[] = [];
  private readonly enemyShots: EnemyShot[] = [];
  private readonly telegraphs: TelegraphView[] = [];
  private readonly zones: Zone[] = [];
  private readonly weaponViews: WeaponView[] = [];
  private readonly auras: AuraView[] = [];
  private readonly beams: BeamView[] = [];
  private readonly orbitals: OrbitalView[] = [];
  private readonly notes: Note[] = [];
  private readonly byType: Partial<Record<EnemyId, Enemy[]>> = {};
  private readonly events: SurvivorsEvent[] = [];
  private readonly scratch: number[] = [];
  private readonly scratch2: number[] = [];
  private readonly scratchEnemies: Enemy[] = [];
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
    this.movement = new SurvivorsMovement(world, this.seed);
    this.quality = opts.quality ?? 'alta';
    this.caps = config.caps[this.quality];
    this.bounds = world.bounds;
    this.w = world.bounds.right - world.bounds.left;
    this.h = world.bounds.bottom - world.bounds.top;
    this.enemyGrid = new SpatialGrid(world.bounds, config.enemyGridCell, this.caps.enemies);
    this.projectileGrid = new SpatialGrid(world.bounds, config.gridCell, this.caps.projectiles);
    this.enemyShotGrid = new SpatialGrid(world.bounds, config.gridCell, this.caps.enemyProjectiles);
    this.noteGrid = new SpatialGrid(world.bounds, config.gridCell, this.caps.notes);
    this.spawnRng = rng(this.seed);
    this.cardRng = rng((this.seed ^ 0x9e3779b9) >>> 0);
    this.weaponRng = rng((this.seed ^ 0x7f4a7c15) >>> 0);
    this.baseShip = opts.ship ?? DEFAULT_SHIP_CONFIG;
    this.shipCfg = survivorsShipConfig(this.baseShip, config.handling, 0);
    if (!config.weapons[config.startingWeapon]) {
      throw new Error(`survivors: no weapon ${config.startingWeapon}`);
    }
    // Hitos del guion: élites (desde cuándo) y Mareas (cuáles). Sin hito de
    // élites el guion no las echa, pero la definición sigue valiendo para
    // las puestas a mano (`spawnEnemy(…, true)`).
    const events = (config.acts[0]?.events ?? []).filter((ev) => ev.enabled !== false);
    let elitesFrom = Infinity;
    let elitesDef: ElitesDef | null = Object.values(config.elites)[0] ?? null;
    for (const ev of events) {
      const def = ev.type === 'elites' ? config.elites[ev.ref] : undefined;
      if (def && ev.atS < elitesFrom) {
        elitesFrom = ev.atS;
        elitesDef = def;
      }
    }
    this.elitesFromS = elitesFrom;
    this.elitesDef = elitesDef;
    this.mareas = events.flatMap((ev) => {
      const def = ev.type === 'marea' ? config.marea[ev.ref] : undefined;
      return def ? [{ ev, def }] : [];
    });
    this.mareaNext = this.mareas.map((m) => m.ev.atS);
    let maxR = 0;
    let maxShot = 0;
    for (const def of Object.values(config.enemies)) {
      if (!def) continue;
      if (def.radius > maxR) maxR = def.radius;
      if (def.shooter && def.shooter.projectile.radius > maxShot) maxShot = def.shooter.projectile.radius;
    }
    this.maxEnemyRadius = maxR * Math.max(1, elitesDef?.radiusScale ?? 1);
    this.maxShotRadius = maxShot;
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
      movement: this.movement.snapshot(),
      player: Object.assign(this.player, { radius: this.shipCfg.radius, invulnerableS: 0 }),
      enemies: this.enemies,
      enemiesByType: this.byType,
      projectiles: this.projectiles,
      enemyProjectiles: this.enemyShots,
      telegraphs: this.telegraphs,
      weapons: this.weaponViews,
      auras: this.auras,
      beams: this.beams,
      orbitals: this.orbitals,
      zones: this.zones,
      notes: this.notes,
      elitesActive: false,
      mareaActive: false,
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
    this.addWeapon(config.startingWeapon);

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
    v.movement = this.movement.snapshot();
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
    v.elitesActive = this.activeS >= this.elitesFromS;
    v.mareaActive = this.mareaActive();
    for (const list of Object.values(this.byType)) if (list) list.length = 0;
    this.telegraphs.length = 0;
    for (const e of this.enemies) {
      this.byType[e.type]?.push(e);
      if (e.phase === 'telegraph' && e.def.charger) {
        const ch = e.def.charger;
        this.telegraphs.push({
          id: e.id,
          type: e.type,
          x: e.x,
          y: e.y,
          heading: Math.atan2(e.chargeY, e.chargeX),
          length: ch.chargeDistance,
          progress: Math.min(1, Math.max(0, 1 - e.timer / ch.telegraphS)),
        });
      }
    }
    this.weaponViews.length = 0;
    this.auras.length = 0;
    this.beams.length = 0;
    this.orbitals.length = 0;
    const p = this.player;
    for (const w of this.weapons) {
      const st = w.stats;
      this.weaponViews.push({
        id: w.def.id,
        kind: w.def.kind,
        level: w.level,
        maxLevel: w.def.maxLevel,
        stats: st,
        cooldownS: Math.max(0, w.cooldown),
      });
      const progress = st.tickS > 0 ? Math.min(1, Math.max(0, 1 - w.tick / st.tickS)) : 0;
      switch (w.def.kind) {
        case 'aura':
          this.auras.push({ weapon: w.def.id, x: p.x, y: p.y, radius: st.area, progress });
          break;
        case 'beam':
          for (let k = 0; k < st.count; k++) {
            this.beams.push({
              weapon: w.def.id,
              x: p.x,
              y: p.y,
              angle: beamAngle(w.angle, k, st.count),
              length: st.range,
              halfWidth: st.area,
            });
          }
          break;
        case 'orbit':
          for (let k = 0; k < st.count; k++) {
            const a = beamAngle(w.angle, k, st.count);
            this.orbitals.push({
              weapon: w.def.id,
              index: k,
              x: wrapInto(p.x + Math.cos(a) * st.range, this.bounds.left, this.bounds.right),
              y: wrapInto(p.y + Math.sin(a) * st.range, this.bounds.top, this.bounds.bottom),
              radius: st.area,
              angle: a,
            });
          }
          break;
        default:
          break;
      }
    }
    for (const z of this.zones) {
      z.lifeS = Math.max(0, z.life);
      z.progress = Math.min(1, Math.max(0, 1 - z.tick / z.tickS));
    }
    return v;
  }

  // --- Armas: lectura y mando (determinista: no gastan azar) ------------------

  /** Las armas que lleva el barco, en orden; cada una con su nivel. */
  get heldWeapons(): readonly { id: WeaponId; level: number }[] {
    return this.weapons.map((w) => ({ id: w.def.id, level: w.level }));
  }

  /** Nivel del arma (0 si no la lleva). */
  weaponLevel(id: WeaponId): number {
    return this.weapons.find((w) => w.def.id === id)?.level ?? 0;
  }

  /**
   * Coge un arma nueva a nivel `level` (1…`maxLevel`). false si ya la lleva
   * o no existe en la config. El tope de huecos lo pone quien ofrece las
   * cartas (T129): aquí sólo se guarda.
   */
  addWeapon(id: WeaponId, level = 1): boolean {
    const def = this.config.weapons[id];
    if (!def || this.weapons.some((w) => w.def.id === id)) return false;
    const slot: WeaponSlot = {
      def,
      level: Math.min(def.maxLevel, Math.max(1, Math.floor(level))),
      stats: resolveWeaponStats(def, 1, this.stats),
      cooldown: 0,
      tick: 0,
      angle: 0,
    };
    slot.stats = resolveWeaponStats(def, slot.level, this.stats);
    this.weapons.push(slot);
    return true;
  }

  /** Sube un nivel el arma (hasta `maxLevel`). false si no la lleva o ya está al máximo. */
  levelUpWeapon(id: WeaponId): boolean {
    const w = this.weapons.find((x) => x.def.id === id);
    if (!w || w.level >= w.def.maxLevel) return false;
    w.level++;
    w.stats = resolveWeaponStats(w.def, w.level, this.stats);
    return true;
  }

  /** Rehace los números de todas las armas (tras una mejora o un vinilo). */
  private refreshWeapons(): void {
    for (const w of this.weapons) w.stats = resolveWeaponStats(w.def, w.level, this.stats);
  }

  private mareaActive(): boolean {
    const t = this.activeS;
    return this.mareas.some(({ ev }) => t >= ev.atS && t < ev.atS + (ev.durationS ?? 0));
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
      movement: this.movement.state(),
      w: this.water,
      inv: this.invulnerable,
      lv: [this.level, this.xp, this.pendingLevels],
      wp: this.weapons.map((w) => [w.def.id, w.level, w.cooldown, w.tick, w.angle]),
      z: this.zones.map((z) => [z.id, z.x, z.y, z.life, z.tick]),
      of: this.overflow,
      acc: this.trackAcc,
      mn: this.mareaNext,
      up: this.stacks,
      card: this.card?.options.map((o) => o.upgrade) ?? null,
      e: this.enemies.map((e) => [
        e.id,
        e.type,
        e.x,
        e.y,
        e.vx,
        e.vy,
        e.hp,
        e.elite ? 1 : 0,
        e.generation,
        e.phase,
        e.timer,
        e.chargeLeft,
      ]),
      b: this.projectiles.map((b) => [b.id, b.x, b.y, b.life, b.target]),
      s: this.enemyShots.map((b) => [b.id, b.x, b.y, b.life]),
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
  spawnEnemy(type: EnemyId, x: number, y: number, elite = false): EnemyView | null {
    const def = this.config.enemies[type];
    if (!def || this.enemies.length >= this.caps.enemies) return null;
    const spot = this.islands.toWater(x, y, def.radius);
    if (!spot) return null;
    const e = this.makeEnemy(def, spot.x, spot.y, def.hp, def.speed, elite);
    this.enemies.push(e);
    this.rebuildEnemyGrid();
    return e;
  }

  /** Un enemigo nuevo en (x, y) con ese aguante y velocidad (élite: se le aplica lo suyo). */
  private makeEnemy(
    def: EnemyDef,
    x: number,
    y: number,
    hp: number,
    speed: number,
    elite: boolean,
  ): Enemy {
    const el = elite && this.elitesDef ? this.elitesDef : null;
    const finalHp = hp * (el?.hpScale ?? 1);
    const e: Enemy = {
      id: this.nextId++,
      type: def.id,
      def,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      heading: 0,
      hp: finalHp,
      maxHp: finalHp,
      radius: def.radius * (el?.radiusScale ?? 1),
      speed: speed * (el?.speedScale ?? 1),
      elite: el !== null,
      scale: el?.radiusScale ?? 1,
      noteValue: def.noteValue * (el?.noteScale ?? 1),
      generation: 0,
      phase: 'move',
      timer: 0,
      chargeX: 1,
      chargeY: 0,
      chargeLeft: 0,
      dead: false,
    };
    this.setWrapped(e, x, y);
    const p = this.player;
    e.heading = Math.atan2(wd(p.y - e.y, this.h), wd(p.x - e.x, this.w));
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

    this.stepPlayer(input.ship ?? IDLE_INPUT, dt, input.turbo === true);
    this.spawnFromScript(dt);
    this.stepEnemies(dt);
    this.contactDamage(dt);
    this.stepEnemyShots(dt);
    this.stepWeapons(dt);
    this.stepProjectiles(dt);
    this.stepZones(dt);
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

  private stepPlayer(input: ShipInput, dt: number, turbo: boolean): void {
    const p = this.player;
    this.events.push(...this.movement.step(p, input, turbo, this.shipCfg, dt));
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
    // «Marea»: durante el hito, un anillo entero cada `burstEveryS` s.
    this.mareas.forEach(({ ev, def }, i) => {
      const end = ev.atS + (ev.durationS ?? 0);
      if (t < ev.atS || t >= end) return;
      while (this.mareaNext[i]! <= t + 1e-9 && this.mareaNext[i]! < end) {
        this.spawnRing(def.enemy, def.count, def.hpScale, def.speedScale);
        this.mareaNext[i] = this.mareaNext[i]! + def.burstEveryS;
      }
    });
    if (this.enemies.length < this.caps.enemies * 0.8 && this.overflow > 0) {
      this.overflow = Math.max(0, this.overflow - 0.01 * dt);
    }
  }

  /** Un punto del anillo de aparición en el ángulo `a` (null si cae en tierra). */
  private ringSpot(a: number, radius: number): { x: number; y: number } | null {
    const sp = this.config.spawn;
    const p = this.player;
    const r = sp.ringMin + (sp.ringMax - sp.ringMin) * this.spawnRng();
    return this.islands.toWater(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, radius);
  }

  /**
   * Un enemigo del guion en (x, y) con el crecimiento por minuto, la fuerza
   * del tope y, desde el hito `elites`, la tirada de élite. Con el tope
   * lleno no aparece y la oleada gana fuerza. Devuelve si apareció.
   */
  private placeEnemy(def: EnemyDef, x: number, y: number, hpScale: number, speedScale: number): boolean {
    const sp = this.config.spawn;
    if (this.enemies.length >= this.caps.enemies) {
      // Tope: la oleada sube de fuerza en vez de en número.
      this.overflow = Math.min(sp.overflowMax, this.overflow + sp.overflowStrength);
      return false;
    }
    const minutes = this.minutes();
    const hp = def.hp * hpScale * (1 + def.growthPerMinute.hp * minutes) * (1 + this.overflow);
    const speed = def.speed * speedScale * (1 + def.growthPerMinute.speed * minutes);
    const elite =
      this.elitesDef !== null &&
      this.activeS >= this.elitesFromS &&
      this.spawnRng() < this.elitesDef.chance;
    this.enemies.push(this.makeEnemy(def, x, y, hp, speed, elite));
    return true;
  }

  private spawnGroup(type: EnemyId, size: number, hpScale: number, speedScale: number): void {
    const def = this.config.enemies[type];
    if (!def || size <= 0) return;
    const sp = this.config.spawn;
    // El centro del grupo en el anillo, en tierra no: hasta 6 intentos.
    let cx = 0;
    let cy = 0;
    let found = false;
    for (let tries = 0; tries < 6 && !found; tries++) {
      const spot = this.ringSpot(this.spawnRng() * Math.PI * 2, def.radius);
      if (spot) {
        cx = spot.x;
        cy = spot.y;
        found = true;
      }
    }
    if (!found) return;
    for (let k = 0; k < size; k++) {
      if (this.enemies.length >= this.caps.enemies) {
        this.overflow = Math.min(sp.overflowMax, this.overflow + sp.overflowStrength);
        continue;
      }
      const jx = (this.spawnRng() * 2 - 1) * sp.groupSpread;
      const jy = (this.spawnRng() * 2 - 1) * sp.groupSpread;
      const spot = this.islands.toWater(cx + jx, cy + jy, def.radius);
      if (!spot) continue;
      this.placeEnemy(def, spot.x, spot.y, hpScale, speedScale);
    }
  }

  /** Un anillo de `count` enemigos a ángulos iguales alrededor del barco (la «Marea»). */
  private spawnRing(type: EnemyId, count: number, hpScale: number, speedScale: number): void {
    const def = this.config.enemies[type];
    if (!def || count <= 0) return;
    const phase = this.spawnRng() * Math.PI * 2;
    for (let k = 0; k < count; k++) {
      const spot = this.ringSpot(phase + (k / count) * Math.PI * 2, def.radius);
      if (!spot) continue;
      this.placeEnemy(def, spot.x, spot.y, hpScale, speedScale);
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
      // `direct`: la velocidad va fijada (quieto o embistiendo), sin inercia ni rodeos.
      let direct = false;
      switch (e.def.behavior) {
        case 'flyer': {
          // Vuela en eses: un vaivén lateral que la hace reconocible (y algo menos directa).
          const weave = Math.sin(this.activeS * 2.5 + e.id) * 0.35 * e.speed;
          wantX += -dy * weave;
          wantY += dx * weave;
          break;
        }
        case 'shooter': {
          const sh = e.def.shooter;
          if (!sh) break;
          if (e.phase === 'aim' && dist > sh.resume) e.phase = 'move';
          else if (e.phase !== 'aim' && dist <= sh.standoff) {
            e.phase = 'aim';
            e.timer = sh.firstShotS;
          }
          if (e.phase === 'aim') {
            wantX = 0;
            wantY = 0;
            e.timer -= dt;
            if (e.timer <= 0) {
              if (dist <= sh.range && this.fireShot(e, dx, dy)) e.timer += sh.cooldownS;
              else e.timer = 0;
            }
          }
          break;
        }
        case 'charger': {
          const ch = e.def.charger;
          if (!ch) break;
          if (e.phase === 'move' && dist <= ch.windupRange) {
            e.phase = 'telegraph';
            e.timer = ch.telegraphS;
            e.chargeX = dx;
            e.chargeY = dy;
            this.events.push({
              type: 'telegraph',
              enemy: e.type,
              id: e.id,
              x: e.x,
              y: e.y,
              heading: Math.atan2(dy, dx),
              length: ch.chargeDistance,
            });
          }
          if (e.phase === 'telegraph') {
            direct = true;
            e.vx = 0;
            e.vy = 0;
            e.heading = Math.atan2(e.chargeY, e.chargeX);
            e.timer -= dt;
            if (e.timer <= 0) {
              e.phase = 'charge';
              e.chargeLeft = ch.chargeDistance;
            }
          } else if (e.phase === 'charge') {
            direct = true;
            e.vx = e.chargeX * ch.chargeSpeed;
            e.vy = e.chargeY * ch.chargeSpeed;
            e.chargeLeft -= ch.chargeSpeed * dt;
            if (e.chargeLeft <= 0) {
              e.phase = 'rest';
              e.timer = ch.restS;
            }
          } else if (e.phase === 'rest') {
            wantX *= 0.3;
            wantY *= 0.3;
            e.timer -= dt;
            if (e.timer <= 0) e.phase = 'move';
          }
          break;
        }
        default:
          break;
      }
      if (direct) {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        const touching = !e.def.ignoresIslands && this.slideOffIslands(e, e.radius);
        e.x = wrapInto(e.x, this.bounds.left, this.bounds.right);
        e.y = wrapInto(e.y, this.bounds.top, this.bounds.bottom);
        if (touching && e.phase === 'charge') {
          // La embestida choca con una isla: se acaba ahí.
          e.phase = 'rest';
          e.timer = e.def.charger?.restS ?? 0;
          e.vx = 0;
          e.vy = 0;
        }
        if (touching && isl.onLand(e.x, e.y) && !this.recycle(e)) e.dead = true;
        continue;
      }
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
      this.damagePlayer(e.def.contactWater, e.type, e.x, e.y);
      return;
    }
  }

  /** Mete `amount` de agua a bordo (menos el casco) y da la invulnerabilidad del golpe. */
  private damagePlayer(amount: number, by: EnemyId, x: number, y: number): void {
    const water = amount * Math.max(0, 1 - this.stats.hullBonus);
    this.water = Math.min(this.config.player.waterCapacity, this.water + water);
    this.invulnerable = this.config.player.invulnerableS;
    this.events.push({ type: 'hit', enemy: by, x, y, water: this.water });
  }

  // --- Disparos enemigos -----------------------------------------------------

  /** El tirador `e` dispara recto hacia (dx, dy) (unitario). false si el tope no deja. */
  private fireShot(e: Enemy, dx: number, dy: number): boolean {
    const sh = e.def.shooter;
    if (!sh || this.enemyShots.length >= this.caps.enemyProjectiles) return false;
    const pr = sh.projectile;
    const start = e.radius + pr.radius + 1;
    this.enemyShots.push({
      id: this.nextId++,
      enemy: e.type,
      x: wrapInto(e.x + dx * start, this.bounds.left, this.bounds.right),
      y: wrapInto(e.y + dy * start, this.bounds.top, this.bounds.bottom),
      vx: dx * pr.speed,
      vy: dy * pr.speed,
      radius: pr.radius,
      life: pr.range / pr.speed,
      water: pr.water,
      dead: false,
    });
    e.heading = Math.atan2(dy, dx);
    this.events.push({ type: 'enemyFire', enemy: e.type, id: e.id, x: e.x, y: e.y });
    return true;
  }

  /**
   * Los disparos enemigos avanzan recto: las islas los paran (como a las
   * bolas del jugador) y el barco los recibe (un golpe, con su
   * invulnerabilidad; invulnerable, el disparo se deshace sin daño).
   */
  private stepEnemyShots(dt: number): void {
    const p = this.player;
    const pr = this.shipCfg.radius;
    for (const b of this.enemyShots) {
      const sx = b.vx * dt;
      const sy = b.vy * dt;
      const ss = sx * sx + sy * sy;
      const blockT = this.islandBlock(b, sx, sy, ss);
      if (blockT !== Infinity) {
        b.dead = true;
        this.events.push({
          type: 'blocked',
          owner: 'enemy',
          x: wrapInto(b.x + sx * blockT, this.bounds.left, this.bounds.right),
          y: wrapInto(b.y + sy * blockT, this.bounds.top, this.bounds.bottom),
        });
        continue;
      }
      const t = segmentHit(wd(b.x - p.x, this.w), wd(b.y - p.y, this.h), sx, sy, ss, pr + b.radius);
      if (t !== Infinity) {
        b.dead = true;
        if (this.invulnerable <= 0) this.damagePlayer(b.water, b.enemy, b.x, b.y);
        continue;
      }
      b.x = wrapInto(b.x + sx, this.bounds.left, this.bounds.right);
      b.y = wrapInto(b.y + sy, this.bounds.top, this.bounds.bottom);
      b.life -= dt;
      if (b.life <= 0) b.dead = true;
    }
    let n = 0;
    for (const b of this.enemyShots) if (!b.dead) this.enemyShots[n++] = b;
    this.enemyShots.length = n;
    const g = this.enemyShotGrid;
    g.clear();
    this.enemyShots.forEach((b, i) => g.insert(i, b.x, b.y));
  }

  /** Disparos enemigos a menos de `r` u del punto (por la rejilla). Para la pantalla y las pruebas. */
  enemyShotsNear(x: number, y: number, r: number): readonly ProjectileView[] {
    const out: ProjectileView[] = [];
    for (const i of this.enemyShotGrid.query(x, y, r + this.maxShotRadius, this.scratch)) {
      const b = this.enemyShots[i]!;
      const dx = wd(b.x - x, this.w);
      const dy = wd(b.y - y, this.h);
      const min = r + b.radius;
      if (dx * dx + dy * dy <= min * min) out.push(b);
    }
    return out;
  }

  /**
   * Primer instante (0…1) del tramo de este paso de un proyectil recto en
   * que toca una isla; Infinity si ninguna.
   */
  private islandBlock(b: { x: number; y: number; radius: number }, sx: number, sy: number, ss: number): number {
    const isl = this.islands;
    const len = Math.sqrt(ss);
    let blockT = Infinity;
    const near = isl.near(b.x + sx / 2, b.y + sy / 2, len / 2 + b.radius, this.scratch);
    for (const k of near) {
      const o = isl.obstacles[k]!;
      const t = segmentHit(wd(b.x - o.x, this.w), wd(b.y - o.y, this.h), sx, sy, ss, o.radius + b.radius);
      if (t < blockT) blockT = t;
    }
    return blockT;
  }

  private compactEnemies(): void {
    let n = 0;
    for (const e of this.enemies) if (!e.dead) this.enemies[n++] = e;
    this.enemies.length = n;
  }

  // --- Armas -----------------------------------------------------------------

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

  /** Los enemigos vivos a menos de `range` del barco (por la rejilla), en `out`. */
  private enemiesInRange(range: number, out: Enemy[]): Enemy[] {
    out.length = 0;
    const p = this.player;
    const near = this.enemyGrid.query(p.x, p.y, range + this.maxEnemyRadius, this.scratch);
    for (const i of near) {
      const e = this.enemies[i]!;
      if (e.dead) continue;
      const dx = wd(e.x - p.x, this.w);
      const dy = wd(e.y - p.y, this.h);
      if (dx * dx + dy * dy <= range * range) out.push(e);
    }
    return out;
  }

  /** Hiere a `e`; si cae, lo derrota. */
  private hurt(e: Enemy, damage: number): void {
    if (e.dead) return;
    e.hp -= damage;
    if (e.hp <= 0) this.defeat(e);
  }

  /** Hiere a todo lo vivo que toca el círculo (x, y, r). Devuelve cuántos. */
  private hurtCircle(x: number, y: number, r: number, damage: number): number {
    const near = this.enemyGrid.query(x, y, r + this.maxEnemyRadius, this.scratch);
    let n = 0;
    for (const i of near) {
      const e = this.enemies[i]!;
      if (e.dead) continue;
      const dx = wd(e.x - x, this.w);
      const dy = wd(e.y - y, this.h);
      const min = r + e.radius;
      if (dx * dx + dy * dy > min * min) continue;
      this.hurt(e, damage);
      n++;
    }
    return n;
  }

  /**
   * Cada arma ataca según su forma. Las que disparan (`cooldownS`) esperan
   * su turno y, sin blanco a tiro, quedan listas para el primero que entre;
   * las que golpean por tic (`tickS`) lo hacen a todo lo que toca su forma.
   */
  private stepWeapons(dt: number): void {
    for (const w of this.weapons) {
      const st = w.stats;
      switch (w.def.kind) {
        case 'projectile':
          if (this.ready(w, dt)) this.fireAtNearest(w);
          break;
        case 'cone':
          if (this.ready(w, dt)) this.fireCone(w);
          break;
        case 'rocket':
          if (this.ready(w, dt)) this.fireRockets(w);
          break;
        case 'zone':
          if (this.ready(w, dt)) this.castZones(w);
          break;
        case 'aura':
          if (this.ticks(w, dt)) this.hurtCircle(this.player.x, this.player.y, st.area, st.damage);
          break;
        case 'beam':
          w.angle = wrapAngle(w.angle + st.speed * dt);
          if (this.ticks(w, dt)) this.hurtBeams(w);
          break;
        case 'orbit':
          w.angle = wrapAngle(w.angle + st.speed * dt);
          if (this.ticks(w, dt)) this.hurtOrbitals(w);
          break;
        default:
          break;
      }
    }
  }

  /** Baja el reloj de disparo; true cuando toca disparar (el que dispara lo rearma). */
  private ready(w: WeaponSlot, dt: number): boolean {
    w.cooldown -= dt;
    return w.cooldown <= 0;
  }

  /** Baja el reloj de tic; true (y rearmado) cuando toca golpear. */
  private ticks(w: WeaponSlot, dt: number): boolean {
    w.tick -= dt;
    if (w.tick > 0) return false;
    w.tick += w.stats.tickS;
    if (w.tick <= 0) w.tick = w.stats.tickS;
    return true;
  }

  /** Un proyectil del arma `w` desde el barco con rumbo `a`. false si el tope no deja. */
  private shoot(w: WeaponSlot, a: number, target = -1): boolean {
    if (this.projectiles.length >= this.caps.projectiles) return false;
    const st = w.stats;
    const p = this.player;
    const rocket = w.def.kind === 'rocket';
    this.projectiles.push({
      id: this.nextId++,
      weapon: w.def.id,
      kind: w.def.kind,
      x: p.x,
      y: p.y,
      vx: Math.cos(a) * st.speed,
      vy: Math.sin(a) * st.speed,
      radius: rocket ? ROCKET_RADIUS : st.area,
      life: (st.range / st.speed) * 1.2,
      damage: st.damage,
      pierce: st.pierce,
      blocked: w.def.blockedByIslands,
      target,
      burst: rocket ? st.area : 0,
      speed: st.speed,
      lastHit: -1,
      dead: false,
    });
    return true;
  }

  /** Cañón de agua: `count` bolas en abanico al enemigo más cercano a tiro. */
  private fireAtNearest(w: WeaponSlot): void {
    const st = w.stats;
    const target = this.nearestEnemy(st.range);
    if (!target) {
      w.cooldown = 0;
      return;
    }
    const p = this.player;
    const aim = Math.atan2(wd(target.y - p.y, this.h), wd(target.x - p.x, this.w));
    this.burst(w, aim);
  }

  /** Cañón de confeti: `count` confetis en abanico hacia donde navega el barco, si hay algo a tiro. */
  private fireCone(w: WeaponSlot): void {
    if (!this.nearestEnemy(w.stats.range)) {
      w.cooldown = 0;
      return;
    }
    this.burst(w, this.player.heading);
  }

  /** Una ráfaga de `count` proyectiles centrada en `aim`, separados `spreadRad`. */
  private burst(w: WeaponSlot, aim: number): void {
    const st = w.stats;
    let fired = 0;
    for (let k = 0; k < st.count; k++) {
      if (!this.shoot(w, aim + (k - (st.count - 1) / 2) * st.spreadRad)) break;
      fired++;
    }
    w.cooldown += st.cooldownS;
    this.fired(w, fired);
  }

  /** Avisa de que el arma `w` ha disparado `count` cosas desde el barco. */
  private fired(w: WeaponSlot, count: number): void {
    if (count <= 0) return;
    const p = this.player;
    this.events.push({ type: 'fire', weapon: w.def.id, x: p.x, y: p.y, count });
  }

  /** Fuegos artificiales: `count` cohetes, cada uno a un enemigo al azar a tiro (pueden repetir). */
  private fireRockets(w: WeaponSlot): void {
    const st = w.stats;
    const pool = this.enemiesInRange(st.range, this.scratchEnemies);
    if (pool.length === 0) {
      w.cooldown = 0;
      return;
    }
    const p = this.player;
    let fired = 0;
    for (let k = 0; k < st.count; k++) {
      const e = pool[Math.floor(this.weaponRng() * pool.length)]!;
      const a = Math.atan2(wd(e.y - p.y, this.h), wd(e.x - p.x, this.w));
      if (!this.shoot(w, a, e.id)) break;
      fired++;
    }
    w.cooldown += st.cooldownS;
    this.fired(w, fired);
  }

  /**
   * Lluvia ácida: `count` nubes, cada una sobre el enemigo a tiro con más
   * vecinos debajo de la nube (empate: el de id menor); ninguna sin blanco.
   */
  private castZones(w: WeaponSlot): void {
    const st = w.stats;
    const pool = this.enemiesInRange(st.range, this.scratchEnemies);
    if (pool.length === 0) {
      w.cooldown = 0;
      return;
    }
    let made = 0;
    for (let k = 0; k < st.count && this.zones.length < this.caps.areas; k++) {
      let best: Enemy | null = null;
      let bestN = -1;
      for (const e of pool) {
        if (e.dead) continue;
        let n = 0;
        const under = this.enemyGrid.query(e.x, e.y, st.area + this.maxEnemyRadius, this.scratch);
        for (const j of under) {
          const o = this.enemies[j]!;
          if (o.dead) continue;
          const dx = wd(o.x - e.x, this.w);
          const dy = wd(o.y - e.y, this.h);
          if (dx * dx + dy * dy <= st.area * st.area) n++;
        }
        // Una nube ya puesta encima no cuenta: la siguiente va a otro grupo.
        for (const z of this.zones) {
          const dx = wd(z.x - e.x, this.w);
          const dy = wd(z.y - e.y, this.h);
          if (dx * dx + dy * dy <= z.radius * z.radius) n = -1;
        }
        if (n > bestN || (n === bestN && best && e.id < best.id)) {
          best = e;
          bestN = n;
        }
      }
      if (!best || bestN < 0) break;
      this.zones.push({
        id: this.nextId++,
        weapon: w.def.id,
        x: best.x,
        y: best.y,
        radius: st.area,
        damage: st.damage,
        tickS: st.tickS,
        tick: 0,
        life: st.durationS,
        durationS: st.durationS,
        lifeS: st.durationS,
        progress: 0,
        dead: false,
      });
      this.events.push({ type: 'fire', weapon: w.def.id, x: best.x, y: best.y, count: 1 });
      made++;
    }
    w.cooldown += made > 0 ? st.cooldownS : 0;
  }

  /** Láser: cada rayo hiere a lo que toca el segmento desde el barco (medio ancho `area`, largo `range`). */
  private hurtBeams(w: WeaponSlot): void {
    const st = w.stats;
    const p = this.player;
    for (let k = 0; k < st.count; k++) {
      const a = beamAngle(w.angle, k, st.count);
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      const near = this.enemyGrid.query(
        p.x + (ux * st.range) / 2,
        p.y + (uy * st.range) / 2,
        st.range / 2 + st.area + this.maxEnemyRadius,
        this.scratch,
      );
      for (const i of near) {
        const e = this.enemies[i]!;
        if (e.dead) continue;
        const dx = wd(e.x - p.x, this.w);
        const dy = wd(e.y - p.y, this.h);
        const along = dx * ux + dy * uy;
        if (along < -e.radius || along > st.range + e.radius) continue;
        const across = Math.abs(-dx * uy + dy * ux);
        if (across > st.area + e.radius) continue;
        this.hurt(e, st.damage);
      }
    }
  }

  /** Boyas orbitales: cada boya hiere a lo que toca. */
  private hurtOrbitals(w: WeaponSlot): void {
    const st = w.stats;
    const p = this.player;
    for (let k = 0; k < st.count; k++) {
      const a = beamAngle(w.angle, k, st.count);
      const bx = p.x + Math.cos(a) * st.range;
      const by = p.y + Math.sin(a) * st.range;
      this.hurtCircle(bx, by, st.area, st.damage);
    }
  }

  /** Las nubes: cada tic hieren a lo que tienen debajo; se deshacen al acabar. */
  private stepZones(dt: number): void {
    for (const z of this.zones) {
      z.tick -= dt;
      if (z.tick <= 0) {
        z.tick += z.tickS;
        this.hurtCircle(z.x, z.y, z.radius, z.damage);
      }
      z.life -= dt;
      if (z.life <= 0) z.dead = true;
    }
    let n = 0;
    for (const z of this.zones) if (!z.dead) this.zones[n++] = z;
    this.zones.length = n;
  }

  /** Un cohete explota en (x, y): hiere a todo en su radio. */
  private explode(b: Projectile): void {
    b.dead = true;
    this.hurtCircle(b.x, b.y, b.burst, b.damage);
    this.events.push({ type: 'explode', weapon: b.weapon, x: b.x, y: b.y, radius: b.burst });
  }

  private enemyById(id: number): Enemy | null {
    if (id < 0) return null;
    for (const e of this.enemies) if (e.id === id) return e.dead ? null : e;
    return null;
  }

  /**
   * Bolas, confetis y cohetes avanzan recto. Las formas rectas (`blocked`)
   * las paran las islas y hieren al primero que tocan (atravesando `pierce`);
   * los cohetes siguen a su blanco por encima de todo y explotan al llegar
   * (o donde estén si el blanco cayó o se les acaba la mecha).
   */
  private stepProjectiles(dt: number): void {
    for (const b of this.projectiles) {
      if (b.kind === 'rocket') {
        const target = this.enemyById(b.target);
        if (!target) {
          this.explode(b);
          continue;
        }
        const dx = wd(target.x - b.x, this.w);
        const dy = wd(target.y - b.y, this.h);
        const d = Math.hypot(dx, dy);
        if (d <= target.radius + b.radius + b.speed * dt) {
          this.setWrapped(b, target.x, target.y);
          this.explode(b);
          continue;
        }
        b.vx = (dx / d) * b.speed;
        b.vy = (dy / d) * b.speed;
        b.x = wrapInto(b.x + b.vx * dt, this.bounds.left, this.bounds.right);
        b.y = wrapInto(b.y + b.vy * dt, this.bounds.top, this.bounds.bottom);
        b.life -= dt;
        if (b.life <= 0) this.explode(b);
        continue;
      }
      const sx = b.vx * dt;
      const sy = b.vy * dt;
      const len = Math.hypot(sx, sy);
      const ss = sx * sx + sy * sy;
      // Islas: el tramo de este paso contra cada isla cercana.
      if (b.blocked) {
        const blockT = this.islandBlock(b, sx, sy, ss);
        if (blockT !== Infinity) {
          b.dead = true;
          this.events.push({
            type: 'blocked',
            owner: 'player',
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
        b.lastHit = hit.id;
        this.hurt(hit, b.damage);
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
    this.events.push({ type: 'defeated', enemy: e.type, id: e.id, x: e.x, y: e.y, elite: e.elite });
    this.dropNote(e.x, e.y, e.noteValue);
    const split = e.def.split;
    if (!split || e.generation >= split.generations) return;
    // Divisor: los trozos salen a los lados, más pequeños, con parte del aguante y de la nota.
    let made = 0;
    for (let k = 0; k < split.count; k++) {
      if (this.enemies.length >= this.caps.enemies) {
        this.overflow = Math.min(this.config.spawn.overflowMax, this.overflow + this.config.spawn.overflowStrength);
        continue;
      }
      const a = e.heading + Math.PI / 2 + (k / split.count) * Math.PI * 2;
      const r = e.radius * (1 + split.scale);
      const spot = this.islands.toWater(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, e.radius * split.scale);
      if (!spot) continue;
      const child = this.makeEnemy(e.def, spot.x, spot.y, e.maxHp * split.hpScale, e.speed, false);
      child.radius = e.def.radius * split.scale;
      child.scale = split.scale;
      child.noteValue = e.def.noteValue * split.noteScale;
      child.generation = e.generation + 1;
      child.vx = Math.cos(a) * e.speed;
      child.vy = Math.sin(a) * e.speed;
      // Lo que ya se iteró en este paso no vuelve a tocarse: la rejilla se rehace al siguiente.
      this.enemies.push(child);
      made++;
    }
    if (made > 0) this.events.push({ type: 'split', enemy: e.type, id: e.id, x: e.x, y: e.y, count: made });
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
    this.refreshWeapons();
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

/** Rumbo del rayo o boya `k` de `count`, repartidos a ángulos iguales desde `base`. */
function beamAngle(base: number, k: number, count: number): number {
  return base + (k / Math.max(1, count)) * Math.PI * 2;
}

/** Ángulo llevado a [0, 2π) para que el giro no crezca sin fin. */
function wrapAngle(a: number): number {
  const two = Math.PI * 2;
  return ((a % two) + two) % two;
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
