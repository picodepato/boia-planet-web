/**
 * Tipos compartidos por los minijuegos de INICIAR_MINIJUEGO (REQ-AVE-035…039).
 * Todos se juegan en el propio mar 3D (`MinigameEntry`, hoy el Cañón «Que no
 * pare la música», plan 010): el registro sólo guarda su id, su panel, su
 * configuración de sesión y cómo se valida; la simulación vive aparte
 * (`@boia/engine/survivors`) y la pinta `/mar`. La capa 2D de la Vigilancia
 * del faro se quitó en el plan 014 (T157).
 */

export type MinigameId = 'canon';

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
 * Cómo acabó una partida, para la sesión. `lives`, `waves` y `time` eran de
 * la capa 2D (quitada en el plan 014, T157); los del mar son los del Cañón:
 * `survived` al amanecer, `victory` al vencer al boss final del acto (T140),
 * `flooded`, `abandoned` tras 5 min en pausa y `quit` con «Terminar
 * partida» (T148: la página no la liquida, se abandona la sesión).
 */
export type ResultReason = EndReason | 'survived' | 'victory' | 'flooded' | 'abandoned' | 'quit';

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
