/**
 * La puerta de la fiesta (plan 019 T218, decisión 11; migración
 * 20261008100300) contra el proyecto de desarrollo:
 *
 * - el lector del equipo (editor o más, con segundo factor) sella un Carnet
 *   y apunta que vino; una segunda lectura no da otro sello;
 * - el Admin sella a mano con motivo; un editor no;
 * - un socio, la visita sin cuenta o un editor sin segundo factor, no;
 * - una cuenta sin Carnet o una fiesta que no existe, tampoco;
 * - el sello por QR del socio (`claim_stamp`) sigue igual y cuenta como el mismo sello.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { StaffStampResult } from '../rpc.ts';
import { context, dropEvents, expectDenied, expectRejected, ok, testEvent, type Member } from './context.ts';
import { elevateToAal2, testRunId } from './testkit.ts';

const ctx = context();
const POLICY = 'muestra-2026-10-08';
const run = testRunId();
const events: string[] = [];

let editor: Member;
let admin: Member;
let guest: Member;
let fan: Member;
let other: Member;
let noCarnet: Member;
let party: { id: string; slug: string; code: string };
let points = 0;

beforeAll(async () => {
  editor = await ctx.member('puerta-editor');
  admin = await ctx.member('puerta-admin');
  guest = await ctx.member('puerta-sin-2fa');
  fan = await ctx.member('puerta-socio');
  other = await ctx.member('puerta-otro');
  noCarnet = await ctx.member('puerta-sin-carnet');
  await ok(
    ctx.service.from('staff_roles').insert([
      { user_id: editor.id, role: 'editor' },
      { user_id: admin.id, role: 'admin' },
      { user_id: guest.id, role: 'editor' },
    ]),
  );
  await elevateToAal2(editor.client);
  await elevateToAal2(admin.client);
  for (const [m, nick] of [
    [fan, 'Puerta Socio'],
    [other, 'Puerta Otro'],
  ] as const) {
    await ok(
      m.client.rpc('save_profile', { p_nickname: `${nick} ${run}`, p_privacy_version: POLICY }),
    );
  }
  const now = Date.now();
  party = await testEvent(ctx, `t218-${run}`, {
    from: new Date(now - 3600_000),
    until: new Date(now + 3600_000),
  });
  events.push(party.id);
  const action = await ok(
    ctx.service.from('point_actions').select('max_points').eq('action', 'stamp').single(),
  );
  points = Number(action.max_points);
});

afterAll(async () => {
  await ctx.cleanup();
  await dropEvents(ctx, events);
});

const stampsOf = async (userId: string) =>
  ok(
    ctx.service
      .from('stamps')
      .select('event_id, revoked_at')
      .eq('user_id', userId)
      .eq('event_id', party.id),
  );

describe('staff_stamp en la puerta', () => {
  it('el lector sella el Carnet, apunta la asistencia y da los puntos del sello', async () => {
    const r = (await ok(
      editor.client.rpc('staff_stamp', { p_member: fan.id, p_event: party.slug }),
    )) as unknown as StaffStampResult;
    expect(r).toMatchObject({
      granted: true,
      event: party.slug,
      member: fan.id,
      nickname: `Puerta Socio ${run}`,
      points,
    });
    expect(await stampsOf(fan.id)).toHaveLength(1);
    const seen = await ok(
      ctx.service
        .from('event_attendance')
        .select('source, scanned_by')
        .eq('event_id', party.id)
        .eq('user_id', fan.id)
        .single(),
    );
    expect(seen).toEqual({ source: 'door', scanned_by: editor.id });
    const tx = await ok(
      ctx.service
        .from('ledger_transactions')
        .select('source_ref, points_delta, created_by')
        .eq('id', r.tx_id!)
        .single(),
    );
    expect(tx).toEqual({ source_ref: `puerta:${party.slug}`, points_delta: points, created_by: editor.id });
  });

  it('una segunda lectura no da otro sello; el socio ve su asistencia y no la de otros', async () => {
    const r = (await ok(
      editor.client.rpc('staff_stamp', { p_member: fan.id, p_event: party.slug }),
    )) as unknown as StaffStampResult;
    expect(r).toMatchObject({ granted: false, reason: 'already_stamped', points: 0 });
    expect(await stampsOf(fan.id)).toHaveLength(1);
    const own = await ok(fan.client.from('event_attendance').select('user_id'));
    expect(own.map((x) => x.user_id)).toEqual([fan.id]);
    const others = await ok(other.client.from('event_attendance').select('user_id'));
    expect(others).toEqual([]);
  });

  it('el QR de la fiesta tras la puerta: ya tiene el sello', async () => {
    const r = await ok(fan.client.rpc('claim_stamp', { p_event: party.slug, p_code: party.code }));
    expect(r).toMatchObject({ granted: false, reason: 'already_stamped' });
  });

  it('sin rol, sin segundo factor o sin cuenta: nada', async () => {
    await expectRejected(
      fan.client.rpc('staff_stamp', { p_member: other.id, p_event: party.slug }),
      'forbidden',
    );
    await expectRejected(
      guest.client.rpc('staff_stamp', { p_member: other.id, p_event: party.slug }),
      'forbidden',
    );
    await expectDenied(ctx.anon.rpc('staff_stamp', { p_member: other.id, p_event: party.slug }));
    expect(await stampsOf(other.id)).toEqual([]);
  });

  it('sin Carnet, una fiesta que no existe o un origen raro: rechazo', async () => {
    await expectRejected(
      editor.client.rpc('staff_stamp', { p_member: noCarnet.id, p_event: party.slug }),
      'unknown_member',
    );
    await expectRejected(
      editor.client.rpc('staff_stamp', { p_member: other.id, p_event: `no-${run}` }),
      'unknown_event',
    );
    await expectRejected(
      editor.client.rpc('staff_stamp', {
        p_member: other.id,
        p_event: party.slug,
        p_source: 'qr',
      }),
      'invalid_input',
    );
  });

  it('nadie escribe la asistencia a mano', async () => {
    await expectDenied(
      editor.client
        .from('event_attendance')
        .insert({ event_id: party.id, user_id: other.id, source: 'door' }),
    );
  });
});

describe('staff_stamp a mano desde el Admin', () => {
  it('un editor no sella a mano; el admin sí, con motivo', async () => {
    const args = { p_member: other.id, p_event: party.slug, p_source: 'manual' };
    await expectRejected(editor.client.rpc('staff_stamp', { ...args, p_reason: 'vino' }), 'forbidden');
    await expectRejected(admin.client.rpc('staff_stamp', args), 'reason_required');
    const r = (await ok(
      admin.client.rpc('staff_stamp', { ...args, p_reason: 'vino sin móvil' }),
    )) as unknown as StaffStampResult;
    expect(r).toMatchObject({ granted: true, member: other.id, points });
    expect(await stampsOf(other.id)).toHaveLength(1);
    const seen = await ok(
      ctx.service
        .from('event_attendance')
        .select('source')
        .eq('event_id', party.id)
        .eq('user_id', other.id)
        .single(),
    );
    expect(seen.source).toBe('manual');
    const audit = await ok(
      ctx.service
        .from('audit_log')
        .select('action, reason')
        .eq('entity_id', other.id)
        .eq('action', 'staff_stamp:manual'),
    );
    expect(audit).toEqual([{ action: 'staff_stamp:manual', reason: 'vino sin móvil' }]);
  });
});
