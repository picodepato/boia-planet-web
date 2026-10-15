/**
 * Los logros secretos del plan 029 y el barco del after en el progreso del
 * servidor (plan 032 T300, migración 20261015100700) contra el proyecto de
 * desarrollo: se cobran en vivo y al fusionar lo del invitado, el del after
 * con su tope propio (150 puntos y 500 monedas, una vez, fuera del tope
 * diario) y su barco, que luego se equipa. Los topes se leen de la base
 * (`point_actions`) y de la migración, no se escriben aquí.
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AwardResult, MergePayload, MergeResult } from '../rpc.ts';
import { context, expectDenied, expectRejected, ok, type Member } from './context.ts';

const ctx = context();

const AFTER = 'siempre-hay-after';
const AFTER_SHIP = 'barco-after';
/** Los logros secretos de los planes 029 y 030 que no tienen tope propio. */
const SECRETS = [
  'fiestera-bailando',
  'salto-mortal',
  'gaviota-pillada',
  'capeaste-temporal',
  'horoscopado',
] as const;

const MIGRATION = readFileSync(
  new URL(
    '../../../../supabase/migrations/20261015100700_secret_prizes_member_restore.sql',
    import.meta.url,
  ),
  'utf8',
);

/** El tope propio del after, tal como lo inserta la migración. */
function afterPrize(): { points: number; coins: number } {
  const m = new RegExp(`\\('${AFTER}',\\s*(\\d+),\\s*(\\d+),`).exec(MIGRATION);
  if (!m) throw new Error('la migración no inserta el tope del after');
  return { points: Number(m[1]), coins: Number(m[2]) };
}

interface ActionCaps {
  max_points: number;
  max_coins: number;
  daily_points: number;
  daily_coins: number;
}

let caps: ActionCaps;
let live: Member;
let guest: Member;
let stranger: Member;

const balances = async (who: Member) => {
  const p = await ok(who.client.from('point_balances').select('points').eq('user_id', who.id));
  const c = await ok(who.client.from('coin_balances').select('coins').eq('user_id', who.id));
  return { points: p[0]?.points ?? 0, coins: c[0]?.coins ?? 0 };
};

const claim = (who: Member, ref: string, points: number, coins: number) =>
  who.client.rpc('award_points', {
    p_action: 'achievement',
    p_ref: ref,
    p_points: points,
    p_coins: coins,
  });

beforeAll(async () => {
  caps = (await ok(
    ctx.anon
      .from('point_actions')
      .select('max_points, max_coins, daily_points, daily_coins')
      .eq('action', 'achievement')
      .single(),
  )) as unknown as ActionCaps;
  live = await ctx.member('secretos-vivo');
  guest = await ctx.member('secretos-fusion');
  stranger = await ctx.member('secretos-otro');
});

afterAll(async () => {
  await ctx.cleanup();
});

describe('logros secretos y barco del after en el servidor (T300)', () => {
  it('el barco del after está en el catálogo, lo regala su logro y no se vende', async () => {
    const rows = await ok(
      ctx.anon
        .from('cosmetics')
        .select('id, slot, price_coins, unlock_achievement')
        .eq('id', AFTER_SHIP),
    );
    expect(rows).toEqual([
      { id: AFTER_SHIP, slot: 'ship', price_coins: null, unlock_achievement: AFTER },
    ]);
    await expectRejected(
      stranger.client.rpc('buy_cosmetic', { p_cosmetic: AFTER_SHIP }),
      'not_for_sale',
    );
    await expectRejected(
      stranger.client.rpc('equip_cosmetic', { p_slot: 'ship', p_cosmetic: AFTER_SHIP }),
      'not_owned',
    );
  });

  it('en vivo: el del after paga su premio y da el barco, una sola vez, y se equipa', async () => {
    const prize = afterPrize();
    expect(prize.coins).toBeGreaterThan(caps.max_coins);
    // Por encima de su tope propio, no.
    await expectRejected(claim(live, AFTER, prize.points, prize.coins + 1), 'limit_action');
    const r = (await ok(claim(live, AFTER, prize.points, prize.coins))) as unknown as AwardResult;
    expect(r).toMatchObject({ granted: true, cosmetics: [AFTER_SHIP] });
    const again = (await ok(
      claim(live, AFTER, prize.points, prize.coins),
    )) as unknown as AwardResult;
    expect(again).toMatchObject({ granted: false, reason: 'duplicate' });
    expect(await balances(live)).toEqual({ points: prize.points, coins: prize.coins });
    const equipped = await ok(
      live.client.rpc('equip_cosmetic', { p_slot: 'ship', p_cosmetic: AFTER_SHIP }),
    );
    expect(equipped).toMatchObject({ ship: AFTER_SHIP });
    // Su tope propio es sólo suyo: otro logro sigue con el de la acción.
    await expectRejected(
      claim(live, 'otro-logro-t300', caps.max_points, caps.max_coins + 1),
      'limit_action',
    );
    // Política `once`: el tope propio no sirve para cobrarlo cada día.
    await expectRejected(
      live.client.rpc('award_points', {
        p_action: 'achievement',
        p_ref: AFTER,
        p_points: prize.points,
        p_coins: prize.coins,
        p_policy: 'daily',
      }),
      'invalid_policy',
    );
  });

  it('en vivo: los secretos sin tope propio se cobran, y el del after no gasta el tope del día', async () => {
    for (const ref of SECRETS) {
      const r = (await ok(claim(live, ref, caps.max_points, 0))) as unknown as AwardResult;
      expect(r.granted, ref).toBe(true);
    }
    // Monedas de logros hasta el tope diario: caben enteras aunque hoy ya se
    // cobrara el del after (sus monedas no cuentan).
    const n = Math.floor(caps.daily_coins / caps.max_coins);
    for (let i = 0; i < n; i++) {
      const r = (await ok(
        claim(live, `relleno-t300-${i}`, 1, caps.max_coins),
      )) as unknown as AwardResult;
      expect(r.granted, `relleno ${i}`).toBe(true);
    }
    await expectRejected(claim(live, 'relleno-t300-de-mas', 1, caps.max_coins), 'limit_daily');
  });

  it('al fusionar lo del invitado: los secretos, el del after y su barco equipado entran sin rechazos', async () => {
    const prize = afterPrize();
    const at = '2026-10-13T03:30:00Z';
    const payload: MergePayload = {
      rewards: [
        { action: 'achievement', ref: AFTER, points: prize.points, coins: prize.coins, at },
        ...SECRETS.map((ref) => ({
          action: 'achievement',
          ref,
          points: caps.max_points,
          coins: caps.max_coins,
          at,
        })),
      ],
      equipped: { ship: AFTER_SHIP },
    };
    const r = (await ok(
      guest.client.rpc('merge_guest', { p_payload: payload as never }),
    )) as unknown as MergeResult;
    expect(r.rejected).toEqual([]);
    expect(r.rewards).toEqual({ granted: SECRETS.length + 1, duplicate: 0 });
    expect(r.equipped).toMatchObject({ ship: AFTER_SHIP });
    expect(await balances(guest)).toEqual({
      points: prize.points + SECRETS.length * caps.max_points,
      coins: prize.coins + SECRETS.length * caps.max_coins,
    });
    // Fusionar otra vez no paga dos veces.
    const again = (await ok(
      guest.client.rpc('merge_guest', { p_payload: payload as never }),
    )) as unknown as MergeResult;
    expect(again.rewards).toEqual({ granted: 0, duplicate: SECRETS.length + 1 });
  });

  it('anon no cobra nada', async () => {
    const prize = afterPrize();
    await expectDenied(
      ctx.anon.rpc('award_points', {
        p_action: 'achievement',
        p_ref: AFTER,
        p_points: prize.points,
        p_coins: prize.coins,
      }),
    );
  });
});
