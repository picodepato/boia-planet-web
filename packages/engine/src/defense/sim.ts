import { configHash, rng as makeRng } from '../minigames/rng';
import {
  DEFAULT_DEFENSE_RUN_MIN,
  DEFENSE_STEP_S,
  type DefenseConfig,
  type DefenseEnemyDef,
  type DefenseEnemyKind,
  type DefenseRunMin,
  type DefenseTowerKind,
  type DifficultyId,
  defenseEnemyDef,
  defenseEnemyRadius,
} from './config';
import { type DefenseMedal, defenseMedal, defenseScore } from './medals';
import { type DefensePath, type PathSample, buildDefensePath } from './path';
import {
  DEFENSE_TOWER_HOOKS,
  type DefenseEnemyView,
  type DefenseSource,
  type DefenseTowerContext,
  type DefenseTowerHooks,
  type DefenseTowerState,
} from './towers';
import { type DefenseSpawn, defenseSchedule } from './waves';

/**
 * La partida de «Defensa del Castillo» (plan 014 T158), sin DOM y
 * determinista: misma configuración, semilla y entradas, misma partida.
 * Paso fijo de `DEFENSE_STEP_S`, como el Cañón.
 *
 * - Los enemigos salen del vórtice según `defenseSchedule` y avanzan por el
 *   camino a su velocidad, cada uno en su carril; al llegar a la muralla le
 *   quitan vida al castillo y desaparecen.
 * - El avión vuela libre dentro de la arena y dispara solo al enemigo más
 *   cercano a su alcance; su daño sube a nivel 2 y 3 con monedas.
 * - Cada enemigo que cae da sus monedas (al monedero de la partida, nunca al
 *   del mundo) y sus puntos.
 * - Las torres (islas construidas) se enganchan por `DEFENSE_TOWER_HOOKS`
 *   (T159); sin ninguna, la partida corre igual.
 * - Castillo a 0: cae (`fallen`). Llegar a la duración elegida: aguantó
 *   (`held`). Una pausa seguida de más de `maxPauseS`: abandono. «Terminar
 *   partida»: `quit`.
 */

/** Cómo acaba: aguantó, cayó el castillo, abandono por pausa larga, o «Terminar partida». */
export type DefenseEndReason = 'held' | 'fallen' | 'abandoned' | 'quit';
export type DefenseStatus = 'running' | 'paused' | 'ended';

export interface DefenseInput {
  /** Hacia dónde vuela el avión (−1…1 en cada eje; más largo que 1 se acorta). Sin valor, frena. */
  move?: { x: number; y: number };
  /** true: pausa manual; false: seguir. Sin valor, no cambia. */
  pause?: boolean;
  /** Comprar el siguiente nivel de daño del avión (si llega el dinero). */
  upgradePlane?: boolean;
}

export interface DefenseOptions {
  /** Duración elegida (min). Sin valor, 5. */
  runMin?: DefenseRunMin;
  /** Sin valor, `normal`. */
  difficulty?: DifficultyId;
  /**
   * Atajo de desarrollo: empezar en el segundo `t` (lo que salió antes no
   * sale y sus monedas van al monedero). La partida no entra en el ranking.
   */
  startAtS?: number;
  /** Otra entrada por atajo de desarrollo: no entra en el ranking. */
  unranked?: boolean;
  /** Lo que hace cada tipo de torre. Sin valor, `DEFENSE_TOWER_HOOKS` (T159). */
  towerHooks?: Partial<Record<DefenseTowerKind, DefenseTowerHooks>>;
}

export type DefenseEvent =
  | { type: 'spawn'; id: number; kind: DefenseEnemyKind; boss: boolean }
  | {
      type: 'kill';
      id: number;
      kind: DefenseEnemyKind;
      boss: boolean;
      x: number;
      y: number;
      coins: number;
      points: number;
      source: DefenseSource;
      towerId: number | null;
    }
  | { type: 'castleHit'; id: number; kind: DefenseEnemyKind; damage: number; life: number }
  | { type: 'planeShot'; shotId: number; targetId: number }
  | { type: 'planeUpgrade'; level: number; cost: number }
  | { type: 'coins'; amount: number; towerId: number | null }
  | { type: 'end'; reason: DefenseEndReason };

/** Una bala del avión. */
export interface DefenseShotView {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly radius: number;
  readonly damage: number;
}

export interface DefensePlaneView {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  /** rad: hacia dónde mira (el de la última vez que se movió). */
  readonly heading: number;
  /** Nivel de daño 1…3. */
  readonly level: number;
  readonly damage: number;
  readonly range: number;
  /** Lo que cuesta el siguiente nivel (null en el 3). */
  readonly nextUpgradeCost: number | null;
  /** u: el anillo donde se construye (T159). */
  readonly buildRing: number;
}

export interface DefenseSnapshot {
  readonly status: DefenseStatus;
  readonly runMin: DefenseRunMin;
  readonly difficulty: DifficultyId;
  readonly durationS: number;
  readonly activeS: number;
  readonly timeLeftS: number;
  readonly pauseRunS: number;
  readonly castle: { readonly life: number; readonly maxLife: number; readonly radius: number };
  readonly plane: DefensePlaneView;
  /** Los vivos, en orden de salida. */
  readonly enemies: readonly DefenseEnemyView[];
  readonly shots: readonly DefenseShotView[];
  readonly towers: readonly DefenseTowerState[];
  readonly coins: number;
  readonly kills: number;
  /** Puntos de lo que ha caído (sin el bono del castillo, que va al final). */
  readonly killPoints: number;
  readonly bossesDefeated: readonly DefenseEnemyKind[];
  /** Enemigos que quedan por salir del vórtice. */
  readonly pending: number;
  readonly end: DefenseEndReason | null;
}

/** El resumen de una partida acabada: para la tarjeta final y el ranking. */
export interface DefenseResult {
  readonly end: DefenseEndReason;
  /** ¿Entra en el ranking? false con «Terminar partida», abandono o un atajo de desarrollo. */
  readonly ranked: boolean;
  readonly medal: DefenseMedal | null;
  readonly score: number;
  readonly killPoints: number;
  readonly lifeBonus: number;
  readonly runMin: DefenseRunMin;
  readonly difficulty: DifficultyId;
  readonly durationS: number;
  /** s de tiempo activo jugado. */
  readonly playedS: number;
  readonly castleLife: number;
  readonly castleMaxLife: number;
  readonly kills: number;
  readonly killsByKind: Readonly<Partial<Record<DefenseEnemyKind, number>>>;
  readonly bossesDefeated: readonly DefenseEnemyKind[];
  /** Monedas ganadas en la partida (caídas y granja; sin el monedero inicial). */
  readonly coinsEarned: number;
  readonly planeLevel: number;
  readonly towersBuilt: number;
  readonly configVersion: number;
}

interface Enemy {
  id: number;
  kind: DefenseEnemyKind;
  def: DefenseEnemyDef;
  tier: DefenseEnemyDef['tier'];
  boss: boolean;
  x: number;
  y: number;
  heading: number;
  distance: number;
  progress: number;
  laneOffset: number;
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  stunS: number;
  ageS: number;
  dead: boolean;
}

interface Shot {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  life: number;
  dead: boolean;
}

const PAUSE_EPS = 1e-9;
const NO_HOOKS: DefenseTowerHooks = { targets: () => [], onTick: () => {} };

export class DefenseGame {
  readonly path: DefensePath;
  readonly runMin: DefenseRunMin;
  readonly difficulty: DifficultyId;
  readonly durationS: number;
  /** El calendario entero (lo que sale y cuándo). */
  readonly schedule: readonly DefenseSpawn[];
  /** Entra en el ranking si acaba bien (sin atajos). */
  readonly shortcut: boolean;

  private readonly rand: () => number;
  private readonly hooks: Partial<Record<DefenseTowerKind, DefenseTowerHooks>>;
  private readonly sample: PathSample = { x: 0, y: 0, heading: 0, nx: 0, ny: 0 };
  private readonly events: DefenseEvent[] = [];
  private readonly ctx: DefenseTowerContext;

  private activeSteps = 0;
  private manualPause = false;
  private pauseRun = 0;
  private endReason: DefenseEndReason | null = null;
  private nextSpawn = 0;
  private nextId = 1;
  private enemies: Enemy[] = [];
  private shots: Shot[] = [];
  private towerList: DefenseTowerState[] = [];
  private towersBuilt = 0;

  private castleLife: number;
  private coins: number;
  private coinsEarned = 0;
  private kills = 0;
  private killPoints = 0;
  private readonly killsByKind: Partial<Record<DefenseEnemyKind, number>> = {};
  private readonly bossesDefeated: DefenseEnemyKind[] = [];

  private readonly plane = { x: 0, y: 0, vx: 0, vy: 0, heading: 0, level: 1, cooldown: 0 };

  constructor(
    readonly config: DefenseConfig,
    readonly seed: number,
    opts: DefenseOptions = {},
  ) {
    this.runMin = opts.runMin ?? DEFAULT_DEFENSE_RUN_MIN;
    this.difficulty = opts.difficulty ?? 'normal';
    this.durationS = config.runs[this.runMin].durationS;
    this.path = buildDefensePath(config.path, config.castle.radius);
    this.schedule = defenseSchedule(config, this.runMin, this.difficulty);
    this.rand = makeRng(seed);
    this.hooks = opts.towerHooks ?? DEFENSE_TOWER_HOOKS;
    this.castleLife = config.castle.life;
    this.coins = config.startCoins;
    this.shortcut = opts.unranked === true || (opts.startAtS ?? 0) > 0;

    // El avión empieza entre el castillo y el vórtice.
    const a = Math.atan2(this.path.start.y, this.path.start.x);
    this.plane.x = Math.cos(a) * config.plane.startDistance;
    this.plane.y = Math.sin(a) * config.plane.startDistance;
    this.plane.heading = a;

    const activeS = () => this.activeS;
    const enemies = () => this.enemies as readonly DefenseEnemyView[];
    this.ctx = {
      get activeS() {
        return activeS();
      },
      get enemies() {
        return enemies();
      },
      path: this.path,
      rng: () => this.rand(),
      enemiesInRange: (x, y, r) => this.enemiesInRange(x, y, r),
      damageEnemy: (e, amount, source, towerId) =>
        this.damage(e as Enemy, amount, source, towerId ?? null),
      stunEnemy: (e, s) => {
        const en = e as Enemy;
        if (!en.dead) en.stunS = Math.max(en.stunS, s);
      },
      addCoins: (amount, towerId) => this.earn(amount, towerId ?? null),
    };

    if (opts.startAtS && opts.startAtS > 0) this.fastForward(opts.startAtS);
  }

  // --- Lectura ---------------------------------------------------------------

  get status(): DefenseStatus {
    if (this.endReason) return 'ended';
    return this.manualPause ? 'paused' : 'running';
  }

  get ended(): boolean {
    return this.endReason !== null;
  }

  get end(): DefenseEndReason | null {
    return this.endReason;
  }

  /** s de tiempo activo. */
  get activeS(): number {
    return this.activeSteps * DEFENSE_STEP_S;
  }

  get life(): number {
    return this.castleLife;
  }

  get purse(): number {
    return this.coins;
  }

  get towers(): readonly DefenseTowerState[] {
    return this.towerList;
  }

  /** Lo que cuesta subir el avión al siguiente nivel, o null en el 3. */
  get planeUpgradeCost(): number | null {
    return this.plane.level >= 3 ? null : this.config.plane.upgradeCost[this.plane.level - 1]!;
  }

  /** El estado para pintar. Las listas son las de la partida: no guardarlas entre pasos. */
  snapshot(): DefenseSnapshot {
    const p = this.plane;
    return {
      status: this.status,
      runMin: this.runMin,
      difficulty: this.difficulty,
      durationS: this.durationS,
      activeS: this.activeS,
      timeLeftS: Math.max(0, this.durationS - this.activeS),
      pauseRunS: this.pauseRun,
      castle: {
        life: this.castleLife,
        maxLife: this.config.castle.life,
        radius: this.config.castle.radius,
      },
      plane: {
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        heading: p.heading,
        level: p.level,
        damage: this.planeDamage,
        range: this.config.plane.range,
        nextUpgradeCost: this.planeUpgradeCost,
        buildRing: this.config.plane.buildRing,
      },
      enemies: this.enemies,
      shots: this.shots,
      towers: this.towerList,
      coins: this.coins,
      kills: this.kills,
      killPoints: this.killPoints,
      bossesDefeated: this.bossesDefeated,
      pending: this.schedule.length - this.nextSpawn,
      end: this.endReason,
    };
  }

  /** El resumen final, o null mientras se juega. */
  result(): DefenseResult | null {
    const end = this.endReason;
    if (!end) return null;
    const score = defenseScore(
      {
        end,
        killPoints: this.killPoints,
        castleLife: this.castleLife,
        castleMaxLife: this.config.castle.life,
      },
      this.config,
    );
    return {
      end,
      ranked: !this.shortcut && (end === 'held' || end === 'fallen'),
      medal: defenseMedal({
        end,
        castleLife: this.castleLife,
        castleMaxLife: this.config.castle.life,
        activeS: this.activeS,
        durationS: this.durationS,
      }),
      score: score.total,
      killPoints: score.killPoints,
      lifeBonus: score.lifeBonus,
      runMin: this.runMin,
      difficulty: this.difficulty,
      durationS: this.durationS,
      playedS: this.activeS,
      castleLife: this.castleLife,
      castleMaxLife: this.config.castle.life,
      kills: this.kills,
      killsByKind: { ...this.killsByKind },
      bossesDefeated: [...this.bossesDefeated],
      coinsEarned: this.coinsEarned,
      planeLevel: this.plane.level,
      towersBuilt: this.towersBuilt,
      configVersion: this.config.version,
    };
  }

  /** Huella del estado (pruebas de determinismo). */
  stateHash(): string {
    const r = (v: number) => Math.round(v * 1000);
    return configHash({
      t: this.activeSteps,
      life: r(this.castleLife),
      coins: r(this.coins),
      kills: this.kills,
      plane: [r(this.plane.x), r(this.plane.y), this.plane.level],
      enemies: this.enemies.map((e) => [e.id, e.kind, r(e.distance), r(e.laneOffset), r(e.hp)]),
      shots: this.shots.map((s) => [s.id, r(s.x), r(s.y)]),
      end: this.endReason,
    });
  }

  /** Los vivos con el borde a menos de `r` de (x, y). */
  enemiesInRange(x: number, y: number, r: number): DefenseEnemyView[] {
    const out: Enemy[] = [];
    for (const e of this.enemies) {
      if (e.dead) continue;
      const reach = r + e.radius;
      const dx = e.x - x;
      const dy = e.y - y;
      if (dx * dx + dy * dy <= reach * reach) out.push(e);
    }
    return out;
  }

  // --- Órdenes -----------------------------------------------------------------

  /** «Terminar partida»: acaba ya con `quit` (sin medalla ni ranking). */
  quit(): void {
    this.finish('quit');
  }

  setPaused(paused: boolean): void {
    if (!this.endReason) this.manualPause = paused;
  }

  /** Cuenta `seconds` s de pausa (pestaña oculta…); más de `maxPauseS` seguidos abandona. */
  elapsePause(seconds: number): readonly DefenseEvent[] {
    this.events.length = 0;
    if (this.endReason || !(seconds > 0)) return this.events;
    this.pauseRun += seconds;
    if (this.pauseRun > this.config.maxPauseS + PAUSE_EPS) this.finish('abandoned');
    return this.events;
  }

  /** Sube el daño del avión un nivel si llega el dinero. */
  upgradePlane(): boolean {
    const cost = this.planeUpgradeCost;
    if (this.endReason || cost === null || this.coins < cost) return false;
    this.coins -= cost;
    this.plane.level++;
    this.events.push({ type: 'planeUpgrade', level: this.plane.level, cost });
    return true;
  }

  /**
   * Pone una torre (sin cobrar ni mirar el sitio: eso es la regla de
   * construir de T159, que llama aquí después). `spent` es lo que costó.
   */
  addTower(
    kind: DefenseTowerKind,
    x: number,
    y: number,
    opts: { level?: number; spent?: number } = {},
  ): DefenseTowerState {
    const t: DefenseTowerState = {
      id: this.nextId++,
      kind,
      x,
      y,
      level: Math.min(3, Math.max(1, opts.level ?? 1)),
      spent: opts.spent ?? 0,
      targets: [],
      lastShot: null,
      data: {},
    };
    this.towerList.push(t);
    this.towersBuilt++;
    return t;
  }

  /** Quita una torre (vender: el dinero lo da T159). */
  removeTower(id: number): DefenseTowerState | null {
    const i = this.towerList.findIndex((t) => t.id === id);
    if (i < 0) return null;
    return this.towerList.splice(i, 1)[0]!;
  }

  /** Gasta monedas (construir, mejorar: T159). false si no llegan. */
  spend(amount: number): boolean {
    if (this.endReason || amount < 0 || this.coins < amount) return false;
    this.coins -= amount;
    return true;
  }

  /** Devuelve monedas (vender, T159). No cuentan como ganadas. */
  refund(amount: number): void {
    if (amount > 0) this.coins += amount;
  }

  // --- Paso --------------------------------------------------------------------

  /** Un paso fijo. Devuelve los sucesos (la lista se reutiliza: leerla antes del siguiente). */
  step(input: DefenseInput = {}): readonly DefenseEvent[] {
    this.events.length = 0;
    if (this.endReason) return this.events;
    if (input.pause !== undefined) this.manualPause = input.pause;
    const dt = DEFENSE_STEP_S;
    if (this.manualPause) {
      this.pauseRun += dt;
      if (this.pauseRun > this.config.maxPauseS + PAUSE_EPS) this.finish('abandoned');
      return this.events;
    }
    this.pauseRun = 0;
    this.activeSteps++;

    if (input.upgradePlane) this.upgradePlane();
    this.spawnDue();
    this.stepEnemies(dt);
    this.stepPlane(input.move, dt);
    this.stepShots(dt);
    this.compact();
    this.stepTowers(dt);
    this.compact();

    if (this.castleLife <= 0) {
      this.castleLife = 0;
      this.finish('fallen');
    } else if (this.activeS >= this.durationS - PAUSE_EPS) this.finish('held');
    return this.events;
  }

  // --- Interno -----------------------------------------------------------------

  private get planeDamage(): number {
    return this.config.plane.damage[this.plane.level - 1]!;
  }

  private finish(reason: DefenseEndReason): void {
    if (this.endReason) return;
    this.endReason = reason;
    this.manualPause = false;
    this.events.push({ type: 'end', reason });
  }

  private earn(amount: number, towerId: number | null): void {
    if (!(amount > 0)) return;
    this.coins += amount;
    this.coinsEarned += amount;
    if (towerId !== null) this.events.push({ type: 'coins', amount, towerId });
  }

  private fastForward(t: number): void {
    const steps = Math.min(
      Math.round(t / DEFENSE_STEP_S),
      Math.round(this.durationS / DEFENSE_STEP_S) - 1,
    );
    this.activeSteps = Math.max(0, steps);
    while (
      this.nextSpawn < this.schedule.length &&
      this.schedule[this.nextSpawn]!.atS < this.activeS
    ) {
      const def = defenseEnemyDef(this.config, this.schedule[this.nextSpawn]!.kind);
      if (def) this.earn(def.coins, null);
      this.nextSpawn++;
    }
  }

  private spawnDue(): void {
    const now = this.activeS;
    const diff = this.config.difficulties[this.difficulty];
    const speedUnit = this.path.length / this.config.path.normalWalkS;
    while (
      this.nextSpawn < this.schedule.length &&
      this.schedule[this.nextSpawn]!.atS <= now + PAUSE_EPS
    ) {
      const s = this.schedule[this.nextSpawn++]!;
      const def = defenseEnemyDef(this.config, s.kind);
      if (!def) continue;
      const radius = defenseEnemyRadius(s.kind);
      const growth =
        def.tier === 'common' ? 1 + this.config.waves.hpGrowthPerMinute * (s.atS / 60) : 1;
      const hp = def.hp * diff.enemyHp * growth;
      const lane = Math.max(0, this.path.width / 2 - radius);
      const e: Enemy = {
        id: this.nextId++,
        kind: s.kind,
        def,
        tier: def.tier,
        boss: def.tier !== 'common',
        x: this.path.start.x,
        y: this.path.start.y,
        heading: this.path.start.heading,
        distance: 0,
        progress: 0,
        laneOffset: (this.rand() * 2 - 1) * lane,
        hp,
        maxHp: hp,
        radius,
        speed: def.pace * speedUnit,
        stunS: 0,
        ageS: 0,
        dead: false,
      };
      this.place(e);
      this.enemies.push(e);
      this.events.push({ type: 'spawn', id: e.id, kind: e.kind, boss: e.boss });
    }
  }

  private place(e: Enemy): void {
    const s = this.path.sampleAt(e.distance, this.sample);
    // El carril se cierra al llegar a la muralla.
    const left = this.path.length - e.distance;
    const off = e.laneOffset * Math.min(1, left / this.path.width);
    e.x = s.x + s.nx * off;
    e.y = s.y + s.ny * off;
    e.heading = s.heading;
    e.progress = this.path.length > 0 ? e.distance / this.path.length : 1;
  }

  private stepEnemies(dt: number): void {
    const diff = this.config.difficulties[this.difficulty];
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.ageS += dt;
      if (e.stunS > 0) {
        e.stunS = Math.max(0, e.stunS - dt);
        continue;
      }
      e.distance += e.speed * dt;
      if (e.distance >= this.path.length) {
        e.distance = this.path.length;
        this.place(e);
        e.dead = true;
        const damage = e.def.castleDamage * diff.castleDamage;
        this.castleLife = Math.max(0, this.castleLife - damage);
        this.events.push({
          type: 'castleHit',
          id: e.id,
          kind: e.kind,
          damage,
          life: this.castleLife,
        });
        continue;
      }
      this.place(e);
    }
  }

  private stepPlane(move: DefenseInput['move'], dt: number): void {
    const cfg = this.config.plane;
    const p = this.plane;
    let mx = move?.x ?? 0;
    let my = move?.y ?? 0;
    if (!Number.isFinite(mx)) mx = 0;
    if (!Number.isFinite(my)) my = 0;
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    const tx = mx * cfg.maxSpeed;
    const ty = my * cfg.maxSpeed;
    const dvx = tx - p.vx;
    const dvy = ty - p.vy;
    const dv = Math.hypot(dvx, dvy);
    const maxDv = cfg.acceleration * dt;
    if (dv <= maxDv) {
      p.vx = tx;
      p.vy = ty;
    } else {
      p.vx += (dvx / dv) * maxDv;
      p.vy += (dvy / dv) * maxDv;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    // Dentro de la arena: lo que empuja hacia fuera se pierde.
    const r = Math.hypot(p.x, p.y);
    const max = this.config.arenaRadius;
    if (r > max) {
      const nx = p.x / r;
      const ny = p.y / r;
      p.x = nx * max;
      p.y = ny * max;
      const out = p.vx * nx + p.vy * ny;
      if (out > 0) {
        p.vx -= out * nx;
        p.vy -= out * ny;
      }
    }
    if (Math.hypot(p.vx, p.vy) > 1) p.heading = Math.atan2(p.vy, p.vx);

    p.cooldown = Math.max(0, p.cooldown - dt);
    if (p.cooldown > 0) return;
    const target = this.nearestEnemy(p.x, p.y, cfg.range);
    if (!target) return;
    // Apunta adonde estará el blanco cuando llegue la bala (una iteración basta).
    const tt = Math.hypot(target.x - p.x, target.y - p.y) / cfg.shotSpeed;
    const lead = target.stunS > 0 ? target.distance : target.distance + target.speed * tt;
    const s = this.path.sampleAt(lead, this.sample);
    const ax = s.x + s.nx * target.laneOffset - p.x;
    const ay = s.y + s.ny * target.laneOffset - p.y;
    const al = Math.hypot(ax, ay) || 1;
    const shot: Shot = {
      id: this.nextId++,
      x: p.x,
      y: p.y,
      vx: (ax / al) * cfg.shotSpeed,
      vy: (ay / al) * cfg.shotSpeed,
      radius: cfg.shotRadius,
      damage: this.planeDamage,
      life: (cfg.range * 1.3) / cfg.shotSpeed,
      dead: false,
    };
    this.shots.push(shot);
    p.cooldown = cfg.cooldownS;
    this.events.push({ type: 'planeShot', shotId: shot.id, targetId: target.id });
  }

  private nearestEnemy(x: number, y: number, range: number): Enemy | null {
    let best: Enemy | null = null;
    let bestD = Infinity;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - y) - e.radius;
      if (d <= range && d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  private stepShots(dt: number): void {
    for (const s of this.shots) {
      if (s.dead) continue;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const reach = e.radius + s.radius;
        const dx = e.x - s.x;
        const dy = e.y - s.y;
        if (dx * dx + dy * dy <= reach * reach) {
          this.damage(e, s.damage, 'plane', null);
          s.dead = true;
          break;
        }
      }
      if (s.life <= 0) s.dead = true;
    }
  }

  private stepTowers(dt: number): void {
    for (const t of this.towerList) {
      const hooks = this.hooks[t.kind] ?? NO_HOOKS;
      t.targets = hooks.targets(t, this.ctx);
      hooks.onTick(t, this.ctx, dt);
    }
  }

  private damage(e: Enemy, amount: number, source: DefenseSource, towerId: number | null): boolean {
    if (e.dead || !(amount > 0)) return false;
    e.hp -= amount;
    if (e.hp > 0) return false;
    e.hp = 0;
    e.dead = true;
    this.kills++;
    this.killPoints += e.def.points;
    this.killsByKind[e.kind] = (this.killsByKind[e.kind] ?? 0) + 1;
    if (e.boss) this.bossesDefeated.push(e.kind);
    this.earn(e.def.coins, null);
    this.events.push({
      type: 'kill',
      id: e.id,
      kind: e.kind,
      boss: e.boss,
      x: e.x,
      y: e.y,
      coins: e.def.coins,
      points: e.def.points,
      source,
      towerId,
    });
    return true;
  }

  private compact(): void {
    if (this.enemies.some((e) => e.dead)) this.enemies = this.enemies.filter((e) => !e.dead);
    if (this.shots.some((s) => s.dead)) this.shots = this.shots.filter((s) => !s.dead);
  }
}

/** Crea una partida. Igual que `new DefenseGame(…)`. */
export function createDefense(
  config: DefenseConfig,
  seed: number,
  opts: DefenseOptions = {},
): DefenseGame {
  return new DefenseGame(config, seed, opts);
}
