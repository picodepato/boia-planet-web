import { describe, expect, it } from 'vitest';
import {
  canonBoardTop,
  fetchCanonPage,
  memberCanonStanding,
  submitCanonScore,
} from './ranking-canon-global';
import { CANON_RANKING_VERSION } from './ranking-canon';
import type { RankingClient } from './ranking-global';

type Call = { fn: string; args: Record<string, unknown> };

/** Un cliente falso: contesta cada RPC con lo que diga `answer`. */
function fakeClient(
  answer: (
    fn: string,
    args: Record<string, unknown>,
  ) => { data: unknown; error: { message?: string } | null },
) {
  const calls: Call[] = [];
  const client: RankingClient = {
    rpc: (fn, args) => {
      calls.push({ fn, args });
      return Promise.resolve(answer(fn, args));
    },
    from: () => ({
      select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }),
    }),
  };
  return { client, calls };
}

const row = (user: string, position: number, value: number, mine = false) => ({
  position,
  user_id: user,
  nickname: user,
  member_number: position,
  is_artist: false,
  value,
  is_mine: mine,
});

describe('ranking global del Cañón (T155)', () => {
  it('manda la partida a `submit_canon_score` con la versión de la tabla', async () => {
    const { client, calls } = fakeClient(() => ({
      data: { best: true, best_score: 12_345 },
      error: null,
    }));
    const r = await submitCanonScore(client, {
      boss: 'kraken',
      score: 12_345.4,
      ms: 400_123.7,
      medal: 'bronce',
      difficulty: 'tranquila',
    });
    expect(r).toEqual({ best: true, bestScore: 12_345 });
    expect(calls).toEqual([
      {
        fn: 'submit_canon_score',
        args: {
          p_boss: 'kraken',
          p_version: CANON_RANKING_VERSION,
          p_score: 12_345,
          p_ms: 400_124,
          p_medal: 'bronce',
          p_difficulty: 'tranquila',
        },
      },
    ]);
  });

  it('un rechazo de la base se lanza', async () => {
    const { client } = fakeClient(() => ({ data: null, error: { message: 'score_too_high' } }));
    await expect(
      submitCanonScore(client, {
        boss: 'fantasma',
        score: 1,
        ms: 1,
        medal: null,
        difficulty: 'normal',
      }),
    ).rejects.toThrow('score_too_high');
  });

  it('cada boss lee su tabla; una que la base no tiene es una tabla vacía', async () => {
    const { client, calls } = fakeClient((_fn, args) =>
      args.p_boss === 'fantasma'
        ? {
            data: {
              total: 2,
              limit: 5,
              offset: 0,
              rows: [row('a', 1, 900), row('b', 2, 500)],
              mine: null,
            },
            error: null,
          }
        : { data: null, error: { message: 'unknown_board' } },
    );
    const page = await fetchCanonPage(client, 'fantasma', 0, 5);
    expect(page.rows.map((r) => [r.userId, r.position, r.value])).toEqual([
      ['a', 1, 900],
      ['b', 2, 500],
    ]);
    expect(calls[0]).toEqual({
      fn: 'ranking_canon',
      args: { p_boss: 'fantasma', p_version: CANON_RANKING_VERSION, p_limit: 5, p_offset: 0 },
    });
    expect(await fetchCanonPage(client, 'kraken')).toMatchObject({
      total: 0,
      rows: [],
      mine: null,
    });
  });

  it('al acabar, un miembro manda y lee su puesto', async () => {
    const { client, calls } = fakeClient((fn) =>
      fn === 'submit_canon_score'
        ? { data: { best: true, best_score: 30_000 }, error: null }
        : {
            data: {
              total: 7,
              limit: 1,
              offset: 0,
              rows: [row('x', 1, 50_000)],
              mine: row('yo', 4, 30_000, true),
            },
            error: null,
          },
    );
    const s = await memberCanonStanding(
      { boss: 'fantasma', score: 30_000, ms: 420_000, medal: 'bronce', difficulty: 'normal' },
      async () => client,
    );
    expect(s).toEqual({ kind: 'global', position: 4, total: 7, bestScore: 30_000, best: true });
    expect(calls.map((c) => c.fn)).toEqual(['submit_canon_score', 'ranking_canon']);
  });

  it('sin cliente, sin red o sin fila propia: no disponible', async () => {
    const sub = {
      boss: 'fantasma',
      score: 1000,
      ms: 100_000,
      medal: null,
      difficulty: 'normal',
    } as const;
    expect(await memberCanonStanding(sub, async () => null)).toEqual({ kind: 'unavailable' });
    const { client } = fakeClient((fn) =>
      fn === 'submit_canon_score'
        ? { data: null, error: { message: 'too_fast' } }
        : { data: { total: 0, limit: 1, offset: 0, rows: [], mine: null }, error: null },
    );
    expect(await memberCanonStanding(sub, async () => client)).toEqual({ kind: 'unavailable' });
    expect(
      await canonBoardTop('fantasma', 5, async () => Promise.reject(new Error('sin red'))),
    ).toBeNull();
    expect(await canonBoardTop('fantasma', 5, async () => null)).toBeNull();
  });
});
