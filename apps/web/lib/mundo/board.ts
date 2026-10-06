import { type Medal, type Medals, medalFor } from '@boia/engine/circuit';
import type { SurvivorsMedal } from '@boia/engine/survivors';
import { CASTLE_GAME_ID, CIRCUIT_ID, type WorldObject } from '@boia/world';
import { type CanonBestStorage, canonBoardBosses, readCanonBest } from './ranking-canon';

/**
 * El «Tablón del faro» (plan 014 T157, decisión 1 del 2026-10-05): junto a la
 * salida, el faro cuenta los dos juegos y la carrera y lleva hasta ellos.
 * Tres tarjetas (Cañón, Castillo, Carrera), cada una con su línea, la mejor
 * medalla del jugador si la tiene y su «Rumbo a…», que marca el destino
 * como el «!» de ayuda. Sin React: de qué lugar va cada tarjeta y qué
 * medalla enseña. Textos en `mar.tablon.*`.
 */

export type BoardCardId = 'canon' | 'castillo' | 'carrera';

/** El orden de las tarjetas. */
export const BOARD_CARDS: readonly BoardCardId[] = ['canon', 'castillo', 'carrera'];

/** Una medalla en el tablón, con los nombres del Cañón (la de la carrera se traduce). */
export type BoardMedal = SurvivorsMedal;

const RACE_TO_BOARD: Record<Medal, BoardMedal> = { gold: 'oro', silver: 'plata', bronze: 'bronce' };
const RANK: Record<BoardMedal, number> = { bronce: 1, plata: 2, oro: 3 };

/** La mejor de unas medallas (null si no hay ninguna). */
export function bestMedal(medals: readonly (BoardMedal | null | undefined)[]): BoardMedal | null {
  let best: BoardMedal | null = null;
  for (const m of medals) if (m && (!best || RANK[m] > RANK[best])) best = m;
  return best;
}

const startsGame = (o: WorldObject, gameId: string) =>
  o.behaviors.some((b) => b.type === 'start_minigame' && b.params.gameId === gameId);

/** La salida de la carrera: la puerta 0 del circuito. */
const startsRace = (o: WorldObject) =>
  o.behaviors.some(
    (b) => b.type === 'checkpoint' && b.params.circuitId === CIRCUIT_ID && b.params.order === 0,
  );

/** El lugar al que lleva cada tarjeta (activo), o null si el mundo no lo tiene. */
export function boardDestinations(
  objects: readonly WorldObject[],
): Record<BoardCardId, string | null> {
  const find = (ok: (o: WorldObject) => boolean) =>
    objects.find((o) => o.identity.active && ok(o))?.identity.id ?? null;
  return {
    canon: find((o) => startsGame(o, 'canon')),
    castillo: find((o) => startsGame(o, CASTLE_GAME_ID)),
    carrera: find(startsRace),
  };
}

/** La mejor medalla del Cañón en este navegador: la mejor de todas sus tablas (por boss). */
export function canonBoardMedal(storage: CanonBestStorage | null): BoardMedal | null {
  return bestMedal(canonBoardBosses().map((boss) => readCanonBest(storage, boss)?.medal));
}

/** La medalla del mejor tiempo de la carrera, o null (sin tiempo o sin bronce). */
export function raceBoardMedal(
  bestMs: number | null | undefined,
  medals: Medals,
): BoardMedal | null {
  if (bestMs === null || bestMs === undefined || !(bestMs > 0)) return null;
  const m = medalFor(bestMs, medals);
  return m ? RACE_TO_BOARD[m] : null;
}
