/**
 * Límite del acceso completo al Admin e interruptor de la analítica (plan
 * 019 T223, decisión 17, migración 20261008100600) contra el proyecto de
 * desarrollo:
 *
 * - como mucho FULL_ACCESS_LIMIT personas con rol admin u owner: la base de
 *   datos rechaza una más (ni service_role puede), los editores no cuentan y
 *   cambiar de admin a owner no suma;
 * - la analítica la enciende y apaga sólo un admin, y la lee cualquiera.
 *
 * El proyecto puede tener ya su equipo de verdad: la prueba llena sólo los
 * huecos que queden hasta el límite con cuentas de prueba.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FULL_ACCESS_LIMIT, type FullAccessResult } from '../rpc.ts';
import { context, expectDenied, expectRejected, ok, type Member } from './context.ts';
import { elevateToAal2 } from './testkit.ts';

const ctx = context();

let admin: Member;
let visitor: Member;
let analyticsBefore = false;

async function fullAccessCount(): Promise<number> {
  const rows = await ok(
    ctx.service.from('staff_roles').select('user_id').in('role', ['admin', 'owner']),
  );
  return rows.length;
}

beforeAll(async () => {
  admin = await ctx.member('t223-admin');
  visitor = await ctx.member('t223-visita');
  await ok(ctx.service.from('staff_roles').insert({ user_id: admin.id, role: 'admin' }));
  await elevateToAal2(admin.client);
  const s = await ok(ctx.service.from('site_settings').select('analytics_enabled').single());
  analyticsBefore = s.analytics_enabled;
});

afterAll(async () => {
  await ctx.service
    .from('site_settings')
    .update({ analytics_enabled: analyticsBefore })
    .eq('id', true);
  await ctx.cleanup();
});

describe('acceso completo: como mucho FULL_ACCESS_LIMIT', () => {
  it('la base de datos rechaza a uno más; los editores no cuentan', async () => {
    // Llena los huecos hasta el límite.
    let n = await fullAccessCount();
    expect(n).toBeLessThanOrEqual(FULL_ACCESS_LIMIT);
    while (n < FULL_ACCESS_LIMIT) {
      const filler = await ctx.user(`t223-lleno-${n}`);
      await ok(ctx.service.from('staff_roles').insert({ user_id: filler.id, role: 'admin' }));
      n += 1;
    }
    expect(await fullAccessCount()).toBe(FULL_ACCESS_LIMIT);

    // Un cuarto admin u owner: no.
    const extra = await ctx.user('t223-cuarto');
    for (const role of ['admin', 'owner'] as const) {
      await expectRejected(
        ctx.service.from('staff_roles').insert({ user_id: extra.id, role }),
        'full_access_limit',
      );
    }
    // Como editor sí entra, pero no sube a admin.
    await ok(ctx.service.from('staff_roles').insert({ user_id: extra.id, role: 'editor' }));
    await expectRejected(
      ctx.service.from('staff_roles').update({ role: 'admin' }).eq('user_id', extra.id),
      'full_access_limit',
    );
    expect(await fullAccessCount()).toBe(FULL_ACCESS_LIMIT);

    // El Admin ve la cuenta y el límite.
    const seen = (await ok(admin.client.rpc('admin_full_access'))) as unknown as FullAccessResult;
    expect(seen).toEqual({ count: FULL_ACCESS_LIMIT, limit: FULL_ACCESS_LIMIT });
    await expectDenied(visitor.client.rpc('admin_full_access'));
  });

  it('pasar de admin a owner no suma a nadie', async () => {
    await ok(ctx.service.from('staff_roles').update({ role: 'owner' }).eq('user_id', admin.id));
    await ok(ctx.service.from('staff_roles').update({ role: 'admin' }).eq('user_id', admin.id));
  });
});

describe('analítica de visitas', () => {
  it('sólo un admin la enciende o la apaga; cualquiera la lee', async () => {
    await expectDenied(visitor.client.rpc('admin_set_analytics', { p_enabled: true }));
    await expectDenied(
      ctx.anon.from('site_settings').update({ analytics_enabled: true }).eq('id', true),
    );
    expect(
      await ok(admin.client.rpc('admin_set_analytics', { p_enabled: true, p_reason: 'T223' })),
    ).toMatchObject({ analytics_enabled: true });
    const on = await ok(ctx.anon.from('site_settings').select('analytics_enabled').single());
    expect(on.analytics_enabled).toBe(true);
    await ok(admin.client.rpc('admin_set_analytics', { p_enabled: false }));
    const off = await ok(visitor.client.from('site_settings').select('analytics_enabled').single());
    expect(off.analytics_enabled).toBe(false);
  });
});
