import { type WorldMinigameSession, type WorldSettlement, canonEnd } from '@boia/engine/minigames';
import type { EndReason } from '@boia/engine/survivors';

/**
 * Liquida la sesión del Cañón al acabar la partida (T119, T148).
 *
 * - Amanecer, inundado, victoria o abandono: la sesión se liquida con el
 *   tiempo activo y pide el premio (que decide el libro).
 * - «Terminar partida» (`quit`, T148): la sesión se abandona y no se liquida.
 *   No hay resultado, ni premio, ni señal `win_minigame`, ni nada que mandar
 *   al ranking. Devuelve null.
 */
export function settleCanonSession(
  session: WorldMinigameSession,
  reason: EndReason,
  activeS: number,
): Promise<WorldSettlement> | null {
  if (reason === 'quit') {
    session.abandon();
    return null;
  }
  return session.finish(canonEnd(reason, activeS));
}
