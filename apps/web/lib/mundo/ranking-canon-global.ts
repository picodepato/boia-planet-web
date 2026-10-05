import type { DifficultyId, SurvivorsMedal } from '@boia/engine/survivors';
import { CANON_RANKING_VERSION } from './ranking-canon';
import {
  type GlobalPage,
  type RankingClient,
  fetchRankingPage,
  rankingClient,
} from './ranking-global';

/**
 * El ranking global del Cañón por boss (plan 013 T155) sobre las RPC de
 * `supabase/migrations/20261005100200_canon_ranking.sql`:
 * `submit_canon_score` (sólo cuentas con Carnet; la base guarda la mejor de
 * cada una y rechaza lo imposible) y `ranking_canon` (la lee cualquiera).
 *
 * Una partida se manda en cuanto acaba, directa (no por la cola del
 * repositorio): sin red, se queda en la mejor de este navegador y la
 * tarjeta lo dice. Sólo con Supabase; en modo local, `ranking-canon.ts`.
 */

export interface CanonSubmission {
  boss: string;
  version?: number;
  score: number;
  /** ms de tiempo activo de la partida. */
  ms: number;
  medal: SurvivorsMedal | null;
  difficulty: DifficultyId;
}

/** Lo que contesta la base al mandar una partida. */
export interface CanonSubmitResult {
  best: boolean;
  bestScore: number;
}

/** Manda una partida al ranking global; lanza si la base la rechaza (`too_fast`, `score_too_high`…). */
export async function submitCanonScore(
  client: RankingClient,
  s: CanonSubmission,
): Promise<CanonSubmitResult> {
  const res = await client.rpc('submit_canon_score', {
    p_boss: s.boss,
    p_version: s.version ?? CANON_RANKING_VERSION,
    p_score: Math.round(s.score),
    p_ms: Math.round(s.ms),
    p_medal: s.medal,
    p_difficulty: s.difficulty,
  });
  if (res.error) throw new Error(`ranking del Cañón: ${res.error.message ?? 'error'}`);
  const d = (res.data ?? {}) as { best?: boolean; best_score?: number };
  return { best: !!d.best, bestScore: Number(d.best_score ?? s.score) };
}

/** La página `offset` de la tabla de un boss. */
export function fetchCanonPage(
  client: RankingClient,
  boss: string,
  offset = 0,
  limit?: number,
  version = CANON_RANKING_VERSION,
): Promise<GlobalPage> {
  return fetchRankingPage(client, { kind: 'canon', boss, version }, offset, limit);
}

export type MemberCanonStanding =
  | { kind: 'global'; position: number; total: number; bestScore: number; best: boolean }
  | { kind: 'unavailable' };

/**
 * Al acabar una partida de un miembro: la manda y lee su puesto en la tabla
 * del boss. `unavailable` si no se pudo (sin red, o la base no la aceptó y
 * no tiene ninguna suya).
 */
export async function memberCanonStanding(
  s: CanonSubmission,
  client: () => Promise<RankingClient | null> = rankingClient,
): Promise<MemberCanonStanding> {
  try {
    const c = await client();
    if (!c) return { kind: 'unavailable' };
    const sent = await submitCanonScore(c, s).catch((err: unknown) => {
      console.warn('[boia] la base no aceptó la partida del Cañón', err);
      return null;
    });
    const page = await fetchCanonPage(c, s.boss, 0, 1, s.version);
    if (!page.mine) return { kind: 'unavailable' };
    return {
      kind: 'global',
      position: page.mine.position,
      total: page.total,
      bestScore: page.mine.value,
      best: sent?.best ?? false,
    };
  } catch (err) {
    console.warn('[boia] no se pudo leer el puesto del Cañón', err);
    return { kind: 'unavailable' };
  }
}

/** La tabla de un boss para el pop-up: su arranque, o null sin cuentas o sin red. */
export async function canonBoardTop(
  boss: string,
  limit: number,
  client: () => Promise<RankingClient | null> = rankingClient,
): Promise<GlobalPage | null> {
  try {
    const c = await client();
    return c ? await fetchCanonPage(c, boss, 0, limit) : null;
  } catch {
    return null;
  }
}
