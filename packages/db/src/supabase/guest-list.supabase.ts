/**
 * La lista de una fiesta (plan 034 T308, migración 20261021200100) contra el
 * proyecto de desarrollo:
 *
 * - quien tiene Carnet se apunta una vez; apuntarse otra vez devuelve la
 *   inscripción de antes sin tocarla; sin cuenta o sin Carnet, no;
 * - llena → `full`; el interruptor cerrado o pasada la hora → `closed`, para
 *   apuntarse y para borrarse; borrarse libera el sitio y se puede volver;
 * - nadie lee las inscripciones de otro ni las escribe a mano;
 * - el Admin lee la lista con apodo, email y si entró por la puerta, borra y
 *   cambia los ajustes; la puerta pregunta si un Carnet está en la lista.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { GuestListJoinResult, GuestListStatusResult } from '../rpc.ts';
import {
  context,
  dropEvents,
  expectDenied,
  expectRejected,
  ok,
  testEvent,
  type Member,
} from './context.ts';
import { elevateToAal2, testRunId } from './testkit.ts';

const ctx = context();
const POLICY = 'muestra-2026-10-08';
const run = testRunId();
const events: string[] = [];

let admin: Member;
let editor: Member;
let fan: Member;
let other: Member;
let third: Member;
let late: Member;
let noCarnet: Member;
let party: { id: string; slug: string };
let plain: { id: string; slug: string };

const HOUR = 3600_000;
const nick = (label: string) => `Lista ${label} ${run}`.slice(0, 30);

async function settings(over: { cap?: number; open?: boolean; closesAt?: Date | null } = {}) {
  return ok(
    admin.client.rpc('admin_guest_list_settings', {
      p_event: party.slug,
      p_enabled: true,
      p_cap: over.cap ?? 2,
      p_closes_at: (over.closesAt === undefined
        ? new Date(Date.now() + HOUR)
        : over.closesAt
      )?.toISOString() as string,
      p_open: over.open ?? true,
    }),
  );
}

const join = (m: Member, name?: string) =>
  m.client.rpc('guest_list_join', { p_event: party.slug, ...(name ? { p_name: name } : {}) });
const leave = (m: Member) => m.client.rpc('guest_list_leave', { p_event: party.slug });

beforeAll(async () => {
  admin = await ctx.member('lista-admin');
  editor = await ctx.member('lista-editor');
  fan = await ctx.member('lista-socio');
  other = await ctx.member('lista-otro');
  third = await ctx.member('lista-tercero');
  late = await ctx.member('lista-tarde');
  noCarnet = await ctx.member('lista-sin-carnet');
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
    [other, 'Otro'],
    [third, 'Tercero'],
    [late, 'Tarde'],
  ] as const) {
    await ok(m.client.rpc('save_profile', { p_nickname: nick(label), p_privacy_version: POLICY }));
  }
  const now = Date.now();
  party = await testEvent(ctx, `t308-${run}`, {
    from: new Date(now - HOUR),
    until: new Date(now + HOUR),
  });
  plain = await testEvent(ctx, `t308-sin-${run}`, {
    from: new Date(now - HOUR),
    until: new Date(now + HOUR),
  });
  events.push(party.id, plain.id);
  await settings();
});

afterAll(async () => {
  await dropEvents(ctx, events);
  await ctx.cleanup();
});

describe('apuntarse', () => {
  it('el estado lo lee cualquiera, sin contador', async () => {
    const s = (await ok(
      ctx.anon.rpc('guest_list_status', { p_event: party.slug }),
    )) as unknown as GuestListStatusResult;
    expect(s).toMatchObject({ enabled: true, cap: 2, open: true, closed: false, full: false });
    expect(s.mine).toBeNull();
    expect(s).not.toHaveProperty('count');
  });

  it('una vez; la segunda devuelve la primera tal cual', async () => {
    const first = (await ok(join(fan, '  Ana   y  Bea '))) as unknown as GuestListJoinResult;
    expect(first).toMatchObject({ created: true, list_name: 'Ana y Bea' });
    const again = (await ok(join(fan, 'Otro nombre'))) as unknown as GuestListJoinResult;
    expect(again).toEqual({ ...first, created: false });
    const s = (await ok(
      fan.client.rpc('guest_list_status', { p_event: party.slug }),
    )) as unknown as GuestListStatusResult;
    expect(s.mine).toEqual({ list_name: 'Ana y Bea', created_at: first.created_at });
  });

  it('sin nombre, el apodo del Carnet', async () => {
    const r = (await ok(join(other))) as unknown as GuestListJoinResult;
    expect(r).toMatchObject({ created: true, list_name: nick('Otro') });
  });

  it('sin cuenta no; sin Carnet, tampoco; sin modo lista o con un nombre de 1 letra, tampoco', async () => {
    await expectDenied(ctx.anon.rpc('guest_list_join', { p_event: party.slug }));
    await expectRejected(join(noCarnet), 'carnet_required');
    await expectRejected(
      third.client.rpc('guest_list_join', { p_event: plain.slug }),
      'not_enabled',
    );
    await expectRejected(join(third, 'A'), 'invalid_input');
  });

  it('llena → full, y el estado lo dice', async () => {
    await expectRejected(join(third), 'full');
    const s = (await ok(
      third.client.rpc('guest_list_status', { p_event: party.slug }),
    )) as unknown as GuestListStatusResult;
    expect(s).toMatchObject({ full: true, mine: null });
  });

  it('nadie lee las inscripciones de otro ni las escribe a mano', async () => {
    const own = await ok(fan.client.from('guest_list_signups').select('user_id, list_name'));
    expect(own).toEqual([{ user_id: fan.id, list_name: 'Ana y Bea' }]);
    expect(await ok(third.client.from('guest_list_signups').select('user_id'))).toEqual([]);
    await expectDenied(
      third.client
        .from('guest_list_signups')
        .insert({ event_id: party.id, user_id: third.id, list_name: 'Cuela' }),
    );
    await expectDenied(
      admin.client.from('event_guest_lists').update({ cap: 500 }).eq('event_id', party.id),
    );
  });

  it('borrarse libera el sitio y se puede volver', async () => {
    expect(await ok(leave(fan))).toMatchObject({ removed: true });
    expect(await ok(join(third))).toMatchObject({ created: true });
    await expectRejected(join(fan), 'full');
    await settings({ cap: 3 });
    const back = (await ok(join(fan, 'Ana otra vez'))) as unknown as GuestListJoinResult;
    expect(back).toMatchObject({ created: true, list_name: 'Ana otra vez' });
  });
});

describe('cerrada', () => {
  it('el interruptor cerrado: ni apuntarse ni borrarse', async () => {
    await settings({ cap: 10, open: false });
    await expectRejected(join(late), 'closed');
    await expectRejected(leave(fan), 'closed');
    // Ya apuntado: se le devuelve su inscripción aunque esté cerrada.
    expect(await ok(join(fan))).toMatchObject({ created: false, list_name: 'Ana otra vez' });
  });

  it('pasada la hora de cierre: ni apuntarse ni borrarse', async () => {
    await settings({ cap: 10, closesAt: new Date(Date.now() - 60_000) });
    const s = (await ok(
      late.client.rpc('guest_list_status', { p_event: party.slug }),
    )) as unknown as GuestListStatusResult;
    expect(s).toMatchObject({ open: true, past_closing: true, closed: true });
    await expectRejected(join(late), 'closed');
    await expectRejected(leave(fan), 'closed');
  });
});

describe('la puerta y el Admin', () => {
  it('la puerta: en la lista, con qué nombre y si pasó la hora', async () => {
    const on = await ok(
      editor.client.rpc('guest_list_door', { p_member: fan.id, p_event: party.slug }),
    );
    expect(on).toMatchObject({
      enabled: true,
      on_list: true,
      list_name: 'Ana otra vez',
      past_closing: true,
    });
    const off = await ok(
      editor.client.rpc('guest_list_door', { p_member: late.id, p_event: party.slug }),
    );
    expect(off).toMatchObject({ on_list: false, list_name: null });
    await expectRejected(
      fan.client.rpc('guest_list_door', { p_member: fan.id, p_event: party.slug }),
      'forbidden',
    );
  });

  it('el Admin ve la lista con apodo, email y si entró por la puerta', async () => {
    await ok(editor.client.rpc('staff_stamp', { p_member: fan.id, p_event: party.slug }));
    const rows = await ok(admin.client.rpc('admin_guest_list', { p_event: party.slug }));
    const by = new Map(rows.map((r) => [r.user_id, r]));
    expect(rows).toHaveLength(3);
    expect(by.get(fan.id)).toMatchObject({
      list_name: 'Ana otra vez',
      nickname: nick('Socio'),
      email: fan.email,
      attended: true,
    });
    expect(by.get(fan.id)!.attended_at).not.toBeNull();
    expect(by.get(other.id)).toMatchObject({ email: other.email, attended: false });
    const st = await ok(admin.client.rpc('admin_guest_list_status', { p_event: party.slug }));
    expect(st).toMatchObject({ count: 3 });
    await expectRejected(
      editor.client.rpc('admin_guest_list', { p_event: party.slug }),
      'forbidden',
    );
    await expectRejected(
      fan.client.rpc('admin_guest_list_status', { p_event: party.slug }),
      'forbidden',
    );
  });

  it('el Admin borra una inscripción (aunque esté cerrada) y queda en la auditoría', async () => {
    expect(
      await ok(
        admin.client.rpc('admin_guest_list_remove', {
          p_event: party.slug,
          p_member: other.id,
          p_reason: 'duplicada',
        }),
      ),
    ).toMatchObject({ removed: true });
    const audit = await ok(
      ctx.service
        .from('audit_log')
        .select('action, reason')
        .eq('entity_id', other.id)
        .eq('action', 'guest_list_remove'),
    );
    expect(audit).toEqual([{ action: 'guest_list_remove', reason: 'duplicada' }]);
    await expectRejected(
      fan.client.rpc('admin_guest_list_remove', { p_event: party.slug, p_member: third.id }),
      'forbidden',
    );
  });

  it('ajustes no válidos: rechazo; un socio no los cambia', async () => {
    await expectRejected(
      admin.client.rpc('admin_guest_list_settings', {
        p_event: party.slug,
        p_enabled: true,
        p_cap: 0,
        p_closes_at: null as unknown as string,
        p_open: true,
      }),
      'invalid_input',
    );
    await expectRejected(
      fan.client.rpc('admin_guest_list_settings', {
        p_event: party.slug,
        p_enabled: false,
        p_cap: 5,
        p_closes_at: null as unknown as string,
        p_open: true,
      }),
      'forbidden',
    );
  });

  it('Halloween de muestra va en lista: tope 100, cierra a las 22:30 del 31', async () => {
    const ev = await ok(
      ctx.service.from('events').select('id').eq('slug', 'halloween-2026').maybeSingle(),
    ).catch(() => null);
    if (!ev) return;
    const gl = await ok(
      ctx.service
        .from('event_guest_lists')
        .select('enabled, cap, closes_at')
        .eq('event_id', ev.id)
        .single(),
    );
    expect(gl.enabled).toBe(true);
    expect(gl.cap).toBe(100);
    expect(new Date(gl.closes_at!).toISOString()).toBe('2026-10-31T21:30:00.000Z');
  });
});
