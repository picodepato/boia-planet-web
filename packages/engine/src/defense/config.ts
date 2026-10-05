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
 * - el **camino** (decisión 5 del plan 014): una espiral hacia dentro de
 *   1¼ vueltas alrededor del castillo, con eses en la vuelta de fuera y un
 *   zigzag en la de dentro, que empieza en el vórtice (el borde de la arena)
 *   y acaba en la muralla. El mismo en todas las partidas;
 * - los **enemigos** (decisión 6): los tipos, minibosses y bosses del Cañón
 *   (sus ids y su tamaño salen de `SURVIVORS_CONFIG` por import), con su
 *   ritmo, aguante, daño al castillo y monedas propios de aquí;
 * - las **oleadas** por duración (5, 7, 10 min) y dificultad (decisión 10);
 * - el **avión** (decisión 7): dispara solo, daño a nivel 1…3 con monedas;
 * - las **monedas** (decisión 11), las **medallas** y la **puntuación**
 *   (decisión 12).
 *
 * Unidades: u de motor (las del mar de `/mar`: 16 u por unidad de escena) y
 * segundos, con el castillo en (0, 0); la vista lo lleva a su sitio del
 * mapa. Cambiar cualquier valor cambia `defenseConfigHash`; un cambio de
 * reglas sube `DEFENSE_CONFIG_VERSION`. Todo es `muestra`.
 */

/** Sube con cada cambio de reglas: el resultado y el ranking la llevan. */
export const DEFENSE_CONFIG_VERSION = 1;

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
 * mapa. Los números de cada una los pone T159.
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

/** Una sección del camino, en vueltas (0 = vórtice … `turns` = fin de la espiral). */
export interface PathSectionDef {
  kind: 's' | 'zigzag';
  fromTurn: number;
  toTurn: number;
  /** u de desvío radial (la ese a los dos lados; el zigzag sólo hacia dentro). */
  amplitude: number;
  /** Ondas de la ese o dientes del zigzag. */
  waves: number;
}

export interface DefensePathDef {
  /** u: ancho del carril (barreras a los dos lados). */
  width: number;
  /** rad: dónde está el vórtice alrededor del castillo (0 = +x). */
  startAngleRad: number;
  /** 1: la espiral gira en sentido +ángulo; −1, al revés. */
  direction: 1 | -1;
  /** u del castillo al vórtice (inicio de la espiral). */
  outerRadius: number;
  /** u del castillo al fin de la espiral (de ahí, recto a la muralla). */
  innerRadius: number;
  /** Vueltas de la espiral. */
  turns: number;
  sections: readonly PathSectionDef[];
  /** rad entre muestras de la polilínea. */
  sampleStepRad: number;
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
    life: number;
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
    cooldownS: number;
    shotSpeed: number;
    shotRadius: number;
    /** Daño por bala a nivel 1, 2 y 3. */
    damage: readonly [number, number, number];
    /** Monedas para subir a nivel 2 y a nivel 3. */
    upgradeCost: readonly [number, number];
    /** u: radio del anillo donde se construye (decisión 7; lo usa T159). */
    buildRing: number;
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
    mix: readonly WaveMixEntry[];
  };
  runs: Record<DefenseRunMin, DefenseRunDef>;
  score: {
    /** Puntos por toda la vida del castillo (proporcional a lo que queda). */
    lifeBonus: number;
  };
}

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
  castle: { radius: 208, life: 100 },
  arenaRadius: 1120,
  vortexRadius: 90,
  islandRadius: 70,
  path: {
    width: 90,
    startAngleRad: 0,
    direction: 1,
    outerRadius: 980,
    innerRadius: 430,
    turns: 1.25,
    sections: [
      // Eses en la vuelta de fuera (donde no hay otra vuelta al lado).
      { kind: 's', fromTurn: 0.3, toTurn: 0.95, amplitude: 120, waves: 2.5 },
      // Zigzag dentro, con los dientes hacia el castillo (no estrechan el hueco con la vuelta de fuera).
      { kind: 'zigzag', fromTurn: 1.0, toTurn: 1.22, amplitude: 90, waves: 4 },
    ],
    sampleStepRad: 0.01,
    normalWalkS: 40,
    cornerMinRad: 0.6,
  },
  startCoins: 120,
  plane: {
    maxSpeed: 300,
    acceleration: 900,
    startDistance: 320,
    range: 380,
    cooldownS: 0.5,
    shotSpeed: 900,
    shotRadius: 8,
    damage: [12, 20, 30],
    upgradeCost: [90, 180],
    buildRing: 260,
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
      enemyHp: 1,
      enemyCount: 1,
      castleDamage: 1,
    },
    tormenta: {
      id: 'tormenta',
      i18nKey: 'survivors.dificultad.tormenta',
      enemyHp: 1.5,
      enemyCount: 1.4,
      castleDamage: 1.4,
    },
  },
  waves: {
    firstAtS: 4,
    everyS: 15,
    baseCount: 5,
    countPerWave: 1,
    spacingS: 0.7,
    hpGrowthPerMinute: 0.2,
    quietTailS: 20,
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
