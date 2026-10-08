/**
 * Ficha del evento y código común de la ticketera (plan 019 T215, decisiones
 * 5, 6 y 7) contra el proyecto de desarrollo (migración 20261008100100):
 * los campos nuevos de `events` y `ticketing_settings` con sus RPC.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { context, dropEvents, expectDenied, ok, type Member } from './context.ts';
import { elevateToAal2, testRunId } from './testkit.ts';

const ctx = context();
const run = testRunId();
const events: string[] = [];

let admin: Member;
let visitor: Member;

beforeAll(async () => {
  admin = await ctx.member('t215-admin');
  visitor = await ctx.member('t215-visita');
  await ok(ctx.service.from('staff_roles').insert({ user_id: admin.id, role: 'admin' }));
  await elevateToAal2(admin.client);
});

afterAll(async () => {
  await ctx.service.from('ticketing_settings').update({ common_discount_code: null }).eq('id', true);
  await dropEvents(ctx, events);
  await ctx.cleanup();
});

describe('campos de la ficha del evento', () => {
  it('el equipo guarda lugar sin anunciar, «Solo en puerta» y su precio', async () => {
    const ev = await ok(
      admin.client
        .from('events')
        .insert({
          slug: `t215-${run}`,
          title: `Prueba ${run}`,
          created_by: admin.id,
          place_announced: false,
          price_cents: 1000,
          door_only: true,
          door_price_cents: 500,
          ticket_provider: 'Ticketera de prueba',
        })
        .select('id, place_announced, door_only, door_price_cents, price_cents')
        .single(),
    );
    events.push(ev.id);
    expect(ev).toMatchObject({
      place_announced: false,
      door_only: true,
      door_price_cents: 500,
      price_cents: 1000,
    });
  });

  it('un precio en puerta sin «Solo en puerta» o negativo no vale', async () => {
    for (const row of [
      { door_only: false, door_price_cents: 500 },
      { door_only: true, door_price_cents: -1 },
      { price_cents: -100 },
    ]) {
      const r = await admin.client
        .from('events')
        .insert({ slug: `t215-mal-${run}`, title: 'Mal', created_by: admin.id, ...row });
      expect(r.error?.code).toBe('23514');
    }
  });
});

describe('código común de la ticketera', () => {
  it('sólo un admin lo fija; la visita ni lo lee ni lo fija', async () => {
    await expectDenied(
      visitor.client.rpc('admin_set_common_discount_code', { p_code: 'NOPE' }),
    );
    const set = await ok(
      admin.client.rpc('admin_set_common_discount_code', { p_code: ' boiaticket ', p_reason: 'T215' }),
    );
    expect(set).toMatchObject({ common_discount_code: 'BOIATICKET' });
    const row = await ok(
      admin.client.from('ticketing_settings').select('common_discount_code').single(),
    );
    expect(row.common_discount_code).toBe('BOIATICKET');
    const seen = await ok(visitor.client.from('ticketing_settings').select('common_discount_code'));
    expect(seen).toEqual([]);
  });

  it('llega sólo a quien encontró ese descuento; vacío, null', async () => {
    await ok(admin.client.rpc('admin_set_common_discount_code', { p_code: 'BOIATICKET' }));
    const before = await visitor.client.rpc('discount_code_for', { p_discount: 'dto-naufrago' });
    expect(before.error).toBeNull();
    expect(before.data).toBeNull();
    await ok(visitor.client.rpc('find_discount', { p_discount: 'dto-naufrago' }));
    expect(
      await ok(visitor.client.rpc('discount_code_for', { p_discount: 'dto-naufrago' })),
    ).toBe('BOIATICKET');
    await ok(admin.client.rpc('admin_set_common_discount_code', { p_code: '' }));
    const { data, error } = await visitor.client.rpc('discount_code_for', {
      p_discount: 'dto-naufrago',
    });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });
});
