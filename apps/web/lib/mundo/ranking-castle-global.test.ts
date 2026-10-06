import { describe, expect, it } from 'vitest';
import { castleResult } from './__fixtures__/castle-result';
import {
  castleBoardTop,
  fetchCastlePage,
  memberCastleStanding,
  submitCastleScore,
} from './ranking-castle-global';
import { boardKey, type RankingClient } from './ranking-global';

function fakeClient(
  answer: (
    fn: string,
    args: Record<string, unknown>,
  ) => { data: unknown; error: { message: string } | null },
) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const client: RankingClient = {
    rpc: (fn, args) => {
      calls.push({ fn, args });
      return Promise.resolve(answer(fn, args));
    },
    from: () => ({ select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }),
  };
  return { client, calls };
}
const row = {
  position: 3,
  user_id: 'yo',
  nickname: 'Mi carnet',
  member_number: 1,
  is_artist: false,
  value: 1200,
  is_mine: true,
};
const page = { total: 20, offset: 0, rows: [], mine: row };
describe('RPC ranking del Castillo', () => {
  it('envía la puntuación de la sim y lee su par, incluida la fila propia fuera del top', async () => {
    const { client, calls } = fakeClient((fn) => ({
      data: fn === 'submit_castle_score' ? { best: true, best_score: 1200 } : page,
      error: null,
    }));
    const r = castleResult({ runMin: 10, difficulty: 'tormenta' });
    expect(await memberCastleStanding(r, async () => client)).toEqual({
      kind: 'global',
      best: true,
      bestScore: 1200,
      position: 3,
      total: 20,
    });
    expect(calls).toEqual([
      {
        fn: 'submit_castle_score',
        args: {
          p_run_min: 10,
          p_difficulty: 'tormenta',
          p_version: 1,
          p_score: r.score,
          p_ms: 600000,
          p_medal: 'oro',
          p_end: 'held',
          p_life: 60,
          p_ranked: true,
        },
      },
      {
        fn: 'ranking_castle',
        args: { p_run_min: 10, p_difficulty: 'tormenta', p_version: 1, p_limit: 1, p_offset: 0 },
      },
    ]);
  });
  it('cada par y versión tiene una identidad y argumentos propios', async () => {
    const { client, calls } = fakeClient(() => ({ data: page, error: null }));
    for (const runMin of [5, 7, 10] as const)
      for (const difficulty of ['tranquila', 'normal', 'tormenta'] as const) {
        expect((await fetchCastlePage(client, runMin, difficulty, 10, 5)).mine?.userId).toBe('yo');
        expect(calls.at(-1)?.args).toEqual({
          p_run_min: runMin,
          p_difficulty: difficulty,
          p_version: 1,
          p_offset: 10,
          p_limit: 5,
        });
      }
    expect(boardKey({ kind: 'castle', runMin: 5, difficulty: 'normal', version: 2 })).toBe(
      'castle:5:normal:v2',
    );
  });
  it('no llama la RPC ni crea un cliente con atajos, quit o imposibles', async () => {
    const { client, calls } = fakeClient(() => ({ data: page, error: null }));
    for (const r of [
      castleResult({ ranked: false }),
      castleResult({ end: 'quit', ranked: false }),
      castleResult({ score: 999999 }),
      castleResult({ playedS: 5 }),
    ]) {
      await expect(submitCastleScore(client, r)).rejects.toThrow('ranking del Castillo');
      expect(
        await memberCastleStanding(r, () => {
          throw Error('no debe obtener cliente');
        }),
      ).toEqual({ kind: 'unavailable' });
    }
    expect(calls).toHaveLength(0);
  });
  it('sin red, rechazo y sin fila propia: no disponible; no finge un envío aceptado', async () => {
    const r = castleResult();
    expect(await memberCastleStanding(r, async () => null)).toEqual({ kind: 'unavailable' });
    expect(await castleBoardTop(5, 'normal', 5, async () => null)).toBeNull();
    const { client, calls } = fakeClient(() => ({
      data: null,
      error: { message: 'score_too_high' },
    }));
    await expect(submitCastleScore(client, r)).rejects.toThrow('score_too_high');
    expect(await memberCastleStanding(r, async () => client)).toEqual({ kind: 'unavailable' });
    expect(calls.every((c) => c.fn === 'submit_castle_score')).toBe(true);
    expect(await castleBoardTop(5, 'normal', 5, async () => client)).toBeNull();
    const unknown = fakeClient(() => ({ data: null, error: { message: 'unknown_board' } })).client;
    expect(await fetchCastlePage(unknown, 5, 'normal')).toMatchObject({
      total: 0,
      rows: [],
      mine: null,
    });
  });
});
