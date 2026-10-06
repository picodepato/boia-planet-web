import { configHash, rng as makeRng } from '../minigames/rng';
import {
  DEFAULT_DEFENSE_RUN_MIN,
  DEFENSE_PLANE_MAX_LEVEL,
  DEFENSE_STEP_S,
  type DefenseConfig,
  type DefenseEnemyDef,
  type DefenseEnemyKind,
  type DefensePlaneStat,
  type DefenseRunMin,
  type DefenseTargetPriority,
  type DefenseTowerKind,
  type DifficultyId,
  asDefenseTargetPriority,
  defenseCastleMaxLevel,
  defenseCastleMaxLife,
  defenseCastleUpgradeCost,
  defenseClampToArena,
  defenseEnemyDef,
  defenseEnemyRadius,
  defensePlaneCooldown,
  defensePlaneDamage,
  defensePlaneUpgradeCost,
} from './config';
import {
  type DefenseBuildCheck,
  defenseBuildCheck,
  defenseTowerSellValue,
  defenseTowerUpgradeCost,
} from './build';
import { type DefenseMedal, defenseMedal, defenseScore } from './medals';
import { type DefensePath, type PathSample, buildDefensePath } from './path';
import {
  DEFENSE_TOWER_HOOKS,
  type DefenseEnemyView,
  type DefenseSource,
  type DefenseTowerContext,
  type DefenseTowerHooks,
  type DefenseTowerState,
  type TowerShotView,
} from './towers';
import {
  type DefenseSpawn,
  type DefenseWaveInfo,
  defenseNextWave,
  defenseSchedule,
  defenseWaveStarts,
} from './waves';

/**
 * La partida de «Defensa del Castillo» (plan 014 T158), sin DOM y
 * determinista: misma configuración, semilla y entradas, misma partida.
 * Paso fijo de `DEFENSE_STEP_S`, como el Cañón.
 *
 * - Los enemigos salen del vórtice según `defenseSchedule` y avanzan por el
 *   camino a su velocidad, cada uno en su carril; al llegar a la muralla le
 *   quitan vida al castillo y desaparecen.
 * - El avión vuela libre dentro de la arena (con el mando o hacia un punto
 *   tocado, `moveTo`, siempre acotado a la arena) y dispara solo al enemigo
 *   más cercano a su alcance; su daño y su velocidad de ataque suben cada
 *   uno hasta el nivel 5 con monedas (plan 015, decisión 8).
 * - El castillo sube su vida máxima con monedas (decisión 9; la mejora
 *   también cura lo que suma).
 * - Cada enemigo que cae da sus monedas (al monedero de la partida, nunca al
 *   del mundo) y sus puntos.
 * - Las torres (islas construidas, T159) se ponen con `build` (la regla de
 *   `build.ts`: en cualquier sitio de la arena fuera del camino, del vórtice
 *   y del castillo, sin montarse; cobra su coste), se suben con
 *   `upgradeTower` hasta el nivel 3, se venden con `sellTower` (una parte de
 *   lo gastado vuelve) y las que eligen blanco cambian de prioridad con
 *   `setTowerPriority` (decisión 12). Lo que hace cada una está en
 *   `DEFENSE_TOWER_HOOKS`; sin ninguna, la partida corre igual.
 * - Las oleadas siguen un reloj de calendario (`waveS`) que corre con la
 *   partida; «Llamar oleada» (`callWave`, decisión 10) lo adelanta al
 *   principio de la siguiente y paga monedas por lo adelantado. La partida
 *   dura lo mismo. `nextWave` dice qué trae la siguiente y cuándo.
 * - Castillo a 0: cae (`fallen`). Llegar a la duración elegida: aguantó
 *   (`held`). Una pausa seguida de más de `maxPauseS`: abandono. «Terminar
 *   partida»: `quit`.
 */

/** Cómo acaba: aguantó, cayó el castillo, abandono por pausa larga, o «Terminar partida». */
export type DefenseEndReason = 'held' | 'fallen' | 'abandoned' | 'quit';
export type DefenseStatus = 'running' | 'paused' | 'ended';

export interface DefenseInput {
  /**
   * Hacia dónde vuela el avión (−1…1 en cada eje; más largo que 1 se acorta).
   * Sin valor (y sin punto pedido), frena. Un mando que empuja cancela el punto.
   */
  move?: { x: number; y: number };
  /**
   * Volar hasta ese punto (u de la partida; se acota a la arena) y pararse
   * allí: se queda pedido hasta llegar o hasta que el mando empuje. null lo cancela.
   */
  moveTo?: { x: number; y: number } | null;
  /** true: pausa manual; false: seguir. Sin valor, no cambia. */
  pause?: boolean;
  /** Comprar el siguiente nivel de daño o de velocidad de ataque del avión (si llega el dinero). */
  upgradePlane?: DefensePlaneStat;
  /** Comprar la siguiente mejora de vida del castillo (si llega el dinero). */
  upgradeCastle?: boolean;
  /** Construir una isla ahí (si la regla lo deja y llega el dinero). */
  build?: { kind: DefenseTowerKind; x: number; y: number };
  /** Subir de nivel la isla con este id. */
  upgradeTower?: number;
  /** Vender la isla con este id. */
  sellTower?: number;
  /** Cambiar a quién apunta una isla que elige blanco. */
  setPriority?: { towerId: number; priority: DefenseTargetPriority };
  /** «Llamar oleada»: la siguiente empieza ya (si queda alguna). */
  callWave?: boolean;
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
  | { type: 'planeUpgrade'; stat: DefensePlaneStat; level: number; cost: number }
  | { type: 'castleUpgrade'; level: number; maxLife: number; cost: number }
  | { type: 'towerPriority'; towerId: number; priority: DefenseTargetPriority }
  | { type: 'waveCalled'; wave: number; skippedS: number; coins: number }
  | { type: 'coins'; amount: number; towerId: number | null }
  | {
      type: 'towerBuilt';
      towerId: number;
      kind: DefenseTowerKind;
      x: number;
      y: number;
      cost: number;
    }
  | { type: 'towerUpgrade'; towerId: number; kind: DefenseTowerKind; level: number; cost: number }
  | { type: 'towerSold'; towerId: number; kind: DefenseTowerKind; refund: number }
  | { type: 'towerShot'; towerId: number; kind: DefenseTowerKind; shot: TowerShotView }
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
  /** El punto al que vuela (`moveTo`, ya acotado a la arena), o null. */
  readonly target: { readonly x: number; readonly y: number } | null;
  /** Nivel de daño y de velocidad de ataque, 1…`maxLevel`. */
  readonly damageLevel: number;
  readonly speedLevel: number;
  readonly maxLevel: number;
  /** Daño por bala y s entre disparos a sus niveles. */
  readonly damage: number;
  readonly cooldownS: number;
  readonly range: number;
  /** Lo que cuesta el siguiente nivel de cada mejora (null en el máximo). */
  readonly nextDamageCost: number | null;
  readonly nextSpeedCost: number | null;
}

/** El castillo: su vida, su nivel (mejoras de vida máxima) y lo que cuesta el siguiente. */
export interface DefenseCastleView {
  readonly life: number;
  readonly maxLife: number;
  readonly radius: number;
  readonly level: number;
  readonly maxLevel: number;
  readonly nextUpgradeCost: number | null;
}

export interface DefenseSnapshot {
  readonly status: DefenseStatus;
  readonly runMin: DefenseRunMin;
  readonly difficulty: DifficultyId;
  readonly durationS: number;
  readonly activeS: number;
  readonly timeLeftS: number;
  readonly pauseRunS: number;
  /** s del reloj de las oleadas (`activeS` más lo adelantado con «Llamar oleada»). */
  readonly waveS: number;
  /** La oleada siguiente (qué trae, si hay boss, cuándo), o null si no quedan. */
  readonly nextWave: DefenseWaveInfo | null;
  readonly castle: DefenseCastleView;
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
  /** Niveles del avión: daño (`planeLevel`) y velocidad de ataque. */
  readonly planeLevel: number;
  readonly planeSpeedLevel: number;
  /** Nivel del castillo (1 + mejoras de vida). */
  readonly castleLevel: number;
  /** s que «Llamar oleada» adelantó el calendario (el ranking cuenta lo salido con ellas). */
  readonly wavesAheadS: number;
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
  burnS: number;
  burnDps: number;
  burnTowerId: number | null;
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
  private castleLevel = 1;
  /** s que «Llamar oleada» ha adelantado el calendario. */
  private aheadS = 0;
  private readonly waveStarts: readonly number[];
  private coins: number;
  private coinsEarned = 0;
  private kills = 0;
  private killPoints = 0;
  private readonly killsByKind: Partial<Record<DefenseEnemyKind, number>> = {};
  private readonly bossesDefeated: DefenseEnemyKind[] = [];

  private readonly plane = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    heading: 0,
    damageLevel: 1,
    speedLevel: 1,
    cooldown: 0,
    target: null as { x: number; y: number } | null,
  };

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
    this.waveStarts = defenseWaveStarts(this.schedule);
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
      config,
      path: this.path,
      rng: () => this.rand(),
      enemiesInRange: (x, y, r) => this.enemiesInRange(x, y, r),
      damageEnemy: (e, amount, source, towerId) =>
        this.damage(e as Enemy, amount, source, towerId ?? null),
      stunEnemy: (e, s) => {
        const en = e as Enemy;
        if (!en.dead) en.stunS = Math.max(en.stunS, s);
      },
      burnEnemy: (e, dps, s, towerId) => {
        const en = e as Enemy;
        if (en.dead || !(dps > 0) || !(s > 0)) return;
        if (dps >= en.burnDps) en.burnTowerId = towerId ?? null;
        en.burnDps = Math.max(en.burnDps, dps);
        en.burnS = Math.max(en.burnS, s);
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

  /** s del reloj de las oleadas: `activeS` más lo adelantado con «Llamar oleada». */
  get waveS(): number {
    return this.activeS + this.aheadS;
  }

  get life(): number {
    return this.castleLife;
  }

  /** La vida máxima del castillo a su nivel. */
  get maxLife(): number {
    return defenseCastleMaxLife(this.config, this.castleLevel);
  }

  get purse(): number {
    return this.coins;
  }

  get towers(): readonly DefenseTowerState[] {
    return this.towerList;
  }

  /** Lo que cuesta subir `stat` del avión al siguiente nivel, o null en el máximo. */
  planeUpgradeCost(stat: DefensePlaneStat = 'damage'): number | null {
    const level = stat === 'damage' ? this.plane.damageLevel : this.plane.speedLevel;
    if (level >= DEFENSE_PLANE_MAX_LEVEL) return null;
    return defensePlaneUpgradeCost(this.config, stat, level);
  }

  /** Lo que cuesta la siguiente mejora de vida del castillo, o null en el máximo. */
  get castleUpgradeCost(): number | null {
    return defenseCastleUpgradeCost(this.config, this.castleLevel);
  }

  /** La oleada siguiente: qué trae, si hay boss y cuándo empieza; null si no quedan. */
  nextWave(): DefenseWaveInfo | null {
    if (this.endReason) return null;
    return defenseNextWave(this.schedule, this.waveStarts, this.nextSpawn, this.waveS);
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
      waveS: this.waveS,
      nextWave: this.nextWave(),
      castle: {
        life: this.castleLife,
        maxLife: this.maxLife,
        radius: this.config.castle.radius,
        level: this.castleLevel,
        maxLevel: defenseCastleMaxLevel(this.config),
        nextUpgradeCost: this.castleUpgradeCost,
      },
      plane: {
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        heading: p.heading,
        target: p.target,
        damageLevel: p.damageLevel,
        speedLevel: p.speedLevel,
        maxLevel: DEFENSE_PLANE_MAX_LEVEL,
        damage: defensePlaneDamage(this.config, p.damageLevel),
        cooldownS: defensePlaneCooldown(this.config, p.speedLevel),
        range: this.config.plane.range,
        nextDamageCost: this.planeUpgradeCost('damage'),
        nextSpeedCost: this.planeUpgradeCost('speed'),
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
    const maxLife = this.maxLife;
    const score = defenseScore(
      {
        end,
        killPoints: this.killPoints,
        castleLife: this.castleLife,
        castleMaxLife: maxLife,
      },
      this.config,
    );
    return {
      end,
      ranked: !this.shortcut && (end === 'held' || end === 'fallen'),
      medal: defenseMedal({
        end,
        castleLife: this.castleLife,
        castleMaxLife: maxLife,
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
      castleMaxLife: maxLife,
      kills: this.kills,
      killsByKind: { ...this.killsByKind },
      bossesDefeated: [...this.bossesDefeated],
      coinsEarned: this.coinsEarned,
      planeLevel: this.plane.damageLevel,
      planeSpeedLevel: this.plane.speedLevel,
      castleLevel: this.castleLevel,
      wavesAheadS: this.aheadS,
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
      castle: this.castleLevel,
      ahead: r(this.aheadS),
      coins: r(this.coins),
      kills: this.kills,
      plane: [
        r(this.plane.x),
        r(this.plane.y),
        r(this.plane.vx),
        r(this.plane.vy),
        r(this.plane.cooldown),
        this.plane.damageLevel,
        this.plane.speedLevel,
      ],
      enemies: this.enemies.map((e) => [e.id, e.kind, r(e.distance), r(e.laneOffset), r(e.hp)]),
      towers: this.towerList.map((t) => [t.id, t.kind, t.level, t.priority, r(t.x), r(t.y)]),
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

  /** Sube el daño o la velocidad de ataque del avión un nivel si llega el dinero. */
  upgradePlane(stat: DefensePlaneStat = 'damage'): boolean {
    const cost = this.planeUpgradeCost(stat);
    if (cost === null || !this.spend(cost)) return false;
    const level = stat === 'damage' ? ++this.plane.damageLevel : ++this.plane.speedLevel;
    this.events.push({ type: 'planeUpgrade', stat, level, cost });
    return true;
  }

  /** Sube la vida máxima del castillo (y le suma esa vida) si llega el dinero. */
  upgradeCastle(): boolean {
    const cost = this.castleUpgradeCost;
    if (cost === null || !this.spend(cost)) return false;
    const before = this.maxLife;
    this.castleLevel++;
    const maxLife = this.maxLife;
    this.castleLife = Math.min(maxLife, this.castleLife + (maxLife - before));
    this.events.push({ type: 'castleUpgrade', level: this.castleLevel, maxLife, cost });
    return true;
  }

  /** Cambia a quién apunta la isla `id` (sólo las que eligen blanco). */
  setTowerPriority(id: number, priority: DefenseTargetPriority): boolean {
    const p = asDefenseTargetPriority(priority);
    const t = this.towerList.find((tw) => tw.id === id);
    if (this.endReason || !p || !t || t.priority === null || t.priority === p) return false;
    t.priority = p;
    this.events.push({ type: 'towerPriority', towerId: t.id, priority: p });
    return true;
  }

  /**
   * «Llamar oleada»: el reloj de las oleadas salta al principio de la
   * siguiente (sale ya, con los bosses que le tocaran antes) y paga
   * `waves.callCoinsPerS` por cada segundo adelantado. false si no quedan.
   */
  callWave(): boolean {
    const next = this.nextWave();
    if (!next || !(next.inS > 0)) return false;
    this.aheadS += next.inS;
    const coins = Math.round(next.inS * this.config.waves.callCoinsPerS);
    this.earn(coins, null);
    this.events.push({ type: 'waveCalled', wave: next.wave, skippedS: next.inS, coins });
    return true;
  }

  /** ¿Se puede construir `kind` en (x, y) ahora? Si no, por qué (la vista previa del HUD). */
  buildCheck(kind: DefenseTowerKind, x: number, y: number): DefenseBuildCheck {
    return defenseBuildCheck(
      {
        config: this.config,
        path: this.path,
        towers: this.towerList,
        coins: this.coins,
        ended: this.ended,
      },
      kind,
      x,
      y,
    );
  }

  /** Construye `kind` en (x, y) si la regla lo deja: cobra y la pone a nivel 1. Si no, null. */
  build(kind: DefenseTowerKind, x: number, y: number): DefenseTowerState | null {
    const check = this.buildCheck(kind, x, y);
    if (!check.ok || !this.spend(check.cost)) return null;
    const t = this.addTower(kind, x, y, { spent: check.cost });
    this.events.push({ type: 'towerBuilt', towerId: t.id, kind, x, y, cost: check.cost });
    return t;
  }

  /** Lo que cuesta subir la isla `id` al siguiente nivel; null en el 3 o si no está. */
  towerUpgradeCost(id: number): number | null {
    const t = this.towerList.find((tw) => tw.id === id);
    return t ? defenseTowerUpgradeCost(this.config, t) : null;
  }

  /** Lo que devolvería vender la isla `id`; null si no está. */
  towerSellValue(id: number): number | null {
    const t = this.towerList.find((tw) => tw.id === id);
    return t ? defenseTowerSellValue(this.config, t) : null;
  }

  /** Sube la isla `id` un nivel (hasta el 3) si llega el dinero. */
  upgradeTower(id: number): boolean {
    const t = this.towerList.find((tw) => tw.id === id);
    const cost = t ? defenseTowerUpgradeCost(this.config, t) : null;
    if (!t || cost === null || !this.spend(cost)) return false;
    t.level++;
    t.spent += cost;
    this.events.push({ type: 'towerUpgrade', towerId: t.id, kind: t.kind, level: t.level, cost });
    return true;
  }

  /** Vende la isla `id`: la quita y devuelve una parte de lo gastado. Lo devuelto, o null. */
  sellTower(id: number): number | null {
    if (this.endReason) return null;
    const t = this.removeTower(id);
    if (!t) return null;
    const refund = defenseTowerSellValue(this.config, t);
    this.refund(refund);
    this.events.push({ type: 'towerSold', towerId: t.id, kind: t.kind, refund });
    return refund;
  }

  /**
   * Pone una torre sin cobrar ni mirar el sitio (lo hace `build`, que llama
   * aquí; las pruebas lo usan directo). `spent` es lo que costó.
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
      priority: this.config.towers.kinds[kind].priority,
      spent: opts.spent ?? 0,
      targets: [],
      lastShot: null,
      data: {},
    };
    this.towerList.push(t);
    this.towersBuilt++;
    return t;
  }

  /** Quita una torre sin devolver nada (vender es `sellTower`). */
  removeTower(id: number): DefenseTowerState | null {
    const i = this.towerList.findIndex((t) => t.id === id);
    if (i < 0) return null;
    return this.towerList.splice(i, 1)[0]!;
  }

  /** Gasta monedas (construir, mejorar). false si no llegan. */
  spend(amount: number): boolean {
    if (this.endReason || amount < 0 || this.coins < amount) return false;
    this.coins -= amount;
    return true;
  }

  /** Devuelve monedas (vender). No cuentan como ganadas. */
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

    if (input.upgradePlane) this.upgradePlane(input.upgradePlane);
    if (input.upgradeCastle) this.upgradeCastle();
    if (input.sellTower !== undefined) this.sellTower(input.sellTower);
    if (input.upgradeTower !== undefined) this.upgradeTower(input.upgradeTower);
    if (input.setPriority)
      this.setTowerPriority(input.setPriority.towerId, input.setPriority.priority);
    if (input.build) this.build(input.build.kind, input.build.x, input.build.y);
    if (input.callWave) this.callWave();
    if (input.moveTo !== undefined) this.setPlaneTarget(input.moveTo);
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

  /** El punto al que vuela el avión (acotado a la arena), o ninguno. */
  setPlaneTarget(to: { x: number; y: number } | null): void {
    this.plane.target = to ? defenseClampToArena(this.config, to.x, to.y) : null;
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
    const now = this.waveS;
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
        burnS: 0,
        burnDps: 0,
        burnTowerId: null,
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
      if (e.burnS > 0) {
        // Arde también aturdido; quemado, la caída es de la torre que lo prendió.
        const burn = Math.min(dt, e.burnS);
        e.burnS = Math.max(0, e.burnS - dt);
        if (this.damage(e, e.burnDps * burn, 'tower', e.burnTowerId)) continue;
        if (e.burnS <= 0) {
          e.burnDps = 0;
          e.burnTowerId = null;
        }
      }
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
    // El mando que empuja manda: el punto pedido se olvida.
    if (len > 1e-6) p.target = null;
    let tx = mx * cfg.maxSpeed;
    let ty = my * cfg.maxSpeed;
    if (p.target) {
      // Hacia el punto, frenando para pararse en él (v² = 2·a·d).
      const dx = p.target.x - p.x;
      const dy = p.target.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d <= cfg.arriveRadius) {
        p.target = null;
        tx = 0;
        ty = 0;
      } else {
        const v = Math.min(cfg.maxSpeed, Math.sqrt(2 * cfg.acceleration * d), d / dt);
        tx = (dx / d) * v;
        ty = (dy / d) * v;
      }
    }
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
    // Dentro de la arena (decisión 3 del plan 015): lo que empuja hacia fuera se pierde.
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
      damage: defensePlaneDamage(this.config, p.damageLevel),
      life: (cfg.range * 1.3) / cfg.shotSpeed,
      dead: false,
    };
    this.shots.push(shot);
    p.cooldown = defensePlaneCooldown(this.config, p.speedLevel);
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
      const before = t.lastShot;
      hooks.onTick(t, this.ctx, dt);
      const shot = t.lastShot;
      if (shot && shot !== before)
        this.events.push({ type: 'towerShot', towerId: t.id, kind: t.kind, shot });
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
