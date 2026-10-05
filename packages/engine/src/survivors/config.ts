import { configHash } from '../minigames/rng';
import type { ShipConfig } from '../ship/config';
import type { QualityTier } from '../world/sectors';
import type { DropsDef } from './drops';

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
 * los huecos 4+4, las evoluciones y el Salvavidas raro; la beta 3 (plan 012)
 * trae el sistema genérico de bosses (`bosses`, `bossFight`: fases, ataques
 * avisados, llamadas), el acto 2 (`acts[1]`, `harderAct`) y su boss final, el
 * Kraken (`bosses.kraken.kraken`, T141).
 * Cambiar cualquier valor cambia `survivorsConfigHash`, que
 * entra en el `configHash` de la sesión del minijuego; un cambio de reglas
 * sube `version`. Unidades: u de motor (las del mar de `/mar`) y segundos.
 * Todo es `muestra`.
 */

/** Sube con cada cambio de reglas: la sesión la lleva y valida con ella. */
export const SURVIVORS_CONFIG_VERSION = 11;

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
/**
 * Minibosses y bosses del diseño (§7). `prueba` es el boss de pruebas del
 * sistema genérico (T137): existe en la config pero ningún hueco del guion
 * lo llama; los de verdad son T138–T141.
 */
export type BossId = 'prueba' | 'vecino' | 'martillo' | 'fantasma' | 'kraken' | 'capitan';
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
  /**
   * Parte del tope de enemigos (`caps[…].enemies`) que este tipo puede ocupar
   * con lo que echa el guion (la «Marea» no la mira). Sin valor, todo el tope.
   * Con el tope bajo de `baja`, deja sitio a los demás tipos.
   */
  capShare?: number;
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
 * - `beam`: focos que se fijan en los enemigos más cercanos y los queman
 *   cada tic (Focos); con `effects.sweep`, rayos en abanico que barren
 *   delante del barco de lado a lado (Show de Láseres).
 * - `orbit`: boyas que orbitan el barco y golpean cada tic (Boyas orbitales).
 * - `trail`: una ristra de petardos que el barco suelta en su estela; cada
 *   uno estalla cuando lo toca un enemigo (Traca).
 * - `zone`: nube quieta sobre un grupo que daña cada segundo (Lluvia ácida).
 */
export type WeaponKind = 'projectile' | 'aura' | 'beam' | 'orbit' | 'cone' | 'trail' | 'zone';

/**
 * Los números de un arma en un nivel. Qué significa cada uno depende de la
 * forma (`WeaponKind`); los que no usa van a 0:
 * - `damage`: por golpe (proyectil, petardo al estallar) o por tic (aura, foco, rayo, boya, nube).
 * - `cooldownS`: s entre disparos (proyectil, abanico, ristra de petardos, nube).
 * - `tickS`: s entre golpes de un aura, foco, rayo, boya o nube.
 * - `count`: bolas por ráfaga, petardos por ristra, focos o rayos, boyas o nubes por disparo.
 * - `area` (u): radio de la bola, del aura, de la boya, del estallido de un
 *   petardo, de la nube, de la mancha de luz de un foco; medio ancho del rayo.
 * - `range` (u): alcance para buscar blanco y vida de las bolas; hasta dónde
 *   llega un foco; largo del rayo; radio de la órbita de las boyas.
 * - `speed`: u/s de las bolas y de la mancha de un foco al pasar de un
 *   blanco a otro; rad/s del giro de las boyas.
 * - `spreadRad`: rad entre proyectiles de una misma ráfaga.
 * - `pierce`: enemigos que una bola atraviesa antes de deshacerse.
 * - `durationS`: s que dura una nube o un petardo sin estallar.
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
    /**
     * Traca (`trail`): s entre petardo y petardo de una ristra (la ristra se
     * dibuja en la estela), u de choque de cada petardo con un enemigo y u
     * mínimas entre un petardo y el anterior (con el barco quieto no caen).
     */
    trail?: { dropEveryS: number; triggerRadius: number; minSpacing: number };
    /**
     * Show de Láseres (`beam` en abanico): los `count` rayos se abren en
     * `arcRad` rad delante del barco y el abanico barre de lado a lado
     * ±`swingRad` rad, `swingHz` veces por segundo.
     */
    sweep?: { arcRad: number; swingRad: number; swingHz: number };
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

// --- Bosses (§7, T137): máquina de fases y ataques avisados, todo en datos ---

/**
 * Forma de un ataque de boss. Todos menos `summon` avisan primero (la forma
 * en el agua con progreso 0→1 durante `telegraphS`) y golpean después
 * (`activeS`):
 * - `ring`: una onda en anillo con `gaps` huecos que crece desde el boss
 *   hasta `radius` en `activeS`; moja al barco si lo pasa por encima fuera
 *   de un hueco (y, con `blockedByIslands`, sin isla entre medias).
 * - `line`: embestida recta de `length` u a `speed` u/s hacia donde estaba
 *   el barco al avisar; el boss moja por contacto con `water`.
 * - `circles`: `count` círculos de `radius` u que caen alrededor del barco
 *   (a menos de `spread` u); mojan a quien esté dentro al caer.
 * - `broadside`: andanada por los dos costados: `count` disparos por lado,
 *   rectos, perpendiculares al rumbo, de `thickness` u de radio, `length` u
 *   de alcance y `speed` u/s; las islas los paran siempre.
 * - `summon`: llama a `summon.count` enemigos alrededor del boss por el
 *   sistema de aparición (sin aviso si `telegraphS` es 0).
 */
export type BossAttackKind = 'ring' | 'line' | 'circles' | 'broadside' | 'summon';

/** Los números de un ataque; los que su forma no usa van a 0 (como `WeaponStats`). */
export interface BossAttackDef {
  kind: BossAttackKind;
  /** s de aviso. */
  telegraphS: number;
  /** s que dura el golpe tras el aviso. */
  activeS: number;
  /** Agua que mete al barco (por golpe o por disparo). */
  water: number;
  /** ring: radio final; circles: radio de cada círculo. */
  radius: number;
  /** ring: grosor del anillo; line: medio ancho; broadside: radio del disparo. */
  thickness: number;
  /** ring: huecos a ángulos iguales y anchura (rad) de cada uno. */
  gaps: number;
  gapRad: number;
  /** line: largo de la embestida; broadside: alcance de los disparos. */
  length: number;
  /** line: u/s de la embestida; broadside: u/s de los disparos. */
  speed: number;
  /** circles: cuántos; broadside: disparos por costado. */
  count: number;
  /** circles: u alrededor del barco donde caen. */
  spread: number;
  /** ring: una isla entre el boss y el barco para la onda en ese sector. */
  blockedByIslands: boolean;
  /** El boss no recibe daño durante el ataque (aviso y golpe). */
  invulnerable: boolean;
  /** El boss se queda quieto durante el aviso. */
  still: boolean;
  /** summon (y, de regalo, cualquier otro): lo que llama al golpear. */
  summon?: { enemy: EnemyId; count: number; elite: boolean; hpScale: number };
}

/** Cómo se mueve el boss en una fase. */
export type BossMovement = 'chase' | 'orbit' | 'still';

/**
 * Una fase de la máquina de estados de un boss (§7). Pasa a otra por vida
 * (`untilHpFraction`, 0: nunca) o por tiempo en la fase (`untilS`, 0:
 * nunca), a la siguiente salvo que `nextByHp` / `nextByTime` digan otra
 * (así se hacen ventanas de invulnerabilidad que vuelven: fase 2 → 1).
 */
export interface BossPhase {
  untilHpFraction: number;
  untilS: number;
  nextByHp?: number;
  nextByTime?: number;
  movement: BossMovement;
  /** u del barco a los que se queda (`chase` se para ahí; `orbit` gira a esa distancia). */
  standoff: number;
  speedScale: number;
  /** Toda la fase sin recibir daño. */
  invulnerable: boolean;
  /** Ataques en orden cíclico (claves de `attacks`), uno cada `attackEveryS` s. */
  attacks: readonly string[];
  attackEveryS: number;
  /** s de espera antes del primer ataque al entrar en la fase. */
  firstAttackS: number;
}

export interface BossDef {
  id: BossId;
  kind: 'miniboss' | 'boss';
  /** Clave de texto del nombre (la barra del boss). */
  i18nKey: string;
  /** Aguante base: se multiplica por `acts[n].bossHpScale` y la dificultad. */
  hp: number;
  radius: number;
  /** u/s de crucero y u/s² de inercia. */
  speed: number;
  acceleration: number;
  /** Agua que mete tocar el casco (fuera de una embestida). */
  contactWater: number;
  ignoresIslands: boolean;
  /** Valor de la nota grande que suelta al caer (la clave de sol). */
  noteValue: number;
  /** Suelta un cofre al caer (los minibosses; lo que da lo resuelve T139). */
  chest: boolean;
  attacks: Record<string, BossAttackDef>;
  phases: readonly BossPhase[];
  /**
   * El Kraken (T141): con esto, el boss no usa `attacks` ni el movimiento de
   * la fase; lo lleva `kraken.ts` (sumergido, tentáculos, agarre a islas,
   * rocas). Las fases siguen siendo las de `phases` (por vida); cada una
   * lee sus números de `kraken.phases[i]`.
   */
  kraken?: KrakenDef;
}

// --- El Kraken (§7, T141) -------------------------------------------------------

/**
 * Los números del Kraken, el boss final del acto 2. Nada bajo el agua (una
 * sombra que no se puede golpear ni moja) persiguiendo al barco y emerge
 * cerca; emergido saca tentáculos alrededor del barco (un círculo de aviso
 * en el agua por tentáculo, luego sube y moja a quien esté dentro, y se queda
 * arriba un rato donde las armas lo pueden tumbar); tumbar un tentáculo
 * expone la cabeza `exposeS` s (la única ventana de daño, salvo `grab.
 * exposesHead`). Cuando una fase lo permite y hay una isla al alcance, en vez
 * de sacar tentáculos se agarra a ella y lanza rocas (círculo de caída
 * avisado durante el vuelo). Después se sumerge y vuelve a perseguir.
 */
export interface KrakenDef {
  /** u del barco a los que emerge, s mínimos y máximos bajo el agua entre salidas. */
  emergeDistance: number;
  /** u del barco por debajo de los cuales no emerge (se aparta: nunca sale justo debajo). */
  emergeMinDistance: number;
  minSubmergedS: number;
  maxSubmergedS: number;
  /** Velocidad bajo el agua (fracción de `speed`). */
  submergedSpeedScale: number;
  /** s que tarda en emerger y en sumergirse (no se le puede golpear). */
  emergeS: number;
  diveS: number;
  /** s que se queda emergido sacando tentáculos (la ventana expuesta lo alarga). */
  emergedS: number;
  /** s de cabeza expuesta al tumbar un tentáculo (se renueva, no se suma). */
  exposeS: number;
  tentacle: {
    /** s de aviso (el círculo), s que tarda en subir, s que se queda arriba. */
    telegraphS: number;
    riseS: number;
    upS: number;
    /** Aguante base (por el acto y la dificultad, como el boss) y radio. */
    hp: number;
    radius: number;
    /** Agua que mete a quien esté en el círculo al subir. */
    water: number;
    /** u alrededor del barco donde salen (el primero, encima). */
    spread: number;
    /** s entre salidas de tentáculos mientras está emergido. */
    everyS: number;
    /** u de la cabeza hasta donde llegan: con el barco más lejos, no saca más y se hunde a perseguir. */
    reach: number;
  };
  grab: {
    /** u (del borde de la isla al Kraken) a los que una isla está al alcance. */
    range: number;
    /** s agarrado y s entre andanadas de rocas. */
    holdS: number;
    everyS: number;
    /** La cabeza recibe daño mientras está agarrado. */
    exposesHead: boolean;
    rock: {
      /** s de vuelo (el aviso es el círculo de caída, que dura el vuelo). */
      flightS: number;
      radius: number;
      water: number;
      /** u alrededor del barco donde caen. */
      spread: number;
    };
  };
  /** Por fase (el índice es la fase de `phases`): tentáculos por salida, rocas por andanada y si se agarra a islas. */
  phases: readonly { tentacles: number; rocks: number; grabs: boolean }[];
}

/** Lo que cambia en la partida mientras hay un boss vivo (T137). */
export interface BossFightDef {
  /** Velocidad de los comunes (fracción). */
  commonSpeedScale: number;
  /** Ritmo del guion (grupos por segundo) de los comunes (fracción); la «Marea» no lo mira. */
  commonSpawnScale: number;
  /** u por delante del barco a las que entra un boss. */
  entryDistance: number;
  /** u de radio del cofre para recogerlo tocándolo. */
  chestRadius: number;
  /** Gancho de la Llama (T135): daño por segundo fijo contra un boss (`flameBosses`). */
  flameDps: number;
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

/**
 * El guion de un acto (§8): datos, no código. El acto 2 (y el 3) tienen la
 * misma estructura con enemigos más duros y los tipos peligrosos antes
 * (`harderAct`); su boss final va en el hueco `boss` de `events`.
 */
export interface ActScript {
  act: number;
  durationS: number;
  tracks: readonly SpawnTrack[];
  events: readonly ScriptEvent[];
  /** Sobre el aguante de todo lo que echa el guion (sin valor, 1). */
  enemyHpScale?: number;
  /** Sobre el aguante de los bosses del acto (sin valor, 1). */
  bossHpScale?: number;
}

export interface QualityCaps {
  enemies: number;
  /** Bolas del jugador. */
  projectiles: number;
  /** Disparos de los enemigos (pistolas de agua). */
  enemyProjectiles: number;
  /** Zonas de daño en el agua (nubes de lluvia ácida). */
  areas: number;
  /** Petardos de la Traca en el agua a la vez (el más viejo se apaga para el nuevo). */
  crackers: number;
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
  /**
   * Peso de cada carta al sacar la oferta (T133): sin ellos todas pesan
   * igual y, con 16 armas y vinilos en el mazo, subir un arma a nivel 5
   * para evolucionarla era cuestión de suerte. `owned`, subir de nivel un
   * arma o vinilo que llevas; `pairedVinyl`, el vinilo nuevo pareja de un
   * arma que llevas sin evolucionar; `new`, lo demás nuevo. La evolución y
   * el Salvavidas no pasan por aquí (salen siempre que tocan).
   */
  cardWeights: { new: number; owned: number; pairedVinyl: number };
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
  /** El botín de las élites (T135): Imán total, Llama y Salvavidas (`drops.ts`). */
  drops: DropsDef;
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
  /** Minibosses y bosses (T137): los huecos del guion los llaman por `BossId`. */
  bosses: Partial<Record<BossId, BossDef>>;
  bossFight: BossFightDef;
  /** Compatibilidad beta 1: no participa en el pool. */
  upgrades: readonly UpgradeDef[];
  /** Guion por acto (`acts[n - 1]` es el acto n): el 1 y, desde la beta 3, el 2. */
  acts: readonly ActScript[];
}

/**
 * El guion del acto 1 (§8). El acto 2 sale de él con `harderAct`: mismo
 * guion, enemigos más duros, los tipos peligrosos antes y el Kraken en el
 * hueco del boss final. Los huecos de los bosses siguen apagados hasta que
 * cada boss exista (T138–T141).
 */
const ACT_1: ActScript = {
  act: 1,
  durationS: 420,
  tracks: [
    {
      enemy: 'piranha',
      fromS: 0,
      toS: 420,
      keys: [
        { atS: 0, groupsPerS: 0.25, group: [2, 4], hpScale: 1, speedScale: 1 },
        { atS: 120, groupsPerS: 0.5, group: [4, 7], hpScale: 1.25, speedScale: 1 },
        { atS: 240, groupsPerS: 0.7, group: [5, 9], hpScale: 1.6, speedScale: 1.03 },
        { atS: 420, groupsPerS: 1, group: [6, 12], hpScale: 2.2, speedScale: 1.05 },
      ],
    },
    {
      enemy: 'jellyfish',
      fromS: 0,
      toS: 420,
      keys: [
        { atS: 0, groupsPerS: 0.1, group: [1, 2], hpScale: 1, speedScale: 1 },
        { atS: 240, groupsPerS: 0.16, group: [2, 3], hpScale: 1.4, speedScale: 1 },
        { atS: 420, groupsPerS: 0.22, group: [2, 4], hpScale: 1.8, speedScale: 1.05 },
      ],
    },
    {
      enemy: 'gull',
      fromS: 60,
      toS: 420,
      keys: [
        { atS: 60, groupsPerS: 0.12, group: [2, 3], hpScale: 1, speedScale: 1 },
        { atS: 240, groupsPerS: 0.2, group: [3, 5], hpScale: 1.3, speedScale: 1 },
        { atS: 420, groupsPerS: 0.28, group: [3, 6], hpScale: 1.8, speedScale: 1.05 },
      ],
    },
    {
      enemy: 'crab',
      fromS: 90,
      toS: 420,
      keys: [
        { atS: 90, groupsPerS: 0.08, group: [1, 1], hpScale: 1, speedScale: 1 },
        { atS: 240, groupsPerS: 0.18, group: [1, 2], hpScale: 1.4, speedScale: 1 },
        { atS: 420, groupsPerS: 0.3, group: [1, 3], hpScale: 2, speedScale: 1.1 },
      ],
    },
    {
      enemy: 'pirate',
      fromS: 180,
      toS: 420,
      keys: [
        { atS: 180, groupsPerS: 0.06, group: [1, 1], hpScale: 1, speedScale: 1 },
        { atS: 300, groupsPerS: 0.1, group: [1, 2], hpScale: 1.25, speedScale: 1 },
        { atS: 420, groupsPerS: 0.14, group: [1, 2], hpScale: 1.6, speedScale: 1 },
      ],
    },
    {
      enemy: 'swordfish',
      fromS: 210,
      toS: 420,
      keys: [
        { atS: 210, groupsPerS: 0.05, group: [1, 1], hpScale: 1, speedScale: 1 },
        { atS: 420, groupsPerS: 0.12, group: [1, 2], hpScale: 1.6, speedScale: 1 },
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
};

export const SURVIVORS_CONFIG: SurvivorsConfig = {
  version: SURVIVORS_CONFIG_VERSION,
  durationS: 420,
  maxPauseS: 300,
  defeatStyle: 'sumergirse',
  handling: { turnRateScale: 1.35, accelerationScale: 1.6, brakeScale: 1.6, lateralGripScale: 1.5 },
  camera: { distanceScale: 1.25, heightScale: 1.15, blendS: 0.8 },
  caps: {
    alta: { enemies: 150, projectiles: 120, enemyProjectiles: 80, areas: 12, crackers: 48, notes: 200 },
    baja: { enemies: 60, projectiles: 60, enemyProjectiles: 40, areas: 6, crackers: 24, notes: 100 },
  },
  player: {
    waterCapacity: 100,
    invulnerableS: 0.5,
    bailPerS: 0,
    magnetRadius: 130,
    pickupRadius: 14,
    magnetSpeed: 420,
  },
  notes: {
    values: { corchea: 1, negra: 3, blanca: 8, redonda: 20 },
    mergeRadius: 36,
    mergeEveryS: 0.5,
  },
  levels: { base: 3, linear: 2.5, quadratic: 0.25 },
  cardChoices: 3,
  cardWeights: { new: 1, owned: 3, pairedVinyl: 3 },
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
  drops: {
    chance: 0.05,
    types: ['iman', 'llama', 'salvavidas'],
    radius: 16,
    lifeS: 25,
    max: 6,
    llama: { durationS: 10, range: 110, halfAngle: 0.45, killS: 0.4 },
    salvavidas: { waterFraction: 0.4 },
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
      growthPerMinute: { hp: 0.08, speed: 0.01 },
      // Las pirañas son el enjambre: sin tope propio llenarían solas los 60 de `baja`.
      capShare: 0.7,
    },
    crab: {
      id: 'crab',
      behavior: 'chase',
      radius: 20,
      speed: 55,
      acceleration: 120,
      hp: 60,
      contactWater: 10,
      ignoresIslands: false,
      noteValue: 8,
      growthPerMinute: { hp: 0.08, speed: 0.01 },
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
      growthPerMinute: { hp: 0.08, speed: 0.015 },
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
      growthPerMinute: { hp: 0.08, speed: 0.01 },
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
      growthPerMinute: { hp: 0.08, speed: 0.01 },
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
      contactWater: 6,
      ignoresIslands: false,
      noteValue: 3,
      growthPerMinute: { hp: 0.08, speed: 0.01 },
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
        damage: 16,
        cooldownS: 0.7,
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
        { i18nKey: 'survivors.weapon.canon.l2', gains: [{ stat: 'damage', amount: 8 }] },
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
        damage: 10,
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
        { i18nKey: 'survivors.weapon.subwoofer.l3', gains: [{ stat: 'damage', amount: 6 }] },
        { i18nKey: 'survivors.weapon.subwoofer.l4', gains: [{ stat: 'area', amount: 25 }] },
        { i18nKey: 'survivors.weapon.subwoofer.l5', gains: [{ stat: 'tickS', amount: -0.15 }] },
      ],
      blockedByIslands: false,
      extraProjectilesApply: false,
    },
    // Focos (antes «Láser de festival», T134): 1–3 focos de escenario; cada
    // uno se fija en un enemigo cercano y lo quema mientras siga a tiro, y
    // pasa suave al siguiente. Pasan por encima de las islas.
    laser: {
      id: 'laser',
      kind: 'beam',
      i18nKey: 'survivors.weapon.laser',
      maxLevel: 5,
      base: {
        damage: 5,
        cooldownS: 0,
        tickS: 0.25,
        count: 1,
        area: 24,
        range: 300,
        speed: 700,
        spreadRad: 0,
        pierce: 0,
        durationS: 0,
      },
      levels: [
        { i18nKey: 'survivors.weapon.laser.l2', gains: [{ stat: 'count', amount: 1 }] },
        { i18nKey: 'survivors.weapon.laser.l3', gains: [{ stat: 'damage', amount: 4 }] },
        { i18nKey: 'survivors.weapon.laser.l4', gains: [{ stat: 'range', amount: 80 }] },
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
        damage: 18,
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
        { i18nKey: 'survivors.weapon.buoys.l2', gains: [{ stat: 'damage', amount: 8 }] },
        { i18nKey: 'survivors.weapon.buoys.l3', gains: [{ stat: 'count', amount: 1 }] },
        { i18nKey: 'survivors.weapon.buoys.l4', gains: [{ stat: 'area', amount: 4 }] },
        { i18nKey: 'survivors.weapon.buoys.l5', gains: [{ stat: 'damage', amount: 12 }] },
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
        damage: 10,
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
        { i18nKey: 'survivors.weapon.confetti.l3', gains: [{ stat: 'damage', amount: 6 }] },
        { i18nKey: 'survivors.weapon.confetti.l4', gains: [{ stat: 'cooldownS', amount: -0.3 }] },
        { i18nKey: 'survivors.weapon.confetti.l5', gains: [{ stat: 'pierce', amount: 1 }] },
      ],
      blockedByIslands: true,
      extraProjectilesApply: true,
    },
    // Traca (antes «Fuegos artificiales», T134): cada pocos segundos el barco
    // suelta una ristra de petardos en su estela; cada petardo estalla
    // (pequeño y seco) cuando lo toca un enemigo. Premia arrastrar a los
    // enemigos por tu estela. No le afectan las islas.
    fireworks: {
      id: 'fireworks',
      kind: 'trail',
      i18nKey: 'survivors.weapon.fireworks',
      maxLevel: 5,
      base: {
        damage: 36,
        cooldownS: 2.4,
        tickS: 0,
        count: 3,
        area: 34,
        range: 0,
        speed: 0,
        spreadRad: 0,
        pierce: 0,
        durationS: 7,
      },
      levels: [
        { i18nKey: 'survivors.weapon.fireworks.l2', gains: [{ stat: 'count', amount: 1 }] },
        { i18nKey: 'survivors.weapon.fireworks.l3', gains: [{ stat: 'damage', amount: 16 }] },
        { i18nKey: 'survivors.weapon.fireworks.l4', gains: [{ stat: 'cooldownS', amount: -0.6 }] },
        { i18nKey: 'survivors.weapon.fireworks.l5', gains: [{ stat: 'count', amount: 2 }] },
      ],
      blockedByIslands: false,
      extraProjectilesApply: true,
      effects: { trail: { dropEveryS: 0.12, triggerRadius: 10, minSpacing: 24 } },
    },
    // Lluvia ácida: una nube sobre el grupo más apretado a tiro; daña cada
    // segundo a lo que tiene debajo mientras dura.
    acidRain: {
      id: 'acidRain',
      kind: 'zone',
      i18nKey: 'survivors.weapon.acidRain',
      maxLevel: 5,
      base: {
        damage: 12,
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
        { i18nKey: 'survivors.weapon.acidRain.l3', gains: [{ stat: 'damage', amount: 8 }] },
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
          damage: 40,
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
          damage: 26,
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
      // Muchos rayos en abanico que barren alrededor del barco: de quemar de
      // uno en uno a barrer a todos.
      evolvedWeapon: {
        id: 'laser',
        kind: 'beam',
        i18nKey: 'survivors.evolution.laserShow',
        maxLevel: 5,
        base: {
          damage: 30,
          cooldownS: 0,
          tickS: 0.16,
          count: 7,
          area: 14,
          range: 440,
          speed: 0,
          spreadRad: 0,
          pierce: 0,
          durationS: 0,
        },
        levels: [],
        blockedByIslands: false,
        extraProjectilesApply: false,
        effects: { sweep: { arcRad: 1.6, swingRad: 0.7, swingHz: 0.5 } },
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
          damage: 50,
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
    tormenta: { id: 'tormenta', i18nKey: 'survivors.dificultad.tormenta', enemyDamage: 1.6, enemyHp: 1.6, enemyCount: 1.6 },
  },
  // Bosses (T137). Sólo el de pruebas del sistema genérico, con un ataque de
  // cada forma y una ventana de invulnerabilidad al cambiar de fase; ningún
  // hueco del guion lo llama, así que no sale en una partida normal. Los de
  // verdad (T138–T141) se escriben con esta misma plantilla.
  bosses: {
    prueba: {
      id: 'prueba',
      kind: 'miniboss',
      i18nKey: 'survivors.boss.prueba',
      hp: 600,
      radius: 40,
      speed: 90,
      acceleration: 160,
      contactWater: 15,
      ignoresIslands: false,
      noteValue: 60,
      chest: true,
      attacks: {
        onda: {
          kind: 'ring',
          telegraphS: 1.2,
          activeS: 1.4,
          water: 18,
          radius: 420,
          thickness: 24,
          gaps: 3,
          gapRad: 0.5,
          length: 0,
          speed: 0,
          count: 0,
          spread: 0,
          blockedByIslands: true,
          invulnerable: false,
          still: true,
        },
        embestida: {
          kind: 'line',
          telegraphS: 1,
          activeS: 1.5,
          water: 20,
          radius: 0,
          thickness: 40,
          gaps: 0,
          gapRad: 0,
          length: 520,
          speed: 420,
          count: 0,
          spread: 0,
          blockedByIslands: false,
          invulnerable: false,
          still: true,
        },
        rocas: {
          kind: 'circles',
          telegraphS: 1.3,
          activeS: 0.4,
          water: 16,
          radius: 70,
          thickness: 0,
          gaps: 0,
          gapRad: 0,
          length: 0,
          speed: 0,
          count: 3,
          spread: 160,
          blockedByIslands: false,
          invulnerable: false,
          still: false,
        },
        andanada: {
          kind: 'broadside',
          telegraphS: 0.9,
          activeS: 0.1,
          water: 8,
          radius: 0,
          thickness: 8,
          gaps: 0,
          gapRad: 0,
          length: 520,
          speed: 320,
          count: 4,
          spread: 0,
          blockedByIslands: true,
          invulnerable: false,
          still: true,
        },
        refuerzos: {
          kind: 'summon',
          telegraphS: 0,
          activeS: 0.1,
          water: 0,
          radius: 0,
          thickness: 0,
          gaps: 0,
          gapRad: 0,
          length: 0,
          speed: 0,
          count: 0,
          spread: 0,
          blockedByIslands: false,
          invulnerable: false,
          still: false,
          summon: { enemy: 'piranha', count: 6, elite: false, hpScale: 1 },
        },
      },
      phases: [
        {
          untilHpFraction: 0.5,
          untilS: 0,
          movement: 'chase',
          standoff: 260,
          speedScale: 1,
          invulnerable: false,
          attacks: ['onda', 'refuerzos', 'andanada'],
          attackEveryS: 3,
          firstAttackS: 2,
        },
        // Ventana invulnerable de 2 s al pasar a la segunda mitad.
        {
          untilHpFraction: 0,
          untilS: 2,
          movement: 'still',
          standoff: 0,
          speedScale: 1,
          invulnerable: true,
          attacks: [],
          attackEveryS: 0,
          firstAttackS: 0,
        },
        {
          untilHpFraction: 0,
          untilS: 0,
          movement: 'orbit',
          standoff: 300,
          speedScale: 1.2,
          invulnerable: false,
          attacks: ['embestida', 'rocas', 'onda'],
          attackEveryS: 2.5,
          firstAttackS: 1,
        },
      ],
    },
    // El Kraken (T141): boss final del acto 2 (`acts[1]`, hueco `boss`). Sus
    // ataques los lleva `kraken.ts` con los números de `kraken`; las fases
    // (por vida) van aquí, sin ataques genéricos. Bajo el agua pasa por
    // debajo de las islas (`ignoresIslands`); emerge siempre en agua.
    kraken: {
      id: 'kraken',
      kind: 'boss',
      i18nKey: 'survivors.boss.kraken',
      hp: 1800,
      radius: 56,
      speed: 150,
      acceleration: 220,
      contactWater: 14,
      ignoresIslands: true,
      noteValue: 100,
      chest: false,
      attacks: {},
      phases: [
        {
          untilHpFraction: 0.65,
          untilS: 0,
          movement: 'chase',
          standoff: 0,
          speedScale: 1,
          invulnerable: false,
          attacks: [],
          attackEveryS: 0,
          firstAttackS: 0,
        },
        {
          untilHpFraction: 0.3,
          untilS: 0,
          movement: 'chase',
          standoff: 0,
          speedScale: 1.15,
          invulnerable: false,
          attacks: [],
          attackEveryS: 0,
          firstAttackS: 0,
        },
        {
          untilHpFraction: 0,
          untilS: 0,
          movement: 'chase',
          standoff: 0,
          speedScale: 1.3,
          invulnerable: false,
          attacks: [],
          attackEveryS: 0,
          firstAttackS: 0,
        },
      ],
      kraken: {
        emergeDistance: 240,
        emergeMinDistance: 110,
        minSubmergedS: 3,
        maxSubmergedS: 14,
        submergedSpeedScale: 1.3,
        emergeS: 1.2,
        diveS: 0.8,
        emergedS: 9,
        exposeS: 4,
        tentacle: {
          telegraphS: 1.2,
          riseS: 0.3,
          upS: 5,
          hp: 50,
          radius: 30,
          water: 18,
          spread: 170,
          everyS: 3.5,
          reach: 520,
        },
        grab: {
          range: 420,
          holdS: 9,
          everyS: 2.5,
          exposesHead: true,
          rock: {
            flightS: 1.5,
            radius: 60,
            water: 16,
            spread: 150,
          },
        },
        phases: [
          { tentacles: 3, rocks: 0, grabs: false },
          { tentacles: 4, rocks: 3, grabs: true },
          { tentacles: 5, rocks: 4, grabs: true },
        ],
      },
    },
  },
  bossFight: {
    commonSpeedScale: 0.7,
    commonSpawnScale: 0.5,
    entryDistance: 700,
    chestRadius: 18,
    flameDps: 120,
  },
  upgrades: [
    { id: 'damage', i18nKey: 'survivors.vinyl.hardstyle', stat: 'damageBonus', amount: 0.2, maxStacks: 5 },
    { id: 'fireRate', i18nKey: 'survivors.vinyl.techno', stat: 'fireRateBonus', amount: 0.15, maxStacks: 5 },
    { id: 'projectiles', i18nKey: 'survivors.vinyl.rumba', stat: 'extraProjectiles', amount: 1, maxStacks: 5 },
    { id: 'speed', i18nKey: 'survivors.vinyl.dnb', stat: 'speedBonus', amount: 0.1, maxStacks: 5 },
    { id: 'magnet', i18nKey: 'survivors.vinyl.disco', stat: 'magnetBonus', amount: 0.4, maxStacks: 5 },
    { id: 'bailing', i18nKey: 'survivors.vinyl.chill', stat: 'bailPerS', amount: 1, maxStacks: 5 },
  ],
  acts: [
    ACT_1,
    harderAct(ACT_1, {
      act: 2,
      enemyHpScale: 1.25,
      bossHpScale: 1.5,
      earlierS: { crab: 30, pirate: 60, swordfish: 60 },
      finalBoss: 'kraken',
      // El Kraken existe (T141): su hueco va encendido. El acto 2 sólo se
      // juega con `act: 2` (pruebas y atajos) hasta la campaña (T144).
      finalBossEnabled: true,
    }),
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

// --- Actos y bosses (T137) ----------------------------------------------------

/**
 * Un acto más duro a partir de otro (§8: «misma estructura, enemigos más
 * duros y tipos peligrosos antes»): las pistas de `earlierS` empiezan esos
 * segundos antes (su curva se adelanta igual, sin bajar de 0), el aguante de
 * todo lo del guion y el de los bosses se multiplican, y el hueco `boss` del
 * final llama a `finalBoss`. Los hitos (élites, Marea, minibosses) se quedan
 * donde están, con su `enabled`.
 */
export function harderAct(
  base: ActScript,
  by: {
    act: number;
    enemyHpScale: number;
    bossHpScale: number;
    earlierS: Partial<Record<EnemyId, number>>;
    finalBoss: BossId;
    /** Si el hueco del boss final va encendido (sin valor, como en el acto base). */
    finalBossEnabled?: boolean;
  },
): ActScript {
  return {
    act: by.act,
    durationS: base.durationS,
    enemyHpScale: (base.enemyHpScale ?? 1) * by.enemyHpScale,
    bossHpScale: (base.bossHpScale ?? 1) * by.bossHpScale,
    tracks: base.tracks.map((t) => {
      const earlier = Math.min(by.earlierS[t.enemy] ?? 0, t.fromS);
      if (earlier <= 0) return t;
      return {
        ...t,
        fromS: t.fromS - earlier,
        keys: t.keys.map((k) => ({ ...k, atS: Math.max(0, k.atS - earlier) })),
      };
    }),
    events: base.events.map((ev) => {
      if (ev.type !== 'boss') return ev;
      const out: ScriptEvent = { ...ev, ref: by.finalBoss };
      if (by.finalBossEnabled !== undefined) out.enabled = by.finalBossEnabled;
      return out;
    }),
  };
}

/** El guion del acto `act` (1…); null si la config no lo tiene. */
export function actOf(cfg: SurvivorsConfig, act: number): ActScript | null {
  return cfg.acts.find((a) => a.act === act) ?? null;
}

/** El aguante con que entra un boss: el suyo por el del acto y por la dificultad. */
export function bossHpFor(def: BossDef, act: ActScript | null, diff: DifficultyDef): number {
  return def.hp * (act?.bossHpScale ?? 1) * diff.enemyHp;
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
