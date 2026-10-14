/**
 * «Tickets todavía no disponibles» (plan 030 T292) contra el proyecto de
 * desarrollo (migración 20261014100400): `events.tickets_not_yet`. El equipo
 * lo marca y lo quita (abrir la venta); cualquiera lo lee en un evento
 * publicado; una visita no lo cambia.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { context, dropEvents, ok, testEvent, type Member } from './context.ts';
import { elevateToAal2, testRunId } from './testkit.ts';

const ctx = context();
const run = testRunId();
const events: string[] = [];

let admin: Member;
let visitor: Member;
let event: { id: string; slug: string };

beforeAll(async () => {
  admin = await ctx.member('t292-admin');
  visitor = await ctx.member('t292-visita');
  await ok(ctx.service.from('staff_roles').insert({ user_id: admin.id, role: 'admin' }));
  await elevateToAal2(admin.client);
  const now = Date.now();
  event = await testEvent(ctx, `t292-${run}`, {
    from: new Date(now + 86_400_000),
    until: new Date(now + 2 * 86_400_000),
  });
  events.push(event.id);
});

afterAll(async () => {
  await dropEvents(ctx, events);
  await ctx.cleanup();
});

const notYet = async () =>
  (await ok(ctx.service.from('events').select('tickets_not_yet').eq('id', event.id).single()))
    .tickets_not_yet;

describe('events.tickets_not_yet', () => {
  it('por defecto, las entradas se venden (false)', async () => {
    expect(await notYet()).toBe(false);
  });

  it('el equipo lo marca y lo quita para abrir la venta', async () => {
    await ok(admin.client.from('events').update({ tickets_not_yet: true }).eq('id', event.id));
    expect(await notYet()).toBe(true);
    await ok(admin.client.from('events').update({ tickets_not_yet: false }).eq('id', event.id));
    expect(await notYet()).toBe(false);
  });

  it('la visita y el anónimo lo leen; la visita no lo cambia', async () => {
    await ok(admin.client.from('events').update({ tickets_not_yet: true }).eq('id', event.id));
    const seen = await ok(
      ctx.anon.from('events').select('tickets_not_yet').eq('id', event.id).single(),
    );
    expect(seen.tickets_not_yet).toBe(true);
    const changed = await ok(
      visitor.client
        .from('events')
        .update({ tickets_not_yet: false })
        .eq('id', event.id)
        .select('id'),
    );
    expect(changed).toEqual([]);
    expect(await notYet()).toBe(true);
  });

  it('la muestra: ALL DAY BOIA y Nochevieja, todavía no; Halloween, sí se vende', async () => {
    const rows = await ok(
      ctx.service
        .from('events')
        .select('slug, tickets_not_yet')
        .in('slug', ['halloween-2026', 'sonido-2026', 'nochevieja-2026'])
        .eq('is_sample', true),
    );
    const by = new Map(rows.map((r) => [r.slug, r.tickets_not_yet]));
    if (by.has('sonido-2026')) expect(by.get('sonido-2026')).toBe(true);
    if (by.has('nochevieja-2026')) expect(by.get('nochevieja-2026')).toBe(true);
    if (by.has('halloween-2026')) expect(by.get('halloween-2026')).toBe(false);
  });
});
