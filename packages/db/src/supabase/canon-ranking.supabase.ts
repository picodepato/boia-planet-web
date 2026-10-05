/**
 * El ranking del Cañón por boss (plan 013 T155,
 * `20261005100200_canon_ranking.sql`) contra el proyecto de desarrollo:
 * la mejor partida de cada cuenta por boss, el antitrampas básico y la
 * tabla de la más alta a la más baja. El proyecto puede tener otras cuentas:
 * las pruebas comparan las suyas entre sí, nunca puestos absolutos.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CanonScoreResult, RankingPage } from '../rpc.ts';
import { context, expectDenied, expectRejected, ok, type Member } from './context.ts';
import { testRunId } from './testkit.ts';

const ctx = context();
const run = testRunId();
const POLICY = 'muestra-2026-10-03';

let top: Member;
let low: Member;

const send = (
  m: Member,
  score: number,
  o: { boss?: string; version?: number; ms?: number; medal?: string; difficulty?: string } = {},
) =>
  m.client.rpc('submit_canon_score', {
    p_boss: o.boss ?? 'fantasma',
    p_version: o.version ?? 1,
    p_score: score,
    p_ms: o.ms ?? 200_000,
    ...(o.medal ? { p_medal: o.medal } : {}),
    p_difficulty: o.difficulty ?? 'normal',
  });

const table = async (boss: string, client: Member['client'] | null = null) =>
  (await ok(
    (client ?? ctx.anon).rpc('ranking_canon', { p_boss: boss, p_limit: 100 }),
  )) as unknown as RankingPage;

beforeAll(async () => {
  top = await ctx.member('canon-alto');
  low = await ctx.member('canon-bajo');
  await ok(
    top.client.rpc('save_profile', { p_nickname: `CanonAlto ${run}`, p_privacy_version: POLICY }),
  );
  await ok(
    low.client.rpc('save_profile', { p_nickname: `CanonBajo ${run}`, p_privacy_version: POLICY }),
  );
});

afterAll(async () => {
  await ctx.cleanup();
});

describe('submit_canon_score: la mejor partida por boss', () => {
  it('guarda la más alta y cuenta los intentos', async () => {
    expect((await ok(send(top, 20_000))) as unknown as CanonScoreResult).toMatchObject({
      best: true,
      best_score: 20_000,
      attempts: 1,
    });
    expect((await ok(send(top, 15_000))) as unknown as CanonScoreResult).toMatchObject({
      best: false,
      best_score: 20_000,
      attempts: 2,
    });
    expect(
      (await ok(
        send(top, 42_000, { ms: 360_000, medal: 'oro', difficulty: 'tormenta' }),
      )) as unknown as CanonScoreResult,
    ).toMatchObject({ best: true, best_score: 42_000, attempts: 3 });
    await ok(send(low, 9_000));
  });

  it('cada boss tiene su tabla', async () => {
    await ok(send(low, 50_000, { boss: 'kraken' }));
    const fantasma = await table('fantasma');
    const kraken = await table('kraken');
    const pos = (p: RankingPage, id: string) => p.rows.find((r) => r.user_id === id)?.position;
    expect(pos(fantasma, top.id)!).toBeLessThan(pos(fantasma, low.id)!);
    expect(pos(kraken, low.id)).toBeDefined();
    expect(pos(kraken, top.id)).toBeUndefined();
    expect(kraken.boss).toBe('kraken');
    const mine = await table('fantasma', top.client);
    expect(mine.mine).toMatchObject({ user_id: top.id, value: 42_000, is_mine: true });
  });

  it('rechaza lo imposible, tablas que no existen y a quien no tiene cuenta', async () => {
    await expectRejected(send(top, 10_000, { ms: 29_999 }), 'too_fast');
    await expectRejected(send(top, 10_000, { ms: 421_001 }), 'too_slow');
    await expectRejected(send(top, 10_000, { ms: 329_999, medal: 'oro' }), 'too_fast');
    await expectRejected(send(top, 10_000, { ms: 419_999, medal: 'bronce' }), 'too_fast');
    await expectRejected(send(top, 170_001), 'score_too_high');
    await expectRejected(send(top, 0), 'invalid_score');
    await expectRejected(send(top, 10_000, { medal: 'diamante' }), 'invalid_medal');
    await expectRejected(send(top, 10_000, { difficulty: 'facil' }), 'invalid_difficulty');
    await expectRejected(send(top, 10_000, { boss: 'capitan' }), 'unknown_board');
    await expectRejected(send(top, 10_000, { version: 2 }), 'unknown_board');
    await expectRejected(ctx.anon.rpc('ranking_canon', { p_boss: 'no-existe' }), 'unknown_board');
    await expectDenied(
      ctx.anon.rpc('submit_canon_score', {
        p_boss: 'fantasma',
        p_version: 1,
        p_score: 10_000,
        p_ms: 200_000,
      }),
    );
    // Nadie escribe la tabla a mano.
    await expectDenied(
      top.client.from('canon_scores').update({ best_score: 1 }).eq('user_id', top.id),
    );
  });
});
