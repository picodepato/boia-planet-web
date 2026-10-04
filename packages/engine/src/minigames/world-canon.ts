import { SURVIVORS_CONFIG, type SurvivorsConfig, survivorsConfigHash } from '../survivors/config';
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
 *   la partida: `won` es llegar al amanecer (`survived`).
 * - `minPlausibleMs(score) = score · 1000`: nadie aguanta N s de juego en
 *   menos de N s de juego. Con el tope y el reloj de la sesión, una duración
 *   imposible no vale.
 * - La versión 4 sustituye a la 3 del cañón 2D; `survivors` lleva la versión
 *   y la huella de la configuración entera del modo, así que cualquier cambio
 *   de equilibrio cambia el `configHash` de la sesión.
 * - El premio, como antes: 150 puntos y 50 monedas, una vez por temporada.
 *   Todo `muestra`.
 */

export interface CanonConfig extends BaseConfig {
  /** La configuración del modo Survivors con que se juega: su versión y su huella. */
  survivors: { version: number; hash: string };
}

/** Versión de las reglas de sesión del Cañón (la 3 era el cañón 2D, T72). */
export const CANON_VERSION = 4;

/** La configuración de sesión del Cañón para una configuración del modo. */
export function canonConfigFor(cfg: SurvivorsConfig = SURVIVORS_CONFIG): CanonConfig {
  return {
    version: CANON_VERSION,
    goal: cfg.durationS,
    timeLimitS: cfg.durationS,
    survivors: { version: cfg.version, hash: survivorsConfigHash(cfg) },
    reward: { policy: 'season', points: 150, coins: 50, maxPoints: 150, maxCoins: 50 },
  };
}

export const CANON_DEFAULTS: CanonConfig = canonConfigFor();

/** La marca de una partida: los segundos enteros de tiempo activo. */
export function canonScore(activeS: number): number {
  return Number.isFinite(activeS) ? Math.max(0, Math.floor(activeS + 1e-6)) : 0;
}

/** Ganada sólo al amanecer. */
export function canonOutcome(reason: ResultReason): Outcome {
  return reason === 'survived' ? 'won' : 'lost';
}

export const canon: MinigameEntry<CanonConfig> = {
  id: 'canon',
  title: 'Que no pare la música',
  summary:
    'Aguanta en tu barco hasta el amanecer: pirañas y cangrejos vienen a por ti y el cañón de agua dispara solo.',
  defaults: CANON_DEFAULTS,
  minPlausibleMs: (score) => Math.max(0, score) * 1000,
};

/** Cómo acabó una partida del Cañón, para su sesión (tiempo activo en s). */
export function canonEnd(reason: ResultReason, activeS: number): WorldGameEnd {
  return {
    outcome: canonOutcome(reason),
    reason,
    score: canonScore(activeS),
    elapsedMs: Math.max(0, activeS) * 1000,
  };
}
