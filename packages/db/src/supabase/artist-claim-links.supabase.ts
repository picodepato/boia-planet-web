/**
 * El enlace personal para reclamar una ficha de artista (plan 031 T296,
 * migración 20261015100300) contra el proyecto de desarrollo:
 *
 * - sólo el Admin (con segundo factor) crea códigos; se guardan con hash;
 * - un código bueno une el Carnet al crearlo y al entrar con uno que ya
 *   existía (auditoría `claim_link`, marca artista) y se gasta;
 * - gastado, caducado, sustituido por otro o equivocado: no une;
 * - una ficha reclamada no recibe enlace.
 */
import { createHash } from 'node:crypto';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ArtistClaimInfo, ArtistClaimLinkCreated, ArtistClaimLinkRow } from '../rpc.ts';
import { context, expectDenied, expectRejected, ok, type Member } from './context.ts';
import { connectDev } from './dev.ts';
import { elevateToAal2, testRunId } from './testkit.ts';

const ctx = context();
const POLICY = 'muestra-2026-10-15';
const run = testRunId();
const nick = (s: string) => `${s} ${run}`;
const A = `prueba-t296-a-${run}`;
const B = `prueba-t296-b-${run}`;
const C = `prueba-t296-c-${run}`;
const D = `prueba-t296-d-${run}`;

let pgc: pg.Client;
let admin: Member;
let fresh: Member; // Crea su Carnet después de abrir el enlace.
let existing: Member; // Ya tenía Carnet y entra.
let other: Member;

const create = async (profile: string, name = 'Prueba T296') =>
  (await ok(
    admin.client.rpc('admin_create_artist_claim_link', {
      p_profile: profile,
      p_name: name,
      p_reason: 'prueba T296',
    }),
  )) as unknown as ArtistClaimLinkCreated;

const info = async (code: string) =>
  (await ok(ctx.anon.rpc('artist_claim_info', { p_code: code }))) as unknown as ArtistClaimInfo;

const profileOf = async (userId: string) =>
  ok(
    ctx.anon.from('carnets').select('is_artist, artist_profile_id').eq('user_id', userId).single(),
  );

beforeAll(async () => {
  pgc = await connectDev(ctx.env);
  admin = await ctx.member('admin-reclamar');
  await ok(ctx.service.from('staff_roles').insert({ user_id: admin.id, role: 'admin' }));
  fresh = await ctx.member('reclamar-nuevo');
  existing = await ctx.member('reclamar-existe');
  other = await ctx.member('reclamar-otro');
  for (const [m, n] of [
    [existing, 'Recl Exist'],
    [other, 'Recl Otro'],
  ] as const) {
    await ok(m.client.rpc('save_profile', { p_nickname: nick(n), p_privacy_version: POLICY }));
  }
});

afterAll(async () => {
  await pgc?.query('delete from private.artist_claim_links where profile_id = any($1)', [
    [A, B, C, D],
  ]);
  await pgc?.end();
  await ctx.cleanup();
});

describe('admin_create_artist_claim_link', () => {
  it('sin cuenta, un socio o el Admin sin TOTP: no; tampoco se lista', async () => {
    const args = { p_profile: A, p_name: 'Prueba' };
    await expectDenied(ctx.anon.rpc('admin_create_artist_claim_link', args));
    await expectDenied(other.client.rpc('admin_create_artist_claim_link', args));
    await expectDenied(admin.client.rpc('admin_create_artist_claim_link', args));
    await expectDenied(ctx.anon.rpc('admin_artist_claim_links'));
    await expectDenied(other.client.rpc('admin_artist_claim_links'));
    // Nadie de fuera lee la tabla ni llama a la lógica privada directamente.
    await expectDenied(ctx.anon.rpc('claim_artist_profile', { p_code: 'x' }));
  });

  it('el Admin crea un código: se ve una vez y sólo se guarda su hash', async () => {
    await elevateToAal2(admin.client);
    const link = await create(A, 'Alba Prueba');
    expect(link.code).toMatch(/^[0-9a-f]{64}$/);
    expect(link.profile_id).toBe(A);
    const days = (Date.parse(link.expires_at) - Date.parse(link.created_at)) / 86_400_000;
    expect(Math.round(days)).toBe(30);
    const { rows } = await pgc.query<{ code_hash: string }>(
      'select code_hash from private.artist_claim_links where profile_id = $1',
      [A],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.code_hash).toBe(createHash('sha256').update(link.code).digest('hex'));
    expect(rows[0]!.code_hash).not.toContain(link.code);
    const list = (await ok(
      admin.client.rpc('admin_artist_claim_links'),
    )) as unknown as ArtistClaimLinkRow[];
    const row = list.find((r) => r.profile_id === A);
    expect(row).toMatchObject({ profile_id: A, spent_at: null });
    expect(JSON.stringify(list)).not.toContain(link.code);
    // La auditoría nunca guarda el código.
    const audit = await ok(
      admin.client
        .from('audit_log')
        .select('action, new_value')
        .eq('entity_id', A)
        .eq('action', 'create_artist_claim_link'),
    );
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit)).not.toContain(link.code);
    expect(await info(link.code)).toEqual({
      valid: true,
      profile_id: A,
      profile_name: 'Alba Prueba',
    });
    expect(await info('0'.repeat(64))).toEqual({ valid: false });
  });
});

describe('claim_artist_profile', () => {
  it('al crear el Carnet: el código bueno une, marca artista, audita y se gasta', async () => {
    const link = await create(B, 'Bea Prueba');
    // Sin Carnet todavía: no hay nada que unir (el código no se gasta).
    await expectRejected(
      fresh.client.rpc('claim_artist_profile', { p_code: link.code }),
      'unknown_member',
    );
    expect(await info(link.code)).toMatchObject({ valid: true });
    await ok(
      fresh.client.rpc('save_profile', {
        p_nickname: nick('Recl Nuevo'),
        p_privacy_version: POLICY,
      }),
    );
    const res = (await ok(fresh.client.rpc('claim_artist_profile', { p_code: link.code }))) as {
      artist_profile_id: string;
      profile_name: string;
      joined: boolean;
    };
    expect(res).toMatchObject({ artist_profile_id: B, profile_name: 'Bea Prueba', joined: true });
    expect(await profileOf(fresh.id)).toEqual({ is_artist: true, artist_profile_id: B });
    const audit = await ok(
      admin.client
        .from('audit_log')
        .select('actor_id, action, new_value')
        .eq('entity_id', fresh.id)
        .eq('action', 'claim_link'),
    );
    expect(audit).toEqual([
      expect.objectContaining({
        actor_id: fresh.id,
        new_value: { is_artist: true, artist_profile_id: B },
      }),
    ]);
    // Gastado: ya no vale, ni para otro.
    expect(await info(link.code)).toEqual({ valid: false });
    await expectRejected(
      other.client.rpc('claim_artist_profile', { p_code: link.code }),
      'claim_invalid',
    );
    expect(await profileOf(other.id)).toEqual({ is_artist: false, artist_profile_id: null });
    // Una ficha reclamada no recibe enlace.
    await expectRejected(
      admin.client.rpc('admin_create_artist_claim_link', { p_profile: B, p_name: 'Bea' }),
      'profile_claimed',
    );
  });

  it('al entrar con un Carnet que ya existía: une igual', async () => {
    const link = await create(C, 'Ceci Prueba');
    const res = (await ok(existing.client.rpc('claim_artist_profile', { p_code: link.code }))) as {
      joined: boolean;
    };
    expect(res.joined).toBe(true);
    expect(await profileOf(existing.id)).toEqual({ is_artist: true, artist_profile_id: C });
  });

  it('un código sustituido por otro, caducado o equivocado no une', async () => {
    const first = await create(D);
    const second = await create(D);
    expect(second.code).not.toBe(first.code);
    expect(await info(first.code)).toEqual({ valid: false });
    await expectRejected(
      other.client.rpc('claim_artist_profile', { p_code: first.code }),
      'claim_invalid',
    );
    await expectRejected(
      other.client.rpc('claim_artist_profile', { p_code: 'nada' }),
      'claim_invalid',
    );
    await expectRejected(other.client.rpc('claim_artist_profile', { p_code: '' }), 'claim_invalid');
    // Caducado.
    await pgc.query(
      "update private.artist_claim_links set expires_at = now() - interval '1 minute' where profile_id = $1",
      [D],
    );
    expect(await info(second.code)).toEqual({ valid: false });
    await expectRejected(
      other.client.rpc('claim_artist_profile', { p_code: second.code }),
      'claim_invalid',
    );
    expect(await profileOf(other.id)).toEqual({ is_artist: false, artist_profile_id: null });
    // Un Carnet ya unido no toma otra ficha con un enlace.
    const third = await create(D);
    await expectRejected(
      existing.client.rpc('claim_artist_profile', { p_code: third.code }),
      'already_joined',
    );
    expect(await info(third.code)).toMatchObject({ valid: true });
  });
});
