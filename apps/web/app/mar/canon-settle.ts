import { type WorldMinigameSession, type WorldSettlement, canonEnd } from '@boia/engine/minigames';
import type { EndReason, SurvivorsConfig, SurvivorsMedal } from '@boia/engine/survivors';
import type { AchievementSignal } from '../../lib/mundo/achievements';
import { CANON_GAME_ID } from './survivors';

/**
 * Liquida la sesión del Cañón al acabar la partida (T119, T148, T153).
 *
 * - Amanecer, inundado, victoria o abandono: la sesión se liquida con el
 *   tiempo activo y la medalla, y pide el premio de la medalla (T153: cada
 *   medalla una vez al día, y las de debajo que aún no tuvieras; lo decide el
 *   libro).
 * - «Terminar partida» (`quit`, T148): la sesión se abandona y no se liquida.
 *   No hay resultado, ni premio, ni señal de logro, ni nada que mandar al
 *   ranking. Devuelve null.
 */
export function settleCanonSession(
  session: WorldMinigameSession,
  reason: EndReason,
  activeS: number,
  medal: SurvivorsMedal | null = null,
  config?: SurvivorsConfig,
): Promise<WorldSettlement> | null {
  if (reason === 'quit') {
    session.abandon();
    return null;
  }
  return session.finish(canonEnd(reason, activeS, config, medal));
}

/** Lo que hace falta de una partida acabada para sus logros (T153). */
export interface CanonGameFacts {
  /** La medalla (null: inundada, abandonada o terminada). */
  medal: SurvivorsMedal | null;
  /** Los bosses vencidos, en orden (ids de la config). */
  bosses: readonly string[];
  difficulty: string;
}

/**
 * Las señales de logro de una partida liquidada (T153), en orden: jugada
 * (`canon-zarpa`, Guardacostas), ganada con bronce o más (`canon`) y cada
 * boss vencido con su dificultad (`canon-fantasma`, `canon-kraken`,
 * `canon-tormenta`). Ninguna si la partida no cuenta: de prueba (un atajo de
 * desarrollo donde no da premio, decisión 8 del plan 013), terminada desde la
 * pausa (no se liquida) o no válida (abandonada, duración imposible…).
 */
export function canonSignals(
  settlement: WorldSettlement | null,
  counts: boolean,
  game: CanonGameFacts,
): AchievementSignal[] {
  if (!settlement || !counts || !settlement.validation.valid) return [];
  const out: AchievementSignal[] = [{ trigger: 'play_minigame', game: CANON_GAME_ID }];
  if (game.medal) out.push({ trigger: 'win_minigame', game: CANON_GAME_ID });
  for (const boss of new Set(game.bosses)) {
    out.push({ trigger: 'defeat_boss', boss, difficulty: game.difficulty });
  }
  return out;
}
