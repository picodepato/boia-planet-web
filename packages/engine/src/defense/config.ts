import { configHash } from '../minigames/rng';
import {
  type BossId,
  DIFFICULTY_IDS,
  type DifficultyId,
  type EnemyId,
  SURVIVORS_CONFIG,
  SURVIVORS_STEP_S,
} from '../survivors/config';

/**
 * La configuración única y versionada de «Defensa del Castillo» (nombre
 * `muestra`, plan 014): un tower defense en el castillo, junto a Boia 7.
 * Todo el equilibrio en datos, como `SURVIVORS_CONFIG` en el Cañón:
 *
 * - el **camino** (decisión 5 del plan 014; v2, decisión 7 del plan 015):
 *   empieza en el vórtice (cerca del borde de la arena), rodea el castillo
 *   por fuera con cuatro curvas en U hacia él, baja y acaba en zigzag en la
 *   muralla. El mismo en todas las partidas;
 * - los **enemigos** (decisión 6): los tipos, minibosses y bosses del Cañón
 *   (sus ids y su tamaño salen de `SURVIVORS_CONFIG` por import), con su
 *   ritmo, aguante, daño al castillo y monedas propios de aquí;
 * - las **oleadas** por duración (5, 7, 10 min) y dificultad (decisión 10);
 * - el **avión** (decisión 7; plan 015, decisión 8): dispara solo; daño y
 *   velocidad de ataque a nivel 1…5 con monedas; el **castillo** sube su
 *   vida máxima (decisión 9) y las islas tienen prioridad (decisión 12);
 * - las **monedas** (decisión 11), las **medallas** y la **puntuación**
 *   (decisión 12).
 *
 * Unidades: u de motor (las del mar de `/mar`: 16 u por unidad de escena) y
 * segundos, con el castillo en (0, 0); la vista lo lleva a su sitio del
 * mapa. Cambiar cualquier valor cambia `defenseConfigHash`; un cambio de
 * reglas sube `DEFENSE_CONFIG_VERSION`. Todo es `muestra`.
 */

/**
 * Sube con cada cambio de reglas: el resultado y el ranking la llevan. 3: el
 * equilibrio de T165 (Benidorm, monedero, dificultades, crecimiento). 4: el
 * castillo v2 (plan 015 T169): camino con curvas en U, construir en toda la
 * arena, avión 1…5 (daño y velocidad de ataque), vida del castillo,
 * prioridades de las islas y «Llamar oleada».
 */
export const DEFENSE_CONFIG_VERSION = 4;

/** Paso fijo de la simulación (s): el del Cañón. */
export const DEFENSE_STEP_S = SURVIVORS_STEP_S;

/** Duraciones que se eligen (min). */
export type DefenseRunMin = 5 | 7 | 10;
export const DEFENSE_RUN_MINS: readonly DefenseRunMin[] = [5, 7, 10];
export const DEFAULT_DEFENSE_RUN_MIN: DefenseRunMin = 5;

/** El valor si `v` es una duración; si no, null. */
export function asDefenseRunMin(v: unknown): DefenseRunMin | null {
  const n = typeof v === 'string' ? Number(v) : v;
  return DEFENSE_RUN_MINS.find((m) => m === n) ?? null;
}

/** Las dificultades son las del Cañón (Tranquila, Normal, Tormenta). */
export { DIFFICULTY_IDS as DEFENSE_DIFFICULTY_IDS, type DifficultyId };

/**
 * Las islas que se construyen como torres (decisión 9): sus ids de lugar del
 * mapa. Sus números, en `DefenseConfig.towers`.
 */
export type DefenseTowerKind =
  'faro' | 'ultima' | 'halloween' | 'cala' | 'tienda' | 'allday' | 'fotos';
export const DEFENSE_TOWER_KINDS: readonly DefenseTowerKind[] = [
  'faro',
  'ultima',
  'halloween',
  'cala',
  'tienda',
  'allday',
  'fotos',
];

/**
 * Lo de cada nivel (1…3) de cada isla (decisión 9). `range` es el alcance
 * (u desde el centro de la isla hasta el borde del enemigo; 0 en la granja).
 */
export interface DefenseTowerStatsByKind {
  /** Faro: haces que giran y hieren lo que tocan, `damagePerS` por segundo de contacto. */
  faro: {
    range: number;
    damagePerS: number;
    /** Haces a ángulos iguales. */
    beams: number;
    /** u de medio ancho del haz. */
    beamWidth: number;
    sweepRadPerS: number;
  };
  /** Nochevieja: bolas de nieve a un blanco distinto cada vez si puede; aturden. */
  ultima: { range: number; damage: number; cooldownS: number; stunS: number };
  /** Halloween: bocanada en cono hacia el más adelantado; deja ardiendo. */
  halloween: {
    range: number;
    damage: number;
    cooldownS: number;
    /** rad de medio ángulo del cono. */
    coneRad: number;
    burnDps: number;
    burnS: number;
  };
  /** Puerto: mortero de fuegos artificiales; cae donde estará el blanco y estalla en área. */
  cala: {
    range: number;
    damage: number;
    cooldownS: number;
    blastRadius: number;
    /** s del disparo al estallido. */
    flightS: number;
  };
  /** Ibiza: granja; `coins` cada `cooldownS`. */
  tienda: { range: number; coins: number; cooldownS: number };
  /** Isla del Sonido: onda de graves a todo lo que tiene alrededor cada `cooldownS`. */
  allday: { range: number; damage: number; cooldownS: number };
  /** Benidorm: francotirador; un tiro fuerte al más fuerte a su alcance (bosses antes). */
  fotos: { range: number; damage: number; cooldownS: number };
}

/**
 * A quién apunta una isla que elige blanco (decisión 12 del plan 015): el
 * primero (el más adelantado por el camino), el último, el más fuerte o el
 * más cercano a la isla.
 */
export type DefenseTargetPriority = 'first' | 'last' | 'strongest' | 'closest';
export const DEFENSE_TARGET_PRIORITIES: readonly DefenseTargetPriority[] = [
  'first',
  'last',
  'strongest',
  'closest',
];

/** El valor si `v` es una prioridad; si no, null. */
export function asDefenseTargetPriority(v: unknown): DefenseTargetPriority | null {
  return DEFENSE_TARGET_PRIORITIES.find((p) => p === v) ?? null;
}

/** Una isla: lo que cuesta, lo que cuesta subirla y lo de cada nivel. */
export interface DefenseTowerDef<K extends DefenseTowerKind = DefenseTowerKind> {
  kind: K;
  /**
   * La prioridad con que se construye, si la isla elige a quién disparar
   * (null: el haz del Faro, la onda del Sonido y la granja no eligen).
   */
  priority: DefenseTargetPriority | null;
  /** Monedas para construirla (nivel 1). */
  cost: number;
  /** Monedas para subir a nivel 2 y a nivel 3. */
  upgradeCost: readonly [number, number];
  levels: readonly [
    DefenseTowerStatsByKind[K],
    DefenseTowerStatsByKind[K],
    DefenseTowerStatsByKind[K],
  ];
}

export interface DefenseTowersDef {
  /**
   * u de agua libre entre el borde de una isla y el borde del carril (la
   * isla, con su huella `islandRadius`, nunca pisa el camino).
   */
  pathClearance: number;
  /** u de agua libre entre el borde de una isla y el del vórtice. */
  vortexClearance: number;
  /** Parte de lo gastado en una isla (construir y mejorar) que devuelve venderla. */
  sellRefund: number;
  /** A minibosses y bosses el aturdimiento les dura esta parte. */
  bossStunScale: number;
  kinds: { [K in DefenseTowerKind]: DefenseTowerDef<K> };
}

/** Qué baja por el camino: un tipo común del Cañón o uno de sus bosses. */
export type DefenseEnemyKind = EnemyId | BossId;

/**
 * Un tipo de enemigo aquí. `pace` es su velocidad sobre la de un enemigo
 * normal (1 = recorre el camino en `path.normalWalkS`). El radio (para los
 * golpes y la pantalla) es el del Cañón.
 */
export interface DefenseEnemyDef {
  kind: DefenseEnemyKind;
  /** Común, miniboss o boss (los dos últimos sólo siguen el camino: decisión 6). */
  tier: 'common' | 'miniboss' | 'boss';
  pace: number;
  /** Aguante base (se multiplica por la dificultad y el crecimiento por minuto). */
  hp: number;
  /** Vida del castillo que quita al llegar. */
  castleDamage: number;
  /** Monedas al caer (directas al monedero). */
  coins: number;
  /** Puntos de ranking al caer. */
  points: number;
}

/** Una dificultad: multiplicadores sobre lo enemigo. */
export interface DefenseDifficultyDef {
  id: DifficultyId;
  i18nKey: string;
  enemyHp: number;
  /** Sobre cuántos comunes trae cada oleada. */
  enemyCount: number;
  castleDamage: number;
}

/** Un tipo común entra en las oleadas desde `fromFrac` de la partida, con su peso. */
export interface WaveMixEntry {
  kind: EnemyId;
  fromFrac: number;
  weight: number;
}

/** Un miniboss o boss a la fracción `atFrac` de la partida. */
export interface WaveBossEntry {
  kind: BossId;
  atFrac: number;
}

export interface DefenseRunDef {
  min: DefenseRunMin;
  durationS: number;
  /** Los bosses de esta duración (cerca del final los gordos). */
  bosses: readonly WaveBossEntry[];
}

/**
 * Un tramo del camino v2 (decisión 7 del plan 015), en el marco del camino
 * (el vórtice en el ángulo 0, los ángulos crecen en el sentido de la vuelta).
 * Lo traza `buildDefensePath`.
 */
export type PathLegDef =
  /** Rodea el castillo hasta `toAngleRad` (rad desde el vórtice), con el radio yendo a `toRadius`. */
  | { kind: 'orbit'; toAngleRad: number; toRadius: number }
  /** U hacia el castillo: `depth` u recto, media vuelta de radio `radius`, y fuera, paralelo. */
  | { kind: 'u'; depth: number; radius: number }
  /** `legs` tramos rectos de `legLength` u hacia el castillo, a ±`angleRad` (los extremos, medios). */
  | { kind: 'zigzag'; legs: number; legLength: number; angleRad: number };

export interface DefensePathDef {
  /** u: ancho del carril (barreras a los dos lados). */
  width: number;
  /** rad: dónde está el vórtice alrededor del castillo (0 = +x). */
  startAngleRad: number;
  /** 1: el camino gira en sentido +ángulo; −1, al revés. */
  direction: 1 | -1;
  /** u del castillo al vórtice (inicio del camino). */
  outerRadius: number;
  /** Los tramos, del vórtice hacia dentro; del último, recto a la muralla. */
  legs: readonly PathLegDef[];
  /** u entre muestras de la polilínea. */
  sampleStep: number;
  /** s que tarda un enemigo normal (`pace` 1) del vórtice a la muralla. */
  normalWalkS: number;
  /** rad: un vértice que gira más que esto es una esquina (boyas de la carrera de acento). */
  cornerMinRad: number;
}

export interface DefenseConfig {
  version: number;
  /** s de una pausa seguida a partir de los cuales la partida se abandona. */
  maxPauseS: number;
  castle: {
    /** u: radio de la isla del castillo (el de su decorado en `/mar`, 13 de escena). */
    radius: number;
    /** Vida al empezar (nivel 1). */
    life: number;
    /** Vida máxima que suma cada mejora (decisión 9 del plan 015; también la cura). */
    lifePerLevel: number;
    /** Monedas de cada mejora (del nivel 1 al 2, …); su largo es el número de mejoras. */
    upgradeCost: readonly number[];
  };
  /** u: radio de la arena (el avión no sale de él; el vórtice está en su borde). */
  arenaRadius: number;
  /** u: radio del vórtice en el agua (T159 no deja construir pegado a él). */
  vortexRadius: number;
  /**
   * u: el círculo que cubre en el agua cualquier isla construida, a su
   * tamaño de nivel 3 (decisión 8: cerca de 1/3 del diámetro del castillo;
   * todas iguales). El hueco entre vueltas del camino se mide con él.
   */
  islandRadius: number;
  path: DefensePathDef;
  /** Las islas que se construyen (decisiones 8 y 9): regla de construir y torres. */
  towers: DefenseTowersDef;
  /** Monedero al empezar (decisión 11: sólo dentro de la partida). */
  startCoins: number;
  plane: {
    /** u/s y u/s² del avión. */
    maxSpeed: number;
    acceleration: number;
    /** u: el avión empieza a esta distancia del castillo, hacia el vórtice. */
    startDistance: number;
    /** u: alcance del disparo automático. */
    range: number;
    shotSpeed: number;
    shotRadius: number;
    /**
     * Las dos mejoras (decisión 8 del plan 015), niveles 1…`DEFENSE_PLANE_MAX_LEVEL`:
     * daño por bala y velocidad de ataque (s entre disparos), con lo que
     * cuesta subir a cada nivel (del 1 al 2, …).
     */
    damage: readonly number[];
    damageCost: readonly number[];
    cooldownS: readonly number[];
    speedCost: readonly number[];
    /** u: a esta distancia del punto pedido (`moveTo`) el avión ya ha llegado. */
    arriveRadius: number;
  };
  enemies: Record<EnemyId, DefenseEnemyDef>;
  bosses: Partial<Record<BossId, DefenseEnemyDef>>;
  difficulties: Record<DifficultyId, DefenseDifficultyDef>;
  waves: {
    firstAtS: number;
    everyS: number;
    /** Comunes de la primera oleada y los que suma cada oleada. */
    baseCount: number;
    countPerWave: number;
    /** s entre uno y otro de una misma oleada. */
    spacingS: number;
    /** Crecimiento del aguante por minuto (0,2 = +20 %). */
    hpGrowthPerMinute: number;
    /** s antes del final sin oleadas nuevas (las últimas llegan a tiempo de verse). */
    quietTailS: number;
    /** «Llamar oleada» (decisión 10 del plan 015): monedas por cada s que se adelanta. */
    callCoinsPerS: number;
    mix: readonly WaveMixEntry[];
  };
  runs: Record<DefenseRunMin, DefenseRunDef>;
  score: {
    /** Puntos por toda la vida del castillo (proporcional a lo que queda). */
    lifeBonus: number;
  };
}

const DEG = Math.PI / 180;

/** Lo común de los tipos (ids del Cañón); el radio sale de `SURVIVORS_CONFIG`. */
const common = (
  kind: EnemyId,
  pace: number,
  hp: number,
  castleDamage: number,
  coins: number,
  points: number,
) =>
  ({
    kind,
    tier: 'common',
    pace,
    hp,
    castleDamage,
    coins,
    points,
  }) as const satisfies DefenseEnemyDef;

const boss = (
  kind: BossId,
  tier: 'miniboss' | 'boss',
  pace: number,
  hp: number,
  castleDamage: number,
  coins: number,
  points: number,
) => ({ kind, tier, pace, hp, castleDamage, coins, points }) as const satisfies DefenseEnemyDef;

export const DEFENSE_CONFIG: DefenseConfig = {
  version: DEFENSE_CONFIG_VERSION,
  maxPauseS: 300,
  castle: { radius: 208, life: 100, lifePerLevel: 50, upgradeCost: [250, 400, 600] },
  arenaRadius: 1120,
  vortexRadius: 90,
  islandRadius: 70,
  path: {
    width: 90,
    startAngleRad: 0,
    direction: 1,
    outerRadius: 980,
    // Del vórtice, por fuera; cuatro U hacia el castillo (entre ellas, U al
    // revés abiertas al castillo); baja por la derecha y zigzag hasta la muralla.
    legs: [
      { kind: 'orbit', toAngleRad: 86 * DEG, toRadius: 980 },
      { kind: 'u', depth: 430, radius: 135 },
      { kind: 'orbit', toAngleRad: 144 * DEG, toRadius: 980 },
      { kind: 'u', depth: 430, radius: 135 },
      { kind: 'orbit', toAngleRad: 202 * DEG, toRadius: 980 },
      { kind: 'u', depth: 430, radius: 135 },
      { kind: 'orbit', toAngleRad: 260 * DEG, toRadius: 980 },
      { kind: 'u', depth: 430, radius: 135 },
      { kind: 'orbit', toAngleRad: 296 * DEG, toRadius: 980 },
      { kind: 'orbit', toAngleRad: 338 * DEG, toRadius: 740 },
      { kind: 'zigzag', legs: 3, legLength: 230, angleRad: 40 * DEG },
    ],
    sampleStep: 10,
    normalWalkS: 44,
    cornerMinRad: 0.6,
  },
  towers: {
    pathClearance: 10,
    vortexClearance: 40,
    sellRefund: 0.6,
    bossStunScale: 0.25,
    kinds: {
      faro: {
        kind: 'faro',
        priority: null,
        cost: 100,
        upgradeCost: [80, 130],
        levels: [
          { range: 260, damagePerS: 63, beams: 1, beamWidth: 16, sweepRadPerS: 2 },
          { range: 280, damagePerS: 77, beams: 2, beamWidth: 16, sweepRadPerS: 2 },
          { range: 300, damagePerS: 91, beams: 3, beamWidth: 18, sweepRadPerS: 2 },
        ],
      },
      ultima: {
        kind: 'ultima',
        priority: 'first',
        cost: 80,
        upgradeCost: [70, 110],
        levels: [
          { range: 300, damage: 10, cooldownS: 1, stunS: 0.5 },
          { range: 320, damage: 15, cooldownS: 0.85, stunS: 0.65 },
          { range: 340, damage: 22, cooldownS: 0.7, stunS: 0.8 },
        ],
      },
      halloween: {
        kind: 'halloween',
        priority: 'first',
        cost: 90,
        upgradeCost: [75, 120],
        levels: [
          { range: 190, damage: 3.5, cooldownS: 0.4, coneRad: 0.45, burnDps: 5.5, burnS: 3 },
          { range: 205, damage: 5.5, cooldownS: 0.4, coneRad: 0.5, burnDps: 8.5, burnS: 3 },
          { range: 220, damage: 8.5, cooldownS: 0.4, coneRad: 0.55, burnDps: 12.5, burnS: 3.5 },
        ],
      },
      cala: {
        kind: 'cala',
        priority: 'first',
        cost: 120,
        upgradeCost: [100, 150],
        levels: [
          { range: 520, damage: 28, cooldownS: 2.4, blastRadius: 80, flightS: 0.9 },
          { range: 540, damage: 45, cooldownS: 2.1, blastRadius: 95, flightS: 0.9 },
          { range: 560, damage: 66, cooldownS: 1.8, blastRadius: 110, flightS: 0.9 },
        ],
      },
      tienda: {
        kind: 'tienda',
        priority: null,
        cost: 70,
        upgradeCost: [60, 90],
        levels: [
          { range: 0, coins: 10, cooldownS: 10 },
          { range: 0, coins: 16, cooldownS: 10 },
          { range: 0, coins: 24, cooldownS: 10 },
        ],
      },
      allday: {
        kind: 'allday',
        priority: null,
        cost: 100,
        upgradeCost: [80, 130],
        levels: [
          { range: 170, damage: 11, cooldownS: 1.2 },
          { range: 185, damage: 18, cooldownS: 1.2 },
          { range: 200, damage: 27, cooldownS: 1.2 },
        ],
      },
      fotos: {
        kind: 'fotos',
        priority: 'strongest',
        cost: 130,
        upgradeCost: [110, 170],
        levels: [
          { range: 560, damage: 70, cooldownS: 3 },
          { range: 600, damage: 115, cooldownS: 2.6 },
          { range: 650, damage: 175, cooldownS: 2.2 },
        ],
      },
    },
  },
  startCoins: 160,
  plane: {
    maxSpeed: 300,
    acceleration: 900,
    startDistance: 320,
    range: 380,
    shotSpeed: 900,
    shotRadius: 8,
    damage: [12, 20, 30, 42, 56],
    damageCost: [90, 180, 280, 400],
    cooldownS: [0.5, 0.43, 0.37, 0.32, 0.27],
    speedCost: [80, 150, 240, 350],
    arriveRadius: 4,
  },
  enemies: {
    piranha: common('piranha', 1.15, 26, 3, 3, 10),
    crab: common('crab', 0.7, 110, 6, 8, 25),
    gull: common('gull', 1.3, 30, 3, 4, 12),
    pirate: common('pirate', 1, 70, 5, 6, 20),
    swordfish: common('swordfish', 1.45, 55, 5, 6, 20),
    jellyfish: common('jellyfish', 0.85, 60, 4, 5, 15),
  },
  bosses: {
    vecino: boss('vecino', 'miniboss', 0.6, 1400, 25, 60, 300),
    martillo: boss('martillo', 'miniboss', 0.75, 1800, 25, 70, 350),
    fantasma: boss('fantasma', 'boss', 0.5, 4200, 50, 120, 800),
    kraken: boss('kraken', 'boss', 0.45, 6000, 60, 150, 1000),
  },
  difficulties: {
    tranquila: {
      id: 'tranquila',
      i18nKey: 'survivors.dificultad.tranquila',
      enemyHp: 0.75,
      enemyCount: 0.75,
      castleDamage: 0.7,
    },
    normal: {
      id: 'normal',
      i18nKey: 'survivors.dificultad.normal',
      enemyHp: 1.15,
      enemyCount: 1,
      castleDamage: 1,
    },
    tormenta: {
      id: 'tormenta',
      i18nKey: 'survivors.dificultad.tormenta',
      enemyHp: 1.12,
      enemyCount: 1.3,
      castleDamage: 1.3,
    },
  },
  waves: {
    firstAtS: 4,
    everyS: 15,
    baseCount: 5,
    countPerWave: 1,
    spacingS: 0.7,
    hpGrowthPerMinute: 0.35,
    quietTailS: 20,
    callCoinsPerS: 1,
    mix: [
      { kind: 'piranha', fromFrac: 0, weight: 4 },
      { kind: 'crab', fromFrac: 0.1, weight: 2 },
      { kind: 'gull', fromFrac: 0.2, weight: 2 },
      { kind: 'jellyfish', fromFrac: 0.3, weight: 2 },
      { kind: 'pirate', fromFrac: 0.4, weight: 2 },
      { kind: 'swordfish', fromFrac: 0.55, weight: 2 },
    ],
  },
  runs: {
    5: {
      min: 5,
      durationS: 300,
      bosses: [
        { kind: 'vecino', atFrac: 0.5 },
        { kind: 'fantasma', atFrac: 0.8 },
      ],
    },
    7: {
      min: 7,
      durationS: 420,
      bosses: [
        { kind: 'vecino', atFrac: 0.4 },
        { kind: 'martillo', atFrac: 0.62 },
        { kind: 'fantasma', atFrac: 0.82 },
      ],
    },
    10: {
      min: 10,
      durationS: 600,
      bosses: [
        { kind: 'vecino', atFrac: 0.3 },
        { kind: 'martillo', atFrac: 0.5 },
        { kind: 'fantasma', atFrac: 0.7 },
        { kind: 'kraken', atFrac: 0.85 },
      ],
    },
  },
  score: { lifeBonus: 1000 },
};

/** Huella estable de la configuración. */
export function defenseConfigHash(cfg: DefenseConfig = DEFENSE_CONFIG): string {
  return configHash(cfg);
}

/** La definición de un tipo (común o boss), o null si no está. */
export function defenseEnemyDef(
  cfg: DefenseConfig,
  kind: DefenseEnemyKind,
): DefenseEnemyDef | null {
  return (
    (cfg.enemies as Partial<Record<string, DefenseEnemyDef>>)[kind] ??
    cfg.bosses[kind as BossId] ??
    null
  );
}

/** El radio de choque de un tipo: el del Cañón (mismo modelo, mismo tamaño). */
export function defenseEnemyRadius(kind: DefenseEnemyKind): number {
  const e = SURVIVORS_CONFIG.enemies[kind as EnemyId];
  if (e) return e.radius;
  return SURVIVORS_CONFIG.bosses[kind as BossId]?.radius ?? 20;
}

/** Lo de una isla a su nivel (1…3, acotado). */
export function defenseTowerStats<K extends DefenseTowerKind>(
  cfg: DefenseConfig,
  kind: K,
  level: number,
): DefenseTowerStatsByKind[K] {
  const def = cfg.towers.kinds[kind] as DefenseTowerDef<K>;
  const i = Math.min(3, Math.max(1, Math.round(level))) - 1;
  return def.levels[i]!;
}

/** El nivel más alto de cada mejora del avión (decisión 8 del plan 015). */
export const DEFENSE_PLANE_MAX_LEVEL = 5;

/** Las dos mejoras del avión. */
export type DefensePlaneStat = 'damage' | 'speed';
export const DEFENSE_PLANE_STATS: readonly DefensePlaneStat[] = ['damage', 'speed'];

/** Lo que cuesta subir `stat` del nivel `level` al siguiente, o null en el máximo. */
export function defensePlaneUpgradeCost(
  cfg: DefenseConfig,
  stat: DefensePlaneStat,
  level: number,
): number | null {
  const costs = stat === 'damage' ? cfg.plane.damageCost : cfg.plane.speedCost;
  return costs[Math.max(1, Math.round(level)) - 1] ?? null;
}

/** Daño por bala del avión a su nivel de daño (1…5, acotado). */
export function defensePlaneDamage(cfg: DefenseConfig, level: number): number {
  const i = Math.min(cfg.plane.damage.length, Math.max(1, Math.round(level))) - 1;
  return cfg.plane.damage[i]!;
}

/** s entre disparos del avión a su nivel de velocidad (1…5, acotado). */
export function defensePlaneCooldown(cfg: DefenseConfig, level: number): number {
  const i = Math.min(cfg.plane.cooldownS.length, Math.max(1, Math.round(level))) - 1;
  return cfg.plane.cooldownS[i]!;
}

/** El nivel más alto del castillo (1 + sus mejoras). */
export function defenseCastleMaxLevel(cfg: DefenseConfig): number {
  return 1 + cfg.castle.upgradeCost.length;
}

/** La vida máxima del castillo a su nivel (1…, acotado). */
export function defenseCastleMaxLife(cfg: DefenseConfig, level: number): number {
  const l = Math.min(defenseCastleMaxLevel(cfg), Math.max(1, Math.round(level)));
  return cfg.castle.life + (l - 1) * cfg.castle.lifePerLevel;
}

/** Todas las vidas máximas que puede tener el castillo (para el ranking). */
export function defenseCastleMaxLives(cfg: DefenseConfig): number[] {
  return Array.from({ length: defenseCastleMaxLevel(cfg) }, (_, i) =>
    defenseCastleMaxLife(cfg, i + 1),
  );
}

/** Lo que cuesta subir el castillo del nivel `level` al siguiente, o null en el máximo. */
export function defenseCastleUpgradeCost(cfg: DefenseConfig, level: number): number | null {
  return cfg.castle.upgradeCost[Math.max(1, Math.round(level)) - 1] ?? null;
}

/** (x, y) llevado dentro de la arena (el avión nunca sale de ella: decisión 3 del plan 015). */
export function defenseClampToArena(
  cfg: DefenseConfig,
  x: number,
  y: number,
): { x: number; y: number } {
  const fx = Number.isFinite(x) ? x : 0;
  const fy = Number.isFinite(y) ? y : 0;
  const r = Math.hypot(fx, fy);
  if (r <= cfg.arenaRadius) return { x: fx, y: fy };
  const k = cfg.arenaRadius / r;
  return { x: fx * k, y: fy * k };
}
