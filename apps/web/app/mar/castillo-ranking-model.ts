import type { DefenseResult } from '@boia/engine/defense';
import {
  type CastleBestStorage,
  type CastleRankRejection,
  castleRanking,
  castleRankRejection,
  readCastleBest,
  recordCastleBest,
} from '../../lib/mundo/ranking-castle';
import type { MemberCastleStanding } from '../../lib/mundo/ranking-castle-global';

export interface CastleRankingOutcome {
  score: number;
  best: number | null;
  isBest: boolean;
  standing:
    | { kind: 'off'; reason: CastleRankRejection }
    | { kind: 'local'; position: number; of: number }
    | { kind: 'global'; position: number; total: number }
    | { kind: 'guest' | 'loading' | 'unavailable' };
}
export interface CastleRankDeps {
  mode: 'local' | 'guest' | 'member';
  storage: CastleBestStorage | null;
  submit: (r: DefenseResult) => Promise<MemberCastleStanding>;
  now?: () => Date;
}

export function rankCastleGame(
  r: DefenseResult,
  deps: CastleRankDeps,
): { now: CastleRankingOutcome; later: Promise<CastleRankingOutcome> | null } {
  const rejection = castleRankRejection(r);
  if (rejection)
    return {
      now: {
        score: r.score,
        best: readCastleBest(deps.storage, r.runMin, r.difficulty)?.score ?? null,
        isBest: false,
        standing: { kind: 'off', reason: rejection },
      },
      later: null,
    };
  const saved = recordCastleBest(deps.storage, r, (deps.now?.() ?? new Date()).toISOString())!;
  const base = { score: r.score, best: saved.record.score, isBest: saved.best };
  if (deps.mode === 'local') {
    const table = castleRanking(saved.record.score, r.runMin, r.difficulty);
    return {
      now: {
        ...base,
        standing: { kind: 'local', position: table.mine.position!, of: table.rows.length },
      },
      later: null,
    };
  }
  if (deps.mode === 'guest') return { now: { ...base, standing: { kind: 'guest' } }, later: null };
  const later = deps.submit(r).then(
    (s): CastleRankingOutcome =>
      s.kind === 'global'
        ? {
            ...base,
            best: s.bestScore,
            isBest: s.best,
            standing: { kind: 'global', position: s.position, total: s.total },
          }
        : { ...base, standing: { kind: 'unavailable' } },
    (): CastleRankingOutcome => ({ ...base, standing: { kind: 'unavailable' } }),
  );
  return { now: { ...base, standing: { kind: 'loading' } }, later };
}
