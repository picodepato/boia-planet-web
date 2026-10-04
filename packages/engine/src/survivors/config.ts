import { configHash } from '../minigames/rng';
import type { ShipConfig } from '../ship/config';
import type { QualityTier } from '../world/sectors';

/**
 * La configuración única y versionada del modo Survivors del Cañón («Que no
 * pare la música», `docs/propuestas/2026-10-04-canon-survivors.md`): todo el
 * equilibrio en datos. La estructura está pensada para los catálogos
 * completos del diseño (6 enemigos, 7 armas, 9 vinilos, 4 evoluciones, guion
 * por acto, minibosses y bosses), aunque la beta 1 (plan 009) sólo trae lo
 * suyo: pirañas, cangrejo acorazado, el Cañón de agua y seis mejoras
 * provisionales. Cambiar cualquier valor cambia `survivorsConfigHash`, que
 * entra en el `configHash` de la sesión del minijuego; un cambio de reglas
 * sube `version`. Unidades: u de motor (las del mar de `/mar`) y segundos.
 * Todo es `muestra`.
 */

/** Sube con cada cambio de reglas: la sesión la lleva y valida con ella. */
export const SURVIVORS_CONFIG_VERSION = 2;

/** Paso fijo de la simulación (s). */
export const SURVIVORS_STEP_S = 1 / 60;

// --- Catálogos (ids) ----------------------------------------------------------

/** Enemigos comunes del diseño (§6). La beta 1 trae `piranha` y `crab`. */
export type EnemyId = 'piranha' | 'crab' | 'gull' | 'pirate' | 'swordfish' | 'jellyfish';
/** Armas del diseño (§5). La beta 1 trae `canon`. */
export type WeaponId =
  | 'canon'
  | 'subwoofer'
  | 'laser'
  | 'buoys'
  | 'confetti'
  | 'fireworks'
  | 'acidRain';
/** Vinilos (pasivas) del diseño (§4). Ninguno en la beta 1. */
export type PassiveId =
  | 'techno'
  | 'reggaeton'
  | 'house'
  | 'dnb'
  | 'disco'
  | 'chill'
  | 'hardstyle'
  | 'pop'
  | 'rumba';
/** Minibosses y bosses del diseño (§7). Ninguno en la beta 1. */
export type BossId = 'vecino' | 'martillo' | 'fantasma' | 'kraken' | 'capitan';
/** Mejoras provisionales de la carta de nivel de la beta 1. */
export type UpgradeId = 'damage' | 'fireRate' | 'projectiles' | 'speed' | 'magnet' | 'bailing';

/**
 * Lo que una mejora, un vinilo o un nivel de arma puede subir. Cada uno es un
 * número que se suma al del jugador (los `…Bonus` son fracciones: 0,25 =
 * +25 %); la carta lo dice tal cual.
 */
export type StatId =
  | 'damageBonus'
  | 'fireRateBonus'
  | 'extraProjectiles'
  | 'speedBonus'
  | 'magnetBonus'
  | 'bailPerS'
  | 'areaBonus'
  | 'hullBonus'
  | 'xpBonus';

/** Figuras de las notas, de menos a más valor (los bosses: clave de sol, más adelante). */
export type NoteFigure = 'corchea' | 'negra' | 'blanca' | 'redonda';
export const NOTE_FIGURES: readonly NoteFigure[] = ['corchea', 'negra', 'blanca', 'redonda'];

/** Cómo desaparece un enemigo (§3); Hernán elige tras la beta. */
export type DefeatStyle = 'puf' | 'sumergirse';

// --- Definiciones -------------------------------------------------------------

/**
 * Comportamiento de un enemigo. La beta 1 sólo usa `chase` (ir a por el
 * barco rodeando islas); los demás son del catálogo completo.
 */
export type EnemyBehavior = 'chase' | 'flyer' | 'shooter' | 'charger' | 'splitter';

export interface EnemyDef {
  id: EnemyId;
  behavior: EnemyBehavior;
  /** u de choque (con el barco, las islas, las balas y entre ellos). */
  radius: number;
  /** u/s de crucero. */
  speed: number;
  /** u/s² para cambiar de velocidad (inercia). */
  acceleration: number;
  /** Aguante base (daño que aguanta). */
  hp: number;
  /** Agua a bordo que mete un golpe de contacto. */
  contactWater: number;
  /** Las gaviotas vuelan por encima de las islas; los demás las rodean. */
  ignoresIslands: boolean;
  /** Valor de la nota que suelta (la figura sale del valor). */
  noteValue: number;
  /** Crecimiento por minuto de partida (fracción: 0,1 = +10 % por minuto). */
  growthPerMinute: { hp: number; speed: number };
}

/** Un nivel de un arma: lo que gana respecto al anterior (la carta lo dice). */
export interface WeaponLevel {
  i18nKey: string;
  stat: StatId;
  amount: number;
}

export interface WeaponDef {
  id: WeaponId;
  /** `projectile`: bola recta que las islas bloquean. Las demás formas, en betas siguientes. */
  kind: 'projectile' | 'aura' | 'beam' | 'orbit' | 'cone' | 'rocket' | 'zone';
  maxLevel: number;
  damage: number;
  cooldownS: number;
  projectiles: number;
  /** rad entre proyectiles de una misma ráfaga. */
  spreadRad: number;
  /** u/s del proyectil. */
  speed: number;
  /** u: alcance para buscar blanco y vida del proyectil. */
  range: number;
  /** u de choque del proyectil. */
  radius: number;
  /** Enemigos que atraviesa antes de deshacerse (0: el primero lo para). */
  pierce: number;
  blockedByIslands: boolean;
  /** Tabla fija de niveles 2…`maxLevel` (vacía en la beta 1: las cartas son mejoras). */
  levels: readonly WeaponLevel[];
}

/** Vinilo: una pasiva por género, hasta nivel 5 (§4). */
export interface PassiveDef {
  id: PassiveId;
  i18nKey: string;
  stat: StatId;
  perLevel: number;
  maxLevel: number;
}

/** Arma a nivel máximo + vinilo pareja = evolución (§4). */
export interface EvolutionDef {
  id: string;
  weapon: WeaponId;
  passive: PassiveId;
  i18nKey: string;
}

/** Una fase de un boss: máquina de estados por fases con datos (§7). */
export interface BossPhase {
  untilHpFraction: number;
  attacks: readonly string[];
}

export interface BossDef {
  id: BossId;
  kind: 'miniboss' | 'boss';
  hp: number;
  radius: number;
  speed: number;
  phases: readonly BossPhase[];
}

/** Mejora de la carta de nivel: un efecto fijo y explícito. */
export interface UpgradeDef {
  id: UpgradeId;
  /** Clave de texto de la carta (`apps/web/lib/i18n/`). */
  i18nKey: string;
  stat: StatId;
  /** Lo que suma cada vez que se elige (fracción en los `…Bonus`). */
  amount: number;
  /** Veces que se puede elegir. */
  maxStacks: number;
}

/**
 * Un punto de la curva de una pista del guion: a los `atS` s, `groupsPerS`
 * grupos por segundo de `group` enemigos, con el aguante y la velocidad
 * multiplicados. Entre puntos, lineal.
 */
export interface SpawnKey {
  atS: number;
  groupsPerS: number;
  group: readonly [number, number];
  hpScale: number;
  speedScale: number;
}

/** Una pista del guion: un tipo de enemigo entre `fromS` y `toS`. */
export interface SpawnTrack {
  enemy: EnemyId;
  fromS: number;
  toS: number;
  keys: readonly SpawnKey[];
}

/** Hitos del guion (minibosses, boss, «Marea», élites): vacíos en la beta 1. */
export interface ScriptEvent {
  atS: number;
  type: 'miniboss' | 'boss' | 'marea' | 'elites';
  ref: string;
  durationS?: number;
}

/** El guion de un acto (§8): datos, no código. */
export interface ActScript {
  act: number;
  durationS: number;
  tracks: readonly SpawnTrack[];
  events: readonly ScriptEvent[];
}

export interface QualityCaps {
  enemies: number;
  projectiles: number;
  notes: number;
}

export interface SurvivorsConfig {
  version: number;
  /** s de tiempo activo para sobrevivir (amanece). */
  durationS: number;
  /** s de una pausa seguida a partir de los cuales la partida se abandona. */
  maxPauseS: number;
  defeatStyle: DefeatStyle;
  /**
   * Maniobrabilidad durante la partida sobre la del barco de `/mar`: más
   * giro, menos inercia. Factores sobre `ShipConfig`.
   */
  handling: {
    turnRateScale: number;
    accelerationScale: number;
    brakeScale: number;
    lateralGripScale: number;
  };
  /** Cámara durante la partida: más lejos y algo más alta; vuelve en `blendS`. */
  camera: { distanceScale: number; heightScale: number; blendS: number };
  /** Topes por calidad de `/mar` (`QualityTier`). */
  caps: Record<QualityTier, QualityCaps>;
  player: {
    /** Agua a bordo que inunda el barco. */
    waterCapacity: number;
    /** s de invulnerabilidad tras un golpe. */
    invulnerableS: number;
    /** Agua que baja sola por segundo sin mejoras. */
    bailPerS: number;
    /** u: radio del imán sin mejoras. */
    magnetRadius: number;
    /** u: a esta distancia del casco la nota se recoge. */
    pickupRadius: number;
    /** u/s con que el imán arrastra las notas. */
    magnetSpeed: number;
  };
  notes: {
    /** Valor de cada figura (la de una nota es la mayor que no pasa de su valor). */
    values: Record<NoteFigure, number>;
    /** u: notas más cerca que esto se funden en una de más valor. */
    mergeRadius: number;
    /** s entre pasadas de fusión. */
    mergeEveryS: number;
  };
  /** Experiencia para pasar del nivel L al L+1: base + lineal·(L−1) + cuadrática·(L−1)². */
  levels: { base: number; linear: number; quadratic: number };
  /** Opciones por carta de nivel. */
  cardChoices: number;
  spawn: {
    /** u del barco al anillo donde aparecen (fuera de la cámara por todos los lados). */
    ringMin: number;
    ringMax: number;
    /** u alrededor del centro del grupo. */
    groupSpread: number;
    /** u: más lejos que esto, el enemigo se recicla al anillo. */
    recycleDistance: number;
    /** Fuerza (aguante) extra por cada enemigo que el tope no dejó aparecer. */
    overflowStrength: number;
    /** Tope de esa fuerza extra. */
    overflowMax: number;
  };
  enemyAI: {
    /** u por delante en las que un enemigo mira si hay isla. */
    lookAhead: number;
    /** Fuerza del rodeo de islas (fracción de la velocidad). */
    avoidStrength: number;
    /** Fuerza con que se separan entre ellos. */
    separation: number;
    /** Vecinos que cada enemigo mira para separarse (tope del coste en enjambre). */
    maxNeighbours: number;
  };
  /** Celda de las rejillas espaciales (u): islas, balas y notas; `enemies`, la de los enemigos (más fina: van en enjambre). */
  gridCell: number;
  enemyGridCell: number;
  /** Para el atajo `&t=`: niveles por minuto de partida que se dan de golpe. */
  devStart: { levelsPerMinute: number; prefillS: number };
  enemies: Partial<Record<EnemyId, EnemyDef>>;
  weapons: Partial<Record<WeaponId, WeaponDef>>;
  /** Arma inicial (la de todos en la v1). */
  startingWeapon: WeaponId;
  passives: Partial<Record<PassiveId, PassiveDef>>;
  evolutions: readonly EvolutionDef[];
  bosses: Partial<Record<BossId, BossDef>>;
  upgrades: readonly UpgradeDef[];
  /** Guion por acto; la beta 1 sólo tiene el acto 1. */
  acts: readonly ActScript[];
}

export const SURVIVORS_CONFIG: SurvivorsConfig = {
  version: SURVIVORS_CONFIG_VERSION,
  durationS: 420,
  maxPauseS: 300,
  defeatStyle: 'sumergirse',
  handling: { turnRateScale: 1.35, accelerationScale: 1.6, brakeScale: 1.6, lateralGripScale: 1.5 },
  camera: { distanceScale: 1.25, heightScale: 1.15, blendS: 0.8 },
  caps: {
    alta: { enemies: 150, projectiles: 120, notes: 200 },
    baja: { enemies: 60, projectiles: 60, notes: 100 },
  },
  player: {
    waterCapacity: 100,
    invulnerableS: 0.5,
    bailPerS: 0,
    magnetRadius: 90,
    pickupRadius: 14,
    magnetSpeed: 420,
  },
  notes: {
    values: { corchea: 1, negra: 3, blanca: 8, redonda: 20 },
    mergeRadius: 36,
    mergeEveryS: 0.5,
  },
  levels: { base: 5, linear: 5, quadratic: 0.6 },
  cardChoices: 3,
  spawn: {
    ringMin: 900,
    ringMax: 1100,
    groupSpread: 60,
    recycleDistance: 1600,
    overflowStrength: 0.02,
    overflowMax: 2,
  },
  enemyAI: { lookAhead: 120, avoidStrength: 1.4, separation: 0.5, maxNeighbours: 6 },
  gridCell: 128,
  enemyGridCell: 24,
  devStart: { levelsPerMinute: 2.5, prefillS: 12 },
  enemies: {
    piranha: {
      id: 'piranha',
      behavior: 'chase',
      radius: 9,
      speed: 120,
      acceleration: 420,
      hp: 10,
      contactWater: 5,
      ignoresIslands: false,
      noteValue: 1,
      growthPerMinute: { hp: 0.12, speed: 0.01 },
    },
    crab: {
      id: 'crab',
      behavior: 'chase',
      radius: 20,
      speed: 55,
      acceleration: 120,
      hp: 60,
      contactWater: 14,
      ignoresIslands: false,
      noteValue: 8,
      growthPerMinute: { hp: 0.15, speed: 0.01 },
    },
  },
  weapons: {
    canon: {
      id: 'canon',
      kind: 'projectile',
      maxLevel: 5,
      damage: 10,
      cooldownS: 0.9,
      projectiles: 1,
      spreadRad: 0.16,
      speed: 620,
      range: 560,
      radius: 6,
      pierce: 0,
      blockedByIslands: true,
      levels: [],
    },
  },
  startingWeapon: 'canon',
  passives: {},
  evolutions: [],
  bosses: {},
  upgrades: [
    {
      id: 'damage',
      i18nKey: 'survivors.upgrade.damage',
      stat: 'damageBonus',
      amount: 0.25,
      maxStacks: 5,
    },
    {
      id: 'fireRate',
      i18nKey: 'survivors.upgrade.fireRate',
      stat: 'fireRateBonus',
      amount: 0.2,
      maxStacks: 5,
    },
    {
      id: 'projectiles',
      i18nKey: 'survivors.upgrade.projectiles',
      stat: 'extraProjectiles',
      amount: 1,
      maxStacks: 4,
    },
    {
      id: 'speed',
      i18nKey: 'survivors.upgrade.speed',
      stat: 'speedBonus',
      amount: 0.1,
      maxStacks: 5,
    },
    {
      id: 'magnet',
      i18nKey: 'survivors.upgrade.magnet',
      stat: 'magnetBonus',
      amount: 0.4,
      maxStacks: 5,
    },
    {
      id: 'bailing',
      i18nKey: 'survivors.upgrade.bailing',
      stat: 'bailPerS',
      amount: 1,
      maxStacks: 5,
    },
  ],
  acts: [
    {
      act: 1,
      durationS: 420,
      tracks: [
        {
          enemy: 'piranha',
          fromS: 0,
          toS: 420,
          keys: [
            { atS: 0, groupsPerS: 0.25, group: [2, 4], hpScale: 1, speedScale: 1 },
            { atS: 120, groupsPerS: 0.5, group: [4, 7], hpScale: 1.4, speedScale: 1 },
            { atS: 240, groupsPerS: 0.7, group: [5, 9], hpScale: 2, speedScale: 1.03 },
            { atS: 420, groupsPerS: 1, group: [6, 12], hpScale: 3, speedScale: 1.05 },
          ],
        },
        {
          enemy: 'crab',
          fromS: 60,
          toS: 420,
          keys: [
            { atS: 60, groupsPerS: 0.08, group: [1, 1], hpScale: 1, speedScale: 1 },
            { atS: 240, groupsPerS: 0.18, group: [1, 2], hpScale: 1.6, speedScale: 1 },
            { atS: 420, groupsPerS: 0.3, group: [1, 3], hpScale: 2.4, speedScale: 1.1 },
          ],
        },
      ],
      events: [],
    },
  ],
};

/** Huella estable de la configuración: entra en el `configHash` de la sesión. */
export function survivorsConfigHash(cfg: SurvivorsConfig = SURVIVORS_CONFIG): string {
  return configHash(cfg);
}

/** Experiencia para pasar del nivel `level` al siguiente. */
export function xpToNext(cfg: SurvivorsConfig, level: number): number {
  const n = Math.max(0, level - 1);
  return Math.round(cfg.levels.base + cfg.levels.linear * n + cfg.levels.quadratic * n * n);
}

/** La figura de una nota de valor `value`: la mayor que no lo pasa. */
export function figureOf(cfg: SurvivorsConfig, value: number): NoteFigure {
  let best: NoteFigure = 'corchea';
  for (const f of NOTE_FIGURES) if (cfg.notes.values[f] <= value) best = f;
  return best;
}

/**
 * La física del barco durante la partida: la de `/mar` con la
 * maniobrabilidad de la config y la velocidad de las mejoras (`speedBonus`).
 */
export function survivorsShipConfig(
  base: ShipConfig,
  handling: SurvivorsConfig['handling'],
  speedBonus = 0,
): ShipConfig {
  const speed = 1 + speedBonus;
  const out: ShipConfig = {
    ...base,
    maxSpeed: base.maxSpeed * speed,
    acceleration: base.acceleration * handling.accelerationScale * speed,
    brakeDeceleration: base.brakeDeceleration * handling.brakeScale,
    turnRate: base.turnRate * handling.turnRateScale,
    lateralGrip: base.lateralGrip * handling.lateralGripScale,
  };
  if (base.turnRadius !== undefined) out.turnRadius = base.turnRadius / handling.turnRateScale;
  return out;
}

/** La curva de una pista en el segundo `t` (null fuera de su tramo). */
export function trackAt(track: SpawnTrack, t: number): SpawnKey | null {
  if (t < track.fromS || t >= track.toS || track.keys.length === 0) return null;
  const keys = track.keys;
  if (t <= keys[0]!.atS) return keys[0]!;
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i]!;
    if (t > b.atS) continue;
    const a = keys[i - 1]!;
    const f = (t - a.atS) / Math.max(1e-9, b.atS - a.atS);
    const lerp = (x: number, y: number) => x + (y - x) * f;
    return {
      atS: t,
      groupsPerS: lerp(a.groupsPerS, b.groupsPerS),
      group: [lerp(a.group[0], b.group[0]), lerp(a.group[1], b.group[1])],
      hpScale: lerp(a.hpScale, b.hpScale),
      speedScale: lerp(a.speedScale, b.speedScale),
    };
  }
  return keys[keys.length - 1]!;
}
