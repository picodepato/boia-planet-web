/**
 * Rankings globales y botellas globales (plan 008, decisiones 8 y 12)
 * contra el proyecto de desarrollo. El proyecto puede tener otras cuentas
 * (otra ejecución a la vez, datos de e2e): las pruebas comparan las suyas
 * entre sí, nunca puestos absolutos.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RankingPage } from '../rpc.ts';
import { context, expectDenied, expectRejected, ok, type Member } from './context.ts';
import { testRunId, type TestUser } from './testkit.ts';

const ctx = context();
const run = testRunId();
const POLICY = 'muestra-2026-10-03';

let top: Member;
let low: Member;
let quiet: TestUser;

const page = async (fn: string, client: Member['client'] | null, args: Record<string, unknown>) =>
  (await ok((client ?? ctx.anon).rpc(fn as 'ranking_points', args))) as unknown as RankingPage;

beforeAll(async () => {
  top = await ctx.member('ranking-alto');
  low = await ctx.member('ranking-bajo');
  // Una cuenta con Carnet y sin puntos ni tiempos (creada sin sesión).
  quiet = await ctx.user('ranking-cero');
  await ok(ctx.service.from('carnets').insert({ user_id: quiet.id, nickname: `Cero ${run}` }));

  await ok(
    top.client.rpc('save_profile', { p_nickname: `Alto ${run}`, p_privacy_version: POLICY }),
  );
  await ok(
    low.client.rpc('save_profile', { p_nickname: `Bajo ${run}`, p_privacy_version: POLICY }),
  );
  await ok(
    top.client.rpc('award_points', {
      p_action: 'mission',
      p_ref: 'mision:fiestera:entrega',
      p_points: 200,
    }),
  );
  await ok(
    low.client.rpc('award_points', { p_action: 'world', p_ref: 'lugar:cala:points', p_points: 20 }),
  );
  await ok(
    top.client.rpc('submit_race_time', { p_circuit: 'el-freu', p_version: 3, p_ms: 61_000 }),
  );
  await ok(
    low.client.rpc('submit_race_time', { p_circuit: 'el-freu', p_version: 3, p_ms: 90_000 }),
  );
});

afterAll(async () => {
  await ctx.cleanup();
});

describe('rankings: puesto, páginas estables y la fila propia', () => {
  for (const [fn, label] of [
    ['ranking_points', 'puntos de siempre'],
    ['ranking_season', 'puntos de la temporada'],
  ] as const) {
    it(`${label}: más puntos, mejor puesto; anon también lo lee`, async () => {
      const all = await page(fn, null, { p_limit: 100 });
      const pos = (id: string) => all.rows.find((r) => r.user_id === id);
      expect(pos(top.id)?.value).toBe(200);
      expect(pos(low.id)?.value).toBe(20);
      expect(pos(quiet.id)?.value).toBe(0);
      expect(pos(top.id)!.position).toBeLessThan(pos(low.id)!.position);
      expect(pos(low.id)!.position).toBeLessThan(pos(quiet.id)!.position);
      expect(all.mine).toBeNull();
      expect(all.rows.every((r) => !r.is_mine)).toBe(true);
      expect(JSON.stringify(all)).not.toContain('@example.test');
    });

    it(`${label}: la fila propia llega aunque quede fuera de la página`, async () => {
      const first = await page(fn, low.client, { p_limit: 1, p_offset: 0 });
      expect(first.rows).toHaveLength(1);
      expect(first.rows[0]!.user_id).not.toBe(low.id);
      expect(first.mine).toMatchObject({ user_id: low.id, value: 20, is_mine: true });
      expect(first.mine!.position).toBeGreaterThan(1);
    });
  }

  it('«Mostrar más»: las páginas recorren a todos sin repetir a nadie', async () => {
    const seen: string[] = [];
    let total = Infinity;
    for (let offset = 0; offset < total; offset += 2) {
      const p = await page('ranking_points', top.client, { p_limit: 2, p_offset: offset });
      total = p.total;
      seen.push(...p.rows.map((r) => r.user_id));
      if (p.rows.length === 0) break;
    }
    expect(seen).toHaveLength(total);
    expect(new Set(seen).size).toBe(total);
    expect(seen).toEqual(expect.arrayContaining([top.id, low.id, quiet.id]));
    const limited = await page('ranking_points', null, { p_limit: 1000 });
    expect(limited.limit).toBe(100);
  });

  it('tiempos por circuito: el mejor de cada cuenta, de menos a más', async () => {
    const all = (await ok(
      ctx.anon.rpc('ranking_race', { p_circuit: 'el-freu', p_limit: 100 }),
    )) as unknown as RankingPage;
    expect(all.version).toBe(3);
    const t = all.rows.find((r) => r.user_id === top.id)!;
    const l = all.rows.find((r) => r.user_id === low.id)!;
    expect(t.value).toBe(61_000);
    expect(l.value).toBe(90_000);
    expect(t.position).toBeLessThan(l.position);
    expect(all.rows.some((r) => r.user_id === quiet.id)).toBe(false);
    const mine = (await ok(
      low.client.rpc('ranking_race', { p_circuit: 'el-freu', p_version: 3, p_limit: 1 }),
    )) as unknown as RankingPage;
    expect(mine.mine).toMatchObject({ user_id: low.id, value: 90_000 });
    await expectRejected(
      ctx.anon.rpc('ranking_race', { p_circuit: 'no-existe' }),
      'unknown_circuit',
    );
  });

  it('rechaza argumentos mal formados y recorta los fuera de rango', async () => {
    const bad = (fn: 'ranking_points' | 'ranking_season', args: Record<string, unknown>) =>
      ctx.anon.rpc(fn, args as never);
    expect((await bad('ranking_points', { p_limit: 'diez' })).error?.code).toBe('22P02');
    expect((await bad('ranking_season', { p_season: 'no-es-un-uuid' })).error?.code).toBe('22P02');
    const clamped = await page('ranking_points', null, { p_limit: 0, p_offset: -5 });
    expect([clamped.limit, clamped.offset]).toEqual([1, 0]);
    const none = await page('ranking_season', null, { p_season: crypto.randomUUID() });
    expect(none.rows.every((r) => r.value === 0)).toBe(true);
  });

  it('un tiempo anulado sale del ranking', async () => {
    await ok(
      ctx.service
        .from('race_times')
        .update({ voided_at: new Date().toISOString(), void_reason: 'prueba' })
        .eq('user_id', low.id),
    );
    const all = (await ok(
      ctx.anon.rpc('ranking_race', { p_circuit: 'el-freu', p_limit: 100 }),
    )) as unknown as RankingPage;
    expect(all.rows.some((r) => r.user_id === low.id)).toBe(false);
  });
});

describe('botellas globales: las 10 más recientes, una por cuenta, con filtro', () => {
  it('echar una botella pide Carnet y la nueva retira la anterior', async () => {
    const noCarnet = await ctx.member('sin-carnet');
    await expectRejected(
      noCarnet.client.rpc('place_bottle', { p_message: 'hola', p_x: 0, p_y: 0 }),
      'carnet_required',
    );
    const b1 = (await ok(
      top.client.rpc('place_bottle', { p_message: `Primera ${run}`, p_x: 10, p_y: 20 }),
    )) as {
      id: string;
    };
    const b2 = (await ok(
      top.client.rpc('place_bottle', { p_message: `Segunda ${run}`, p_x: 30, p_y: 40 }),
    )) as {
      id: string;
    };
    const mine = await ok(top.client.from('bottles').select('id, status').eq('user_id', top.id));
    expect(mine).toEqual(
      expect.arrayContaining([
        { id: b1.id, status: 'retired' },
        { id: b2.id, status: 'active' },
      ]),
    );
  });

  it('el filtro rechaza enlaces, emails, teléfonos y palabras ofensivas, también directo', async () => {
    const put = (msg: string) => low.client.rpc('place_bottle', { p_message: msg, p_x: 0, p_y: 0 });
    await expectRejected(put('mira www.ejemplo.es'), 'text_link');
    await expectRejected(put('escríbeme a yo@ejemplo.es'), 'text_email');
    await expectRejected(put('llámame 612 345 678'), 'text_phone');
    await expectRejected(put('eres un cabrón'), 'text_offensive');
    await expectRejected(put('   '), 'invalid_message');
    await expectRejected(
      low.client.rpc('place_bottle', { p_message: 'hola', p_x: 1e9, p_y: 0 }),
      'invalid_position',
    );
    // Escribir la botella a mano ya no se puede (T94): sólo con place_bottle.
    await expectDenied(
      low.client
        .from('bottles')
        .insert({ user_id: low.id, message: 'https://trampa.io', x: 0, y: 0 }),
    );
    await expectDenied(ctx.anon.rpc('place_bottle', { p_message: 'hola', p_x: 0, p_y: 0 }));
  });

  it('todo el mundo lee como mucho las 10 más recientes activas', async () => {
    await ok(low.client.rpc('place_bottle', { p_message: `De Bajo ${run}`, p_x: 5, p_y: 5 }));
    const list = await ok(ctx.anon.rpc('latest_bottles', { p_limit: 50 }));
    expect(list.length).toBeLessThanOrEqual(10);
    const dates = list.map((b) => Date.parse(b.created_at));
    expect([...dates].sort((x, y) => y - x)).toEqual(dates);
    const ours = list.filter((b) => b.message.endsWith(run));
    expect(ours.map((b) => b.message)).toEqual([`De Bajo ${run}`, `Segunda ${run}`]);
    expect(ours[0]).toMatchObject({ author_nickname: `Bajo ${run}`, is_mine: false });
    const asLow = await ok(low.client.rpc('latest_bottles', {}));
    expect(asLow.find((b) => b.author_id === low.id)?.is_mine).toBe(true);
    const bad = await ctx.anon.rpc('latest_bottles', { p_limit: 'diez' as never });
    expect(bad.error?.code).toBe('22P02');
  });
});
