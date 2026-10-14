/**
 * «¿Eres uno de estos artistas?»: la solicitud para reclamar una ficha que
 * revisa el Admin (plan 031 T297, migración 20261015100400) contra el
 * proyecto de desarrollo:
 *
 * - un Carnet de artista sin ficha pide una ficha libre; sólo para sí mismo,
 *   una pendiente por Carnet y por ficha; la puede retirar;
 * - pedir NUNCA une: sólo el Admin (con segundo factor) aprueba (une, con
 *   auditoría `claim_request_approved`) o rechaza (sigue siendo de artista);
 * - una ficha reclamada por otra vía cierra sus solicitudes pendientes;
 * - sin cuenta no se ve ni se toca nada.
 */
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AdminArtistClaimRequest, ArtistClaimRequest } from '../rpc.ts';
import { context, expectDenied, expectRejected, ok, type Member } from './context.ts';
import { connectDev } from './dev.ts';
import { elevateToAal2, testRunId } from './testkit.ts';

const ctx = context();
const POLICY = 'muestra-2026-10-15';
const run = testRunId();
const nick = (s: string) => `${s} ${run}`;
const A = `prueba-t297-a-${run}`;
const B = `prueba-t297-b-${run}`;
const C = `prueba-t297-c-${run}`;
const D = `prueba-t297-d-${run}`;

let pgc: pg.Client;
let admin: Member;
let ana: Member; // Artista que pide A, la retira, pide B y el Admin aprueba.
let beto: Member; // Artista que pide C y el Admin rechaza.
let caro: Member; // Artista que pide D; D la reclama otro por otra vía.
let plain: Member; // Socio que no es artista.

const profileOf = async (userId: string) =>
  ok(
    ctx.anon.from('carnets').select('is_artist, artist_profile_id').eq('user_id', userId).single(),
  );

const ask = (m: Member, profile: string, name = 'Prueba T297') =>
  m.client.rpc('request_artist_profile', { p_profile: profile, p_name: name });

const request = async (m: Member, profile: string, name = 'Prueba T297') =>
  (await ok(ask(m, profile, name))) as unknown as ArtistClaimRequest;

const mine = async (m: Member) =>
  (await ok(m.client.rpc('my_artist_claim_request'))) as unknown as ArtistClaimRequest | null;

const pending = async () =>
  (await ok(
    admin.client.rpc('admin_artist_claim_requests'),
  )) as unknown as AdminArtistClaimRequest[];

const statusOf = async (id: string) =>
  (
    await pgc.query<{ status: string }>(
      'select status from private.artist_claim_requests where id = $1',
      [id],
    )
  ).rows[0]?.status;

beforeAll(async () => {
  pgc = await connectDev(ctx.env);
  admin = await ctx.member('admin-solicitud');
  await ok(ctx.service.from('staff_roles').insert({ user_id: admin.id, role: 'admin' }));
  ana = await ctx.member('solicitud-ana');
  beto = await ctx.member('solicitud-beto');
  caro = await ctx.member('solicitud-caro');
  plain = await ctx.member('solicitud-socio');
  for (const [m, n] of [
    [ana, 'Sol Ana'],
    [beto, 'Sol Beto'],
    [caro, 'Sol Caro'],
    [plain, 'Sol Socio'],
  ] as const) {
    await ok(m.client.rpc('save_profile', { p_nickname: nick(n), p_privacy_version: POLICY }));
  }
  // Los tres artistas: como si hubieran creado el Carnet con el enlace general.
  await ok(
    ctx.service
      .from('carnets')
      .update({ is_artist: true })
      .in('user_id', [ana.id, beto.id, caro.id]),
  );
});

afterAll(async () => {
  await pgc?.query('delete from private.artist_claim_requests where profile_id = any($1)', [
    [A, B, C, D],
  ]);
  await pgc?.end();
  await ctx.cleanup();
});

describe('sin cuenta', () => {
  it('anon no ve ni toca las solicitudes', async () => {
    await expectDenied(ctx.anon.rpc('request_artist_profile', { p_profile: A, p_name: 'x' }));
    await expectDenied(ctx.anon.rpc('my_artist_claim_request'));
    await expectDenied(ctx.anon.rpc('cancel_artist_claim_request'));
    await expectDenied(ctx.anon.rpc('admin_artist_claim_requests'));
    await expectDenied(
      ctx.anon.rpc('admin_decide_artist_claim_request', {
        p_request: '00000000-0000-0000-0000-000000000000',
        p_approve: true,
      }),
    );
  });
});

describe('el artista pide, ve y retira la suya', () => {
  it('pedir no une; una pendiente por Carnet; sólo la suya; la retira', async () => {
    expect(await mine(ana)).toBeNull();
    const req = await request(ana, A, 'Alba Prueba');
    expect(req).toMatchObject({ profile_id: A, profile_name: 'Alba Prueba', status: 'pending' });
    // Pedir NUNCA une.
    expect(await profileOf(ana.id)).toEqual({ is_artist: true, artist_profile_id: null });
    expect(await mine(ana)).toMatchObject({ id: req.id, profile_id: A });
    // Otro Carnet no ve la de Ana.
    expect(await mine(beto)).toBeNull();
    // Una pendiente por Carnet.
    await expectRejected(ask(ana, B), 'request_pending');
    // Una pendiente por ficha.
    await expectRejected(ask(beto, A), 'profile_requested');
    // Quien no es artista no pide.
    await expectRejected(ask(plain, B), 'artist_required');
    // Retirar la de otro no existe: Beto retira (nada) y la de Ana sigue.
    expect(await ok(beto.client.rpc('cancel_artist_claim_request'))).toEqual({ cancelled: false });
    expect(await statusOf(req.id)).toBe('pending');
    // Socios sin rol de Admin no ven la lista ni deciden.
    await expectDenied(ana.client.rpc('admin_artist_claim_requests'));
    await expectDenied(
      ana.client.rpc('admin_decide_artist_claim_request', { p_request: req.id, p_approve: true }),
    );
    // Ana la retira.
    expect(await ok(ana.client.rpc('cancel_artist_claim_request'))).toMatchObject({
      cancelled: true,
      id: req.id,
    });
    expect(await statusOf(req.id)).toBe('cancelled');
    expect(await mine(ana)).toBeNull();
    const audit = await pgc.query<{ action: string; actor_id: string }>(
      'select action, actor_id from public.audit_log where entity_id = $1 order by id',
      [req.id],
    );
    expect(audit.rows).toEqual([
      { action: 'claim_request_created', actor_id: ana.id },
      { action: 'claim_request_cancelled', actor_id: ana.id },
    ]);
  });
});

describe('el Admin decide', () => {
  it('sin segundo factor, no', async () => {
    const req = await request(ana, B, 'Bea Prueba');
    await expectDenied(admin.client.rpc('admin_artist_claim_requests'));
    await expectDenied(
      admin.client.rpc('admin_decide_artist_claim_request', { p_request: req.id, p_approve: true }),
    );
    expect(await statusOf(req.id)).toBe('pending');
  });

  it('aprobar une el Carnet a la ficha, con auditoría claim_request_approved', async () => {
    await elevateToAal2(admin.client);
    const list = await pending();
    const row = list.find((r) => r.profile_id === B);
    expect(row).toMatchObject({
      user_id: ana.id,
      nickname: nick('Sol Ana'),
      email: ana.email,
      profile_name: 'Bea Prueba',
    });
    expect(row?.created_at).toBeTruthy();
    const res = await ok(
      admin.client.rpc('admin_decide_artist_claim_request', {
        p_request: row!.id,
        p_approve: true,
        p_reason: 'prueba T297',
      }),
    );
    expect(res).toMatchObject({ status: 'approved', user_id: ana.id, profile_id: B });
    expect(await profileOf(ana.id)).toEqual({ is_artist: true, artist_profile_id: B });
    expect(await statusOf(row!.id)).toBe('approved');
    const audit = await ok(
      admin.client
        .from('audit_log')
        .select('actor_id, action, new_value')
        .eq('entity_id', ana.id)
        .eq('action', 'claim_request_approved'),
    );
    expect(audit).toEqual([
      expect.objectContaining({
        actor_id: admin.id,
        new_value: { is_artist: true, artist_profile_id: B },
      }),
    ]);
    // Ya decidida: no se decide otra vez; ya no sale en la lista.
    await expectRejected(
      admin.client.rpc('admin_decide_artist_claim_request', {
        p_request: row!.id,
        p_approve: false,
      }),
      'request_closed',
    );
    expect((await pending()).some((r) => r.id === row!.id)).toBe(false);
    // Unido: ya no pide más.
    await expectRejected(ask(ana, C), 'already_joined');
    // Una ficha reclamada no se pide.
    await expectRejected(ask(beto, B), 'profile_claimed');
  });

  it('rechazar la cierra y el Carnet sigue de artista, sin ficha', async () => {
    const req = await request(beto, C, 'Ceci Prueba');
    await ok(
      admin.client.rpc('admin_decide_artist_claim_request', {
        p_request: req.id,
        p_approve: false,
        p_reason: 'prueba T297',
      }),
    );
    expect(await statusOf(req.id)).toBe('rejected');
    expect(await profileOf(beto.id)).toEqual({ is_artist: true, artist_profile_id: null });
    expect(await mine(beto)).toBeNull();
    const audit = await pgc.query<{ action: string; actor_id: string }>(
      "select action, actor_id from public.audit_log where entity_id = $1 and action = 'claim_request_rejected'",
      [req.id],
    );
    expect(audit.rows).toEqual([{ action: 'claim_request_rejected', actor_id: admin.id }]);
    // Puede pedir otra vez (la ficha vuelve a estar libre de solicitudes).
    const again = await request(beto, C, 'Ceci Prueba');
    await ok(beto.client.rpc('cancel_artist_claim_request'));
    expect(await statusOf(again.id)).toBe('cancelled');
    await expectRejected(
      admin.client.rpc('admin_decide_artist_claim_request', {
        p_request: '00000000-0000-0000-0000-000000000000',
        p_approve: true,
      }),
      'unknown_request',
    );
  });

  it('una ficha reclamada por otra vía cierra sus solicitudes pendientes', async () => {
    const req = await request(caro, D, 'Dani Prueba');
    // El Admin une a Beto a D a mano (la vía 3).
    await ok(
      admin.client.rpc('admin_join_artist_profile', {
        p_user: beto.id,
        p_profile: D,
        p_reason: 'prueba T297',
      }),
    );
    expect(await statusOf(req.id)).toBe('closed');
    expect(await mine(caro)).toBeNull();
    expect(await profileOf(caro.id)).toEqual({ is_artist: true, artist_profile_id: null });
    await expectRejected(
      admin.client.rpc('admin_decide_artist_claim_request', { p_request: req.id, p_approve: true }),
      'request_closed',
    );
  });
});
