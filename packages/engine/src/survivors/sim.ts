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
  type ActScript,
  type BossAttackDef,
  type BossAttackKind,
  type BossDef,
  type BossId,
  type ElitesDef,
  type EnemyDef,
  type EnemyId,
  type EnemyPhase,
  type MareaDef,
  type NoteFigure,
  type QualityCaps,
  type ScriptEvent,
  type PassiveId,
  type EvolutionId,
  SURVIVORS_STEP_S,
  type SurvivorsConfig,
  type UpgradeId,
  type WeaponDef,
  type WeaponId,
  type WeaponKind,
  type WeaponStats,
  DEFAULT_DIFFICULTY,
  type DifficultyDef,
  type DifficultyId,
  actOf,
  bossHpFor,
  figureOf,
  resolveWeaponStats,
  survivorsShipConfig,
  trackAt,
  xpToNext,
} from './config';
import { attackFrom, inRingGap, nextPhase, ringRadiusAt, ringTouches } from './bosses';
import {
  type GhostShipEvent,
  type GhostShipHost,
  type GhostShipState,
  type GhostShipView,
  createGhostShip,
  ghostAttackPlan,
  ghostHash,
  ghostInvulnerable,
  ghostShipView,
  ghostSolid,
  ghostSpeedScale,
  stepGhostShip,
} from './fantasma';
import {
  type KrakenEvent,
  type KrakenHost,
  type KrakenState,
  type KrakenView,
  type Tentacle,
  clearKraken,
  createKraken,
  hurtTentacle,
  krakenHash,
  krakenSolid,
  krakenView,
  krakenVulnerable,
  krakenWarnings,
  stepKraken,
  tentacleHittable,
} from './kraken';
import { buildCardPool, eligibleEvolutions, type CardOption, type SalvavidasState } from './cards';
export type { CardOption } from './cards';
import { type DropId, flameDamage, inFlame } from './drops';
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
 *   paran; el aura del Subwoofer, los Focos (y el Show de Láseres), las
 *   Boyas orbitales, los petardos de la Traca y la nube de la Lluvia ácida
 *   pasan por encima.
 * - Las notas se funden y el imán las atrae; subir de nivel abre una carta
 *   (1 de 3) y la partida queda en pausa hasta elegir.
 * - Botín (T135): una élite que cae suelta a veces un objeto que flota
 *   (Imán total, Llama o Salvavidas, `drops.ts`) y se coge tocándolo.
 * - Agua a bordo = vida; llena, inundado. A los 7:00 de tiempo activo,
 *   amanece. Una pausa seguida de más de 5 min abandona la partida.
 */

/** Cómo acaba: amanece, se inunda, abandono (5 min en pausa) o cae el boss final del acto (`victory`, T140). */
export type EndReason = 'survived' | 'flooded' | 'abandoned' | 'victory';
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
  /** Un arma dispara: `count` bolas, confetis, petardos o nubes salen de (x, y). */
  | { type: 'fire'; weapon: WeaponId; x: number; y: number; count: number }
  /** Un petardo de la Traca o una bola de El Drop estalla en (x, y) con ese radio. */
  | { type: 'explode'; weapon: WeaponId; x: number; y: number; radius: number }
  /** Una bola del jugador o un disparo enemigo (`owner`) parado por una isla. */
  | { type: 'blocked'; x: number; y: number; owner: 'player' | 'enemy' }
  | { type: 'enemyFire'; enemy: EnemyId; id: number; x: number; y: number }
  /** Empieza el aviso de una embestida: la línea en el agua desde (x, y), `length` u. */
  | { type: 'telegraph'; enemy: EnemyId; id: number; x: number; y: number; heading: number; length: number }
  | { type: 'split'; enemy: EnemyId; id: number; x: number; y: number; count: number }
  | { type: 'note'; figure: NoteFigure; value: number; x: number; y: number }
  | { type: 'levelUp'; level: number }
  | { type: 'saved'; item: 'salvavidas'; x: number; y: number; water: number }
  | { type: 'evolved'; weapon: WeaponId; evolutionId: EvolutionId }
  /** Una élite suelta un objeto del botín (T135) que flota en (x, y). */
  | { type: 'drop'; item: DropId; id: number; x: number; y: number }
  /** El barco coge un objeto del botín: su efecto empieza ya. */
  | { type: 'pickup'; item: DropId; id: number; x: number; y: number }
  // --- Bosses (T137) ---
  /** Entra un boss por delante del barco (`id` es el de la entidad, único en la partida). */
  | { type: 'bossSpawn'; boss: BossId; id: number; kind: BossDef['kind']; nameKey: string; x: number; y: number }
  | { type: 'bossPhase'; boss: BossId; id: number; phase: number }
  /** Empieza el aviso de un ataque: la forma en el agua (ver `BossWarningView`). */
  | { type: 'bossTelegraph'; boss: BossId; id: number; attack: string; kind: BossAttackKind; x: number; y: number; heading: number }
  /** Acaba el aviso: el golpe empieza. */
  | { type: 'bossAttack'; boss: BossId; id: number; attack: string; kind: BossAttackKind; x: number; y: number }
  | { type: 'bossSummon'; boss: BossId; id: number; enemy: EnemyId; count: number; x: number; y: number }
  /** Un golpe de boss al barco (`attack` null: por contacto). */
  | { type: 'bossHit'; boss: BossId; attack: string | null; x: number; y: number; water: number }
  /** El boss recibe `damage` (lo que le queda en `hp`). */
  | { type: 'bossDamaged'; boss: BossId; id: number; damage: number; hp: number; x: number; y: number }
  | { type: 'bossDefeated'; boss: BossId; id: number; kind: BossDef['kind']; x: number; y: number }
  /** Amanece con el boss vivo: se retira. */
  | { type: 'bossRetreated'; boss: BossId; id: number; kind: BossDef['kind']; x: number; y: number }
  /** Un miniboss suelta el cofre en (x, y); flota hasta que el barco lo toca. */
  | { type: 'chest'; boss: BossId; id: number; x: number; y: number }
  /** El barco toca el cofre: lo que da lo resuelve quien escucha (T139). */
  | { type: 'chestOpened'; boss: BossId; id: number; x: number; y: number }
  // --- El Kraken (T141): sus estados, tentáculos, rocas y la cabeza expuesta (`kraken.ts`) ---
  | KrakenEvent
  // --- El Barco Pirata Fantasma (T140): sólido ↔ fantasma (`fantasma.ts`) ---
  | GhostShipEvent
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
  /** Fantasma (llamado por el Barco Fantasma, T140): igual en la simulación; la pantalla lo pinta translúcido. */
  readonly ghost: boolean;
}

export interface ProjectileView {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly radius: number;
}

/** Una bola o un confeti del jugador: `weapon` y `kind` dicen cuál pintar. */
export interface PlayerProjectileView extends ProjectileView {
  readonly weapon: WeaponId;
  readonly kind: WeaponKind;
  readonly evolutionId: EvolutionId | null;
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

/**
 * Un haz desde el barco: un foco (Focos) que acaba en una mancha de luz de
 * radio `spot` sobre su blanco, o un rayo del Show de Láseres (`spot` 0) de
 * medio ancho `halfWidth`. Va de (x, y) con rumbo `angle` y largo `length`.
 */
export interface BeamView {
  readonly weapon: WeaponId;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly length: number;
  readonly halfWidth: number;
  /** Radio de la mancha de luz del foco (0: rayo del abanico, sin mancha). */
  readonly spot: number;
  /** Enemigo al que sigue el foco (−1: ninguno; siempre −1 en el abanico). */
  readonly target: number;
}

/** Un petardo de la Traca flotando en la estela: estalla al tocarlo un enemigo. */
export interface CrackerView {
  readonly id: number;
  readonly weapon: WeaponId;
  readonly x: number;
  readonly y: number;
  /** u de choque con un enemigo. */
  readonly radius: number;
  /** u del estallido. */
  readonly burst: number;
  /** s que le quedan antes de apagarse sin estallar y lo que duraba al caer. */
  readonly lifeS: number;
  readonly durationS: number;
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
export interface VinylView {
  readonly id: PassiveId;
  readonly level: number;
  readonly maxLevel: number;
  readonly nameKey: string;
}

export interface WeaponView {
  readonly id: WeaponId;
  readonly kind: WeaponKind;
  readonly evolutionId: EvolutionId | null;
  readonly nameKey: string;
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

/** Un objeto del botín flotando en el agua (T135). */
export interface PickupView {
  readonly id: number;
  readonly item: DropId;
  readonly x: number;
  readonly y: number;
  /** s que le quedan antes de hundirse y lo que flotaba al caer. */
  readonly lifeS: number;
  readonly durationS: number;
}

/** La Llama encendida delante del barco (T135): un sector de agua que quema. */
export interface FlameView {
  readonly x: number;
  readonly y: number;
  /** El rumbo del barco: hacia donde sale la llama. */
  readonly heading: number;
  readonly range: number;
  readonly halfAngle: number;
  /** s que le quedan y lo que dura entera. */
  readonly leftS: number;
  readonly durationS: number;
}

/** Un boss vivo, para la pantalla y el HUD (T137). */
export interface BossView {
  readonly id: number;
  readonly boss: BossId;
  readonly kind: BossDef['kind'];
  readonly nameKey: string;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly heading: number;
  readonly radius: number;
  readonly hp: number;
  readonly maxHp: number;
  /** hp / maxHp, 0…1. */
  readonly hpFraction: number;
  /** Fase (0…) y cuántas tiene. */
  readonly phase: number;
  readonly phaseCount: number;
  /** No recibe daño ahora (fase o ataque): la pantalla lo puede pintar translúcido. */
  readonly invulnerable: boolean;
  /** Ataque en curso y en qué está (`warning` avisando, `hit` golpeando); null entre ataques. */
  readonly attack: string | null;
  readonly attackStage: 'warning' | 'hit' | null;
  /** Sólo el Kraken (T141): estado, tentáculos, rocas y cabeza expuesta; null en los demás. */
  readonly kraken: KrakenView | null;
  /** Sólo el Barco Pirata Fantasma (T140): sólido o fantasma y cuánto le queda; null en los demás. */
  readonly fantasma: GhostShipView | null;
}

/**
 * Una forma de aviso (y luego de golpe) de un boss en el agua. `progress` va
 * 0→1 durante el aviso y otra vez 0→1 durante el golpe (`hit` true).
 * - `ring`: centro (x, y), `radius` final, `thickness`, `gaps` huecos de
 *   `gapRad` rad desde `gapPhase`; durante el golpe `ringRadius` es el de la onda.
 * - `line`: desde (x, y) con `heading`, `length` u, medio ancho `thickness`.
 * - `circles`: un aviso por círculo: centro (x, y), `radius`.
 * - `broadside`: una por costado: desde (x, y) con `heading`, `length`, `thickness`.
 */
export interface BossWarningView {
  readonly id: number;
  readonly boss: BossId;
  readonly attack: string;
  readonly kind: BossAttackKind;
  readonly x: number;
  readonly y: number;
  readonly heading: number;
  readonly length: number;
  readonly radius: number;
  readonly thickness: number;
  readonly gaps: number;
  readonly gapRad: number;
  readonly gapPhase: number;
  readonly ringRadius: number;
  /** Islas relativas al origen de un anillo, para dibujar su sombra radial (T138). */
  readonly ringObstacles?: readonly { readonly x: number; readonly y: number; readonly radius: number }[];
  readonly progress: number;
  readonly hit: boolean;
}

/** El cofre que suelta un miniboss, flotando hasta que el barco lo toca. */
export interface ChestView {
  readonly id: number;
  readonly boss: BossId;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
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
  /** La dificultad de la partida. */
  readonly difficulty: DifficultyId;
  readonly movement: MovementView;
  readonly player: Readonly<ShipState> & {
    readonly radius: number;
    readonly invulnerableS: number;
  };
  readonly enemies: readonly EnemyView[];
  readonly enemiesByType: Readonly<Partial<Record<EnemyId, readonly EnemyView[]>>>;
  /** Bolas y confetis del jugador (todas las armas que vuelan). */
  readonly projectiles: readonly PlayerProjectileView[];
  /** Disparos de los enemigos (pistolas de agua). */
  readonly enemyProjectiles: readonly ProjectileView[];
  /** Avisos de embestida en curso. */
  readonly telegraphs: readonly TelegraphView[];
  /** Las armas del barco, en el orden en que se cogieron. */
  readonly weapons: readonly WeaponView[];
  readonly vinyls: readonly VinylView[];
  readonly salvavidas: SalvavidasState;
  readonly slots: Readonly<SurvivorsConfig['slots']>;
  readonly auras: readonly AuraView[];
  readonly beams: readonly BeamView[];
  readonly orbitals: readonly OrbitalView[];
  readonly zones: readonly ZoneView[];
  /** Petardos de la Traca en el agua. */
  readonly crackers: readonly CrackerView[];
  readonly notes: readonly NoteView[];
  /** Objetos del botín flotando (T135). */
  readonly pickups: readonly PickupView[];
  /** La Llama, mientras dura (null apagada). */
  readonly flame: FlameView | null;
  /** Objetos del botín cogidos en la partida. */
  readonly pickupsTaken: number;
  /** Ya salen élites (hito `elites` del guion). */
  readonly elitesActive: boolean;
  /** La «Marea» está cayendo. */
  readonly mareaActive: boolean;
  /** El acto que se juega (1…). */
  readonly act: number;
  /** Bosses vivos (T137), sus avisos en el agua y los cofres sin recoger. */
  readonly bosses: readonly BossView[];
  readonly bossWarnings: readonly BossWarningView[];
  readonly chests: readonly ChestView[];
  /** Los bosses vencidos en la partida, en orden. */
  readonly bossesDefeated: readonly BossId[];
  /** El boss final del acto cayó (la medalla de oro, T144). */
  readonly finalBossDefeated: boolean;
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
  /** Transitional selection counts by beta-1 icon alias; use weapons/vinyls for real levels. */
  readonly upgrades: Readonly<Partial<Record<UpgradeId, number>>>;
}

export interface SurvivorsOptions {
  /** Calidad de `/mar`: elige los topes. Sin valor, `alta`. */
  quality?: QualityTier;
  /** Física del barco de `/mar` (sin valor, la del motor); se le aplica `handling`. */
  ship?: ShipConfig;
  /** Empezar en el segundo `t` de la partida (atajo `&t=`); determinista por semilla. */
  startAtS?: number;
  /** Dificultad (T131): multiplicadores de `config.difficulties`. Sin valor, `normal`. */
  difficulty?: DifficultyId;
  /** Acto (T137): el guion `config.acts` con ese `act`. Sin valor, el 1. */
  act?: number;
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
  /** Pirata fantasma (T140): la pantalla lo pinta translúcido. */
  ghost: boolean;
  dead: boolean;
}

/** Un disparo enemigo (pistola de agua, andanada de un boss): recto, lo paran las islas y el barco. */
interface EnemyShot {
  id: number;
  /** Quién lo tiró: un tipo de enemigo o un boss con su ataque. */
  enemy: EnemyId | null;
  boss: BossId | null;
  attack: string | null;
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
  evolutionId: EvolutionId | null;
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
  /** El Drop: radio del estallido al chocar (0: no estalla). */
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

/** Un petardo de la Traca: quieto en el agua hasta que lo toca un enemigo o se apaga. */
interface Cracker {
  id: number;
  weapon: WeaponId;
  x: number;
  y: number;
  radius: number;
  burst: number;
  damage: number;
  lifeS: number;
  durationS: number;
  dead: boolean;
}

/** Un foco: su mancha respecto al barco (u) y el enemigo que sigue (−1: ninguno). */
interface Spot {
  dx: number;
  dy: number;
  target: number;
}

/** Un arma del barco: su definición, nivel, números resueltos y relojes. */
interface WeaponSlot {
  def: WeaponDef;
  evolutionId: EvolutionId | null;
  level: number;
  stats: WeaponStats;
  /** s hasta el próximo disparo (formas con `cooldownS`). */
  cooldown: number;
  /** s hasta el próximo golpe (formas con `tickS`). */
  tick: number;
  /** rad: giro de las boyas. */
  angle: number;
  /** s de vida del arma (el «respirar» del abanico del Show de Láseres). */
  phase: number;
  /** Traca: petardos de la ristra en curso que quedan por soltar y s hasta el siguiente. */
  pending: number;
  dropT: number;
  /** Traca: dónde cayó el último petardo (para no amontonarlos con el barco quieto). */
  dropped: boolean;
  lastX: number;
  lastY: number;
  /** Focos: uno por foco. */
  spots: Spot[];
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

/** Un objeto del botín en el agua (T135). */
interface Pickup {
  id: number;
  item: DropId;
  x: number;
  y: number;
  lifeS: number;
  durationS: number;
}

/** Un ataque de boss en curso: su definición, en qué está y la geometría fijada al avisar. */
interface BossAttack {
  name: string;
  def: BossAttackDef;
  stage: 'warning' | 'hit';
  /** s que quedan de la etapa. */
  timer: number;
  /** Ancla: el boss (ring, line, broadside) o donde estaba el barco (circles). */
  x: number;
  y: number;
  heading: number;
  /** ring: desde dónde van los huecos. */
  gapPhase: number;
  /** circles: dónde cae cada uno. */
  circles: { x: number; y: number }[];
  /** line: u que quedan de embestida. */
  left: number;
  /** Ya mojó al barco en este golpe (un golpe por ataque). */
  landed: boolean;
}

interface Boss {
  id: number;
  def: BossDef;
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  hp: number;
  maxHp: number;
  radius: number;
  phase: number;
  /** s en la fase. */
  phaseS: number;
  /** s hasta el próximo ataque. */
  attackTimer: number;
  /** Ataques lanzados en la fase (para el orden cíclico). */
  attackIndex: number;
  attack: BossAttack | null;
  /** Sólo el Kraken (T141): su estado propio (`kraken.ts`); null en los demás. */
  kraken: KrakenState | null;
  /** Sólo el Barco Pirata Fantasma (T140): su ciclo sólido ↔ fantasma (`fantasma.ts`); null en los demás. */
  fantasma: GhostShipState | null;
  dead: boolean;
}

/**
 * Lo que las armas pueden golpear de un boss (T141): su cuerpo (si no está
 * invulnerable) y, en el Kraken, cada tentáculo arriba. La lista se rehace
 * en cada paso tras mover los bosses y vale hasta el siguiente; `dead` se
 * pone al caer la parte dentro del paso. Comparte el `Target` de las armas.
 */
interface BossTarget {
  id: number;
  x: number;
  y: number;
  radius: number;
  dead: boolean;
  boss: Boss;
  tentacle: Tentacle | null;
}

interface Chest {
  id: number;
  boss: BossId;
  x: number;
  y: number;
  dead: boolean;
}

/** Un hueco de boss del guion: cuándo, cuál y si ya se atendió. */
interface BossSlot {
  ev: ScriptEvent;
  def: BossDef;
  done: boolean;
}

/** Lo que un arma puede tener por blanco: un enemigo o un boss (ids del mismo contador). */
type Target = Pick<Enemy, 'id' | 'x' | 'y' | 'radius' | 'dead'>;

const NOTE_RADIUS = 4;
/** Fracción del alcance a la que espera la mancha de un foco sin blanco, por delante del barco. */
const SPOT_REST = 0.35;
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
  /** Azar del botín (T135): aparte, para que soltar objetos no cambie lo que aparece. */
  private readonly dropRng: () => number;
  private readonly baseShip: ShipConfig;
  private shipCfg: ShipConfig;
  private readonly weapons: WeaponSlot[] = [];
  private readonly vinyls: VinylView[] = [];
  private salvavidas: SalvavidasState = 'absent';
  private readonly maxEnemyRadius: number;
  private readonly maxShotRadius: number;
  /** s de partida desde los que salen élites (Infinity: nunca) y su definición. */
  private readonly elitesFromS: number;
  private readonly elitesDef: ElitesDef | null;
  /** Hitos «Marea» activos del guion y, para cada uno, cuándo cae el próximo anillo. */
  private readonly mareas: { ev: ScriptEvent; def: MareaDef }[];
  private readonly mareaNext: number[];
  /** El guion del acto que se juega (T137). */
  readonly act: ActScript;
  /** Huecos de boss activos del guion cuyo boss existe en la config. */
  private readonly bossSlots: BossSlot[];
  /** El azar de los bosses (huecos del anillo, dónde caen los círculos): aparte del guion. */
  private readonly bossRng: () => number;
  private readonly bosses: Boss[] = [];
  /** Lo golpeable de los bosses vivos en este paso (`rebuildBossTargets`). */
  private readonly bossTargets: BossTarget[] = [];
  /** Lo que el Kraken necesita de la partida (T141) y el Kraken al que se lo da ahora. */
  private readonly krakenHost: KrakenHost;
  private krakenBoss: Boss | null = null;
  /** Lo que el Fantasma necesita de la partida (T140): sólo sus sucesos. */
  private readonly ghostHost: GhostShipHost;
  private readonly bossViews: BossView[] = [];
  private readonly bossWarnings: BossWarningView[] = [];
  private readonly chests: Chest[] = [];
  private readonly chestViews: ChestView[] = [];
  private readonly bossesDefeated: BossId[] = [];
  private finalBossDefeated = false;

  private readonly player: ShipState;
  private readonly enemies: Enemy[] = [];
  private readonly projectiles: Projectile[] = [];
  private readonly enemyShots: EnemyShot[] = [];
  private readonly telegraphs: TelegraphView[] = [];
  private readonly zones: Zone[] = [];
  private readonly crackers: Cracker[] = [];
  private readonly weaponViews: WeaponView[] = [];
  private readonly auras: AuraView[] = [];
  private readonly beams: BeamView[] = [];
  private readonly orbitals: OrbitalView[] = [];
  private readonly notes: Note[] = [];
  private readonly pickups: Pickup[] = [];
  /** s que le quedan a la Llama (0: apagada). */
  private flameS = 0;
  private pickupsTaken = 0;
  /**
   * Ids de los objetos del botín, aparte de `nextId`: soltar uno no cambia
   * los ids de lo que aparece después (y con ellos la partida).
   */
  private nextPickupId = 1;
  private readonly flameView: { -readonly [K in keyof FlameView]: FlameView[K] } = {
    x: 0,
    y: 0,
    heading: 0,
    range: 0,
    halfAngle: 0,
    leftS: 0,
    durationS: 0,
  };
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
  readonly difficulty: DifficultyId;
  private readonly diff: DifficultyDef;
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
    this.difficulty = opts.difficulty ?? DEFAULT_DIFFICULTY;
    const diff = config.difficulties[this.difficulty];
    if (!diff) throw new Error(`survivors: no difficulty ${this.difficulty}`);
    this.diff = diff;
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
    this.dropRng = rng((this.seed ^ 0x85ebca6b) >>> 0);
    this.bossRng = rng((this.seed ^ 0x3c6ef372) >>> 0);
    this.baseShip = opts.ship ?? DEFAULT_SHIP_CONFIG;
    this.shipCfg = survivorsShipConfig(this.baseShip, config.handling, 0);
    if (!config.weapons[config.startingWeapon]) {
      throw new Error(`survivors: no weapon ${config.startingWeapon}`);
    }
    // El acto (T137): su guion; sin actos en la config, uno vacío.
    const actN = opts.act ?? 1;
    const act =
      actOf(config, actN) ??
      (opts.act === undefined
        ? config.acts[0] ?? { act: 1, durationS: config.durationS, tracks: [], events: [] }
        : null);
    if (!act) throw new Error(`survivors: no act ${actN}`);
    this.act = act;
    // Hitos del guion: élites (desde cuándo) y Mareas (cuáles). Sin hito de
    // élites el guion no las echa, pero la definición sigue valiendo para
    // las puestas a mano (`spawnEnemy(…, true)`).
    const events = act.events.filter((ev) => ev.enabled !== false);
    // Huecos de boss: sólo los activos cuyo boss existe (los demás, nada, como en T125).
    this.bossSlots = events.flatMap((ev) => {
      const def = ev.type === 'miniboss' || ev.type === 'boss' ? config.bosses[ev.ref as BossId] : undefined;
      return def ? [{ ev, def, done: false }] : [];
    });
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
    this.trackAcc = act.tracks.map(() => 0);
    this.durationSteps = Math.round(config.durationS / SURVIVORS_STEP_S);
    // El Kraken (T141) ve la partida por aquí: barco, azar de los bosses, islas, golpes y sucesos.
    this.krakenHost = {
      bounds: this.bounds,
      obstacles: world.obstacles,
      player: () => this.player,
      shipRadius: () => this.shipCfg.radius,
      rng: () => this.bossRng(),
      nextId: () => this.nextId++,
      toWater: (x, y, r) => this.islands.toWater(x, y, r),
      hitLands: () => this.bossHitLands(),
      hitPlayer: (water, attack, x, y) => {
        const b = this.krakenBoss;
        if (b) this.damagePlayerByBoss(water, b, attack, x, y);
      },
      telegraph: (attack, x, y) => {
        const b = this.krakenBoss;
        if (b) this.events.push({ type: 'bossTelegraph', boss: b.def.id, id: b.id, attack, kind: 'circles', x, y, heading: 0 });
      },
      attack: (attack, x, y) => {
        const b = this.krakenBoss;
        if (b) this.events.push({ type: 'bossAttack', boss: b.def.id, id: b.id, attack, kind: 'circles', x, y });
      },
      emit: (ev) => this.events.push(ev),
    };
    this.ghostHost = { emit: (ev) => this.events.push(ev) };

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
      difficulty: this.difficulty,
      movement: this.movement.snapshot(),
      player: Object.assign(this.player, { radius: this.shipCfg.radius, invulnerableS: 0 }),
      enemies: this.enemies,
      enemiesByType: this.byType,
      projectiles: this.projectiles,
      enemyProjectiles: this.enemyShots,
      telegraphs: this.telegraphs,
      weapons: this.weaponViews,
      vinyls: this.vinyls,
      salvavidas: this.salvavidas,
      slots: config.slots,
      auras: this.auras,
      beams: this.beams,
      orbitals: this.orbitals,
      zones: this.zones,
      crackers: this.crackers,
      notes: this.notes,
      pickups: this.pickups,
      flame: null,
      pickupsTaken: 0,
      elitesActive: false,
      mareaActive: false,
      act: act.act,
      bosses: this.bossViews,
      bossWarnings: this.bossWarnings,
      chests: this.chestViews,
      bossesDefeated: this.bossesDefeated,
      finalBossDefeated: false,
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
    v.salvavidas = this.salvavidas;
    v.end = this.endReason;
    v.defeated = this.defeated;
    v.pressure = this.overflow;
    v.notesPicked = this.notesPicked;
    v.notesValue = this.notesValue;
    v.pickupsTaken = this.pickupsTaken;
    v.flame = this.flameS > 0 ? this.updateFlameView() : null;
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
        evolutionId: w.evolutionId,
        nameKey: w.def.i18nKey,
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
          if (w.def.effects?.sweep) {
            for (let k = 0; k < st.count; k++) {
              this.beams.push({
                weapon: w.def.id,
                x: p.x,
                y: p.y,
                angle: this.sweepAngle(w, k),
                length: st.range,
                halfWidth: st.area,
                spot: 0,
                target: -1,
              });
            }
          } else {
            for (const sp of w.spots) {
              this.beams.push({
                weapon: w.def.id,
                x: p.x,
                y: p.y,
                angle: Math.atan2(sp.dy, sp.dx),
                length: Math.hypot(sp.dx, sp.dy),
                halfWidth: st.area,
                spot: st.area,
                target: sp.target,
              });
            }
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
    v.finalBossDefeated = this.finalBossDefeated;
    this.bossViews.length = 0;
    this.bossWarnings.length = 0;
    for (const b of this.bosses) {
      this.bossViews.push(this.bossView(b));
      if (b.attack) this.pushWarnings(b, b.attack);
      if (b.kraken) krakenWarnings(b.kraken, b, this.bossWarnings);
    }
    this.chestViews.length = 0;
    for (const c of this.chests) {
      this.chestViews.push({ id: c.id, boss: c.boss, x: c.x, y: c.y, radius: this.config.bossFight.chestRadius });
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
   * o no existe en la config, o no quedan huecos.
   */
  addWeapon(id: WeaponId, level = 1): boolean {
    const def = this.config.weapons[id];
    if (!def || !Number.isFinite(level) || this.weapons.length >= this.config.slots.weapons ||
      this.weapons.some((w) => w.def.id === id)) return false;
    const slot: WeaponSlot = {
      def,
      evolutionId: null,
      level: Math.min(def.maxLevel, Math.max(1, Math.floor(level))),
      stats: resolveWeaponStats(def, 1, this.stats),
      cooldown: 0,
      tick: 0,
      angle: 0,
      phase: 0,
      pending: 0,
      dropT: 0,
      dropped: false,
      lastX: 0,
      lastY: 0,
      spots: [],
    };
    slot.stats = resolveWeaponStats(def, slot.level, this.stats);
    this.weapons.push(slot);
    return true;
  }

  /** Sube un nivel el arma (hasta `maxLevel`). false si no la lleva o ya está al máximo. */
  levelUpWeapon(id: WeaponId): boolean {
    const w = this.weapons.find((x) => x.def.id === id);
    if (!w || w.evolutionId || w.level >= w.def.maxLevel) return false;
    w.level++;
    w.stats = resolveWeaponStats(w.def, w.level, this.stats);
    return true;
  }

  /** Rehace los números de todas las armas (tras una mejora o un vinilo). */
  private refreshWeapons(): void {
    for (const w of this.weapons) w.stats = resolveWeaponStats(w.def, w.level, this.stats);
  }

  get heldVinyls(): readonly VinylView[] {
    return this.vinyls;
  }

  vinylLevel(id: PassiveId): number {
    return this.vinyls.find((v) => v.id === id)?.level ?? 0;
  }

  addVinyl(id: PassiveId, level = 1): boolean {
    const def = this.config.passives[id];
    if (!def || !Number.isFinite(level) || this.vinylLevel(id) > 0 ||
      this.vinyls.length >= this.config.slots.vinyls) return false;
    const top = Math.min(def.maxLevel, Math.max(1, Math.floor(level)));
    this.vinyls.push({ id, level: top, maxLevel: def.maxLevel, nameKey: def.i18nKey });
    for (const gain of def.levels.slice(0, top)) this.stats[def.stat] += gain.amount;
    this.refreshStats();
    return true;
  }

  levelUpVinyl(id: PassiveId): boolean {
    const index = this.vinyls.findIndex((v) => v.id === id);
    const v = this.vinyls[index];
    const def = this.config.passives[id];
    if (!v || !def || v.level >= def.maxLevel) return false;
    this.stats[def.stat] += def.levels[v.level]!.amount;
    this.vinyls[index] = { ...v, level: v.level + 1 };
    this.refreshStats();
    return true;
  }

  private refreshStats(): void {
    this.shipCfg = survivorsShipConfig(this.baseShip, this.config.handling, this.stats.speedBonus);
    this.refreshWeapons();
  }

  private inventory() {
    return {
      weapons: this.weapons.map((w) => ({ id: w.def.id, level: w.level, evolutionId: w.evolutionId })),
      vinyls: this.vinyls,
      salvavidas: this.salvavidas,
    };
  }

  /** No RNG: the same hook is available to a future chest. */
  evolveWeapon(id: EvolutionId): boolean {
    const e = eligibleEvolutions(this.config, this.inventory()).find((e) => e.id === id);
    if (!e) return false;
    const w = this.weapons.find((w) => w.def.id === e.weapon)!;
    w.def = e.evolvedWeapon;
    w.evolutionId = e.id;
    w.stats = resolveWeaponStats(w.def, w.level, this.stats);
    w.cooldown = 0;
    w.tick = 0;
    w.spots.length = 0;
    this.events.push({ type: 'evolved', weapon: e.weapon, evolutionId: e.id });
    return true;
  }

  /** Rare level-up item, not an equipment slot; permanently unavailable after acquisition. */
  addSalvavidas(): boolean {
    if (this.salvavidas !== 'absent') return false;
    this.salvavidas = 'held';
    return true;
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
      wp: this.weapons.map((w) => [
        w.def.id,
        w.level,
        w.evolutionId,
        w.cooldown,
        w.tick,
        w.angle,
        w.phase,
        w.pending,
        w.dropT,
        w.dropped ? [w.lastX, w.lastY] : null,
        w.spots.map((sp) => [sp.dx, sp.dy, sp.target]),
      ]),
      z: this.zones.map((z) => [z.id, z.x, z.y, z.life, z.tick]),
      cr: this.crackers.map((c) => [c.id, c.x, c.y, c.lifeS]),
      of: this.overflow,
      acc: this.trackAcc,
      mn: this.mareaNext,
      up: this.stacks,
      vinyls: this.vinyls.map((v) => [v.id, v.level]),
      salvavidas: this.salvavidas,
      card: this.card?.options.map((o) => [o.id, o.targetLevel]) ?? null,
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
      b: this.projectiles.map((b) => [b.id, b.x, b.y, b.life]),
      s: this.enemyShots.map((b) => [b.id, b.x, b.y, b.life]),
      n: this.notes.map((n) => [n.id, n.x, n.y, n.value, n.magnet ? 1 : 0]),
      pk: this.pickups.map((o) => [o.id, o.item, o.x, o.y, o.lifeS]),
      fl: [this.flameS, this.pickupsTaken, this.nextPickupId],
      k: [this.defeated, this.notesPicked, this.notesValue, this.nextId],
      act: this.act.act,
      bs: this.bossSlots.map((s) => (s.done ? 1 : 0)),
      bo: this.bosses.map((b) => [
        b.id,
        b.def.id,
        b.x,
        b.y,
        b.vx,
        b.vy,
        b.hp,
        b.phase,
        b.phaseS,
        b.attackTimer,
        b.attackIndex,
        b.attack ? [b.attack.name, b.attack.stage, b.attack.timer, b.attack.x, b.attack.y, b.attack.left, b.attack.landed ? 1 : 0] : null,
        b.kraken ? krakenHash(b.kraken) : null,
        b.fantasma ? ghostHash(b.fantasma) : null,
      ]),
      ch: this.chests.map((c) => [c.id, c.boss, c.x, c.y]),
      bd: this.bossesDefeated,
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
    const e = this.makeEnemy(def, spot.x, spot.y, def.hp * this.diff.enemyHp, def.speed, elite);
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
      ghost: false,
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

  /**
   * Suelta un objeto del botín en (x, y), llevado al agua (T135). Para
   * pruebas y el atajo `&botin=1`. Devuelve su id.
   */
  spawnPickup(item: DropId, x: number, y: number): number {
    return this.dropPickup(item, x, y);
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
    this.stepBosses(dt);
    this.contactDamage(dt);
    this.stepEnemyShots(dt);
    this.stepWeapons(dt);
    this.stepFlame(dt);
    this.stepProjectiles(dt);
    this.stepZones(dt);
    this.stepCrackers(dt);
    this.compactEnemies();
    this.stepPickups(dt);
    this.compactBosses();
    this.stepNotes(dt);
    this.stepChests();

    if (this.water >= this.config.player.waterCapacity && this.salvavidas === 'held') {
      this.salvavidas = 'consumed';
      this.water = this.config.player.waterCapacity * this.config.salvavidas.waterFractionAfterSave;
      this.invulnerable = this.config.salvavidas.invulnerableS;
      this.events.push({ type: 'saved', item: 'salvavidas', x: this.player.x, y: this.player.y, water: this.water });
    }
    if (this.water >= this.config.player.waterCapacity) this.finish('flooded');
    else if (this.activeSteps >= this.durationSteps) {
      // Amanece: un boss vivo se retira (§8); la partida se sobrevive igual.
      this.retreatBosses();
      this.finish('survived');
    } else if (!this.endReason) this.checkLevelUp();
    return this.events;
  }

  /** Acaba la partida (una sola vez: la primera razón manda; vencer al boss final acaba a medio paso, T140). */
  private finish(reason: EndReason): void {
    if (this.endReason) return;
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
    const act = this.act;
    const t = this.activeS;
    // Huecos de boss: al llegar su segundo, entra el boss.
    for (const slot of this.bossSlots) {
      if (slot.done || t < slot.ev.atS) continue;
      slot.done = true;
      this.enterBoss(slot.def);
    }
    // Con un boss vivo los comunes bajan de ritmo (§8).
    const pace = this.bosses.length > 0 ? this.config.bossFight.commonSpawnScale : 1;
    act.tracks.forEach((track, i) => {
      const key = trackAt(track, t);
      if (!key) return;
      let acc = this.trackAcc[i]! + key.groupsPerS * this.diff.enemyCount * pace * dt;
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
        this.spawnRing(def.enemy, Math.round(def.count * this.diff.enemyCount), def.hpScale, def.speedScale);
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
  private placeEnemy(
    def: EnemyDef,
    x: number,
    y: number,
    hpScale: number,
    speedScale: number,
    ignoreShare = false,
  ): boolean {
    const sp = this.config.spawn;
    if (this.enemies.length >= this.caps.enemies || (!ignoreShare && this.overShare(def))) {
      // Tope: la oleada sube de fuerza en vez de en número.
      this.overflow = Math.min(sp.overflowMax, this.overflow + sp.overflowStrength);
      return false;
    }
    const minutes = this.minutes();
    const hp =
      def.hp *
      hpScale *
      this.diff.enemyHp *
      (this.act.enemyHpScale ?? 1) *
      (1 + def.growthPerMinute.hp * minutes) *
      (1 + this.overflow);
    const speed = def.speed * speedScale * (1 + def.growthPerMinute.speed * minutes);
    const elite =
      this.elitesDef !== null &&
      this.activeS >= this.elitesFromS &&
      this.spawnRng() < this.elitesDef.chance;
    this.enemies.push(this.makeEnemy(def, x, y, hp, speed, elite));
    return true;
  }

  /**
   * ¿Ya ocupa este tipo su parte del tope (`capShare`)? Así, con el tope
   * bajo de `baja`, las pirañas no llenan solas el mar y el guion tardío
   * sigue enseñando los demás tipos (T126/T132).
   */
  private overShare(def: EnemyDef): boolean {
    if (def.capShare === undefined || def.capShare >= 1) return false;
    const max = Math.max(1, Math.floor(this.caps.enemies * def.capShare));
    let n = 0;
    for (const e of this.enemies) if (!e.dead && e.type === def.id && ++n >= max) return true;
    return false;
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
      // La Marea es un enjambre a propósito: no mira la parte del tope de su tipo.
      this.placeEnemy(def, spot.x, spot.y, hpScale, speedScale, true);
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
    // Con un boss vivo los comunes van más despacio (§8, `bossFight.commonSpeedScale`).
    const slow = this.bosses.length > 0 ? this.config.bossFight.commonSpeedScale : 1;
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
      const speed = e.speed * slow;
      let wantX = dx * speed;
      let wantY = dy * speed;
      // `direct`: la velocidad va fijada (quieto o embistiendo), sin inercia ni rodeos.
      let direct = false;
      switch (e.def.behavior) {
        case 'flyer': {
          // Vuela en eses: un vaivén lateral que la hace reconocible (y algo menos directa).
          const weave = Math.sin(this.activeS * 2.5 + e.id) * 0.35 * speed;
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
            e.vx = e.chargeX * ch.chargeSpeed * slow;
            e.vy = e.chargeY * ch.chargeSpeed * slow;
            e.chargeLeft -= ch.chargeSpeed * slow * dt;
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
        const push = this.avoidIslands(e.x, e.y, dx, dy, e.radius, speed);
        wantX += push.x;
        wantY += push.y;
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
      const top = speed * 1.5;
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
   * El empuje lateral para rodear la isla que hay delante de un cuerpo en
   * (x, y) de radio `r` que quiere ir hacia (dx, dy) (unitario) a `speed`:
   * la parte del rodeo del `chase` de los enemigos, compartida con los
   * bosses. Devuelve el vector a sumar a la velocidad deseada.
   */
  private readonly avoidOut = { x: 0, y: 0 };
  private avoidIslands(x: number, y: number, dx: number, dy: number, r: number, speed: number): { x: number; y: number } {
    const ai = this.config.enemyAI;
    const isl = this.islands;
    const out = this.avoidOut;
    out.x = 0;
    out.y = 0;
    const near = isl.near(x, y, ai.lookAhead + r, this.scratch);
    for (const k of near) {
      const o = isl.obstacles[k]!;
      const ox = wd(o.x - x, this.w);
      const oy = wd(o.y - y, this.h);
      const proj = ox * dx + oy * dy;
      if (proj < -o.radius || proj > ai.lookAhead + o.radius) continue;
      const lat = -ox * dy + oy * dx;
      const clear = o.radius + r + 8;
      if (Math.abs(lat) >= clear) continue;
      const push = (clear - Math.abs(lat)) / clear;
      const side = lat > 0 ? -1 : 1;
      out.x += -dy * side * push * ai.avoidStrength * speed;
      out.y += dx * side * push * ai.avoidStrength * speed;
    }
    return out;
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
    const p = this.player;
    const pr = this.shipCfg.radius;
    if (this.invulnerable <= 0) {
      const near = this.enemyGrid.query(p.x, p.y, pr + this.maxEnemyRadius, this.scratch);
      for (const i of near) {
        const e = this.enemies[i]!;
        if (e.dead) continue;
        const dx = wd(e.x - p.x, this.w);
        const dy = wd(e.y - p.y, this.h);
        const min = pr + e.radius;
        if (dx * dx + dy * dy >= min * min) continue;
        this.damagePlayer(e.def.contactWater, e.type, e.x, e.y);
        break;
      }
    }
    // Los bosses: pocos, sin rejilla. Tocar el casco moja como un enemigo;
    // la embestida (`line` en golpe) moja lo del ataque una vez, aunque el
    // barco esté en los segundos de gracia de un golpe de contacto.
    for (const b of this.bosses) {
      if (b.dead) continue;
      // El Kraken bajo el agua (o saliendo / hundiéndose) es una sombra: no toca.
      if (b.kraken && !krakenSolid(b.kraken)) continue;
      // El Fantasma desvanecido (T140) tampoco.
      if (b.fantasma && !ghostSolid(b.fantasma)) continue;
      const dx = wd(b.x - p.x, this.w);
      const dy = wd(b.y - p.y, this.h);
      const min = pr + b.radius;
      if (dx * dx + dy * dy >= min * min) continue;
      const charging = b.attack && b.attack.stage === 'hit' && b.attack.def.kind === 'line' ? b.attack : null;
      if (charging) {
        if (charging.landed || !this.bossHitLands()) continue;
        charging.landed = true;
        this.damagePlayerByBoss(charging.def.water, b, charging.name, b.x, b.y);
      } else if (this.invulnerable <= 0) {
        this.damagePlayerByBoss(b.def.contactWater, b, null, b.x, b.y);
      }
      return;
    }
  }

  /**
   * ¿Moja ahora un ataque avisado de boss? Sí salvo que el barco lleve una
   * invulnerabilidad larga (la del Salvavidas): los segundos de gracia de un
   * golpe de contacto no lo salvan de un ataque avisado, o un boss rodeado
   * de pirañas no tocaría nunca.
   */
  private bossHitLands(): boolean {
    return this.invulnerable <= this.config.player.invulnerableS;
  }

  /** Mete `amount` de agua a bordo (menos la dificultad y el casco) y da la invulnerabilidad del golpe. */
  private takeWater(amount: number): void {
    const water = amount * this.diff.enemyDamage * Math.max(0, 1 - this.stats.hullBonus);
    this.water = Math.min(this.config.player.waterCapacity, this.water + water);
    this.invulnerable = this.config.player.invulnerableS;
  }

  private damagePlayer(amount: number, by: EnemyId, x: number, y: number): void {
    this.takeWater(amount);
    this.events.push({ type: 'hit', enemy: by, x, y, water: this.water });
  }

  private damagePlayerByBoss(amount: number, b: Boss, attack: string | null, x: number, y: number): void {
    this.takeWater(amount);
    this.events.push({ type: 'bossHit', boss: b.def.id, attack, x, y, water: this.water });
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
      boss: null,
      attack: null,
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
        if (b.enemy !== null) {
          if (this.invulnerable <= 0) this.damagePlayer(b.water, b.enemy, b.x, b.y);
        } else if (b.boss !== null && this.bossHitLands()) {
          this.takeWater(b.water);
          this.events.push({ type: 'bossHit', boss: b.boss, attack: b.attack, x: b.x, y: b.y, water: this.water });
        }
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

  /** Lo golpeable de un boss (cuerpo vulnerable o tentáculo) más cercano a (x, y) a menos de `range`; null si nada. */
  private nearestBoss(x: number, y: number, range: number): BossTarget | null {
    let best: BossTarget | null = null;
    let bestD = range * range;
    for (const b of this.bossTargets) {
      if (b.dead) continue;
      const dx = wd(b.x - x, this.w);
      const dy = wd(b.y - y, this.h);
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD || (d2 === bestD && best && b.id < best.id)) {
        best = b;
        bestD = d2;
      }
    }
    return best;
  }

  /** Lo más cercano a tiro para apuntar: un enemigo o un boss vulnerable (el más cercano de los dos). */
  private nearestTarget(range: number): { x: number; y: number } | null {
    const p = this.player;
    const e = this.nearestEnemy(range);
    const b = this.nearestBoss(p.x, p.y, range);
    if (!e || !b) return e ?? b;
    const de = Math.hypot(wd(e.x - p.x, this.w), wd(e.y - p.y, this.h));
    const db = Math.hypot(wd(b.x - p.x, this.w), wd(b.y - p.y, this.h));
    return db < de ? b : e;
  }

  /** Enemigos y bosses vulnerables a menos de `range` del barco: los blancos de cohetes y nubes. */
  private readonly scratchTargets: Target[] = [];
  private targetsInRange(range: number): Target[] {
    const out = this.scratchTargets;
    out.length = 0;
    for (const e of this.enemiesInRange(range, this.scratchEnemies)) out.push(e);
    const p = this.player;
    for (const b of this.bossTargets) {
      if (b.dead) continue;
      const dx = wd(b.x - p.x, this.w);
      const dy = wd(b.y - p.y, this.h);
      if (dx * dx + dy * dy <= range * range) out.push(b);
    }
    return out;
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

  /** Hiere a todo lo vivo que toca el círculo (x, y, r), bosses incluidos. Devuelve cuántos. */
  private hurtCircle(x: number, y: number, r: number, damage: number, push = 0): number {
    const near = this.enemyGrid.query(x, y, r + this.maxEnemyRadius, this.scratch2);
    let n = this.hurtBossesCircle(x, y, r, damage);
    for (const i of near) {
      const e = this.enemies[i]!;
      if (e.dead) continue;
      const dx = wd(e.x - x, this.w);
      const dy = wd(e.y - y, this.h);
      const min = r + e.radius;
      if (dx * dx + dy * dy > min * min) continue;
      this.hurt(e, damage);
      if (!e.dead && push > 0) {
        const d = Math.hypot(dx, dy);
        const ux = d > 0 ? dx / d : 1;
        const uy = d > 0 ? dy / d : 0;
        this.setWrapped(e, e.x + ux * push, e.y + uy * push);
        if (!e.def.ignoresIslands) {
          this.slideOffIslands(e, e.radius);
          const spot = this.islands.toWater(e.x, e.y, e.radius);
          if (spot) this.setWrapped(e, spot.x, spot.y);
        }
      }
      n++;
    }
    if (push > 0 && n > 0) this.rebuildEnemyGrid();
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
        case 'trail':
          this.stepTrail(w, dt);
          break;
        case 'zone':
          if (this.ready(w, dt)) this.castZones(w);
          break;
        case 'aura':
          if (this.ticks(w, dt)) {
            this.hurtCircle(this.player.x, this.player.y, st.area, st.damage, w.def.effects?.pushDistance);
          }
          break;
        case 'beam':
          if (w.def.effects?.sweep) {
            w.phase += dt;
            if (this.ticks(w, dt)) this.hurtBeams(w);
          } else {
            this.aimSpots(w, dt);
            if (this.ticks(w, dt)) this.hurtSpots(w);
          }
          break;
        case 'orbit':
          w.angle = wrapAngle(w.angle + st.speed * dt);
          if (this.ticks(w, dt)) this.hurtOrbitals(w);
          if (w.def.effects?.flashes && this.ready(w, dt)) this.fireOrbitalFlashes(w);
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
  private shoot(w: WeaponSlot, a: number, origin = this.player, flash = false): boolean {
    if (this.projectiles.length >= this.caps.projectiles) return false;
    const st = w.stats;
    const p = origin;
    const f = flash ? w.def.effects?.flashes : undefined;
    const speed = f?.speed ?? st.speed;
    const range = f?.range ?? st.range;
    this.projectiles.push({
      id: this.nextId++,
      weapon: w.def.id,
      kind: w.def.kind,
      evolutionId: w.evolutionId,
      x: p.x,
      y: p.y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      radius: f ? f.radius * (1 + this.stats.areaBonus) : w.def.effects?.projectileRadius ?? st.area,
      life: (range / speed) * 1.2,
      damage: st.damage,
      pierce: st.pierce,
      blocked: w.def.blockedByIslands,
      burst: w.def.effects?.projectileRadius ? st.area : 0,
      speed,
      lastHit: -1,
      dead: false,
    });
    return true;
  }

  /** Cañón de agua: `count` bolas en abanico al enemigo más cercano a tiro. */
  private fireAtNearest(w: WeaponSlot): void {
    const st = w.stats;
    const target = this.nearestTarget(st.range);
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
    if (!this.nearestTarget(w.stats.range)) {
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

  /**
   * Traca: cada `cooldownS` empieza una ristra de `count` petardos, que caen
   * de uno en uno por la popa cada `dropEveryS` s y así quedan en la estela.
   * No necesita blanco: la ristra cae al ritmo, haya o no enemigos cerca;
   * pero cada petardo cae a `minSpacing` u del anterior como poco, así que
   * con el barco quieto la ristra espera (premia navegar, no plantarse).
   * Una ristra nueva sustituye a lo que quedara de la anterior.
   */
  private stepTrail(w: WeaponSlot, dt: number): void {
    const st = w.stats;
    const trail = w.def.effects?.trail;
    if (!trail) return;
    if (this.ready(w, dt)) {
      w.cooldown += st.cooldownS;
      if (st.count > 0) {
        w.pending = st.count;
        w.dropT = 0;
        const p = this.player;
        this.events.push({ type: 'fire', weapon: w.def.id, x: p.x, y: p.y, count: st.count });
      }
    }
    if (w.pending <= 0) return;
    w.dropT = Math.max(0, w.dropT - dt);
    const p = this.player;
    const back = this.shipCfg.radius + trail.triggerRadius;
    while (w.pending > 0 && w.dropT <= 0) {
      const x = wrapInto(p.x - Math.cos(p.heading) * back, this.bounds.left, this.bounds.right);
      const y = wrapInto(p.y - Math.sin(p.heading) * back, this.bounds.top, this.bounds.bottom);
      // Sin estela no hay ristra: el petardo espera a que el barco se aparte del anterior.
      if (w.dropped && Math.hypot(wd(x - w.lastX, this.w), wd(y - w.lastY, this.h)) < trail.minSpacing) break;
      this.dropCracker(w, x, y, trail.triggerRadius);
      w.pending--;
      w.dropT += Math.max(SURVIVORS_STEP_S, trail.dropEveryS);
    }
  }

  /** Un petardo en (x, y); con el tope lleno, el más viejo se apaga para dejarle sitio. */
  private dropCracker(w: WeaponSlot, x: number, y: number, triggerRadius: number): void {
    w.dropped = true;
    w.lastX = x;
    w.lastY = y;
    if (this.caps.crackers <= 0) return;
    if (this.crackers.length >= this.caps.crackers) this.crackers.shift();
    const st = w.stats;
    this.crackers.push({
      id: this.nextId++,
      weapon: w.def.id,
      x,
      y,
      radius: triggerRadius,
      burst: st.area,
      damage: st.damage,
      lifeS: st.durationS,
      durationS: st.durationS,
      dead: false,
    });
  }

  /**
   * Los petardos: el que toca un enemigo vivo estalla (daño a todo lo que
   * hay en su radio, pequeño); el que se queda sin mecha se apaga sin más.
   */
  private stepCrackers(dt: number): void {
    if (this.crackers.length === 0) return;
    for (const c of this.crackers) {
      c.lifeS -= dt;
      if (c.lifeS <= 0) {
        c.dead = true;
        continue;
      }
      const near = this.enemyGrid.query(c.x, c.y, c.radius + this.maxEnemyRadius, this.scratch);
      let touched = false;
      for (const i of near) {
        const e = this.enemies[i]!;
        if (e.dead) continue;
        const dx = wd(e.x - c.x, this.w);
        const dy = wd(e.y - c.y, this.h);
        const min = c.radius + e.radius;
        if (dx * dx + dy * dy <= min * min) {
          touched = true;
          break;
        }
      }
      if (!touched) continue;
      c.dead = true;
      this.hurtCircle(c.x, c.y, c.burst, c.damage);
      this.events.push({ type: 'explode', weapon: c.weapon, x: c.x, y: c.y, radius: c.burst });
    }
    let n = 0;
    for (const c of this.crackers) if (!c.dead) this.crackers[n++] = c;
    this.crackers.length = n;
  }

  /**
   * Lluvia ácida: `count` nubes, cada una sobre el enemigo a tiro con más
   * vecinos debajo de la nube (empate: el de id menor); ninguna sin blanco.
   */
  private castZones(w: WeaponSlot): void {
    const st = w.stats;
    const pool = this.targetsInRange(st.range);
    if (pool.length === 0) {
      w.cooldown = 0;
      return;
    }
    let made = 0;
    for (let k = 0; k < st.count && this.zones.length < this.caps.areas; k++) {
      let best: Target | null = null;
      let bestN = -1;
      for (const e of pool) {
        if (e.dead) continue;
        // Un boss (o un tentáculo) cuenta como un grupo de 3 debajo de la nube (vale la pena regarlo).
        let n = this.bossTargets.includes(e as BossTarget) ? 3 : 0;
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

  /**
   * Rumbo del rayo `k` del abanico del Show de Láseres: los rayos se abren
   * en `arcRad` delante del barco y el abanico entero barre de lado a lado
   * (±`swingRad`, `swingHz` veces por segundo). Lo de detrás queda fuera:
   * hay que apuntar con el barco.
   */
  private sweepAngle(w: WeaponSlot, k: number): number {
    const sw = w.def.effects!.sweep!;
    const n = w.stats.count;
    const f = n > 1 ? k / (n - 1) - 0.5 : 0;
    const swing = sw.swingRad * Math.sin(w.phase * sw.swingHz * Math.PI * 2);
    return this.player.heading + swing + f * sw.arcRad;
  }

  /** ¿Sigue valiendo `id` como blanco de un foco (vivo, el boss vulnerable, y a tiro)? */
  private spotTarget(id: number, range: number): Target | null {
    const e = this.targetById(id);
    if (!e) return null;
    const p = this.player;
    const dx = wd(e.x - p.x, this.w);
    const dy = wd(e.y - p.y, this.h);
    const r = range + e.radius;
    return dx * dx + dy * dy <= r * r ? e : null;
  }

  /**
   * Focos: cada foco sigue a su blanco mientras viva y esté a tiro; si no,
   * se fija en el enemigo más cercano que no lleve ya otro foco (si todos lo
   * llevan, el más cercano). La mancha va hacia el blanco a `speed` u/s, así
   * que pasa suave de uno a otro; sin blanco vuelve por delante del barco.
   */
  private aimSpots(w: WeaponSlot, dt: number): void {
    const st = w.stats;
    const p = this.player;
    const count = Math.max(0, st.count);
    while (w.spots.length < count) {
      const rest = st.range * SPOT_REST;
      w.spots.push({ dx: Math.cos(p.heading) * rest, dy: Math.sin(p.heading) * rest, target: -1 });
    }
    w.spots.length = count;
    // Los focos se fijan en enemigos y en bosses vulnerables (T137).
    let pool: Target[] | null = null;
    for (let k = 0; k < w.spots.length; k++) {
      const sp = w.spots[k]!;
      let target = this.spotTarget(sp.target, st.range);
      if (!target) {
        pool ??= this.targetsInRange(st.range);
        let free: Target | null = null;
        let freeD = Infinity;
        let any: Target | null = null;
        let anyD = Infinity;
        for (const e of pool) {
          if (e.dead) continue;
          const dx = wd(e.x - p.x, this.w);
          const dy = wd(e.y - p.y, this.h);
          const d = dx * dx + dy * dy;
          if (d < anyD || (d === anyD && any && e.id < any.id)) {
            any = e;
            anyD = d;
          }
          const taken = w.spots.some((o, j) => j !== k && o.target === e.id);
          if (!taken && (d < freeD || (d === freeD && free && e.id < free.id))) {
            free = e;
            freeD = d;
          }
        }
        target = free ?? any;
        sp.target = target ? target.id : -1;
      }
      let gx: number;
      let gy: number;
      if (target) {
        gx = wd(target.x - p.x, this.w);
        gy = wd(target.y - p.y, this.h);
      } else {
        const rest = st.range * SPOT_REST;
        gx = Math.cos(p.heading) * rest;
        gy = Math.sin(p.heading) * rest;
      }
      const ex = gx - sp.dx;
      const ey = gy - sp.dy;
      const d = Math.hypot(ex, ey);
      const stepLen = st.speed * dt;
      if (d <= stepLen || d === 0) {
        sp.dx = gx;
        sp.dy = gy;
      } else {
        sp.dx += (ex / d) * stepLen;
        sp.dy += (ey / d) * stepLen;
      }
      // La mancha nunca pasa del alcance.
      const len = Math.hypot(sp.dx, sp.dy);
      if (len > st.range) {
        sp.dx *= st.range / len;
        sp.dy *= st.range / len;
      }
    }
  }

  /** Focos: cada mancha quema a lo que tiene debajo (el blanco y lo que pase por ahí). */
  private hurtSpots(w: WeaponSlot): void {
    const st = w.stats;
    const p = this.player;
    for (const sp of w.spots) {
      if (sp.target < 0) continue;
      this.hurtCircle(
        wrapInto(p.x + sp.dx, this.bounds.left, this.bounds.right),
        wrapInto(p.y + sp.dy, this.bounds.top, this.bounds.bottom),
        st.area,
        st.damage,
      );
    }
  }

  /** Show de Láseres: cada rayo del abanico hiere a lo que toca el segmento desde el barco. */
  private hurtBeams(w: WeaponSlot): void {
    const st = w.stats;
    const p = this.player;
    for (let k = 0; k < st.count; k++) {
      const a = this.sweepAngle(w, k);
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
      for (const b of this.bossTargets) {
        if (b.dead) continue;
        const dx = wd(b.x - p.x, this.w);
        const dy = wd(b.y - p.y, this.h);
        const along = dx * ux + dy * uy;
        if (along < -b.radius || along > st.range + b.radius) continue;
        if (Math.abs(-dx * uy + dy * ux) > st.area + b.radius) continue;
        this.hurtTarget(b, st.damage);
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

  /** Bola de Discoteca: destellos desde la bola gigante en orbita, bajo el tope de proyectiles. */
  private fireOrbitalFlashes(w: WeaponSlot): void {
    const f = w.def.effects!.flashes!;
    const st = w.stats;
    let count = 0;
    for (let k = 0; k < st.count; k++) {
      const a = beamAngle(w.angle, k, st.count);
      const origin = { ...this.player,
        x: this.player.x + Math.cos(a) * st.range,
        y: this.player.y + Math.sin(a) * st.range };
      const flashes = f.count + Math.round(this.stats.extraProjectiles);
      for (let j = 0; j < flashes; j++) {
        if (!this.shoot(w, beamAngle(w.angle, j, flashes), origin, true)) break;
        count++;
      }
    }
    w.cooldown += Math.max(SURVIVORS_STEP_S, f.cooldownS / (1 + this.stats.fireRateBonus));
    this.fired(w, count);
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

  /** Una bola de El Drop estalla en (x, y): hiere a todo en su radio. */
  private explode(b: Projectile): void {
    b.dead = true;
    this.hurtCircle(b.x, b.y, b.burst, b.damage);
    this.events.push({ type: 'explode', weapon: b.weapon, x: b.x, y: b.y, radius: b.burst });
  }

  /** El enemigo o boss (vivo y, el boss, vulnerable) con ese id; null si ya no está. */
  private targetById(id: number): Target | null {
    if (id < 0) return null;
    for (const e of this.enemies) if (e.id === id) return e.dead ? null : e;
    for (const b of this.bossTargets) if (b.id === id) return b.dead ? null : b;
    return null;
  }

  /**
   * Bolas y confetis avanzan recto. Las formas rectas (`blocked`) las paran
   * las islas y hieren al primero que tocan (atravesando `pierce`); las de
   * El Drop estallan al chocar.
   */
  private stepProjectiles(dt: number): void {
    for (const b of this.projectiles) {
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
      // Los bosses: pocos, sin rejilla; invulnerables, la bola los atraviesa (sólo lo golpeable está en la lista).
      let hitBoss: BossTarget | null = null;
      for (const o of this.bossTargets) {
        if (o.dead || o.id === b.lastHit) continue;
        const t = segmentHit(wd(b.x - o.x, this.w), wd(b.y - o.y, this.h), sx, sy, ss, o.radius + b.radius);
        if (t < hitT) {
          hitBoss = o;
          hit = null;
          hitT = t;
        }
      }
      if (hit || hitBoss) {
        if (b.burst > 0) {
          this.setWrapped(b, b.x + sx * hitT, b.y + sy * hitT);
          this.explode(b);
          continue;
        }
        if (hitBoss) {
          b.lastHit = hitBoss.id;
          this.hurtTarget(hitBoss, b.damage);
        } else if (hit) {
          b.lastHit = hit.id;
          this.hurt(hit, b.damage);
        }
        if (b.pierce <= 0) {
          b.dead = true;
          continue;
        }
        b.pierce--;
      }
      b.x = wrapInto(b.x + sx, this.bounds.left, this.bounds.right);
      b.y = wrapInto(b.y + sy, this.bounds.top, this.bounds.bottom);
      b.life -= dt;
      if (b.life <= 0) {
        if (b.burst > 0) this.explode(b);
        else b.dead = true;
      }
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
    if (e.elite) this.rollDrop(e.x, e.y);
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

  // --- Botín de las élites (T135) ---------------------------------------------

  /** Tirada del botín al caer una élite: `chance`, y el tipo a partes iguales. */
  private rollDrop(x: number, y: number): void {
    const d = this.config.drops;
    if (d.types.length === 0 || !(d.chance > 0)) return;
    if (this.dropRng() >= d.chance) return;
    const item = d.types[Math.min(d.types.length - 1, Math.floor(this.dropRng() * d.types.length))]!;
    this.dropPickup(item, x, y);
  }

  private dropPickup(item: DropId, x: number, y: number): number {
    const d = this.config.drops;
    // Tope: el más viejo se hunde para el nuevo.
    while (this.pickups.length >= Math.max(1, d.max)) this.pickups.shift();
    const spot = this.islands.toWater(x, y, d.radius) ?? { x, y };
    const o: Pickup = { id: this.nextPickupId++, item, x: 0, y: 0, lifeS: d.lifeS, durationS: d.lifeS };
    this.setWrapped(o, spot.x, spot.y);
    this.pickups.push(o);
    this.events.push({ type: 'drop', item, id: o.id, x: o.x, y: o.y });
    return o.id;
  }

  /** Los objetos flotan y se hunden con el tiempo; el casco los coge al tocarlos. */
  private stepPickups(dt: number): void {
    if (this.pickups.length === 0) return;
    const p = this.player;
    const reach = this.config.drops.radius + this.shipCfg.radius;
    let k = 0;
    for (const o of this.pickups) {
      const dx = wd(o.x - p.x, this.w);
      const dy = wd(o.y - p.y, this.h);
      if (dx * dx + dy * dy <= reach * reach) {
        this.takePickup(o);
        continue;
      }
      o.lifeS -= dt;
      if (o.lifeS > 0) this.pickups[k++] = o;
    }
    this.pickups.length = k;
  }

  private takePickup(o: Pickup): void {
    const d = this.config.drops;
    this.pickupsTaken++;
    this.events.push({ type: 'pickup', item: o.item, id: o.id, x: o.x, y: o.y });
    switch (o.item) {
      case 'iman':
        // Todas las notas del mar vuelan al barco (el imán ya no las suelta).
        for (const n of this.notes) n.magnet = true;
        break;
      case 'llama':
        this.flameS = d.llama.durationS;
        break;
      case 'salvavidas':
        this.water = Math.max(0, this.water - this.config.player.waterCapacity * d.salvavidas.waterFraction);
        break;
    }
  }

  /**
   * La Llama: lo que toca su sector delante del barco pierde su vida máxima
   * en `killS` s (`flameDamage`); pasa por encima de las islas. A los
   * bosses que toca les hace el daño fijo de `bossFight.flameDps` (y nada si
   * están invulnerables).
   */
  private stepFlame(dt: number): void {
    if (this.flameS <= 0) return;
    const def = this.config.drops.llama;
    const p = this.player;
    const near = this.enemyGrid.query(p.x, p.y, def.range + this.maxEnemyRadius, this.scratch2);
    for (const i of near) {
      const e = this.enemies[i];
      if (!e || e.dead) continue;
      const dx = wd(e.x - p.x, this.w);
      const dy = wd(e.y - p.y, this.h);
      if (!inFlame(def, p.heading, dx, dy, e.radius)) continue;
      e.hp -= flameDamage(def, e, dt);
      // Sin restos de coma flotante: a los `killS` s justos, cae.
      if (e.hp <= e.maxHp * 1e-9) this.defeat(e);
    }
    // Lo golpeable de los bosses (cuerpos vulnerables y tentáculos del Kraken,
    // T141): el daño fijo por segundo de `bossFight.flameDps`. Lo que entra en
    // la lista en este paso (la cabeza que expone un tentáculo caído) arde en el siguiente.
    const bossDps = this.config.bossFight.flameDps;
    const targets = this.bossTargets;
    for (let i = 0, n = targets.length; i < n; i++) {
      const b = targets[i]!;
      if (b.dead) continue;
      const dx = wd(b.x - p.x, this.w);
      const dy = wd(b.y - p.y, this.h);
      if (!inFlame(def, p.heading, dx, dy, b.radius)) continue;
      this.hurtTarget(b, flameDamage(def, { maxHp: b.boss.maxHp, bossDps }, dt));
    }
    this.flameS = Math.max(0, this.flameS - dt);
  }

  private updateFlameView(): FlameView {
    const f = this.flameView;
    const def = this.config.drops.llama;
    f.x = this.player.x;
    f.y = this.player.y;
    f.heading = this.player.heading;
    f.range = def.range;
    f.halfAngle = def.halfAngle;
    f.leftS = this.flameS;
    f.durationS = def.durationS;
    return f;
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
        const fromX = n.x;
        const fromY = n.y;
        n.vx = (dx / d) * pull;
        n.vy = (dy / d) * pull;
        n.x += (dx / d) * stepLen;
        n.y += (dy / d) * stepLen;
        // Encajada entre dos islas, el deslizar la puede dejar en tierra: se queda donde estaba.
        if (this.slideOffIslands(n, NOTE_RADIUS) && this.islands.onLand(n.x, n.y)) {
          n.x = fromX;
          n.y = fromY;
        }
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

  private available(): CardOption[] {
    const rare = this.salvavidas === 'absent' && this.cardRng() < this.config.salvavidas.offerChance;
    return buildCardPool(this.config, this.inventory(), rare);
  }

  private openCard(): void {
    if (this.card || this.pendingLevels <= 0) return;
    const pool = this.available();
    const picks: CardOption[] = [];
    const limit = Math.max(1, this.config.cardChoices);
    // An eligible evolution is visibly offered, rather than relying on a lucky draw.
    const evolutions = pool.filter((o) => o.kind === 'evolution');
    if (evolutions.length > 0) {
      const e = evolutions[Math.floor(this.cardRng() * evolutions.length)]!;
      picks.push(pool.splice(pool.indexOf(e), 1)[0]!);
    }
    const rare = pool.findIndex((o) => o.kind === 'salvavidas');
    if (rare >= 0 && picks.length < limit) picks.push(pool.splice(rare, 1)[0]!);
    // Weighted draw without replacement: owned weapons/vinyls and the vinyl that
    // pairs with a held weapon come up more often (config.cardWeights, T133).
    const weights = pool.map((o) => this.cardWeight(o));
    while (picks.length < limit && pool.length > 0) {
      let total = 0;
      for (const w of weights) total += w;
      let r = this.cardRng() * total;
      let k = 0;
      while (k < pool.length - 1 && r >= weights[k]!) r -= weights[k++]!;
      picks.push(pool.splice(k, 1)[0]!);
      weights.splice(k, 1);
    }
    this.card = { level: this.level - this.pendingLevels + 1, options: picks };
  }

  /** Peso de una carta en la oferta (`config.cardWeights`). */
  private cardWeight(o: CardOption): number {
    const w = this.config.cardWeights;
    switch (o.kind) {
      case 'weapon-level':
      case 'vinyl-level':
        return w.owned;
      case 'vinyl-new':
        return this.config.evolutions.some(
          (e) =>
            e.passive === o.vinylId &&
            this.weapons.some((h) => h.def.id === e.weapon && !h.evolutionId),
        )
          ? w.pairedVinyl
          : w.new;
      default:
        return w.new;
    }
  }

  private choose(index: number): void {
    const opt = this.card?.options[index];
    if (!opt || !this.applyCard(opt)) return;
    this.card = null;
    this.pendingLevels--;
    this.openCard();
  }

  private applyCard(opt: CardOption): boolean {
    const applied = this.applyCardEffect(opt);
    if (applied) this.stacks[opt.upgrade] = (this.stacks[opt.upgrade] ?? 0) + 1;
    return applied;
  }

  private applyCardEffect(opt: CardOption): boolean {
    switch (opt.kind) {
      case 'weapon-new': return this.addWeapon(opt.weaponId!);
      case 'weapon-level': return this.levelUpWeapon(opt.weaponId!);
      case 'vinyl-new': return this.addVinyl(opt.vinylId!);
      case 'vinyl-level': return this.levelUpVinyl(opt.vinylId!);
      case 'evolution': return this.evolveWeapon(opt.evolutionId!);
      case 'salvavidas': return this.addSalvavidas();
      case 'fallback':
        this.water = Math.max(0, this.water - this.config.fallback.waterRemoved);
        return true;
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
      this.applyCard(pool[Math.floor(this.cardRng() * pool.length)]!);
    }
    const act = this.act;
    // Bosses: el hueco más reciente ya pasado entra ahora (la pelea en la
    // que estarías); los anteriores se dan por pasados, sin contar como vencidos.
    let latest: BossSlot | null = null;
    for (const slot of this.bossSlots) {
      if (slot.ev.atS > this.activeS) continue;
      slot.done = true;
      if (!latest || slot.ev.atS >= latest.ev.atS) latest = slot;
    }
    if (latest) this.enterBoss(latest.def);
    // Por turnos entre pistas: con el tope bajo de `baja`, la primera (las
    // pirañas) no se queda con todo el sitio y salen todos los tipos del guion.
    const keys = act.tracks.map((track) => trackAt(track, this.activeS));
    const groups = keys.map((key) =>
      key ? Math.round(key.groupsPerS * this.diff.enemyCount * this.config.devStart.prefillS) : 0,
    );
    const rounds = Math.max(0, ...groups);
    for (let g = 0; g < rounds; g++) {
      act.tracks.forEach((track, i) => {
        const key = keys[i];
        if (!key || g >= groups[i]!) return;
        const size = Math.round(key.group[0] + (key.group[1] - key.group[0]) * this.spawnRng());
        this.spawnGroup(track.enemy, size, key.hpScale, key.speedScale);
      });
    }
  }

  // --- Bosses (T137) ---------------------------------------------------------
  //
  // Los bosses son entidades aparte de los enemigos (pocos, sin rejilla; la
  // pantalla pinta los enemigos por `EnemyId`). Todo lo que hacen sale de su
  // `BossDef`: la máquina de fases (`nextPhase`), los ataques avisados
  // (`startBossAttack` → `landBossAttack`), las llamadas por el sistema de
  // aparición y el movimiento por fase. Las armas los hieren por
  // `hurtBoss`; invulnerables, las bolas los atraviesan y nada los daña.

  /**
   * Pone el boss `id` en (x, y), llevado al agua, con el aguante del acto y
   * la dificultad; null si no existe o cae en tierra. Para pruebas y atajos
   * de desarrollo (los huecos del guion entran solos).
   */
  spawnBoss(id: BossId, x: number, y: number): BossView | null {
    const def = this.config.bosses[id];
    if (!def) return null;
    const spot = def.ignoresIslands ? { x, y } : this.islands.toWater(x, y, def.radius);
    if (!spot) return null;
    return this.bossView(this.makeBoss(def, spot.x, spot.y));
  }

  /**
   * Gancho de la Llama (T135): quema a los bosses que toca el círculo (x, y,
   * r) con el daño por segundo fijo de `bossFight.flameDps` durante `dt` s.
   * Devuelve cuántos tocó.
   */
  flameBosses(x: number, y: number, r: number, dt: number): number {
    const damage = flameDamage(this.config.drops.llama, { maxHp: 0, bossDps: this.config.bossFight.flameDps }, dt);
    return this.hurtBossesCircle(x, y, r, damage);
  }

  /** Un boss del guion entra por delante del barco (`bossFight.entryDistance`), en agua. */
  private enterBoss(def: BossDef): void {
    const p = this.player;
    const d = this.config.bossFight.entryDistance;
    for (let k = 0; k < 8; k++) {
      // Delante del barco; en tierra, probando a un lado y a otro.
      const a = p.heading + (k % 2 === 0 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 4);
      const x = p.x + Math.cos(a) * d;
      const y = p.y + Math.sin(a) * d;
      const spot = def.ignoresIslands ? { x, y } : this.islands.toWater(x, y, def.radius);
      if (spot) {
        this.makeBoss(def, spot.x, spot.y);
        return;
      }
    }
    this.makeBoss(def, p.x + Math.cos(p.heading) * d, p.y + Math.sin(p.heading) * d);
  }

  private makeBoss(def: BossDef, x: number, y: number): Boss {
    const hp = bossHpFor(def, this.act, this.diff);
    const b: Boss = {
      id: this.nextId++,
      def,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      heading: 0,
      hp,
      maxHp: hp,
      radius: def.radius,
      phase: 0,
      phaseS: 0,
      attackTimer: def.phases[0]?.firstAttackS ?? 0,
      attackIndex: 0,
      attack: null,
      kraken: null,
      fantasma: def.fantasma ? createGhostShip(def.fantasma) : null,
      dead: false,
    };
    if (def.kraken) {
      // Los tentáculos aguantan como el boss: por el acto y la dificultad.
      b.kraken = createKraken(def.kraken, def.kraken.tentacle.hp * (this.act.bossHpScale ?? 1) * this.diff.enemyHp);
    }
    this.setWrapped(b, x, y);
    const p = this.player;
    b.heading = Math.atan2(wd(p.y - b.y, this.h), wd(p.x - b.x, this.w));
    this.bosses.push(b);
    this.events.push({ type: 'bossSpawn', boss: def.id, id: b.id, kind: def.kind, nameKey: def.i18nKey, x: b.x, y: b.y });
    if (b.kraken) {
      this.events.push({ type: 'krakenState', id: b.id, state: b.kraken.mode, x: b.x, y: b.y, island: -1 });
    }
    this.rebuildBossTargets();
    return b;
  }

  /**
   * Rehace lo golpeable de los bosses (T141): el cuerpo de cada boss vivo y
   * vulnerable y, en el Kraken, cada tentáculo arriba. Se llama tras mover
   * los bosses en cada paso y cuando entra o cae uno.
   */
  private rebuildBossTargets(): void {
    const out = this.bossTargets;
    out.length = 0;
    for (const b of this.bosses) {
      if (b.dead) continue;
      if (!this.bossInvulnerable(b)) out.push({ id: b.id, x: b.x, y: b.y, radius: b.radius, dead: false, boss: b, tentacle: null });
      if (b.kraken) {
        for (const t of b.kraken.tentacles) {
          if (tentacleHittable(t)) out.push({ id: t.id, x: t.x, y: t.y, radius: t.radius, dead: false, boss: b, tentacle: t });
        }
      }
    }
  }

  /** Hiere una parte golpeable de un boss: el cuerpo (`hurtBoss`) o un tentáculo del Kraken. */
  private hurtTarget(t: BossTarget, damage: number): void {
    if (t.dead) return;
    if (t.tentacle) {
      if (!t.boss.kraken) return;
      this.krakenBoss = t.boss;
      hurtTentacle(t.boss.kraken, t.boss, this.krakenHost, t.tentacle, damage);
      this.krakenBoss = null;
      if (!t.tentacle.dead) return;
      t.dead = true;
      // Tumbarlo expone la cabeza: entra en la lista ya, en este mismo paso.
      const b = t.boss;
      if (!this.bossInvulnerable(b) && !this.bossTargets.some((o) => o.boss === b && !o.tentacle && !o.dead)) {
        this.bossTargets.push({ id: b.id, x: b.x, y: b.y, radius: b.radius, dead: false, boss: b, tentacle: null });
      }
      return;
    }
    this.hurtBoss(t.boss, damage);
    if (t.boss.dead || this.bossInvulnerable(t.boss)) t.dead = true;
  }

  private bossView(b: Boss): BossView {
    return {
      id: b.id,
      boss: b.def.id,
      kind: b.def.kind,
      nameKey: b.def.i18nKey,
      x: b.x,
      y: b.y,
      vx: b.vx,
      vy: b.vy,
      heading: b.heading,
      radius: b.radius,
      hp: b.hp,
      maxHp: b.maxHp,
      hpFraction: Math.min(1, Math.max(0, b.hp / b.maxHp)),
      phase: b.phase,
      phaseCount: b.def.phases.length,
      invulnerable: this.bossInvulnerable(b),
      attack: b.attack?.name ?? null,
      attackStage: b.attack?.stage ?? null,
      kraken: b.kraken ? krakenView(b.kraken) : null,
      fantasma: b.fantasma ? ghostShipView(b.fantasma, b) : null,
    };
  }

  /** No recibe daño: por la fase o por el ataque en curso; el Kraken, salvo con la cabeza expuesta; el Fantasma, desvanecido. */
  private bossInvulnerable(b: Boss): boolean {
    if (b.kraken) return !krakenVulnerable(b.kraken);
    if (b.fantasma && ghostInvulnerable(b.fantasma)) return true;
    return (b.def.phases[b.phase]?.invulnerable ?? false) || (b.attack?.def.invulnerable ?? false);
  }

  private stepBosses(dt: number): void {
    for (const b of this.bosses) {
      if (b.dead) continue;
      b.phaseS += dt;
      // Fases: por vida o por tiempo (`nextPhase`); al cambiar, el reloj de ataque arranca de nuevo.
      const next = nextPhase(b.def, b.phase, b.hp / b.maxHp, b.phaseS);
      if (next !== null) {
        b.phase = next;
        b.phaseS = 0;
        b.attackIndex = 0;
        b.attackTimer = b.def.phases[next]!.firstAttackS;
        this.events.push({ type: 'bossPhase', boss: b.def.id, id: b.id, phase: next });
      }
      const phase = b.def.phases[b.phase];
      if (!phase) continue;
      // El Kraken (T141) va por su cuenta: sumergido, tentáculos, agarre y rocas (`kraken.ts`).
      if (b.kraken) {
        this.krakenBoss = b;
        stepKraken(b.kraken, b, this.krakenHost, dt);
        this.krakenBoss = null;
        continue;
      }
      // El Fantasma (T140): su ciclo sólido ↔ fantasma; al cambiar, otra lista de ataques y el reloj de nuevo.
      let plan = { attacks: phase.attacks, everyS: phase.attackEveryS, firstS: phase.firstAttackS };
      if (b.fantasma) {
        const changed = stepGhostShip(b.fantasma, b, this.ghostHost, dt, b.attack !== null);
        plan = ghostAttackPlan(b.fantasma, phase);
        if (changed) {
          b.attackIndex = 0;
          b.attackTimer = plan.firstS;
        }
      }
      // Ataques: el que está en curso avanza; si no hay, baja el reloj y lanza el siguiente de la lista.
      if (b.attack) this.stepBossAttack(b, b.attack, plan.everyS, dt);
      else if (plan.attacks.length > 0) {
        b.attackTimer -= dt;
        if (b.attackTimer <= 0) {
          const next = attackFrom(b.def, plan.attacks, b.attackIndex++);
          if (next) this.startBossAttack(b, next.name, next.def);
          else b.attackTimer = plan.everyS;
        }
      }
      // Movimiento: quieto si el aviso lo pide; la embestida mueve sola; si no, el patrón de la fase.
      const a = b.attack;
      if (a && a.stage === 'hit' && a.def.kind === 'line') this.chargeBoss(b, a, dt);
      else if (a && a.stage === 'warning' && a.def.still) {
        b.vx = 0;
        b.vy = 0;
      } else this.moveBoss(b, phase, dt);
    }
    this.rebuildBossTargets();
  }

  private moveBoss(b: Boss, phase: BossDef['phases'][number], dt: number): void {
    const p = this.player;
    let dx = wd(p.x - b.x, this.w);
    let dy = wd(p.y - b.y, this.h);
    const dist = Math.hypot(dx, dy);
    dx = dist > 1e-6 ? dx / dist : 1;
    dy = dist > 1e-6 ? dy / dist : 0;
    const speed = b.def.speed * phase.speedScale * (b.fantasma ? ghostSpeedScale(b.fantasma) : 1);
    let wantX = 0;
    let wantY = 0;
    switch (phase.movement) {
      case 'chase':
        if (dist > phase.standoff) {
          wantX = dx * speed;
          wantY = dy * speed;
        }
        break;
      case 'orbit': {
        // Tangente alrededor del barco más la corrección radial hacia `standoff`.
        const radial = Math.max(-1, Math.min(1, (dist - phase.standoff) / 120));
        wantX = (-dy + dx * radial) * speed;
        wantY = (dx + dy * radial) * speed;
        const l = Math.hypot(wantX, wantY);
        if (l > speed) {
          wantX *= speed / l;
          wantY *= speed / l;
        }
        break;
      }
      default:
        break;
    }
    const wl = Math.hypot(wantX, wantY);
    if (!b.def.ignoresIslands && wl > 1e-6) {
      const push = this.avoidIslands(b.x, b.y, wantX / wl, wantY / wl, b.radius, speed);
      wantX += push.x;
      wantY += push.y;
    }
    const ddx = wantX - b.vx;
    const ddy = wantY - b.vy;
    const dl = Math.hypot(ddx, ddy);
    const maxDv = b.def.acceleration * dt;
    if (dl > maxDv) {
      b.vx += (ddx / dl) * maxDv;
      b.vy += (ddy / dl) * maxDv;
    } else {
      b.vx = wantX;
      b.vy = wantY;
    }
    const sp = Math.hypot(b.vx, b.vy);
    const top = speed * 1.5;
    if (sp > top) {
      b.vx *= top / sp;
      b.vy *= top / sp;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    // Navegando, mira hacia donde va; parado, al barco.
    b.heading = sp > 1 ? Math.atan2(b.vy, b.vx) : Math.atan2(dy, dx);
    if (!b.def.ignoresIslands) this.slideOffIslands(b, b.radius);
    this.setWrapped(b, b.x, b.y);
  }

  /** Empieza un ataque: fija su geometría (hacia donde está el barco ahora) y avisa. */
  private startBossAttack(b: Boss, name: string, def: BossAttackDef): void {
    const p = this.player;
    const toPlayer = Math.atan2(wd(p.y - b.y, this.h), wd(p.x - b.x, this.w));
    const a: BossAttack = {
      name,
      def,
      stage: 'warning',
      timer: def.telegraphS,
      x: b.x,
      y: b.y,
      // La andanada va por los costados del rumbo actual; lo demás, hacia el barco.
      heading: def.kind === 'broadside' ? b.heading : toPlayer,
      gapPhase: this.bossRng() * Math.PI * 2,
      circles: [],
      left: def.length,
      landed: false,
    };
    if (def.kind === 'circles') {
      // Fijados donde está el barco al avisar: el primero encima, los demás alrededor.
      a.x = p.x;
      a.y = p.y;
      for (let k = 0; k < def.count; k++) {
        const ang = this.bossRng() * Math.PI * 2;
        const r = k === 0 ? 0 : Math.sqrt(this.bossRng()) * def.spread;
        a.circles.push({
          x: wrapInto(p.x + Math.cos(ang) * r, this.bounds.left, this.bounds.right),
          y: wrapInto(p.y + Math.sin(ang) * r, this.bounds.top, this.bounds.bottom),
        });
      }
    }
    if (def.kind === 'line') b.heading = a.heading;
    b.attack = a;
    this.events.push({
      type: 'bossTelegraph',
      boss: b.def.id,
      id: b.id,
      attack: name,
      kind: def.kind,
      x: a.x,
      y: a.y,
      heading: a.heading,
    });
    if (def.telegraphS <= 0) this.landBossAttack(b, a);
  }

  private stepBossAttack(b: Boss, a: BossAttack, attackEveryS: number, dt: number): void {
    a.timer -= dt;
    if (a.stage === 'warning') {
      // El ancla sigue al boss hasta el golpe (los círculos quedan donde estaba el barco).
      if (a.def.kind !== 'circles') {
        a.x = b.x;
        a.y = b.y;
        if (a.def.kind === 'broadside') a.heading = b.heading;
      }
      if (a.timer <= 0) this.landBossAttack(b, a);
      return;
    }
    switch (a.def.kind) {
      case 'ring':
        this.ringHit(b, a);
        break;
      case 'circles':
        this.circlesHit(b, a);
        break;
      default:
        // line: el contacto moja (`contactDamage`); broadside y summon ya hicieron lo suyo al golpear.
        break;
    }
    if (a.timer <= 0 || (a.def.kind === 'line' && a.left <= 0)) {
      // La embestida acaba en seco: la inercia no la alarga.
      if (a.def.kind === 'line') {
        b.vx = 0;
        b.vy = 0;
      }
      b.attack = null;
      b.attackTimer = attackEveryS;
    }
  }

  /** Acaba el aviso: el golpe empieza (lo instantáneo, aquí; lo que dura, en `stepBossAttack`). */
  private landBossAttack(b: Boss, a: BossAttack): void {
    a.stage = 'hit';
    a.timer = a.def.activeS;
    this.events.push({ type: 'bossAttack', boss: b.def.id, id: b.id, attack: a.name, kind: a.def.kind, x: a.x, y: a.y });
    switch (a.def.kind) {
      case 'line':
        a.left = a.def.length;
        b.heading = a.heading;
        break;
      case 'broadside':
        this.fireBroadside(b, a);
        break;
      default:
        break;
    }
    if (a.def.summon) this.summon(b, a.def.summon);
  }

  /** La onda del anillo: moja al barco si lo pasa por encima fuera de un hueco y sin isla entre medias. */
  private ringHit(b: Boss, a: BossAttack): void {
    if (a.landed || !this.bossHitLands()) return;
    const p = this.player;
    const def = a.def;
    const progress = 1 - a.timer / def.activeS;
    const r = ringRadiusAt(def, progress);
    const dx = wd(p.x - a.x, this.w);
    const dy = wd(p.y - a.y, this.h);
    const dist = Math.hypot(dx, dy);
    if (!ringTouches(r, def.thickness, dist, this.shipCfg.radius)) return;
    if (inRingGap(Math.atan2(dy, dx), def.gaps, def.gapRad, a.gapPhase)) return;
    if (def.blockedByIslands && this.islandBetween(a.x, a.y, dx, dy)) return;
    a.landed = true;
    this.damagePlayerByBoss(def.water, b, a.name, p.x, p.y);
  }

  /** Los círculos caen: moja al barco si está dentro de alguno. */
  private circlesHit(b: Boss, a: BossAttack): void {
    if (a.landed || !this.bossHitLands()) return;
    const p = this.player;
    const reach = a.def.radius + this.shipCfg.radius;
    for (const c of a.circles) {
      const dx = wd(p.x - c.x, this.w);
      const dy = wd(p.y - c.y, this.h);
      if (dx * dx + dy * dy > reach * reach) continue;
      a.landed = true;
      this.damagePlayerByBoss(a.def.water, b, a.name, p.x, p.y);
      return;
    }
  }

  /** ¿Hay una isla en el tramo desde (x, y) avanzando (dx, dy)? */
  private islandBetween(x: number, y: number, dx: number, dy: number): boolean {
    return this.islandBlock({ x, y, radius: 0 }, dx, dy, dx * dx + dy * dy) !== Infinity;
  }

  /** La embestida: recta a `speed` hasta agotar `length`; contra una isla (si no las ignora), se acaba. */
  private chargeBoss(b: Boss, a: BossAttack, dt: number): void {
    const step = Math.min(a.def.speed * dt, a.left);
    const ux = Math.cos(a.heading);
    const uy = Math.sin(a.heading);
    b.vx = ux * a.def.speed;
    b.vy = uy * a.def.speed;
    b.heading = a.heading;
    b.x += ux * step;
    b.y += uy * step;
    a.left -= step;
    if (!b.def.ignoresIslands && this.slideOffIslands(b, b.radius)) {
      a.left = 0;
      b.vx = 0;
      b.vy = 0;
    }
    this.setWrapped(b, b.x, b.y);
  }

  /** Andanada: `count` disparos rectos por cada costado, repartidos a lo largo del casco. */
  private fireBroadside(b: Boss, a: BossAttack): void {
    const def = a.def;
    const hx = Math.cos(a.heading);
    const hy = Math.sin(a.heading);
    for (const side of [-1, 1]) {
      const pa = a.heading + side * (Math.PI / 2);
      const px = Math.cos(pa);
      const py = Math.sin(pa);
      for (let k = 0; k < def.count; k++) {
        if (this.enemyShots.length >= this.caps.enemyProjectiles) return;
        const along = (k - (def.count - 1) / 2) * ((2 * b.radius) / Math.max(1, def.count));
        const out = b.radius + def.thickness + 1;
        this.enemyShots.push({
          id: this.nextId++,
          enemy: null,
          boss: b.def.id,
          attack: a.name,
          x: wrapInto(b.x + hx * along + px * out, this.bounds.left, this.bounds.right),
          y: wrapInto(b.y + hy * along + py * out, this.bounds.top, this.bounds.bottom),
          vx: px * def.speed,
          vy: py * def.speed,
          radius: def.thickness,
          life: def.length / def.speed,
          water: def.water,
          dead: false,
        });
      }
    }
  }

  /** Llama a `count` enemigos alrededor del boss por el sistema de aparición (bajo el tope). */
  private summon(b: Boss, s: NonNullable<BossAttackDef['summon']>): void {
    const def = this.config.enemies[s.enemy];
    if (!def) return;
    let made = 0;
    const minutes = this.minutes();
    for (let k = 0; k < s.count; k++) {
      if (this.enemies.length >= this.caps.enemies) break;
      const ang = (k / s.count) * Math.PI * 2 + b.heading;
      const r = b.radius + def.radius + 30;
      const spot = this.islands.toWater(b.x + Math.cos(ang) * r, b.y + Math.sin(ang) * r, def.radius);
      if (!spot) continue;
      const hp = def.hp * s.hpScale * this.diff.enemyHp * (this.act.enemyHpScale ?? 1) * (1 + def.growthPerMinute.hp * minutes);
      const speed = def.speed * (1 + def.growthPerMinute.speed * minutes);
      const e = this.makeEnemy(def, spot.x, spot.y, hp, speed, s.elite);
      e.ghost = s.ghost === true;
      this.enemies.push(e);
      made++;
    }
    if (made > 0) {
      this.rebuildEnemyGrid();
      this.events.push({ type: 'bossSummon', boss: b.def.id, id: b.id, enemy: s.enemy, count: made, x: b.x, y: b.y });
    }
  }

  /** Hiere al boss (nada si está invulnerable); si cae, lo vence. */
  private hurtBoss(b: Boss, damage: number): void {
    if (b.dead || damage <= 0 || this.bossInvulnerable(b)) return;
    b.hp -= damage;
    this.events.push({ type: 'bossDamaged', boss: b.def.id, id: b.id, damage, hp: Math.max(0, b.hp), x: b.x, y: b.y });
    if (b.hp <= 0) this.defeatBoss(b);
  }

  /** Hiere lo golpeable de los bosses (cuerpos y tentáculos) que toca el círculo (x, y, r). Devuelve cuántos. */
  private hurtBossesCircle(x: number, y: number, r: number, damage: number): number {
    let n = 0;
    for (const b of this.bossTargets) {
      if (b.dead) continue;
      const dx = wd(b.x - x, this.w);
      const dy = wd(b.y - y, this.h);
      const min = r + b.radius;
      if (dx * dx + dy * dy > min * min) continue;
      this.hurtTarget(b, damage);
      n++;
    }
    return n;
  }

  private defeatBoss(b: Boss): void {
    b.dead = true;
    b.attack = null;
    if (b.kraken) clearKraken(b.kraken);
    this.rebuildBossTargets();
    this.bossesDefeated.push(b.def.id);
    this.events.push({ type: 'bossDefeated', boss: b.def.id, id: b.id, kind: b.def.kind, x: b.x, y: b.y });
    // La nota grande (la clave de sol: la figura mayor que no pasa de su valor).
    this.dropNote(b.x, b.y, b.def.noteValue);
    if (b.def.chest) {
      const spot = this.islands.toWater(b.x, b.y, this.config.bossFight.chestRadius) ?? { x: b.x, y: b.y };
      const c: Chest = { id: this.nextId++, boss: b.def.id, x: 0, y: 0, dead: false };
      this.setWrapped(c, spot.x, spot.y);
      this.chests.push(c);
      this.events.push({ type: 'chest', boss: c.boss, id: c.id, x: c.x, y: c.y });
    }
    // El boss final del acto cae: la partida acaba ahí con su final (la medalla de oro, T144).
    if (b.def.kind === 'boss') {
      this.finalBossDefeated = true;
      this.finish('victory');
    }
  }

  /** Amanece: los bosses vivos se retiran (no cuentan como vencidos). */
  private retreatBosses(): void {
    for (const b of this.bosses) {
      if (b.dead) continue;
      b.dead = true;
      b.attack = null;
      if (b.kraken) clearKraken(b.kraken);
      this.events.push({ type: 'bossRetreated', boss: b.def.id, id: b.id, kind: b.def.kind, x: b.x, y: b.y });
    }
    this.compactBosses();
    this.rebuildBossTargets();
  }

  private compactBosses(): void {
    let n = 0;
    for (const b of this.bosses) if (!b.dead) this.bosses[n++] = b;
    this.bosses.length = n;
  }

  /** Los cofres flotan donde cayó el miniboss hasta que el barco los toca. */
  private stepChests(): void {
    if (this.chests.length === 0) return;
    const p = this.player;
    const reach = this.shipCfg.radius + this.config.bossFight.chestRadius;
    for (const c of this.chests) {
      const dx = wd(c.x - p.x, this.w);
      const dy = wd(c.y - p.y, this.h);
      if (dx * dx + dy * dy > reach * reach) continue;
      c.dead = true;
      this.events.push({ type: 'chestOpened', boss: c.boss, id: c.id, x: c.x, y: c.y });
    }
    let n = 0;
    for (const c of this.chests) if (!c.dead) this.chests[n++] = c;
    this.chests.length = n;
  }

  /** Las formas de aviso/golpe del ataque `a` de `b`, para la pantalla. */
  private pushWarnings(b: Boss, a: BossAttack): void {
    const def = a.def;
    const hit = a.stage === 'hit';
    const total = hit ? def.activeS : def.telegraphS;
    const progress = total > 0 ? Math.min(1, Math.max(0, 1 - a.timer / total)) : 1;
    const base = {
      id: b.id,
      boss: b.def.id,
      attack: a.name,
      kind: def.kind,
      heading: a.heading,
      length: 0,
      radius: 0,
      thickness: def.thickness,
      gaps: 0,
      gapRad: 0,
      gapPhase: 0,
      ringRadius: 0,
      progress,
      hit,
    };
    switch (def.kind) {
      case 'ring':
        this.bossWarnings.push({
          ...base,
          x: a.x,
          y: a.y,
          radius: def.radius,
          gaps: def.gaps,
          gapRad: def.gapRad,
          gapPhase: a.gapPhase,
          ringRadius: hit ? ringRadiusAt(def, progress) : 0,
          ringObstacles: def.blockedByIslands
            ? this.islands.near(a.x, a.y, def.radius, this.scratch).map((k) => {
                const o = this.islands.obstacles[k]!;
                return { x: wd(o.x - a.x, this.w), y: wd(o.y - a.y, this.h), radius: o.radius };
              })
            : [],
        });
        break;
      case 'line':
        this.bossWarnings.push({ ...base, x: a.x, y: a.y, length: def.length });
        break;
      case 'circles':
        for (const c of a.circles) this.bossWarnings.push({ ...base, x: c.x, y: c.y, radius: def.radius });
        break;
      case 'broadside':
        for (const side of [-1, 1]) {
          this.bossWarnings.push({ ...base, x: a.x, y: a.y, heading: a.heading + side * (Math.PI / 2), length: def.length });
        }
        break;
      case 'summon':
        if (!hit) this.bossWarnings.push({ ...base, x: a.x, y: a.y, radius: b.radius * 1.5 });
        break;
      default:
        break;
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
