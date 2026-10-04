import { configHash } from '../minigames/rng';
import type { ShipConfig } from '../ship/config';
import type { QualityTier } from '../world/sectors';

/**
 * La configuración única y versionada del modo Survivors del Cañón («Que no
 * pare la música», `docs/propuestas/2026-10-04-canon-survivors.md`): todo el
 * equilibrio en datos. La estructura está pensada para los catálogos
 * completos del diseño (6 enemigos, 7 armas, 9 vinilos, 4 evoluciones, guion
 * por acto, minibosses y bosses). La beta 1 (plan 010) trajo pirañas,
 * cangrejo, el Cañón de agua y seis mejoras provisionales; la beta 2 (plan
 * 011) trae los 6 enemigos, las élites, la «Marea» y el guion entero del
 * acto 1 con los huecos de los bosses apagados (beta 3), y las 7 armas con
 * su tabla fija por nivel (`weapons`, `resolveWeaponStats`), los 9 vinilos,
 * los huecos 4+4, las evoluciones y el Salvavidas raro.
 * Cambiar cualquier valor cambia `survivorsConfigHash`, que
 * entra en el `configHash` de la sesión del minijuego; un cambio de reglas
 * sube `version`. Unidades: u de motor (las del mar de `/mar`) y segundos.
 * Todo es `muestra`.
 */

/** Sube con cada cambio de reglas: la sesión la lleva y valida con ella. */
export const SURVIVORS_CONFIG_VERSION = 5;

/** Paso fijo de la simulación (s). */
export const SURVIVORS_STEP_S = 1 / 60;

// --- Catálogos (ids) ----------------------------------------------------------

/** Enemigos comunes del diseño (§6). La beta 1 trae `piranha` y `crab`. */
export type EnemyId = 'piranha' | 'crab' | 'gull' | 'pirate' | 'swordfish' | 'jellyfish';
/** Armas del diseño (§5): las 7 de la beta 2. */
export type WeaponId =
  | 'canon'
  | 'subwoofer'
  | 'laser'
  | 'buoys'
  | 'confetti'
  | 'fireworks'
  | 'acidRain';
/** Vinilos (pasivas) del diseño (§4). */
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

/** Dificultades que se eligen en el panel de la isla (beta 2, plan 011 T131). */
export type DifficultyId = 'tranquila' | 'normal' | 'tormenta';
export const DIFFICULTY_IDS: readonly DifficultyId[] = ['tranquila', 'normal', 'tormenta'];
/** La que va marcada de entrada. */
export const DEFAULT_DIFFICULTY: DifficultyId = 'normal';

/**
 * Una dificultad: sólo multiplicadores sobre lo enemigo. No toca el premio,
 * la duración ni `won`. `muestra`.
 */
export interface DifficultyDef {
  id: DifficultyId;
  i18nKey: string;
  /** Sobre el agua que mete cada golpe (contacto y disparos). */
  enemyDamage: number;
  /** Sobre el aguante de cada enemigo que aparece. */
  enemyHp: number;
  /** Sobre cuántos enemigos echa el guion (grupos por segundo y anillos de la Marea). */
  enemyCount: number;
}

/** El id si `v` es una dificultad; si no, null. */
export function asDifficulty(v: string | null | undefined): DifficultyId | null {
  return DIFFICULTY_IDS.find((d) => d === v) ?? null;
}

/** Cómo desaparece un enemigo (§3); Hernán elige tras la beta. */
export type DefeatStyle = 'puf' | 'sumergirse';

// --- Definiciones -------------------------------------------------------------

/**
 * Comportamiento de un enemigo (§6): `chase` va a por el barco rodeando
 * islas (pirañas, cangrejo); `flyer` igual pero por encima de las islas
 * (gaviota); `shooter` se para a distancia y dispara recto (pirata);
 * `charger` avisa con una línea en el agua y embiste recto (pez espada);
 * `splitter` persigue y al caer se parte en pequeños (medusa).
 */
export type EnemyBehavior = 'chase' | 'flyer' | 'shooter' | 'charger' | 'splitter';

/** Fase en que está un enemigo; la pantalla puede pintarla (quieto, aviso, embestida…). */
export type EnemyPhase = 'move' | 'aim' | 'telegraph' | 'charge' | 'rest';

/** Tirador (`shooter`): se para a `standoff` u y dispara recto cada `cooldownS`. */
export interface ShooterDef {
  /** u: a esta distancia del barco se para. */
  standoff: number;
  /** u: más lejos que esto vuelve a acercarse. */
  resume: number;
  /** u: sólo dispara con el barco más cerca que esto. */
  range: number;
  cooldownS: number;
  /** s antes del primer disparo al ponerse a tiro. */
  firstShotS: number;
  projectile: {
    /** u/s. */
    speed: number;
    radius: number;
    /** Agua a bordo que mete. */
    water: number;
    /** u: vida del disparo. */
    range: number;
  };
}

/** Embestida (`charger`): a `windupRange` u se para, avisa `telegraphS` s y carga recto. */
export interface ChargerDef {
  /** u: a esta distancia del barco empieza el aviso. */
  windupRange: number;
  /** s de aviso (la línea en el agua), quieto. */
  telegraphS: number;
  /** u/s de la embestida (el único enemigo más rápido que el barco: va avisado). */
  chargeSpeed: number;
  /** u que recorre la embestida (y largo de la línea de aviso). */
  chargeDistance: number;
  /** s de descanso tras la embestida antes de volver a perseguir. */
  restS: number;
}

/** Divisor (`splitter`): al caer se parte en `count` iguales más pequeños. */
export interface SplitDef {
  count: number;
  /** Tamaño de cada trozo respecto al padre (radio). */
  scale: number;
  /** Aguante de cada trozo respecto al aguante máximo del padre. */
  hpScale: number;
  /** Nota de cada trozo respecto a la del padre. */
  noteScale: number;
  /** Veces que se puede partir (1: los trozos ya no se parten). */
  generations: number;
}

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
  /** Sólo los `shooter`. */
  shooter?: ShooterDef;
  /** Sólo los `charger`. */
  charger?: ChargerDef;
  /** Sólo los `splitter`. */
  split?: SplitDef;
}

/**
 * Élites (§6): desde el hito `elites` del guion, una parte de lo que
 * aparece sale élite: más aguante, mejor nota y una marca para la pantalla.
 */
export interface ElitesDef {
  /** Fracción de lo que aparece que sale élite. */
  chance: number;
  hpScale: number;
  noteScale: number;
  radiusScale: number;
  speedScale: number;
}

/** «Marea» (§8): durante el hito, un anillo de `count` enemigos cada `burstEveryS` s desde todos lados. */
export interface MareaDef {
  enemy: EnemyId;
  count: number;
  burstEveryS: number;
  hpScale: number;
  speedScale: number;
}

/**
 * Cómo ataca un arma (§5). Las formas rectas (`projectile`, `cone`) son
 * proyectiles que las islas paran; las demás pasan por encima.
 * - `projectile`: bola(s) al enemigo más cercano (Cañón de agua).
 * - `cone`: ráfaga en abanico hacia donde navega el barco (Cañón de confeti).
 * - `aura`: círculo alrededor del barco que golpea cada tic (Subwoofer).
 * - `beam`: rayo(s) que giran alrededor del barco y golpean cada tic (Láser).
 * - `orbit`: boyas que orbitan el barco y golpean cada tic (Boyas orbitales).
 * - `rocket`: cohete(s) a enemigos al azar que explotan en área (Fuegos).
 * - `zone`: nube quieta sobre un grupo que daña cada segundo (Lluvia ácida).
 */
export type WeaponKind = 'projectile' | 'aura' | 'beam' | 'orbit' | 'cone' | 'rocket' | 'zone';

/**
 * Los números de un arma en un nivel. Qué significa cada uno depende de la
 * forma (`WeaponKind`); los que no usa van a 0:
 * - `damage`: por golpe (proyectil, cohete al explotar) o por tic (aura, rayo, boya, nube).
 * - `cooldownS`: s entre disparos (proyectil, abanico, cohete, nube).
 * - `tickS`: s entre golpes de un aura, rayo, boya o nube.
 * - `count`: bolas por ráfaga, cohetes por disparo, rayos, boyas o nubes por disparo.
 * - `area` (u): radio de la bola o del cohete en vuelo, del aura, de la boya,
 *   de la explosión, de la nube; medio ancho del rayo.
 * - `range` (u): alcance para buscar blanco y vida de bolas y cohetes; largo
 *   del rayo; radio de la órbita de las boyas.
 * - `speed`: u/s de bolas y cohetes; rad/s del giro del rayo y de las boyas.
 * - `spreadRad`: rad entre proyectiles de una misma ráfaga.
 * - `pierce`: enemigos que una bola atraviesa antes de deshacerse.
 * - `durationS`: s que dura una nube.
 */
export interface WeaponStats {
  damage: number;
  cooldownS: number;
  tickS: number;
  count: number;
  area: number;
  range: number;
  speed: number;
  spreadRad: number;
  pierce: number;
  durationS: number;
}

export type WeaponStatId = keyof WeaponStats;

/** Lo que un nivel suma (o resta, en los tiempos) a un número del arma. */
export interface WeaponGain {
  stat: WeaponStatId;
  amount: number;
}

/** Un nivel de un arma (2…`maxLevel`): lo que gana respecto al anterior (la carta lo dice tal cual). */
export interface WeaponLevel {
  i18nKey: string;
  gains: readonly WeaponGain[];
}

export interface WeaponDef {
  id: WeaponId;
  kind: WeaponKind;
  /** Clave de texto del nombre (`apps/web/lib/i18n/`). */
  i18nKey: string;
  maxLevel: number;
  /** Los números a nivel 1. */
  base: WeaponStats;
  /** Tabla fija de los niveles 2…`maxLevel`, en orden (maxLevel - 1 entradas).
   * Las evoluciones son terminales: base contiene sus cifras finales y levels queda vacio.
   */
  levels: readonly WeaponLevel[];
  /** Sólo las formas rectas: una isla para el proyectil. */
  blockedByIslands: boolean;
  /** Si `extraProjectiles` (la mejora o el vinilo Rumba) suma a `count`. */
  extraProjectilesApply: boolean;
  /** Evoluciones: comportamiento adicional, con todos sus numeros en datos. */
  effects?: {
    /** area es el radio de explosion; esto es el radio de la bola en vuelo. */
    projectileRadius?: number;
    /** u de empuje por pulso, contra islas y con wrap. */
    pushDistance?: number;
    /** Destellos rectos desde cada orbital, sin bloqueo de islas. */
    flashes?: { count: number; range: number; speed: number; radius: number; cooldownS: number };
  };
}

/**
 * Lo que las mejoras y los vinilos (T129) cambian de todas las armas a la
 * vez: fracciones (0,25 = +25 %) salvo `extraProjectiles`, que suma unidades.
 * Es el gancho del sistema de armas: `resolveWeaponStats` lo aplica.
 */
export interface WeaponModifiers {
  damageBonus: number;
  /** Acorta `cooldownS` y `tickS` (÷ (1 + bonus)). */
  fireRateBonus: number;
  areaBonus: number;
  extraProjectiles: number;
}

/** Vinilo: una pasiva por género, hasta nivel 5 (§4). */
export interface PassiveDef {
  id: PassiveId;
  i18nKey: string;
  stat: StatId;
  maxLevel: number;
  /** Incrementos fijos, no totales: levels[0] da nivel 1. */
  levels: readonly { i18nKey: string; amount: number }[];
}

/** Arma a nivel máximo + vinilo pareja = evolución (§4). */
export type EvolutionId = 'drop' | 'soundWall' | 'laserShow' | 'discoBall';

export interface EvolutionDef {
  id: EvolutionId;
  weapon: WeaponId;
  passive: PassiveId;
  i18nKey: string;
  /** Sustituye al arma en su hueco; se resuelve con los mismos modificadores. */
  evolvedWeapon: WeaponDef;
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

/**
 * Hitos del guion: «Marea» y élites (beta 2), minibosses y boss (sus huecos
 * van `enabled: false` hasta la beta 3, que sólo los rellena).
 */
export interface ScriptEvent {
  atS: number;
  type: 'miniboss' | 'boss' | 'marea' | 'elites';
  /** `marea`/`elites`: la clave de la config; `miniboss`/`boss`: el `BossId`. */
  ref: string;
  durationS?: number;
  /** false: el hueco existe pero la simulación lo ignora. Sin valor, activo. */
  enabled?: boolean;
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
  /** Bolas del jugador. */
  projectiles: number;
  /** Disparos de los enemigos (pistolas de agua). */
  enemyProjectiles: number;
  /** Zonas de daño en el agua (nubes de lluvia ácida). */
  areas: number;
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
  slots: { weapons: number; vinyls: number };
  /** Beta 2: cartas de nivel. Beta 3 puede cambiarlo a chest sin duplicar condiciones. */
  evolutionSource: 'level-up' | 'chest';
  salvavidas: {
    i18nKey: string;
    textKey: string;
    /** Probabilidad por oferta; nunca se vuelve a ofrecer tras adquirirlo. */
    offerChance: number;
    waterFractionAfterSave: number;
    invulnerableS: number;
  };
  fallback: { id: 'bailing'; i18nKey: string; textKey: string; waterRemoved: number };
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
  /** Élites e hitos del guion, por la clave `ref` del `ScriptEvent`. */
  elites: Record<string, ElitesDef>;
  marea: Record<string, MareaDef>;
  weapons: Partial<Record<WeaponId, WeaponDef>>;
  /** Arma inicial (la de todos en la v1). */
  startingWeapon: WeaponId;
  passives: Partial<Record<PassiveId, PassiveDef>>;
  evolutions: readonly EvolutionDef[];
  /** Tranquila / Normal / Tormenta (T131). */
  difficulties: Record<DifficultyId, DifficultyDef>;
  bosses: Partial<Record<BossId, BossDef>>;
  /** Compatibilidad beta 1: no participa en el pool. */
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
    alta: { enemies: 150, projectiles: 120, enemyProjectiles: 80, areas: 12, notes: 200 },
    baja: { enemies: 60, projectiles: 60, enemyProjectiles: 40, areas: 6, notes: 100 },
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
  slots: { weapons: 4, vinyls: 4 },
  evolutionSource: 'level-up',
  salvavidas: {
    i18nKey: 'survivors.salvavidas',
    textKey: 'survivors.salvavidas.efecto',
    offerChance: 0.03,
    waterFractionAfterSave: 0.25,
    invulnerableS: 2,
  },
  fallback: {
    id: 'bailing',
    i18nKey: 'survivors.fallback.bailing',
    textKey: 'survivors.fallback.bailing.efecto',
    waterRemoved: 25,
  },
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
    // Gaviota aguafiestas: vuela por encima de las islas; débil y algo rápida
    // (por debajo de los 150 u/s del barco, como todo lo que no avisa).
    gull: {
      id: 'gull',
      behavior: 'flyer',
      radius: 10,
      speed: 110,
      acceleration: 300,
      hp: 14,
      contactWater: 6,
      ignoresIslands: true,
      noteValue: 3,
      growthPerMinute: { hp: 0.12, speed: 0.015 },
    },
    // Pirata en un botecito: se para a distancia y dispara con la pistola de
    // agua, recto; las islas paran sus disparos (y los del barco).
    pirate: {
      id: 'pirate',
      behavior: 'shooter',
      radius: 16,
      speed: 85,
      acceleration: 160,
      hp: 40,
      contactWater: 8,
      ignoresIslands: false,
      noteValue: 8,
      growthPerMinute: { hp: 0.15, speed: 0.01 },
      shooter: {
        standoff: 320,
        resume: 420,
        range: 480,
        cooldownS: 2.2,
        firstShotS: 0.8,
        projectile: { speed: 300, radius: 6, water: 6, range: 560 },
      },
    },
    // Pez espada: a tiro, se para, avisa con una línea en el agua y embiste
    // recto. La embestida es lo único más rápido que el barco: va avisada.
    swordfish: {
      id: 'swordfish',
      behavior: 'charger',
      radius: 13,
      speed: 95,
      acceleration: 260,
      hp: 45,
      contactWater: 12,
      ignoresIslands: false,
      noteValue: 8,
      growthPerMinute: { hp: 0.15, speed: 0.01 },
      charger: {
        windupRange: 380,
        telegraphS: 0.9,
        chargeSpeed: 400,
        chargeDistance: 560,
        restS: 1.2,
      },
    },
    // Medusa: lenta; al caer se parte en 2 pequeñas (que ya no se parten).
    jellyfish: {
      id: 'jellyfish',
      behavior: 'splitter',
      radius: 14,
      speed: 50,
      acceleration: 90,
      hp: 30,
      contactWater: 7,
      ignoresIslands: false,
      noteValue: 3,
      growthPerMinute: { hp: 0.12, speed: 0.01 },
      split: { count: 2, scale: 0.6, hpScale: 0.5, noteScale: 0.34, generations: 1 },
    },
  },
  elites: {
    elites: { chance: 0.1, hpScale: 3, noteScale: 4, radiusScale: 1.25, speedScale: 1 },
  },
  marea: {
    marea: { enemy: 'piranha', count: 20, burstEveryS: 2.5, hpScale: 1, speedScale: 1 },
  },
  // Las 7 armas (§5), cada una con su tabla fija: la carta dice exactamente
  // qué da cada nivel («Nivel 3: +1 boya»). Lo que no es recto pasa por
  // encima de las islas. Las claves de texto las rellena la beta 2 (T129/T130).
  weapons: {
    canon: {
      id: 'canon',
      kind: 'projectile',
      i18nKey: 'survivors.weapon.canon',
      maxLevel: 5,
      base: {
        damage: 10,
        cooldownS: 0.9,
        tickS: 0,
        count: 1,
        area: 6,
        range: 560,
        speed: 620,
        spreadRad: 0.16,
        pierce: 0,
        durationS: 0,
      },
      levels: [
        { i18nKey: 'survivors.weapon.canon.l2', gains: [{ stat: 'damage', amount: 5 }] },
        { i18nKey: 'survivors.weapon.canon.l3', gains: [{ stat: 'count', amount: 1 }] },
        { i18nKey: 'survivors.weapon.canon.l4', gains: [{ stat: 'cooldownS', amount: -0.2 }] },
        { i18nKey: 'survivors.weapon.canon.l5', gains: [{ stat: 'pierce', amount: 1 }] },
      ],
      blockedByIslands: true,
      extraProjectilesApply: true,
    },
    // Subwoofer: aura de graves; golpea a todo lo que entra cada medio segundo.
    subwoofer: {
      id: 'subwoofer',
      kind: 'aura',
      i18nKey: 'survivors.weapon.subwoofer',
      maxLevel: 5,
      base: {
        damage: 6,
        cooldownS: 0,
        tickS: 0.5,
        count: 1,
        area: 110,
        range: 0,
        speed: 0,
        spreadRad: 0,
        pierce: 0,
        durationS: 0,
      },
      levels: [
        { i18nKey: 'survivors.weapon.subwoofer.l2', gains: [{ stat: 'area', amount: 20 }] },
        { i18nKey: 'survivors.weapon.subwoofer.l3', gains: [{ stat: 'damage', amount: 4 }] },
        { i18nKey: 'survivors.weapon.subwoofer.l4', gains: [{ stat: 'area', amount: 25 }] },
        { i18nKey: 'survivors.weapon.subwoofer.l5', gains: [{ stat: 'tickS', amount: -0.15 }] },
      ],
      blockedByIslands: false,
      extraProjectilesApply: false,
    },
    // Láser de festival: un rayo que gira alrededor del barco (dos a nivel 5).
    laser: {
      id: 'laser',
      kind: 'beam',
      i18nKey: 'survivors.weapon.laser',
      maxLevel: 5,
      base: {
        damage: 8,
        cooldownS: 0,
        tickS: 0.25,
        count: 1,
        area: 10,
        range: 260,
        speed: 1.6,
        spreadRad: 0,
        pierce: 0,
        durationS: 0,
      },
      levels: [
        { i18nKey: 'survivors.weapon.laser.l2', gains: [{ stat: 'range', amount: 60 }] },
        { i18nKey: 'survivors.weapon.laser.l3', gains: [{ stat: 'damage', amount: 5 }] },
        { i18nKey: 'survivors.weapon.laser.l4', gains: [{ stat: 'tickS', amount: -0.05 }] },
        { i18nKey: 'survivors.weapon.laser.l5', gains: [{ stat: 'count', amount: 1 }] },
      ],
      blockedByIslands: false,
      extraProjectilesApply: false,
    },
    // Boyas orbitales: 2 boyas BOIA en órbita (3 a nivel 3) que golpean al pasar.
    buoys: {
      id: 'buoys',
      kind: 'orbit',
      i18nKey: 'survivors.weapon.buoys',
      maxLevel: 5,
      base: {
        damage: 12,
        cooldownS: 0,
        tickS: 0.4,
        count: 2,
        area: 14,
        range: 70,
        speed: 2.2,
        spreadRad: 0,
        pierce: 0,
        durationS: 0,
      },
      levels: [
        { i18nKey: 'survivors.weapon.buoys.l2', gains: [{ stat: 'damage', amount: 6 }] },
        { i18nKey: 'survivors.weapon.buoys.l3', gains: [{ stat: 'count', amount: 1 }] },
        { i18nKey: 'survivors.weapon.buoys.l4', gains: [{ stat: 'area', amount: 4 }] },
        { i18nKey: 'survivors.weapon.buoys.l5', gains: [{ stat: 'damage', amount: 10 }] },
      ],
      blockedByIslands: false,
      extraProjectilesApply: false,
    },
    // Cañón de confeti: ráfaga en abanico hacia donde navega el barco; recta,
    // las islas la paran; cada confeti atraviesa un enemigo.
    confetti: {
      id: 'confetti',
      kind: 'cone',
      i18nKey: 'survivors.weapon.confetti',
      maxLevel: 5,
      base: {
        damage: 6,
        cooldownS: 1.4,
        tickS: 0,
        count: 5,
        area: 5,
        range: 320,
        speed: 520,
        spreadRad: 0.22,
        pierce: 1,
        durationS: 0,
      },
      levels: [
        { i18nKey: 'survivors.weapon.confetti.l2', gains: [{ stat: 'count', amount: 2 }] },
        { i18nKey: 'survivors.weapon.confetti.l3', gains: [{ stat: 'damage', amount: 4 }] },
        { i18nKey: 'survivors.weapon.confetti.l4', gains: [{ stat: 'cooldownS', amount: -0.3 }] },
        { i18nKey: 'survivors.weapon.confetti.l5', gains: [{ stat: 'pierce', amount: 1 }] },
      ],
      blockedByIslands: true,
      extraProjectilesApply: true,
    },
    // Fuegos artificiales: cohetes a enemigos al azar (a tiro) que explotan
    // en área al llegar; vuelan por encima de las islas.
    fireworks: {
      id: 'fireworks',
      kind: 'rocket',
      i18nKey: 'survivors.weapon.fireworks',
      maxLevel: 5,
      base: {
        damage: 25,
        cooldownS: 2.2,
        tickS: 0,
        count: 1,
        area: 60,
        range: 700,
        speed: 380,
        spreadRad: 0,
        pierce: 0,
        durationS: 0,
      },
      levels: [
        { i18nKey: 'survivors.weapon.fireworks.l2', gains: [{ stat: 'area', amount: 15 }] },
        { i18nKey: 'survivors.weapon.fireworks.l3', gains: [{ stat: 'count', amount: 1 }] },
        { i18nKey: 'survivors.weapon.fireworks.l4', gains: [{ stat: 'damage', amount: 15 }] },
        { i18nKey: 'survivors.weapon.fireworks.l5', gains: [{ stat: 'cooldownS', amount: -0.6 }] },
      ],
      blockedByIslands: false,
      extraProjectilesApply: true,
    },
    // Lluvia ácida: una nube sobre el grupo más apretado a tiro; daña cada
    // segundo a lo que tiene debajo mientras dura.
    acidRain: {
      id: 'acidRain',
      kind: 'zone',
      i18nKey: 'survivors.weapon.acidRain',
      maxLevel: 5,
      base: {
        damage: 7,
        cooldownS: 5,
        tickS: 1,
        count: 1,
        area: 90,
        range: 600,
        speed: 0,
        spreadRad: 0,
        pierce: 0,
        durationS: 4,
      },
      levels: [
        { i18nKey: 'survivors.weapon.acidRain.l2', gains: [{ stat: 'area', amount: 25 }] },
        { i18nKey: 'survivors.weapon.acidRain.l3', gains: [{ stat: 'damage', amount: 5 }] },
        { i18nKey: 'survivors.weapon.acidRain.l4', gains: [{ stat: 'durationS', amount: 2 }] },
        { i18nKey: 'survivors.weapon.acidRain.l5', gains: [{ stat: 'cooldownS', amount: -1.5 }] },
      ],
      blockedByIslands: false,
      extraProjectilesApply: false,
    },
  },
  startingWeapon: 'canon',
  passives: {
    techno: {
      id: 'techno',
      i18nKey: 'survivors.vinyl.techno',
      stat: 'fireRateBonus',
      maxLevel: 5,
      levels: [
        { i18nKey: 'survivors.vinyl.techno.l1', amount: 0.15 },
        { i18nKey: 'survivors.vinyl.techno.l2', amount: 0.15 },
        { i18nKey: 'survivors.vinyl.techno.l3', amount: 0.15 },
        { i18nKey: 'survivors.vinyl.techno.l4', amount: 0.15 },
        { i18nKey: 'survivors.vinyl.techno.l5', amount: 0.15 },
      ],
    },
    reggaeton: {
      id: 'reggaeton',
      i18nKey: 'survivors.vinyl.reggaeton',
      stat: 'areaBonus',
      maxLevel: 5,
      levels: [
        { i18nKey: 'survivors.vinyl.reggaeton.l1', amount: 0.15 },
        { i18nKey: 'survivors.vinyl.reggaeton.l2', amount: 0.15 },
        { i18nKey: 'survivors.vinyl.reggaeton.l3', amount: 0.15 },
        { i18nKey: 'survivors.vinyl.reggaeton.l4', amount: 0.15 },
        { i18nKey: 'survivors.vinyl.reggaeton.l5', amount: 0.15 },
      ],
    },
    house: {
      id: 'house',
      i18nKey: 'survivors.vinyl.house',
      stat: 'hullBonus',
      maxLevel: 5,
      levels: [
        { i18nKey: 'survivors.vinyl.house.l1', amount: 0.08 },
        { i18nKey: 'survivors.vinyl.house.l2', amount: 0.08 },
        { i18nKey: 'survivors.vinyl.house.l3', amount: 0.08 },
        { i18nKey: 'survivors.vinyl.house.l4', amount: 0.08 },
        { i18nKey: 'survivors.vinyl.house.l5', amount: 0.08 },
      ],
    },
    dnb: {
      id: 'dnb',
      i18nKey: 'survivors.vinyl.dnb',
      stat: 'speedBonus',
      maxLevel: 5,
      levels: [
        { i18nKey: 'survivors.vinyl.dnb.l1', amount: 0.1 },
        { i18nKey: 'survivors.vinyl.dnb.l2', amount: 0.1 },
        { i18nKey: 'survivors.vinyl.dnb.l3', amount: 0.1 },
        { i18nKey: 'survivors.vinyl.dnb.l4', amount: 0.1 },
        { i18nKey: 'survivors.vinyl.dnb.l5', amount: 0.1 },
      ],
    },
    disco: {
      id: 'disco',
      i18nKey: 'survivors.vinyl.disco',
      stat: 'magnetBonus',
      maxLevel: 5,
      levels: [
        { i18nKey: 'survivors.vinyl.disco.l1', amount: 0.4 },
        { i18nKey: 'survivors.vinyl.disco.l2', amount: 0.4 },
        { i18nKey: 'survivors.vinyl.disco.l3', amount: 0.4 },
        { i18nKey: 'survivors.vinyl.disco.l4', amount: 0.4 },
        { i18nKey: 'survivors.vinyl.disco.l5', amount: 0.4 },
      ],
    },
    chill: {
      id: 'chill',
      i18nKey: 'survivors.vinyl.chill',
      stat: 'bailPerS',
      maxLevel: 5,
      levels: [
        { i18nKey: 'survivors.vinyl.chill.l1', amount: 1 },
        { i18nKey: 'survivors.vinyl.chill.l2', amount: 1 },
        { i18nKey: 'survivors.vinyl.chill.l3', amount: 1 },
        { i18nKey: 'survivors.vinyl.chill.l4', amount: 1 },
        { i18nKey: 'survivors.vinyl.chill.l5', amount: 1 },
      ],
    },
    hardstyle: {
      id: 'hardstyle',
      i18nKey: 'survivors.vinyl.hardstyle',
      stat: 'damageBonus',
      maxLevel: 5,
      levels: [
        { i18nKey: 'survivors.vinyl.hardstyle.l1', amount: 0.2 },
        { i18nKey: 'survivors.vinyl.hardstyle.l2', amount: 0.2 },
        { i18nKey: 'survivors.vinyl.hardstyle.l3', amount: 0.2 },
        { i18nKey: 'survivors.vinyl.hardstyle.l4', amount: 0.2 },
        { i18nKey: 'survivors.vinyl.hardstyle.l5', amount: 0.2 },
      ],
    },
    pop: {
      id: 'pop',
      i18nKey: 'survivors.vinyl.pop',
      stat: 'xpBonus',
      maxLevel: 5,
      levels: [
        { i18nKey: 'survivors.vinyl.pop.l1', amount: 0.15 },
        { i18nKey: 'survivors.vinyl.pop.l2', amount: 0.15 },
        { i18nKey: 'survivors.vinyl.pop.l3', amount: 0.15 },
        { i18nKey: 'survivors.vinyl.pop.l4', amount: 0.15 },
        { i18nKey: 'survivors.vinyl.pop.l5', amount: 0.15 },
      ],
    },
    rumba: {
      id: 'rumba',
      i18nKey: 'survivors.vinyl.rumba',
      stat: 'extraProjectiles',
      maxLevel: 5,
      levels: [
        { i18nKey: 'survivors.vinyl.rumba.l1', amount: 1 },
        { i18nKey: 'survivors.vinyl.rumba.l2', amount: 1 },
        { i18nKey: 'survivors.vinyl.rumba.l3', amount: 1 },
        { i18nKey: 'survivors.vinyl.rumba.l4', amount: 1 },
        { i18nKey: 'survivors.vinyl.rumba.l5', amount: 1 },
      ],
    },
  },
  evolutions: [
    {
      id: 'drop',
      weapon: 'canon',
      passive: 'hardstyle',
      i18nKey: 'survivors.evolution.drop',
      evolvedWeapon: {
        id: 'canon',
        kind: 'projectile',
        i18nKey: 'survivors.evolution.drop',
        maxLevel: 5,
        base: {
          damage: 28,
          cooldownS: 0.6,
          tickS: 0,
          count: 2,
          area: 90,
          range: 650,
          speed: 680,
          spreadRad: 0.16,
          pierce: 0,
          durationS: 0,
        },
        levels: [],
        blockedByIslands: true,
        extraProjectilesApply: true,
        effects: { projectileRadius: 6 },
      },
    },
    {
      id: 'soundWall',
      weapon: 'subwoofer',
      passive: 'house',
      i18nKey: 'survivors.evolution.soundWall',
      evolvedWeapon: {
        id: 'subwoofer',
        kind: 'aura',
        i18nKey: 'survivors.evolution.soundWall',
        maxLevel: 5,
        base: {
          damage: 18,
          cooldownS: 0,
          tickS: 0.3,
          count: 1,
          area: 260,
          range: 0,
          speed: 0,
          spreadRad: 0,
          pierce: 0,
          durationS: 0,
        },
        levels: [],
        blockedByIslands: false,
        extraProjectilesApply: false,
        effects: { pushDistance: 35 },
      },
    },
    {
      id: 'laserShow',
      weapon: 'laser',
      passive: 'techno',
      i18nKey: 'survivors.evolution.laserShow',
      evolvedWeapon: {
        id: 'laser',
        kind: 'beam',
        i18nKey: 'survivors.evolution.laserShow',
        maxLevel: 5,
        base: {
          damage: 22,
          cooldownS: 0,
          tickS: 0.16,
          count: 4,
          area: 16,
          range: 420,
          speed: 1.8,
          spreadRad: 0,
          pierce: 0,
          durationS: 0,
        },
        levels: [],
        blockedByIslands: false,
        extraProjectilesApply: false,
      },
    },
    {
      id: 'discoBall',
      weapon: 'buoys',
      passive: 'disco',
      i18nKey: 'survivors.evolution.discoBall',
      evolvedWeapon: {
        id: 'buoys',
        kind: 'orbit',
        i18nKey: 'survivors.evolution.discoBall',
        maxLevel: 5,
        base: {
          damage: 36,
          cooldownS: 0,
          tickS: 0.3,
          count: 1,
          area: 42,
          range: 90,
          speed: 1.6,
          spreadRad: 0,
          pierce: 0,
          durationS: 0,
        },
        levels: [],
        blockedByIslands: false,
        extraProjectilesApply: false,
        effects: { flashes: { count: 6, range: 420, speed: 560, radius: 6, cooldownS: 0.8 } },
      },
    },
  ],
  difficulties: {
    tranquila: { id: 'tranquila', i18nKey: 'survivors.dificultad.tranquila', enemyDamage: 0.7, enemyHp: 0.8, enemyCount: 0.75 },
    normal: { id: 'normal', i18nKey: 'survivors.dificultad.normal', enemyDamage: 1, enemyHp: 1, enemyCount: 1 },
    tormenta: { id: 'tormenta', i18nKey: 'survivors.dificultad.tormenta', enemyDamage: 1.3, enemyHp: 1.3, enemyCount: 1.4 },
  },
  bosses: {},
  upgrades: [
    { id: 'damage', i18nKey: 'survivors.vinyl.hardstyle', stat: 'damageBonus', amount: 0.2, maxStacks: 5 },
    { id: 'fireRate', i18nKey: 'survivors.vinyl.techno', stat: 'fireRateBonus', amount: 0.15, maxStacks: 5 },
    { id: 'projectiles', i18nKey: 'survivors.vinyl.rumba', stat: 'extraProjectiles', amount: 1, maxStacks: 5 },
    { id: 'speed', i18nKey: 'survivors.vinyl.dnb', stat: 'speedBonus', amount: 0.1, maxStacks: 5 },
    { id: 'magnet', i18nKey: 'survivors.vinyl.disco', stat: 'magnetBonus', amount: 0.4, maxStacks: 5 },
    { id: 'bailing', i18nKey: 'survivors.vinyl.chill', stat: 'bailPerS', amount: 1, maxStacks: 5 },
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
          enemy: 'jellyfish',
          fromS: 0,
          toS: 420,
          keys: [
            { atS: 0, groupsPerS: 0.1, group: [1, 2], hpScale: 1, speedScale: 1 },
            { atS: 240, groupsPerS: 0.16, group: [2, 3], hpScale: 1.6, speedScale: 1 },
            { atS: 420, groupsPerS: 0.22, group: [2, 4], hpScale: 2.2, speedScale: 1.05 },
          ],
        },
        {
          enemy: 'gull',
          fromS: 60,
          toS: 420,
          keys: [
            { atS: 60, groupsPerS: 0.12, group: [2, 3], hpScale: 1, speedScale: 1 },
            { atS: 240, groupsPerS: 0.2, group: [3, 5], hpScale: 1.5, speedScale: 1 },
            { atS: 420, groupsPerS: 0.28, group: [3, 6], hpScale: 2.2, speedScale: 1.05 },
          ],
        },
        {
          enemy: 'crab',
          fromS: 90,
          toS: 420,
          keys: [
            { atS: 90, groupsPerS: 0.08, group: [1, 1], hpScale: 1, speedScale: 1 },
            { atS: 240, groupsPerS: 0.18, group: [1, 2], hpScale: 1.6, speedScale: 1 },
            { atS: 420, groupsPerS: 0.3, group: [1, 3], hpScale: 2.4, speedScale: 1.1 },
          ],
        },
        {
          enemy: 'pirate',
          fromS: 180,
          toS: 420,
          keys: [
            { atS: 180, groupsPerS: 0.06, group: [1, 1], hpScale: 1, speedScale: 1 },
            { atS: 300, groupsPerS: 0.1, group: [1, 2], hpScale: 1.4, speedScale: 1 },
            { atS: 420, groupsPerS: 0.14, group: [1, 2], hpScale: 1.8, speedScale: 1 },
          ],
        },
        {
          enemy: 'swordfish',
          fromS: 210,
          toS: 420,
          keys: [
            { atS: 210, groupsPerS: 0.05, group: [1, 1], hpScale: 1, speedScale: 1 },
            { atS: 420, groupsPerS: 0.12, group: [1, 2], hpScale: 1.8, speedScale: 1 },
          ],
        },
      ],
      // Los huecos de los minibosses (2:30, 4:30) y del boss (5:30) existen
      // apagados: la beta 3 sólo los enciende.
      events: [
        { atS: 150, type: 'miniboss', ref: 'vecino', enabled: false },
        { atS: 210, type: 'elites', ref: 'elites' },
        { atS: 270, type: 'miniboss', ref: 'martillo', enabled: false },
        { atS: 300, type: 'marea', ref: 'marea', durationS: 20 },
        { atS: 330, type: 'boss', ref: 'fantasma', enabled: false },
      ],
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

/** Los números de un arma a nivel `level` (1…`maxLevel`), sólo la tabla: sin mejoras ni vinilos. */
export function weaponStatsAt(def: WeaponDef, level: number): WeaponStats {
  const out: WeaponStats = { ...def.base };
  const top = Math.min(def.maxLevel, Math.max(1, Math.floor(level)));
  for (let l = 2; l <= top; l++) {
    for (const g of def.levels[l - 2]?.gains ?? []) out[g.stat] += g.amount;
  }
  return out;
}

export const NO_WEAPON_MODIFIERS: Readonly<WeaponModifiers> = {
  damageBonus: 0,
  fireRateBonus: 0,
  areaBonus: 0,
  extraProjectiles: 0,
};

/**
 * Los números con que un arma ataca de verdad: su tabla a ese nivel más lo
 * que las mejoras y los vinilos cambian a todas (`WeaponModifiers`). Los
 * tiempos nunca bajan de un paso; `count` y `pierce` quedan enteros.
 */
export function resolveWeaponStats(
  def: WeaponDef,
  level: number,
  mods: Readonly<WeaponModifiers> = NO_WEAPON_MODIFIERS,
): WeaponStats {
  const s = weaponStatsAt(def, level);
  const rate = 1 + Math.max(0, mods.fireRateBonus);
  s.damage *= 1 + mods.damageBonus;
  s.area *= 1 + mods.areaBonus;
  if (s.cooldownS > 0) s.cooldownS = Math.max(SURVIVORS_STEP_S, s.cooldownS / rate);
  if (s.tickS > 0) s.tickS = Math.max(SURVIVORS_STEP_S, s.tickS / rate);
  if (def.extraProjectilesApply) s.count += Math.round(mods.extraProjectiles);
  s.count = Math.max(0, Math.round(s.count));
  s.pierce = Math.max(0, Math.round(s.pierce));
  return s;
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
