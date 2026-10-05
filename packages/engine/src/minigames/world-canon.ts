import {
  DEFAULT_DIFFICULTY,
  type DifficultyId,
  SURVIVORS_CONFIG,
  type SurvivorsConfig,
  survivorsConfigHash,
} from '../survivors/config';
import type { SurvivorsMedal } from '../survivors/medals';
import type { BaseConfig, MinigameEntry, Outcome, ResultReason, RewardRule } from './types';
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
 * - El premio (plan 013 T153, §9 del diseño): **cada medalla se cobra una
 *   vez al día, por separado** (`minigame:canon:bronce@<día>`, `…:plata@…`,
 *   `…:oro@…`): bronce 30 puntos y 10 monedas, plata 60 y 20, oro 100 y 40;
 *   una medalla cobra también las de debajo que aún no tuvieras hoy (un oro
 *   de primeras, 190 y 70). Sustituye al premio de la beta (150 y 50 una vez
 *   por temporada). El oro no vale antes de que entre el boss final del acto
 *   (5:30) y el bronce y la plata, antes del amanecer. Todo `muestra`.
 */

export interface CanonConfig extends BaseConfig {
  /** La configuración del modo Survivors con que se juega: su versión y su huella. */
  survivors: { version: number; hash: string; difficulty: DifficultyId; act: number };
}

/**
 * Versión de las reglas de sesión del Cañón (la 3 era el cañón 2D, T72; la 5,
 * el premio por medalla de T153).
 */
export const CANON_VERSION = 5;

/** Lo que paga cada medalla, una vez al día cada una (T153). muestra */
export const CANON_MEDAL_PRIZES: Readonly<
  Record<SurvivorsMedal, { points: number; coins: number }>
> = {
  bronce: { points: 30, coins: 10 },
  plata: { points: 60, coins: 20 },
  oro: { points: 100, coins: 40 },
};

/** El segundo en que entra el boss final del acto `act` (sin él, el más temprano de todos). */
function finalBossAtS(cfg: SurvivorsConfig, act: number): number {
  const ev = cfg.acts
    .find((a) => a.act === act)
    ?.events.find(
      (e) =>
        e.type === 'boss' && e.enabled !== false && cfg.bosses[e.ref as keyof typeof cfg.bosses],
    );
  return ev ? ev.atS : canonEarliestWinS(cfg);
}

/** El premio del Cañón para una configuración del modo y un acto: por medalla, una vez al día. */
export function canonReward(cfg: SurvivorsConfig = SURVIVORS_CONFIG, act = 1): RewardRule {
  const { bronce, plata, oro } = CANON_MEDAL_PRIZES;
  const nightMs = cfg.durationS * 1000;
  return {
    policy: 'daily',
    points: bronce.points + plata.points + oro.points,
    coins: bronce.coins + plata.coins + oro.coins,
    maxPoints: Math.max(bronce.points, plata.points, oro.points),
    maxCoins: Math.max(bronce.coins, plata.coins, oro.coins),
    tiers: [
      { id: 'bronce', ...bronce, minMs: nightMs, reasons: ['survived'] },
      { id: 'plata', ...plata, minMs: nightMs, reasons: ['survived'] },
      { id: 'oro', ...oro, minMs: finalBossAtS(cfg, act) * 1000, reasons: ['victory'] },
    ],
  };
}

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
    reward: canonReward(cfg, act),
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
      if (
        ev.type === 'boss' &&
        ev.enabled !== false &&
        cfg.bosses[ev.ref as keyof typeof cfg.bosses] &&
        ev.atS < earliest
      ) {
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

/**
 * Cómo acabó una partida del Cañón, para su sesión (tiempo activo en s) y su
 * medalla (T153: el escalón del premio). Sin medalla dicha, la de la razón:
 * oro al vencer al boss final, bronce al amanecer.
 */
export function canonEnd(
  reason: ResultReason,
  activeS: number,
  cfg: SurvivorsConfig = SURVIVORS_CONFIG,
  medal?: SurvivorsMedal | null,
): WorldGameEnd {
  const tier =
    medal === undefined
      ? reason === 'victory'
        ? 'oro'
        : reason === 'survived'
          ? 'bronce'
          : null
      : medal;
  return {
    ...(tier ? { tier } : {}),
    outcome: canonOutcome(reason),
    reason,
    // Vencer al boss final (T140) vale la noche entera: la marca del objetivo.
    score: reason === 'victory' ? canonScore(cfg.durationS) : canonScore(activeS),
    elapsedMs: Math.max(0, activeS) * 1000,
  };
}
