/** T163: integración de la migración cuando se aplique a una base de pruebas. No aplica migraciones. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CastleScoreResult, RankingPage } from '../rpc.ts';
import { context, expectDenied, expectRejected, ok, type Member } from './context.ts';
import { testRunId } from './testkit.ts';

const ctx = context();
const run = testRunId();
let top: Member;
let low: Member;
const args = {
  p_run_min: 5,
  p_difficulty: 'normal',
  p_version: 1,
  p_score: 1200,
  p_ms: 300000,
  p_medal: 'oro',
  p_end: 'held',
  p_life: 60,
  p_ranked: true,
};
const send = (m: Member, overrides: Partial<typeof args> = {}) =>
  m.client.rpc('submit_castle_score', { ...args, ...overrides });
const table = async (min: number, diff: string, client: Member['client'] = ctx.anon) =>
  (await ok(
    client.rpc('ranking_castle', { p_run_min: min, p_difficulty: diff, p_limit: 100 }),
  )) as unknown as RankingPage;
beforeAll(async () => {
  top = await ctx.member('castle-alto');
  low = await ctx.member('castle-bajo');
  for (const [m, name] of [
    [top, 'CastleAlto'],
    [low, 'CastleBajo'],
  ] as const) {
    await ok(
      m.client.rpc('save_profile', {
        p_nickname: `${name} ${run}`,
        p_privacy_version: 'muestra-2026-10-03',
      }),
    );
  }
});
afterAll(async () => {
  await ctx.cleanup();
});
describe('ranking Castillo: tablas, mejor, antitrampas y RLS', () => {
  it('el mejor sólo sube y cuenta intentos, incluidos empates', async () => {
    expect((await ok(send(top))) as unknown as CastleScoreResult).toMatchObject({
      best: true,
      best_score: 1200,
      attempts: 1,
    });
    expect((await ok(send(top, { p_score: 1200 }))) as unknown as CastleScoreResult).toMatchObject({
      best: false,
      attempts: 2,
    });
    expect((await ok(send(top, { p_score: 1000 }))) as unknown as CastleScoreResult).toMatchObject({
      best: false,
      best_score: 1200,
      attempts: 3,
    });
    expect((await ok(send(top, { p_score: 1800 }))) as unknown as CastleScoreResult).toMatchObject({
      best: true,
      best_score: 1800,
      attempts: 4,
    });
    await ok(send(low, { p_score: 1800 }));
    const p = await table(5, 'normal', top.client);
    expect(p.mine).toMatchObject({ value: 1800, is_mine: true });
    const rows = p.rows.filter((r) => [top.id, low.id].includes(r.user_id));
    expect(rows).toHaveLength(2);
    expect(rows[0]!.position).toBe(rows[1]!.position);
  });
  it('separa las nueve tablas; no se comparte puntuación entre duración o dificultad', async () => {
    for (const min of [5, 7, 10])
      for (const diff of ['tranquila', 'normal', 'tormenta']) {
        if (min === 5 && diff === 'normal') continue;
        await ok(
          send(low, { p_run_min: min, p_difficulty: diff, p_ms: min * 60000, p_score: 2000 }),
        );
        const p = await table(min, diff);
        expect(p).toMatchObject({ run_min: min, difficulty: diff, version: 1 });
        expect(p.rows.some((r) => r.user_id === top.id)).toBe(false);
        expect(p.rows.find((r) => r.user_id === low.id)?.value).toBe(2000);
      }
  });
  it('acepta caer sin medalla, bronce a mitad y caída en el último tick', async () => {
    await ok(
      send(top, {
        p_score: 150,
        p_ms: 100000,
        p_medal: null as unknown as string,
        p_end: 'fallen',
        p_life: 0,
      }),
    );
    await ok(
      send(top, { p_score: 200, p_ms: 150000, p_medal: 'bronce', p_end: 'fallen', p_life: 0 }),
    );
    await ok(
      send(top, { p_score: 300, p_ms: 300000, p_medal: 'bronce', p_end: 'fallen', p_life: 0 }),
    );
    await ok(send(top, { p_life: 50, p_medal: 'plata' }));
  });
  it('rechaza atajo, quit, tiempos y puntos imposibles, y escribir a mano', async () => {
    await expectRejected(send(top, { p_ranked: false }), 'unranked_game');
    await expectRejected(send(top, { p_end: 'quit' }), 'invalid_end');
    await expectRejected(send(top, { p_end: 'abandoned' }), 'invalid_end');
    await expectRejected(send(top, { p_ms: 29999 }), 'too_fast');
    await expectRejected(send(top, { p_ms: 301001 }), 'too_slow');
    await expectRejected(send(top, { p_ms: 299999 }), 'too_fast');
    await expectRejected(
      send(top, { p_ms: 149999, p_medal: 'bronce', p_end: 'fallen', p_life: 0 }),
      'invalid_medal',
    );
    await expectRejected(send(top, { p_score: 5779 }), 'score_too_high');
    await expectRejected(send(top, { p_score: 0 }), 'invalid_score');
    await expectRejected(send(top, { p_life: 101 }), 'invalid_life');
    await expectRejected(send(top, { p_medal: 'plata' }), 'invalid_medal');
    await expectRejected(send(top, { p_difficulty: 'facil' }), 'invalid_difficulty');
    await expectRejected(send(top, { p_run_min: 6 }), 'unknown_board');
    await expectRejected(send(top, { p_version: 2 }), 'unknown_board');
    await expectDenied(ctx.anon.rpc('submit_castle_score', args));
    await expectDenied(
      top.client.from('castle_scores').update({ best_score: 1 }).eq('user_id', top.id),
    );
    await expectDenied(
      top.client.from('castle_boards').update({ max_kill_points: 999999 }).eq('run_min', 5),
    );
  });
});
