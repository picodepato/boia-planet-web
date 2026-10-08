/**
 * El enlace a la música de un Carnet de artista (plan 019 T217, migración
 * 20261008100200) contra el proyecto de desarrollo:
 *
 * - el artista lo pone (y lo quita) con `set_artist_music` y cualquiera lo lee;
 * - un socio que no es artista, sin Carnet o sin cuenta, no;
 * - un enlace de otra plataforma, http o a medias, no;
 * - ningún cliente escribe las columnas a mano.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ArtistLinkRotation } from '../rpc.ts';
import { context, expectDenied, expectRejected, ok, type Member } from './context.ts';
import { elevateToAal2, testRunId } from './testkit.ts';

const ctx = context();
const POLICY = 'muestra-2026-10-08';
const run = testRunId();
const nick = (s: string) => `${s} ${run}`;

let artist: Member;
let fan: Member;
let noCarnet: Member;

beforeAll(async () => {
  const admin = await ctx.member('admin-musica');
  await ok(ctx.service.from('staff_roles').insert({ user_id: admin.id, role: 'admin' }));
  await elevateToAal2(admin.client);
  const { code } = (await ok(
    admin.client.rpc('admin_rotate_artist_link', { p_reason: 'prueba T217' }),
  )) as unknown as ArtistLinkRotation;
  artist = await ctx.member('musica-artista');
  fan = await ctx.member('musica-socio');
  noCarnet = await ctx.member('musica-sin-carnet');
  await ok(
    artist.client.rpc('save_profile', {
      p_nickname: nick('Musica Art'),
      p_privacy_version: POLICY,
      p_artist_code: code,
    }),
  );
  await ok(
    fan.client.rpc('save_profile', { p_nickname: nick('Musica Fan'), p_privacy_version: POLICY }),
  );
});

afterAll(async () => {
  await ctx.cleanup();
});

const readMusic = async (userId: string) =>
  ok(ctx.anon.from('carnets').select('music_platform, music_url').eq('user_id', userId).single());

describe('set_artist_music', () => {
  it('el artista pone su SoundCloud y cualquiera lo lee; con nulos, lo quita', async () => {
    const url = 'https://soundcloud.com/musica-t217';
    await ok(artist.client.rpc('set_artist_music', { p_platform: 'soundcloud', p_url: url }));
    expect(await readMusic(artist.id)).toEqual({ music_platform: 'soundcloud', music_url: url });
    await ok(artist.client.rpc('set_artist_music', {}));
    expect(await readMusic(artist.id)).toEqual({ music_platform: null, music_url: null });
  });

  it('un enlace de otra plataforma, que no casa, http o a medias: invalid_music', async () => {
    for (const [p_platform, p_url] of [
      ['soundcloud', 'https://youtube.com/x'],
      ['spotify', 'https://soundcloud.com/x'],
      ['instagram', 'http://instagram.com/x'],
      ['bandcamp', null],
      ['tiktok', 'https://tiktok.com/@x'],
    ] as const) {
      await expectRejected(
        artist.client.rpc('set_artist_music', { p_platform, p_url: p_url as string }),
        'invalid_music',
      );
    }
  });

  it('un socio que no es artista no; sin Carnet, tampoco; sin cuenta, nada', async () => {
    const args = { p_platform: 'bandcamp', p_url: 'https://x.bandcamp.com/' };
    await expectRejected(fan.client.rpc('set_artist_music', args), 'artist_required');
    await expectRejected(noCarnet.client.rpc('set_artist_music', args), 'carnet_required');
    await expectDenied(ctx.anon.rpc('set_artist_music', args));
    expect(await readMusic(fan.id)).toEqual({ music_platform: null, music_url: null });
  });

  it('nadie escribe las columnas a mano', async () => {
    await expectDenied(
      artist.client
        .from('carnets')
        .update({ music_platform: 'spotify', music_url: 'https://open.spotify.com/x' })
        .eq('user_id', artist.id),
    );
  });
});
