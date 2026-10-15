/**
 * Contadores propios del embudo (plan 032 T301, migración
 * 20261015101100_funnel_counts) contra el proyecto de desarrollo:
 *
 * - anon suma los cinco pasos del navegador y nada más: ni texto libre ni
 *   `purchase_confirmed` (ese es del webhook de la ticketera);
 * - con la analítica apagada en el Admin no se suma nada;
 * - ni anon ni un socio leen los números ni la tabla; un admin sí.
 *
 * Suma de verdad en los contadores de hoy de dev (cuentan uno por paso):
 * es el precio de probar contra la base.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FunnelCountsResult } from '../rpc.ts';
import { context, expectDenied, expectRejected, ok, type Member } from './context.ts';
import { elevateToAal2 } from './testkit.ts';

const ctx = context();
const STEPS = [
  'landing_view',
  'explore_start',
  'discount_found',
  'tickets_panel_open',
  'ticket_click_out',
] as const;

let admin: Member;
let fan: Member;
let analyticsBefore = false;

async function setAnalytics(on: boolean): Promise<void> {
  await ok(
    ctx.service.from('site_settings').update({ analytics_enabled: on }).eq('id', true).select(),
  );
}

async function counts(): Promise<FunnelCountsResult> {
  return (await ok(
    admin.client.rpc('admin_funnel_counts', { p_days: 7 }),
  )) as unknown as FunnelCountsResult;
}

function todayCount(r: FunnelCountsResult, event: string): number {
  return r.rows.find((row) => row.day === r.today && row.event === event)?.count ?? 0;
}

beforeAll(async () => {
  admin = await ctx.member('t301-admin');
  fan = await ctx.member('t301-socio');
  await ok(ctx.service.from('staff_roles').insert({ user_id: admin.id, role: 'admin' }));
  await elevateToAal2(admin.client);
  const s = await ok(ctx.service.from('site_settings').select('analytics_enabled').single());
  analyticsBefore = s.analytics_enabled;
});

afterAll(async () => {
  await setAnalytics(analyticsBefore);
  await ctx.cleanup();
});

describe('funnel_hit: anon suma sólo los pasos permitidos', () => {
  it('encendida, cada paso suma uno; el admin lo ve en el día de hoy', async () => {
    await setAnalytics(true);
    const before = await counts();
    for (const step of STEPS) {
      expect(await ok(ctx.anon.rpc('funnel_hit', { p_event: step }))).toBe(true);
    }
    const after = await counts();
    for (const step of STEPS) {
      // ≥: otra ejecución contra dev puede sumar a la vez.
      expect(todayCount(after, step) - todayCount(before, step), step).toBeGreaterThanOrEqual(1);
    }
    expect(after.rows.every((r) => r.day <= after.today)).toBe(true);
  });

  it('un paso que no existe, texto libre o la compra: rechazados', async () => {
    await setAnalytics(true);
    for (const bad of ['purchase_confirmed', 'landing_view; drop', '', 'LANDING_VIEW']) {
      await expectRejected(ctx.anon.rpc('funnel_hit', { p_event: bad }), 'unknown_event');
    }
    await expectRejected(fan.client.rpc('funnel_hit', { p_event: 'otro' }), 'unknown_event');
  });

  it('apagada: no suma nada', async () => {
    await setAnalytics(false);
    const before = await counts();
    expect(await ok(ctx.anon.rpc('funnel_hit', { p_event: 'landing_view' }))).toBe(false);
    const after = await counts();
    expect(todayCount(after, 'landing_view')).toBe(todayCount(before, 'landing_view'));
  });
});

describe('admin_funnel_counts: sólo un admin lee', () => {
  it('anon y un socio no; la tabla no se alcanza por la Data API', async () => {
    await expectDenied(ctx.anon.rpc('admin_funnel_counts', { p_days: 30 }));
    await expectDenied(fan.client.rpc('admin_funnel_counts', { p_days: 30 }));
    for (const client of [ctx.anon, fan.client]) {
      const { data, error } = await client.from('funnel_counts' as never).select('*');
      expect(data).toBeNull();
      expect(error).not.toBeNull();
    }
  });

  it('el admin lee como mucho 90 días, hoy incluido', async () => {
    const r = (await ok(
      admin.client.rpc('admin_funnel_counts', { p_days: 1000 }),
    )) as unknown as FunnelCountsResult;
    expect(r.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const oldest = new Date(`${r.today}T00:00:00Z`);
    oldest.setUTCDate(oldest.getUTCDate() - 89);
    const min = oldest.toISOString().slice(0, 10);
    expect(r.rows.every((row) => row.day >= min && row.day <= r.today)).toBe(true);
  });
});
