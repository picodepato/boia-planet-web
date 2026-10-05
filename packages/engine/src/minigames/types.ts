/**
 * Tipos compartidos por los minijuegos de INICIAR_MINIJUEGO (REQ-AVE-035…039).
 * Hay dos clases de minijuego en el registro:
 *
 * - los de la capa 2D (`MinigameDefinition`, hoy el Faro): la simulación es
 *   pura (sin DOM), recibe una entrada por paso fijo y devuelve lo que pasó;
 *   el anfitrión (`host.ts`) la pinta, la controla con dedo, puntero o
 *   teclado y valida el resultado con la sesión local;
 * - los que se juegan en el propio mar 3D (`MinigameEntry` sin simulación
 *   aquí, hoy el Cañón «Que no pare la música», plan 010): el registro sólo
 *   guarda su id, su panel, su configuración de sesión y cómo se valida; la
 *   simulación vive en `@boia/engine/survivors` y la pinta `/mar`.
 */

export type MinigameId = 'faro' | 'canon';

/** Política de recompensa (REQ-AVE-038). `record_only`: sólo marca personal. */
export type MinigamePolicy = 'once' | 'daily' | 'season' | 'record_only';

export interface RewardRule {
  policy: MinigamePolicy;
  points: number;
  coins: number;
  /** Límites de lo que una partida puede conceder, por si la regla cambia. */
  maxPoints: number;
  maxCoins: number;
  /**
   * Premios por escalones (el Cañón, plan 013 T153: bronce, plata y oro), de
   * menos a más. Con ellos, una partida ganada cobra su escalón y los de
   * debajo que aún no tuviera, cada uno con su origen
   * (`minigame:<id>:<escalón>`) y la política de la regla; `points` y
   * `coins` son la suma de todos y `maxPoints`/`maxCoins` el tope de cada uno.
   */
  tiers?: readonly RewardTier[];
}

/** Un escalón del premio (una medalla). Todo `muestra`. */
export interface RewardTier {
  /** Clave estable del escalón (`bronce`, `plata`, `oro`). */
  id: string;
  points: number;
  coins: number;
  /** ms de juego mínimos para conseguirlo (el oro, no antes de que entre el boss final). */
  minMs: number;
  /** Cómo puede acabar una partida con este escalón (el oro, sólo `victory`). */
  reasons: readonly ResultReason[];
}

/** Lo que toda configuración de minijuego lleva. Todo `muestra`. */
export interface BaseConfig {
  /** Versión de reglas y patrones; cambia la validación. */
  version: number;
  /** Marca (puntos de la partida) a partir de la cual se gana el premio. */
  goal: number;
  /** Tope de duración de una partida: más, y la marca no es posible. */
  timeLimitS: number;
  reward: RewardRule;
}

/** `won`: la partida acabó con `goal` puntos o más (y da premio). */
export type Outcome = 'won' | 'lost';
/** Sin vidas, tras la última oleada o al tope de tiempo. */
export type EndReason = 'lives' | 'waves' | 'time';
/**
 * Cómo acabó una partida, para la sesión: los de la capa 2D y los del mar
 * (el Cañón: `survived` al amanecer, `victory` al vencer al boss final del acto
 * (T140), `flooded`, `abandoned` tras 5 min en pausa, `quit` con «Terminar
 * partida», T148: la página no la liquida, se abandona la sesión).
 */
export type ResultReason = EndReason | 'survived' | 'victory' | 'flooded' | 'abandoned' | 'quit';

export interface Ending {
  outcome: Outcome;
  reason: EndReason;
}

/** Punto en el espacio lógico de la escena: 0..1 en ambos ejes. */
export interface Point {
  x: number;
  y: number;
}

/**
 * Entrada de un paso. `aim` es el punto que señala el dedo o el puntero;
 * `pull` es el arrastre en curso (del punto donde empezó al de ahora, en
 * unidades de escena); `turn` y `lift` (-1..1) vienen del teclado; `action`
 * es DESTELLO o FUEGO y vale sólo en el paso en que se pulsa.
 */
export interface MinigameInput {
  aim?: Point | null;
  pull?: Point | null;
  turn?: number;
  lift?: number;
  action?: boolean;
}

/** Lo que pasó en un paso, para el sonido, los avisos y las marcas en pantalla. */
export interface SimEvent {
  kind:
    | 'hit'
    | 'false_alarm'
    | 'escape'
    | 'fire'
    | 'splash'
    | 'scare'
    | 'miss'
    | 'flash'
    | 'wave'
    | 'end';
  x?: number;
  y?: number;
  /** Puntos que dio y multiplicador con que los dio. */
  points?: number;
  combo?: number;
  /** Oleada que empieza. */
  wave?: number;
}

/** Aviso en texto de un evento (también se oye; REQ-AVE-039). */
export interface Feedback {
  text: string;
  tone: 'good' | 'bad';
}

/** Una línea de estado legible sin audio (REQ-AVE-039). */
export interface StatusItem {
  label: string;
  value: string;
}

export interface DrawOptions {
  reducedMotion: boolean;
  /** s de reloj real, sólo para animaciones decorativas. */
  clock: number;
}

export interface MinigameSim {
  /** s simulados de juego (no cuenta la pausa). */
  readonly time: number;
  readonly score: number;
  readonly ended: Ending | null;
  step(dt: number, input: MinigameInput): SimEvent[];
  status(): StatusItem[];
  /** El punto de apuntado actual (para que el teclado parta de él). */
  aim(): Point;
  draw(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    skin: MinigameSkin,
    o: DrawOptions,
  ): void;
}

/**
 * Lo que todo minijuego del registro tiene: su id, el texto de su panel, su
 * configuración (versión, objetivo, tope de tiempo y premio) y la duración
 * mínima posible de una marca, con la que la sesión lo valida.
 */
export interface MinigameEntry<C extends BaseConfig = BaseConfig> {
  id: MinigameId;
  title: string;
  /** Texto del panel editorial de la isla. */
  summary: string;
  defaults: C;
  /**
   * El tiempo mínimo, en ms de juego, en que se puede llegar a `score` con
   * esta semilla y esta configuración. Por debajo, la marca es imposible.
   */
  minPlausibleMs(score: number, seed: number, config: C): number;
}

/** Un minijuego de la capa 2D: además, su simulación y sus textos. */
export interface MinigameDefinition<C extends BaseConfig = BaseConfig> extends MinigameEntry<C> {
  /** Instrucciones breves, una por línea. */
  instructions: readonly string[];
  /** Texto del botón de acción (DESTELLO, FUEGO). */
  actionLabel: string;
  /** Teclas, en una línea (sólo con teclado). */
  hint: string;
  create(seed: number, config: C): MinigameSim;
  /** Texto del final, por motivo. */
  endText(e: Ending): string;
  /** Aviso de un evento, o nada. */
  feedback(ev: SimEvent): Feedback | null;
}

/** ¿Se juega en la capa 2D (tiene simulación aquí)? */
export function isLayerMinigame<C extends BaseConfig>(
  def: MinigameEntry<C>,
): def is MinigameDefinition<C> {
  return typeof (def as Partial<MinigameDefinition<C>>).create === 'function';
}

/** Colores y trazo de un mundo para los minijuegos. */
export interface MinigameSkin {
  /** `clay`: contornos gruesos (Arcilla); `wash`: aguadas suaves (Acuarela). */
  style: 'plain' | 'clay' | 'wash';
  night: string;
  sea: string;
  wave: string;
  crest: string;
  land: string;
  ink: string;
  beam: string;
  accent: string;
  onAccent: string;
  good: string;
  bad: string;
}
