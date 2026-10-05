import {
  DEFAULT_DIFFICULTY,
  type DifficultyId,
  SURVIVORS_CONFIG,
  type SurvivorsConfig,
  survivorsConfigHash,
} from '../survivors/config';
import type { BaseConfig, MinigameEntry, Outcome, ResultReason } from './types';
import type { WorldGameEnd } from './world-session';

/**
 * El Cañón «Que no pare la música» en el registro de minijuegos (plan 010,
 * T119). Desde la beta 1 se juega en el propio mar de `/mar` (la simulación
 * es `@boia/engine/survivors`), no en la capa 2D: aquí sólo queda lo que la
 * sesión necesita (REQ-AVE-038) y el premio de siempre.
 *
 * - La marca (`score`) son los segundos enteros de tiempo activo que aguantó
 *   el barco; el objetivo (`goal`) y el tope (`timeLimitS`) son los 7:00 de
 *   la partida: `won` es llegar al amanecer (`survived`) o vencer al boss
 *   final del acto (`victory`, T140): la noche cuenta entera (la marca es el
 *   objetivo), porque la medalla de oro vale más que la de bronce (T144).
 * - `minPlausibleMs(score) = min(score, boss final) · 1000`: nadie aguanta N s
 *   de juego en menos de N s de juego, y nadie vence al boss final antes de
 *   que entre (`canonEarliestWinS`). Con el tope y el reloj de la sesión, una
 *   duración imposible no vale.
 * - La versión 4 sustituye a la 3 del cañón 2D; `survivors` lleva la versión
 *   y la huella de la configuración entera del modo, así que cualquier cambio
 *   de equilibrio cambia el `configHash` de la sesión; también lleva la
 *   dificultad elegida (T131) y el acto jugado (T144), y el premio y `won`
 *   no cambian con ellos. `won` es la medalla de bronce o más (T144:
 *   `survivorsMedal`).
 * - El premio, como antes: 150 puntos y 50 monedas, una vez por temporada.
 *   Todo `muestra`.
 */

export interface CanonConfig extends BaseConfig {
  /** La configuración del modo Survivors con que se juega: su versión y su huella. */
  survivors: { version: number; hash: string; difficulty: DifficultyId; act: number };
}

/** Versión de las reglas de sesión del Cañón (la 3 era el cañón 2D, T72). */
export const CANON_VERSION = 4;

/** La configuración de sesión del Cañón para una configuración del modo. */
export function canonConfigFor(
  cfg: SurvivorsConfig = SURVIVORS_CONFIG,
  difficulty: DifficultyId = DEFAULT_DIFFICULTY,
  act = 1,
): CanonConfig {
  return {
    version: CANON_VERSION,
    goal: cfg.durationS,
    timeLimitS: cfg.durationS,
    survivors: { version: cfg.version, hash: survivorsConfigHash(cfg), difficulty, act },
    reward: { policy: 'season', points: 150, coins: 50, maxPoints: 150, maxCoins: 50 },
  };
}

export const CANON_DEFAULTS: CanonConfig = canonConfigFor();

/** La marca de una partida: los segundos enteros de tiempo activo. */
export function canonScore(activeS: number): number {
  return Number.isFinite(activeS) ? Math.max(0, Math.floor(activeS + 1e-6)) : 0;
}

/** Ganada al amanecer o al vencer al boss final del acto (T140). */
export function canonOutcome(reason: ResultReason): Outcome {
  return reason === 'survived' || reason === 'victory' ? 'won' : 'lost';
}

/**
 * El segundo de partida más temprano en que se puede ganar: cuando entra el
 * boss final más temprano de los actos (su hueco `boss` encendido); sin
 * ninguno, el amanecer.
 */
export function canonEarliestWinS(cfg: SurvivorsConfig = SURVIVORS_CONFIG): number {
  let earliest = cfg.durationS;
  for (const act of cfg.acts) {
    for (const ev of act.events) {
      if (ev.type === 'boss' && ev.enabled !== false && cfg.bosses[ev.ref as keyof typeof cfg.bosses] && ev.atS < earliest) {
        earliest = ev.atS;
      }
    }
  }
  return earliest;
}

export const canon: MinigameEntry<CanonConfig> = {
  id: 'canon',
  title: 'Que no pare la música',
  summary:
    'Aguanta en tu barco hasta el amanecer: pirañas y cangrejos vienen a por ti y el cañón de agua dispara solo.',
  defaults: CANON_DEFAULTS,
  minPlausibleMs: (score) => Math.min(Math.max(0, score), canonEarliestWinS()) * 1000,
};

/** Cómo acabó una partida del Cañón, para su sesión (tiempo activo en s). */
export function canonEnd(reason: ResultReason, activeS: number, cfg: SurvivorsConfig = SURVIVORS_CONFIG): WorldGameEnd {
  return {
    outcome: canonOutcome(reason),
    reason,
    // Vencer al boss final (T140) vale la noche entera: la marca del objetivo.
    score: reason === 'victory' ? canonScore(cfg.durationS) : canonScore(activeS),
    elapsedMs: Math.max(0, activeS) * 1000,
  };
}
