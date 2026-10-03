/**
 * Lo de valor (plan 008, decisiones 4, 6, 7 y 9) contra el proyecto de
 * desarrollo: cada RPC con lo que acepta y lo que rechaza, y que el cliente
 * no escribe las tablas de valor directamente.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  AwardResult,
  BuyResult,
  FindDiscountResult,
  MergePayload,
  MergeResult,
  RaceTimeResult,
  SnapshotResult,
  StampResult,
} from '../rpc.ts';
import {
  context,
  dropEvents,
  expectDenied,
  expectRejected,
  ok,
  testEvent,
  type Member,
} from './context.ts';
import { testRunId } from './testkit.ts';

const ctx = context();
const run = testRunId();
const events: string[] = [];

let m: Member;
let other: Member;

const balances = async (who: Member) => {
  const p = await ok(who.client.from('point_balances').select('points').eq('user_id', who.id));
  const c = await ok(who.client.from('coin_balances').select('coins').eq('user_id', who.id));
  return { points: p[0]?.points ?? 0, coins: c[0]?.coins ?? 0 };
};

beforeAll(async () => {
  m = await ctx.member('valor');
  other = await ctx.member('valor-otra');
});

afterAll(async () => {
  await ctx.cleanup();
  await dropEvents(ctx, events);
});

describe('award_points: acciones conocidas con tope por acción y por día', () => {
  it('concede una vez por origen y política; repetir no da nada', async () => {
    const args = { p_action: 'world', p_ref: 'lugar:cala:points', p_points: 20 };
    const first = (await ok(m.client.rpc('award_points', args))) as unknown as AwardResult;
    expect(first.granted).toBe(true);
    const again = (await ok(m.client.rpc('award_points', args))) as unknown as AwardResult;
    expect(again).toMatchObject({ granted: false, reason: 'duplicate' });
    expect(await balances(m)).toEqual({ points: 20, coins: 0 });
  });

  it('rechaza acciones, orígenes, políticas y cantidades que no son', async () => {
    const rpc = (a: Record<string, unknown>) =>
      m.client.rpc('award_points', {
        p_action: 'world',
        p_ref: 'lugar:tienda:points',
        p_points: 10,
        ...a,
      });
    await expectRejected(rpc({ p_action: 'trampa' }), 'unknown_action');
    await expectRejected(rpc({ p_action: 'stamp', p_ref: 'qr:halloween-2026' }), 'unknown_action');
    await expectRejected(rpc({ p_ref: 'minigame:faro' }), 'invalid_ref');
    await expectRejected(rpc({ p_policy: 'daily' }), 'invalid_policy');
    await expectRejected(rpc({ p_points: 0 }), 'invalid_amount');
    await expectRejected(rpc({ p_points: -5 }), 'invalid_amount');
    await expectRejected(rpc({ p_points: 51 }), 'limit_action');
    await expectRejected(rpc({ p_metadata: [1, 2] }), 'invalid_metadata');
    await expectDenied(
      ctx.anon.rpc('award_points', { p_action: 'world', p_ref: 'lugar:x:points', p_points: 1 }),
    );
  });

  it('un logro regala su cosmético al cobrarse', async () => {
    const r = (await ok(
      m.client.rpc('award_points', { p_action: 'achievement', p_ref: 'carnet', p_points: 300 }),
    )) as unknown as AwardResult;
    expect(r).toMatchObject({ granted: true, cosmetics: ['barco-low-poly'] });
  });
});

describe('cosméticos: comprar con monedas y equipar lo propio', () => {
  it('sin monedas no se compra; con monedas, una vez', async () => {
    await expectRejected(
      m.client.rpc('buy_cosmetic', { p_cosmetic: 'bandera-boia' }),
      'insufficient_coins',
    );
    await ok(
      m.client.rpc('award_points', {
        p_action: 'world',
        p_ref: 'lugar:cofre-1:coins:visita:s1',
        p_coins: 40,
      }),
    );
    const bought = (await ok(
      m.client.rpc('buy_cosmetic', { p_cosmetic: 'bandera-boia' }),
    )) as unknown as BuyResult;
    expect(bought).toMatchObject({ granted: true, coins: -20, balance: 20 });
    const again = (await ok(
      m.client.rpc('buy_cosmetic', { p_cosmetic: 'bandera-boia' }),
    )) as unknown as BuyResult;
    expect(again).toEqual({ granted: false, reason: 'duplicate' });
    expect((await balances(m)).coins).toBe(20);
  });

  it('rechaza lo que no se vende, lo que no existe y la skin sin su barco', async () => {
    await expectRejected(
      m.client.rpc('buy_cosmetic', { p_cosmetic: 'bandera-fiestera' }),
      'not_for_sale',
    );
    await expectRejected(
      m.client.rpc('buy_cosmetic', { p_cosmetic: 'no-existe' }),
      'unknown_cosmetic',
    );
    await expectRejected(
      m.client.rpc('buy_cosmetic', { p_cosmetic: 'skin-cartoon-30-noche' }),
      'needs_ship',
    );
  });

  it('equipa lo propio en su ranura; una skin lleva su barco', async () => {
    expect(
      await ok(m.client.rpc('equip_cosmetic', { p_slot: 'flag', p_cosmetic: 'bandera-boia' })),
    ).toEqual({
      flag: 'bandera-boia',
    });
    await ok(m.client.rpc('equip_cosmetic', { p_slot: 'ship', p_cosmetic: 'barco-low-poly' }));
    await ok(
      m.client.rpc('award_points', {
        p_action: 'world',
        p_ref: 'lugar:cofre-2:coins:visita:s1',
        p_coins: 40,
      }),
    );
    await ok(m.client.rpc('buy_cosmetic', { p_cosmetic: 'skin-arcilla-noche' }));
    expect(
      await ok(
        m.client.rpc('equip_cosmetic', { p_slot: 'skin', p_cosmetic: 'skin-arcilla-noche' }),
      ),
    ).toEqual({ flag: 'bandera-boia', ship: 'barco-arcilla', skin: 'skin-arcilla-noche' });
    // Otro barco quita la skin del anterior.
    expect(
      await ok(m.client.rpc('equip_cosmetic', { p_slot: 'ship', p_cosmetic: 'barco-low-poly' })),
    ).toEqual({
      flag: 'bandera-boia',
      ship: 'barco-low-poly',
    });
    const pub = await ok(
      ctx.anon.from('equipped_cosmetics').select('slot, cosmetic_id').eq('user_id', m.id),
    );
    expect(pub).toHaveLength(2);
  });

  it('rechaza ranuras, cosméticos ajenos a la ranura y lo que no se tiene', async () => {
    await expectRejected(
      m.client.rpc('equip_cosmetic', { p_slot: 'casco', p_cosmetic: 'x' }),
      'invalid_slot',
    );
    await expectRejected(
      m.client.rpc('equip_cosmetic', { p_slot: 'flag', p_cosmetic: 'estela-naranja' }),
      'wrong_slot',
    );
    await expectRejected(
      m.client.rpc('equip_cosmetic', { p_slot: 'wake', p_cosmetic: 'estela-naranja' }),
      'not_owned',
    );
    await expectRejected(
      m.client.rpc('equip_cosmetic', { p_slot: 'flag', p_cosmetic: 'nada' }),
      'unknown_cosmetic',
    );
    expect(await ok(m.client.rpc('equip_cosmetic', { p_slot: 'flag' }))).toEqual({
      ship: 'barco-low-poly',
    });
  });
});

describe('claim_stamp: el sello de la fiesta por QR', () => {
  let open: { id: string; slug: string; code: string };
  let closed: { id: string; slug: string; code: string };

  beforeAll(async () => {
    const now = Date.now();
    open = await testEvent(ctx, `t86-${run}-abierta`, {
      from: new Date(now - 3600_000),
      until: new Date(now + 3600_000),
    });
    closed = await testEvent(ctx, `t86-${run}-cerrada`, {
      from: new Date(now - 48 * 3600_000),
      until: new Date(now - 24 * 3600_000),
    });
    events.push(open.id, closed.id);
  });

  it('con el código y dentro de la ventana da el sello y 50 puntos, una vez', async () => {
    const before = (await balances(m)).points;
    const r = (await ok(
      m.client.rpc('claim_stamp', { p_event: open.slug, p_code: open.code.toLowerCase() }),
    )) as unknown as StampResult;
    expect(r).toMatchObject({ granted: true, event: open.slug, points: 50 });
    expect((await balances(m)).points).toBe(before + 50);
    const stamps = await ok(
      ctx.anon.from('stamps').select('event_id, purchase_id').eq('user_id', m.id),
    );
    expect(stamps).toEqual([{ event_id: open.id, purchase_id: null }]);
    const again = (await ok(
      m.client.rpc('claim_stamp', { p_event: open.slug, p_code: open.code }),
    )) as unknown as StampResult;
    expect(again).toEqual({ granted: false, reason: 'already_stamped', event: open.slug });
  });

  it('rechaza otro código, fuera de hora y una fiesta que no existe', async () => {
    await expectRejected(
      other.client.rpc('claim_stamp', { p_event: open.slug, p_code: 'MAL000' }),
      'invalid_code',
    );
    await expectRejected(
      other.client.rpc('claim_stamp', { p_event: closed.slug, p_code: closed.code }),
      'outside_window',
    );
    await expectRejected(
      other.client.rpc('claim_stamp', { p_event: 'no-existe', p_code: 'X' }),
      'unknown_event',
    );
    await expectDenied(ctx.anon.rpc('claim_stamp', { p_event: open.slug, p_code: open.code }));
  });
});

describe('submit_race_time: el mejor tiempo por circuito y versión', () => {
  const race = (ms: number, circuit = 'el-freu', version = 3) =>
    m.client.rpc('submit_race_time', { p_circuit: circuit, p_version: version, p_ms: ms });

  it('guarda el mejor y cuenta los intentos', async () => {
    expect((await ok(race(70_000))) as unknown as RaceTimeResult).toMatchObject({
      best: true,
      best_ms: 70_000,
      attempts: 1,
    });
    expect((await ok(race(80_000))) as unknown as RaceTimeResult).toMatchObject({
      best: false,
      best_ms: 70_000,
      attempts: 2,
    });
    expect((await ok(race(65_000))) as unknown as RaceTimeResult).toMatchObject({
      best: true,
      best_ms: 65_000,
      attempts: 3,
    });
  });

  it('rechaza tiempos imposibles y circuitos o versiones que no existen', async () => {
    await expectRejected(race(44_999), 'too_fast');
    await expectRejected(race(300_001), 'too_slow');
    await expectRejected(race(0), 'invalid_time');
    await expectRejected(race(70_000, 'no-existe'), 'unknown_circuit');
    await expectRejected(race(70_000, 'el-freu', 2), 'unknown_circuit');
    await expectDenied(
      ctx.anon.rpc('submit_race_time', { p_circuit: 'el-freu', p_version: 3, p_ms: 70_000 }),
    );
  });
});

describe('descuentos: encontrar y usar una vez', () => {
  it('encuentra una vez y usa una vez', async () => {
    const f = (await ok(
      m.client.rpc('find_discount', { p_discount: 'dto-fiestera' }),
    )) as unknown as FindDiscountResult;
    expect(f).toMatchObject({ first: true, used_at: null });
    const f2 = (await ok(
      m.client.rpc('find_discount', { p_discount: 'dto-fiestera' }),
    )) as unknown as FindDiscountResult;
    expect(f2.first).toBe(false);
    expect(await ok(m.client.rpc('use_discount', { p_discount: 'dto-fiestera' }))).toMatchObject({
      used: true,
    });
    await expectRejected(
      m.client.rpc('use_discount', { p_discount: 'dto-fiestera' }),
      'discount_used',
    );
  });

  it('rechaza lo desconocido, lo no encontrado y el de otra fiesta', async () => {
    await expectRejected(
      m.client.rpc('find_discount', { p_discount: 'no-existe' }),
      'unknown_discount',
    );
    await expectRejected(
      m.client.rpc('use_discount', { p_discount: 'dto-naufrago' }),
      'discount_not_found',
    );
    await ok(m.client.rpc('find_discount', { p_discount: 'dto-naufrago' }));
    await expectRejected(
      m.client.rpc('use_discount', { p_discount: 'dto-naufrago', p_event: 'nochevieja-2026' }),
      'wrong_event',
    );
    const mine = await ok(
      m.client.from('user_discounts').select('discount_id').eq('user_id', m.id),
    );
    expect(mine.map((d) => d.discount_id).sort()).toEqual(['dto-fiestera', 'dto-naufrago']);
    expect(
      await ok(other.client.from('user_discounts').select('discount_id').eq('user_id', m.id)),
    ).toEqual([]);
  });
});

describe('save_snapshot: la copia del resto del documento', () => {
  it('guarda, versiona y avisa del conflicto', async () => {
    const s1 = (await ok(
      m.client.rpc('save_snapshot', { p_data: { casa: 1 }, p_base_version: 0 }),
    )) as unknown as SnapshotResult;
    expect(s1.version).toBe(1);
    await expectRejected(
      m.client.rpc('save_snapshot', { p_data: { casa: 2 }, p_base_version: 0 }),
      'snapshot_conflict',
    );
    const s2 = (await ok(
      m.client.rpc('save_snapshot', { p_data: { casa: 2 }, p_base_version: 1 }),
    )) as unknown as SnapshotResult;
    expect(s2.version).toBe(2);
    const s3 = (await ok(
      m.client.rpc('save_snapshot', { p_data: { casa: 3 } }),
    )) as unknown as SnapshotResult;
    expect(s3.version).toBe(3);
    expect(await ok(m.client.from('account_snapshots').select('data').eq('user_id', m.id))).toEqual(
      [{ data: { casa: 3 } }],
    );
  });

  it('rechaza lo que no es un objeto o pasa de 512 KB; nadie más la lee', async () => {
    await expectRejected(m.client.rpc('save_snapshot', { p_data: [1] }), 'invalid_snapshot');
    await expectRejected(
      m.client.rpc('save_snapshot', { p_data: { grande: 'x'.repeat(530_000) } }),
      'snapshot_too_large',
    );
    expect(
      await ok(other.client.from('account_snapshots').select('user_id').eq('user_id', m.id)),
    ).toEqual([]);
    await expectDenied(ctx.anon.from('account_snapshots').select('user_id'));
  });
});

describe('merge_guest: el progreso del invitado entra en la cuenta, validado uno a uno', () => {
  const payload: MergePayload = {
    rewards: [
      { action: 'world', ref: 'lugar:cala:points', points: 20, at: '2026-09-20T10:00:00Z' },
      { action: 'world', ref: 'lugar:cala:points', points: 20, at: '2026-09-20T10:00:00Z' },
      {
        action: 'world',
        ref: 'lugar:cofre-1:coins:visita:g1',
        coins: 40,
        at: '2026-09-20T11:00:00Z',
      },
      {
        action: 'minigame',
        ref: 'minigame:faro',
        points: 150,
        coins: 50,
        policy: 'daily',
        at: '2026-09-21T11:00:00Z',
      },
      {
        action: 'minigame',
        ref: 'minigame:faro',
        points: 150,
        coins: 50,
        policy: 'daily',
        at: '2026-09-22T11:00:00Z',
      },
      { action: 'trampa', ref: 'lugar:cala:points', points: 9999 },
    ],
    discounts: [{ id: 'dto-fiestera', found_at: '2026-09-20T12:00:00Z', used: true }],
    cosmetics: ['bandera-boia'],
    equipped: { flag: 'bandera-boia', ship: 'barco-acuarela' },
    times: [
      { circuit: 'el-freu', version: 3, ms: 71_234.4, at: '2026-09-20T13:00:00Z' },
      { circuit: 'el-freu', version: 3, ms: 1_000 },
    ],
    snapshot: { casa: { muebles: 3 } },
  };

  it('fusiona lo válido, cuenta lo repetido y lista lo rechazado', async () => {
    const r = (await ok(
      other.client.rpc('merge_guest', { p_payload: payload as never }),
    )) as unknown as MergeResult;
    expect(r.rewards).toEqual({ granted: 4, duplicate: 1 });
    expect(r.cosmetics).toEqual({ granted: 1, duplicate: 0 });
    expect(r.discounts).toEqual({ found: 1, used: 1 });
    expect(r.times).toEqual({ accepted: 1 });
    expect(r.equipped).toEqual({ flag: 'bandera-boia', ship: 'barco-acuarela' });
    expect(r.snapshot).toBe('saved');
    expect(r.rejected).toEqual(
      expect.arrayContaining([
        { kind: 'reward', ref: 'lugar:cala:points', reason: 'unknown_action' },
        { kind: 'time', ref: 'el-freu:v3', reason: 'too_fast' },
      ]),
    );
    expect(r.rejected).toHaveLength(2);
    // 20 + 150 + 150 puntos; 40 + 50 + 50 monedas, menos 20 de la bandera.
    expect(await balances(other)).toEqual({ points: 320, coins: 120 });
    const t = await ok(other.client.from('race_times').select('best_ms').eq('user_id', other.id));
    expect(t).toEqual([{ best_ms: 71_234 }]);
  });

  it('fusionar otra vez no duplica nada y no pisa la copia', async () => {
    const r = (await ok(
      other.client.rpc('merge_guest', { p_payload: payload as never }),
    )) as unknown as MergeResult;
    expect(r.rewards).toEqual({ granted: 0, duplicate: 5 });
    expect(r.cosmetics).toEqual({ granted: 0, duplicate: 1 });
    expect(r.discounts).toEqual({ found: 0, used: 0 });
    expect(r.snapshot).toBe('kept');
    expect(await balances(other)).toEqual({ points: 320, coins: 120 });
  });

  it('el tope diario cuenta por el día en que ocurrió', async () => {
    const day = '2026-09-25T12:00:00+02:00';
    const rewards = Array.from({ length: 26 }, (_, i) => ({
      action: 'world',
      ref: `lugar:resto-${i}:coins:visita:g2`,
      coins: 50,
      at: day,
    }));
    const r = (await ok(
      other.client.rpc('merge_guest', { p_payload: { rewards } }),
    )) as unknown as MergeResult;
    // 1200 monedas al día en `world`: 24 de 50.
    expect(r.rewards.granted).toBe(24);
    expect(r.rejected.map((x) => x.reason)).toEqual(['limit_daily', 'limit_daily']);
  });

  it('rechaza lo que no tiene la forma de la fusión', async () => {
    await expectRejected(
      other.client.rpc('merge_guest', { p_payload: [] as never }),
      'invalid_payload',
    );
    await expectRejected(
      other.client.rpc('merge_guest', { p_payload: { trampa: 1 } }),
      'invalid_payload',
    );
    await expectRejected(
      other.client.rpc('merge_guest', { p_payload: { rewards: {} } }),
      'invalid_payload',
    );
    await expectDenied(ctx.anon.rpc('merge_guest', { p_payload: {} }));
  });
});

describe('RLS: el cliente no escribe las tablas de valor', () => {
  it('ni el libro, ni tiempos, ni cosméticos, ni sellos, ni catálogos', async () => {
    await expectDenied(
      m.client.from('ledger_transactions').insert({
        id: crypto.randomUUID(),
        user_id: m.id,
        kind: 'world_reward',
        points_delta: 1000,
        source_ref: 'trampa',
      }),
    );
    await expectDenied(
      m.client
        .from('race_times')
        .insert({ user_id: m.id, circuit_id: 'el-freu', circuit_version: 3, best_ms: 1 }),
    );
    await expectDenied(m.client.from('race_times').update({ best_ms: 1 }).eq('user_id', m.id));
    await expectDenied(
      m.client
        .from('equipped_cosmetics')
        .insert({ user_id: m.id, slot: 'wake', cosmetic_id: 'estela-rayo' }),
    );
    await expectDenied(
      m.client.from('user_discounts').update({ used_at: null }).eq('user_id', m.id),
    );
    await expectDenied(
      m.client.from('point_actions').update({ max_points: 100000 }).eq('action', 'world'),
    );
    await expectDenied(
      m.client.from('cosmetics').update({ price_coins: 1 }).eq('id', 'barco-cartoon-30'),
    );
    await expectDenied(m.client.from('account_snapshots').insert({ user_id: m.id, data: {} }));
    await expectDenied(
      ctx.anon
        .from('race_times')
        .insert({ user_id: m.id, circuit_id: 'el-freu', circuit_version: 3, best_ms: 1 }),
    );
    await expectDenied(ctx.anon.from('discounts').select('id'));
  });
});
