/**
 * «Entraron» (plan 037 T317, migración 20261022100100) contra el proyecto de
 * desarrollo: sólo el rol admin con segundo factor lee quién entró a una
 * fiesta; cada persona sale una vez (el primer escaneo), con cómo entró
 * (puerta, enlace, a mano) y el nombre de lista o null; también sin lista.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DoorLinkCreated } from '../rpc.ts';
import { context, dropEvents, expectDenied, expectRejected, ok, testEvent } from './context.ts';
import type { Member } from './context.ts';
import { elevateToAal2, testRunId } from './testkit.ts';

const ctx = context();
const POLICY = 'muestra-2026-10-08';
const run = testRunId();
const HOUR = 3600_000;
const events: string[] = [];

let admin: Member;
let editor: Member;
let fan: Member;
let walkIn: Member;
let linked: Member;
let manual: Member;
let party: { id: string; slug: string };
let plain: { id: string; slug: string };

const attendees = (c: Pick<Member, 'client'>['client'], slug: string) =>
  c.rpc('admin_event_attendees', { p_event: slug });

beforeAll(async () => {
  admin = await ctx.member('entraron-admin');
  editor = await ctx.member('entraron-editor');
  fan = await ctx.member('entraron-socio');
  walkIn = await ctx.member('entraron-sin-lista');
  linked = await ctx.member('entraron-enlace');
  manual = await ctx.member('entraron-mano');
  await ok(
    ctx.service.from('staff_roles').insert([
      { user_id: admin.id, role: 'admin' },
      { user_id: editor.id, role: 'editor' },
    ]),
  );
  await elevateToAal2(admin.client);
  await elevateToAal2(editor.client);
  for (const [m, label] of [
    [fan, 'Socio'],
    [walkIn, 'Sin'],
    [linked, 'Enlace'],
    [manual, 'Mano'],
  ] as const) {
    await ok(
      m.client.rpc('save_profile', {
        p_nickname: `Ent ${label} ${run}`.slice(0, 30),
        p_privacy_version: POLICY,
      }),
    );
  }
  const now = Date.now();
  const window = { from: new Date(now - HOUR), until: new Date(now + HOUR) };
  party = await testEvent(ctx, `t317-${run}`, window);
  plain = await testEvent(ctx, `t317-sin-${run}`, window);
  events.push(party.id, plain.id);
  await ok(
    admin.client.rpc('admin_guest_list_settings', {
      p_event: party.slug,
      p_enabled: true,
      p_cap: 10,
      p_closes_at: new Date(now + HOUR).toISOString(),
      p_open: true,
    }),
  );
  await ok(fan.client.rpc('guest_list_join', { p_event: party.slug, p_name: 'Ana y Bea' }));
});

afterAll(async () => {
  await dropEvents(ctx, events);
  await ctx.cleanup();
});

describe('admin_event_attendees', () => {
  it('sin nadie escaneado devuelve una lista vacía', async () => {
    expect(await ok(attendees(admin.client, party.slug))).toEqual([]);
  });

  it('cada persona una vez, con su primer escaneo, cómo entró y el nombre de lista', async () => {
    await ok(editor.client.rpc('staff_stamp', { p_member: fan.id, p_event: party.slug }));
    // Escanear dos veces no duplica ni cambia la hora.
    await ok(editor.client.rpc('staff_stamp', { p_member: fan.id, p_event: party.slug }));
    await ok(editor.client.rpc('staff_stamp', { p_member: walkIn.id, p_event: party.slug }));
    const link = (await ok(
      admin.client.rpc('admin_create_door_link', { p_event: party.slug }),
    )) as unknown as DoorLinkCreated;
    await ok(ctx.anon.rpc('door_link_stamp', { p_token: link.token, p_member: linked.id }));
    await ok(
      admin.client.rpc('staff_stamp', {
        p_member: manual.id,
        p_event: party.slug,
        p_source: 'manual',
        p_reason: 'sin móvil',
      }),
    );

    const rows = await ok(attendees(admin.client, party.slug));
    expect(rows).toHaveLength(4);
    const by = new Map(rows.map((r) => [r.user_id, r]));
    expect(by.get(fan.id)).toMatchObject({
      source: 'door',
      list_name: 'Ana y Bea',
      email: fan.email,
      nickname: `Ent Socio ${run}`.slice(0, 30),
    });
    expect(by.get(walkIn.id)).toMatchObject({ source: 'door', list_name: null });
    expect(by.get(linked.id)).toMatchObject({ source: 'link', list_name: null });
    expect(by.get(manual.id)).toMatchObject({ source: 'manual', list_name: null });
    // El más reciente primero.
    const times = rows.map((r) => Date.parse(r.scanned_at));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('una fiesta sin lista también lo devuelve; otra fiesta no mezcla', async () => {
    await ok(editor.client.rpc('staff_stamp', { p_member: walkIn.id, p_event: plain.slug }));
    const rows = await ok(attendees(admin.client, plain.slug));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ user_id: walkIn.id, list_name: null });
  });

  it('sólo el admin con segundo factor: editor, socio y anon no', async () => {
    await expectRejected(attendees(editor.client, party.slug), 'forbidden');
    await expectRejected(attendees(fan.client, party.slug), 'forbidden');
    await expectDenied(attendees(ctx.anon, party.slug));
  });

  it('una fiesta que no existe', async () => {
    await expectRejected(attendees(admin.client, `no-existe-${run}`), 'unknown_event');
  });
});
