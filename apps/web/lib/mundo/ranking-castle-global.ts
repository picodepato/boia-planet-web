import type { DefenseResult, DefenseRunMin, DifficultyId } from '@boia/engine/defense';
import { CASTLE_RANKING_VERSION, castleRankRejection } from './ranking-castle';
import {
  type GlobalPage,
  type RankingClient,
  fetchRankingPage,
  rankingClient,
} from './ranking-global';

export async function submitCastleScore(
  client: RankingClient,
  r: DefenseResult,
): Promise<{ best: boolean; bestScore: number }> {
  const rejection = castleRankRejection(r);
  if (rejection) throw new Error(`ranking del Castillo: ${rejection}`);
  const res = await client.rpc('submit_castle_score', {
    p_run_min: r.runMin,
    p_difficulty: r.difficulty,
    p_version: CASTLE_RANKING_VERSION,
    p_score: r.score,
    p_ms: Math.round(r.playedS * 1000),
    p_medal: r.medal,
    p_end: r.end,
    p_life: r.castleLife,
    p_ranked: r.ranked,
  });
  if (res.error) throw new Error(`ranking del Castillo: ${res.error.message ?? 'error'}`);
  const data = res.data as { best: boolean; best_score: number };
  return { best: data.best, bestScore: Number(data.best_score) };
}

export function fetchCastlePage(
  client: RankingClient,
  runMin: DefenseRunMin,
  difficulty: DifficultyId,
  offset = 0,
  limit?: number,
): Promise<GlobalPage> {
  return fetchRankingPage(
    client,
    { kind: 'castle', runMin, difficulty, version: CASTLE_RANKING_VERSION },
    offset,
    limit,
  );
}

export type MemberCastleStanding =
  | { kind: 'global'; position: number; total: number; bestScore: number; best: boolean }
  | { kind: 'unavailable' };

/** Envío directo, sin cola; nunca se envían atajos, quit ni resultados imposibles. */
export async function memberCastleStanding(
  r: DefenseResult,
  client: () => Promise<RankingClient | null> = rankingClient,
): Promise<MemberCastleStanding> {
  if (castleRankRejection(r)) return { kind: 'unavailable' };
  try {
    const c = await client();
    if (!c) return { kind: 'unavailable' };
    const sent = await submitCastleScore(c, r);
    const page = await fetchCastlePage(c, r.runMin, r.difficulty, 0, 1);
    return page.mine
      ? {
          kind: 'global',
          position: page.mine.position,
          total: page.total,
          bestScore: page.mine.value,
          best: sent.best,
        }
      : { kind: 'unavailable' };
  } catch {
    return { kind: 'unavailable' };
  }
}

export async function castleBoardTop(
  runMin: DefenseRunMin,
  difficulty: DifficultyId,
  limit: number,
  client: () => Promise<RankingClient | null> = rankingClient,
): Promise<GlobalPage | null> {
  try {
    const c = await client();
    return c ? await fetchCastlePage(c, runMin, difficulty, 0, limit) : null;
  } catch {
    return null;
  }
}
