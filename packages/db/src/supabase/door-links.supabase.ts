/**
 * El enlace de la puerta (plan 034 T307; migración 20261021100100) contra el
 * proyecto de desarrollo:
 *
 * - el Admin crea un enlace por fiesta (el código sale una vez), lo lista sin
 *   el código y lo revoca; crear otro revoca el anterior;
 * - con el enlace y sin cuenta se sella un Carnet una vez: la asistencia
 *   apunta el enlace, el libro da los puntos del sello y queda auditado; una
 *   segunda lectura no da otro sello;
 * - un enlace revocado, equivocado o de una fiesta archivada o cancelada no
 *   vale;
 * - anon (ni un socio) no lee la tabla de enlaces ni usa las RPC del Admin.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DoorLinkCreated, DoorLinkRow, DoorLinkStampResult } from '../rpc.ts';
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
let noCarnet: Member;
let party: { id: string; slug: string };
let points = 0;

const window = () => {
  const now = Date.now();
  return { from: new Date(now - 3600_000), until: new Date(now + 3600_000) };
};

beforeAll(async () => {
  admin = await ctx.member('enlace-admin');
  editor = await ctx.member('enlace-editor');
  fan = await ctx.member('enlace-socio');
  other = await ctx.member('enlace-otro');
  noCarnet = await ctx.member('enlace-sin-carnet');
  await ok(
    ctx.service.from('staff_roles').insert([
      { user_id: admin.id, role: 'admin' },
      { user_id: editor.id, role: 'editor' },
    ]),
  );
  await elevateToAal2(admin.client);
  await elevateToAal2(editor.client);
  for (const [m, nick] of [
    [fan, 'Enlace Socio'],
    [other, 'Enlace Otro'],
  ] as const) {
    await ok(
      m.client.rpc('save_profile', { p_nickname: `${nick} ${run}`, p_privacy_version: POLICY }),
    );
  }
  party = await testEvent(ctx, `t307-${run}`, window());
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

const create = async (slug: string) =>
  (await ok(
    admin.client.rpc('admin_create_door_link', { p_event: slug }),
  )) as unknown as DoorLinkCreated;

const stamp = (token: string, member: string) =>
  ctx.anon.rpc('door_link_stamp', { p_token: token, p_member: member });

const stampsOf = async (userId: string, eventId = party.id) =>
  ok(ctx.service.from('stamps').select('event_id').eq('user_id', userId).eq('event_id', eventId));

describe('el Admin y los enlaces de la puerta', () => {
  it('crea uno por fiesta: el código sale una vez y sólo se guarda su hash', async () => {
    const link = await create(party.slug);
    expect(link.token).toMatch(/^[0-9a-f]{64}$/);
    expect(link).toMatchObject({ event: party.slug, title: `Prueba ${party.slug}` });
    const rows = await ok(
      ctx.service.from('door_links').select('token_hash, revoked_at').eq('event_id', party.id),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.token_hash).not.toBe(link.token);
    expect(rows[0]!.revoked_at).toBeNull();
    const list = (await ok(admin.client.rpc('admin_door_links'))) as unknown as DoorLinkRow[];
    const mine = list.filter((l) => l.event === party.slug);
    expect(mine).toEqual([
      { id: link.id, event: party.slug, title: link.title, created_at: link.created_at },
    ]);
    expect(JSON.stringify(list)).not.toContain(link.token);
  });

  it('crear otro revoca el anterior; revocar deja la fiesta sin enlace', async () => {
    const first = await create(party.slug);
    const second = await create(party.slug);
    expect(second.token).not.toBe(first.token);
    await expectRejected(stamp(first.token, fan.id), 'door_link_invalid');
    const live = await ok(
      ctx.service.from('door_links').select('id').eq('event_id', party.id).is('revoked_at', null),
    );
    expect(live.map((r) => r.id)).toEqual([second.id]);
    const r = await ok(admin.client.rpc('admin_revoke_door_link', { p_event: party.slug }));
    expect(r).toMatchObject({ revoked: true });
    expect(await ok(ctx.anon.rpc('door_link_info', { p_token: second.token }))).toEqual({
      valid: false,
    });
    await expectRejected(stamp(second.token, fan.id), 'door_link_invalid');
    expect(await stampsOf(fan.id)).toEqual([]);
  });

  it('un editor, un socio o anon no gestionan enlaces ni leen la tabla', async () => {
    await expectRejected(
      editor.client.rpc('admin_create_door_link', { p_event: party.slug }),
      'forbidden',
    );
    await expectRejected(fan.client.rpc('admin_door_links'), 'forbidden');
    await expectDenied(ctx.anon.rpc('admin_create_door_link', { p_event: party.slug }));
    await expectDenied(ctx.anon.rpc('admin_revoke_door_link', { p_event: party.slug }));
    await expectDenied(ctx.anon.from('door_links').select('id'));
    await expectDenied(fan.client.from('door_links').select('id'));
    await expectDenied(
      fan.client.from('door_links').insert({ event_id: party.id, token_hash: 'a'.repeat(64) }),
    );
  });
});

describe('sellar con el enlace, sin cuenta', () => {
  let token = '';
  beforeAll(async () => {
    token = (await create(party.slug)).token;
  });

  it('la página sabe de qué fiesta es; un código equivocado, no', async () => {
    expect(await ok(ctx.anon.rpc('door_link_info', { p_token: token }))).toMatchObject({
      valid: true,
      title: `Prueba ${party.slug}`,
    });
    for (const bad of ['', 'nada', 'f'.repeat(64)]) {
      expect(await ok(ctx.anon.rpc('door_link_info', { p_token: bad }))).toEqual({
        valid: false,
      });
      await expectRejected(stamp(bad, fan.id), 'door_link_invalid');
    }
  });

  it('sella una vez: asistencia con el enlace, puntos del sello y auditoría', async () => {
    const r = (await ok(stamp(token, fan.id))) as unknown as DoorLinkStampResult;
    expect(r).toMatchObject({
      granted: true,
      title: `Prueba ${party.slug}`,
      nickname: `Enlace Socio ${run}`,
    });
    // Sólo el apodo: ni la cuenta ni los puntos.
    expect(Object.keys(r).sort()).toEqual(['at', 'granted', 'nickname', 'title']);
    expect(await stampsOf(fan.id)).toHaveLength(1);
    const linkId = (
      await ok(
        ctx.service.from('door_links').select('id').eq('event_id', party.id).is('revoked_at', null),
      )
    )[0]!.id;
    const seen = await ok(
      ctx.service
        .from('event_attendance')
        .select('source, scanned_by, door_link_id')
        .eq('event_id', party.id)
        .eq('user_id', fan.id)
        .single(),
    );
    expect(seen).toEqual({ source: 'door', scanned_by: null, door_link_id: linkId });
    const tx = await ok(
      ctx.service
        .from('ledger_transactions')
        .select('source_ref, points_delta')
        .eq('user_id', fan.id)
        .eq('event_id', party.id)
        .eq('kind', 'stamp'),
    );
    expect(tx).toEqual([{ source_ref: `puerta:${party.slug}`, points_delta: points }]);
    const audit = await ok(
      ctx.service
        .from('audit_log')
        .select('action, actor_id')
        .eq('entity_id', fan.id)
        .eq('action', 'door_link_stamp'),
    );
    expect(audit).toEqual([{ action: 'door_link_stamp', actor_id: null }]);
  });

  it('la segunda lectura del mismo Carnet no da otro sello (y queda auditada)', async () => {
    const r = (await ok(stamp(token, fan.id))) as unknown as DoorLinkStampResult;
    expect(r).toMatchObject({ granted: false, reason: 'already_stamped' });
    expect(await stampsOf(fan.id)).toHaveLength(1);
    const audit = await ok(
      ctx.service
        .from('audit_log')
        .select('action')
        .eq('entity_id', fan.id)
        .eq('action', 'door_link_stamp'),
    );
    expect(audit).toHaveLength(2);
    // Y el lector del equipo, tras el enlace: ya lo tenía.
    const staff = await ok(
      editor.client.rpc('staff_stamp', { p_member: fan.id, p_event: party.slug }),
    );
    expect(staff).toMatchObject({ granted: false, reason: 'already_stamped' });
  });

  it('una cuenta sin Carnet no se sella', async () => {
    await expectRejected(stamp(token, noCarnet.id), 'unknown_member');
  });

  it('una fiesta archivada o cancelada deja el enlace sin valor', async () => {
    for (const [tag, change] of [
      ['archivada', { archived_at: new Date().toISOString() }],
      ['cancelada', { state: 'cancelled' as const }],
    ] as const) {
      const ev = await testEvent(ctx, `t307-${tag}-${run}`, window());
      events.push(ev.id);
      const link = await create(ev.slug);
      await ok(ctx.service.from('events').update(change).eq('id', ev.id));
      expect(await ok(ctx.anon.rpc('door_link_info', { p_token: link.token }))).toEqual({
        valid: false,
      });
      await expectRejected(stamp(link.token, other.id), 'door_link_invalid');
      expect(await stampsOf(other.id, ev.id)).toEqual([]);
    }
  });
});
