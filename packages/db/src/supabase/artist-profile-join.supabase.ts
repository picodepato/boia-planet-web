/**
 * Un Carnet unido a su ficha de artista (plan 031 T295, migración
 * 20261015100200) contra el proyecto de desarrollo:
 *
 * - el Admin (con segundo factor) une un Carnet a una ficha y lo deshace; las
 *   dos cosas quedan en la auditoría y unir marca el Carnet como artista;
 * - una ficha no se une a dos Carnets, ni un Carnet a dos fichas;
 * - un socio, el Admin sin TOTP y quien no tiene cuenta, no;
 * - nadie escribe la columna a mano; cualquiera la lee (es pública como el Carnet).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ProfileResult } from '../rpc.ts';
import { context, expectDenied, expectRejected, ok, type Member } from './context.ts';
import { elevateToAal2, testRunId } from './testkit.ts';

const ctx = context();
const POLICY = 'muestra-2026-10-15';
const run = testRunId();
const nick = (s: string) => `${s} ${run}`;
/** Fichas de esta ejecución (la columna es única en toda la base). */
const PROFILE = `prueba-t295-${run}`;
const OTHER = `prueba-t295-otra-${run}`;

let admin: Member;
let artist: Member;
let fan: Member;

const profileOf = async (userId: string) =>
  ok(
    ctx.anon.from('carnets').select('is_artist, artist_profile_id').eq('user_id', userId).single(),
  );

const auditOf = async (userId: string, action: string) =>
  ok(
    admin.client
      .from('audit_log')
      .select('action, reason, old_value, new_value')
      .eq('entity_id', userId)
      .eq('action', action),
  );

beforeAll(async () => {
  admin = await ctx.member('admin-union');
  await ok(ctx.service.from('staff_roles').insert({ user_id: admin.id, role: 'admin' }));
  artist = await ctx.member('union-artista');
  fan = await ctx.member('union-socio');
  for (const [m, n] of [
    [artist, 'Union Art'],
    [fan, 'Union Fan'],
  ] as const) {
    await ok(m.client.rpc('save_profile', { p_nickname: nick(n), p_privacy_version: POLICY }));
  }
});

afterAll(async () => {
  await ctx.cleanup();
});

describe('admin_join_artist_profile / admin_unjoin_artist_profile', () => {
  it('sin cuenta, un socio o el Admin sin TOTP: no', async () => {
    const join = { p_user: artist.id, p_profile: PROFILE };
    await expectDenied(ctx.anon.rpc('admin_join_artist_profile', join));
    await expectDenied(fan.client.rpc('admin_join_artist_profile', join));
    await expectDenied(admin.client.rpc('admin_join_artist_profile', join));
    await expectDenied(ctx.anon.rpc('admin_unjoin_artist_profile', { p_user: artist.id }));
    await expectDenied(fan.client.rpc('admin_unjoin_artist_profile', { p_user: artist.id }));
    expect(await profileOf(artist.id)).toEqual({ is_artist: false, artist_profile_id: null });
  });

  it('nadie escribe la columna a mano', async () => {
    await expectDenied(
      artist.client.from('carnets').update({ artist_profile_id: PROFILE }).eq('user_id', artist.id),
    );
  });

  it('el Admin une un Carnet a una ficha: lo marca artista y queda en la auditoría', async () => {
    await elevateToAal2(admin.client);
    const res = (await ok(
      admin.client.rpc('admin_join_artist_profile', {
        p_user: artist.id,
        p_profile: PROFILE,
        p_reason: 'prueba T295',
      }),
    )) as { artist_profile_id: string; is_artist: boolean; joined: boolean };
    expect(res).toMatchObject({ artist_profile_id: PROFILE, is_artist: true, joined: true });
    expect(await profileOf(artist.id)).toEqual({ is_artist: true, artist_profile_id: PROFILE });
    const audit = await auditOf(artist.id, 'join_artist_profile');
    expect(audit).toEqual([
      expect.objectContaining({
        reason: 'prueba T295',
        old_value: { is_artist: false, artist_profile_id: null },
        new_value: { is_artist: true, artist_profile_id: PROFILE },
      }),
    ]);
    // Lo repetido no es un error ni deja otra fila.
    const again = (await ok(
      admin.client.rpc('admin_join_artist_profile', { p_user: artist.id, p_profile: PROFILE }),
    )) as { joined: boolean };
    expect(again.joined).toBe(false);
    expect(await auditOf(artist.id, 'join_artist_profile')).toHaveLength(1);
  });

  it('una ficha no se une a dos Carnets, ni un Carnet a dos fichas', async () => {
    await expectRejected(
      admin.client.rpc('admin_join_artist_profile', { p_user: fan.id, p_profile: PROFILE }),
      'profile_claimed',
    );
    await expectRejected(
      admin.client.rpc('admin_join_artist_profile', { p_user: artist.id, p_profile: OTHER }),
      'already_joined',
    );
    await expectRejected(
      admin.client.rpc('admin_join_artist_profile', { p_user: fan.id, p_profile: 'No Vale!' }),
      'invalid_profile',
    );
    await expectRejected(
      admin.client.rpc('admin_join_artist_profile', {
        p_user: '00000000-0000-4000-8000-000000000000',
        p_profile: OTHER,
      }),
      'unknown_member',
    );
    expect(await profileOf(fan.id)).toEqual({ is_artist: false, artist_profile_id: null });
  });

  it('deshacer la unión: el Carnet sigue de artista y la ficha queda libre', async () => {
    const res = (await ok(
      admin.client.rpc('admin_unjoin_artist_profile', {
        p_user: artist.id,
        p_reason: 'prueba T295',
      }),
    )) as { unjoined: boolean };
    expect(res.unjoined).toBe(true);
    expect(await profileOf(artist.id)).toEqual({ is_artist: true, artist_profile_id: null });
    expect(await auditOf(artist.id, 'unjoin_artist_profile')).toEqual([
      expect.objectContaining({
        old_value: { artist_profile_id: PROFILE },
        new_value: { artist_profile_id: null },
      }),
    ]);
    // Otra vez: nada que deshacer, sin error.
    const again = (await ok(
      admin.client.rpc('admin_unjoin_artist_profile', { p_user: artist.id }),
    )) as { unjoined: boolean };
    expect(again.unjoined).toBe(false);
    // La ficha, libre: otro Carnet la puede tomar.
    await ok(admin.client.rpc('admin_join_artist_profile', { p_user: fan.id, p_profile: PROFILE }));
    expect(await profileOf(fan.id)).toEqual({ is_artist: true, artist_profile_id: PROFILE });
  });

  it('quitar «artista» también deshace la unión', async () => {
    const off = (await ok(
      admin.client.rpc('admin_set_artist', { p_user: fan.id, p_is_artist: false }),
    )) as unknown as ProfileResult;
    expect(off.is_artist).toBe(false);
    expect(await profileOf(fan.id)).toEqual({ is_artist: false, artist_profile_id: null });
  });
});
