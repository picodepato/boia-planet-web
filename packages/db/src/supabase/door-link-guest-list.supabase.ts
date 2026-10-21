/**
 * La lista de la fiesta en el enlace de la puerta (plan 034 T310; migración
 * 20261021300100) contra el proyecto de desarrollo:
 *
 * - con el código del enlace y sin cuenta, la puerta sabe si el Carnet
 *   escaneado está en la lista y con qué nombre; nada de email, apodo ni
 *   fecha de inscripción;
 * - pasada la hora de cierre lo sigue diciendo, con `past_closing`;
 * - una fiesta que no va en lista lo dice (`enabled: false`);
 * - un código revocado o equivocado no vale.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DoorLinkCreated, DoorLinkGuestListResult } from '../rpc.ts';
import { context, dropEvents, expectRejected, ok, testEvent, type Member } from './context.ts';
import { elevateToAal2, testRunId } from './testkit.ts';

const ctx = context();
const POLICY = 'muestra-2026-10-08';
const run = testRunId();
const events: string[] = [];
const HOUR = 3600_000;

let admin: Member;
let fan: Member;
let other: Member;
let party: { id: string; slug: string };
let plain: { id: string; slug: string };
let token = '';
let plainToken = '';

const settings = (closesAt: Date) =>
  ok(
    admin.client.rpc('admin_guest_list_settings', {
      p_event: party.slug,
      p_enabled: true,
      p_cap: 10,
      p_closes_at: closesAt.toISOString(),
      p_open: true,
    }),
  );

const lookup = async (t: string, member: string) =>
  (await ok(
    ctx.anon.rpc('door_link_guest_list', { p_token: t, p_member: member }),
  )) as unknown as DoorLinkGuestListResult;

beforeAll(async () => {
  admin = await ctx.member('enlace-lista-admin');
  fan = await ctx.member('enlace-lista-socio');
  other = await ctx.member('enlace-lista-otro');
  await ok(ctx.service.from('staff_roles').insert([{ user_id: admin.id, role: 'admin' }]));
  await elevateToAal2(admin.client);
  for (const [m, label] of [
    [fan, 'Socio'],
    [other, 'Otro'],
  ] as const) {
    await ok(
      m.client.rpc('save_profile', {
        p_nickname: `EL ${label} ${run}`.slice(0, 30),
        p_privacy_version: POLICY,
      }),
    );
  }
  const now = Date.now();
  const window = { from: new Date(now - HOUR), until: new Date(now + HOUR) };
  party = await testEvent(ctx, `t310-${run}`, window);
  plain = await testEvent(ctx, `t310-sin-${run}`, window);
  events.push(party.id, plain.id);
  await settings(new Date(now + HOUR));
  await ok(fan.client.rpc('guest_list_join', { p_event: party.slug, p_name: 'Ana y Bea' }));
  token = (
    (await ok(
      admin.client.rpc('admin_create_door_link', { p_event: party.slug }),
    )) as unknown as DoorLinkCreated
  ).token;
  plainToken = (
    (await ok(
      admin.client.rpc('admin_create_door_link', { p_event: plain.slug }),
    )) as unknown as DoorLinkCreated
  ).token;
});

afterAll(async () => {
  await dropEvents(ctx, events);
  await ctx.cleanup();
});

describe('la lista en el enlace de la puerta', () => {
  it('dice si está en la lista y con qué nombre; sólo eso', async () => {
    const on = await lookup(token, fan.id);
    expect(on).toMatchObject({
      enabled: true,
      on_list: true,
      list_name: 'Ana y Bea',
      past_closing: false,
    });
    expect(Object.keys(on).sort()).toEqual([
      'closes_at',
      'enabled',
      'list_name',
      'on_list',
      'past_closing',
    ]);
    expect(JSON.stringify(on)).not.toContain('@');
    expect(await lookup(token, other.id)).toMatchObject({
      enabled: true,
      on_list: false,
      list_name: null,
    });
  });

  it('pasada la hora de cierre lo sigue diciendo, con el aviso', async () => {
    await settings(new Date(Date.now() - 60_000));
    expect(await lookup(token, fan.id)).toMatchObject({
      on_list: true,
      list_name: 'Ana y Bea',
      past_closing: true,
    });
  });

  it('una fiesta sin lista lo dice', async () => {
    expect(await lookup(plainToken, fan.id)).toMatchObject({
      enabled: false,
      on_list: false,
      past_closing: false,
    });
  });

  it('un código equivocado o revocado no vale', async () => {
    for (const bad of ['', 'nada', 'f'.repeat(64)]) {
      await expectRejected(
        ctx.anon.rpc('door_link_guest_list', { p_token: bad, p_member: fan.id }),
        'door_link_invalid',
      );
    }
    await ok(admin.client.rpc('admin_revoke_door_link', { p_event: party.slug }));
    await expectRejected(
      ctx.anon.rpc('door_link_guest_list', { p_token: token, p_member: fan.id }),
      'door_link_invalid',
    );
  });
});
