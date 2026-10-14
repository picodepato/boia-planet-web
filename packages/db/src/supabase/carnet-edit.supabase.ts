/**
 * Editar el propio Carnet (plan 030 T293) contra el proyecto de desarrollo:
 * el mismo orden de llamadas que la web al guardar (`save_profile` con el
 * apodo de siempre, luego `set_artist_music` o la respuesta).
 *
 * - un artista y un socio guardan su Carnet con su mismo apodo (en otras
 *   mayúsculas también) y un enlace nuevo o cambiado: se guarda, sin
 *   `nickname_taken` y sin tocar su número de socio;
 * - otro miembro que pide un apodo ya tomado: `nickname_taken`.
 */
import { carnetQuestionsFor } from '@boia/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ArtistLinkRotation } from '../rpc.ts';
import { context, expectRejected, ok, type Member } from './context.ts';
import { elevateToAal2, testRunId } from './testkit.ts';

const ctx = context();
const POLICY = 'muestra-2026-10-14';
const run = testRunId();
const nick = (s: string) => `${s} ${run}`.slice(0, 30);

let artist: Member;
let fan: Member;
let other: Member;

const carnetOf = async (userId: string) =>
  (await ok(
    ctx.service
      .from('carnets')
      .select('nickname, member_number, music_platform, music_url, is_artist')
      .eq('user_id', userId)
      .single(),
  )) as {
    nickname: string;
    member_number: number;
    music_platform: string | null;
    music_url: string | null;
    is_artist: boolean;
  };

beforeAll(async () => {
  const admin = await ctx.member('editar-admin');
  await ok(ctx.service.from('staff_roles').insert({ user_id: admin.id, role: 'admin' }));
  await elevateToAal2(admin.client);
  const { code } = (await ok(
    admin.client.rpc('admin_rotate_artist_link', { p_reason: 'prueba T293' }),
  )) as unknown as ArtistLinkRotation;
  artist = await ctx.member('editar-artista');
  fan = await ctx.member('editar-socio');
  other = await ctx.member('editar-otro');
  await ok(
    artist.client.rpc('save_profile', {
      p_nickname: nick('Edita Art'),
      p_privacy_version: POLICY,
      p_artist_code: code,
    }),
  );
  await ok(
    fan.client.rpc('save_profile', { p_nickname: nick('Edita Fan'), p_privacy_version: POLICY }),
  );
  await ok(
    other.client.rpc('save_profile', { p_nickname: nick('Edita Otro'), p_privacy_version: POLICY }),
  );
});

afterAll(async () => {
  await ctx.cleanup();
});

describe('editar el propio Carnet con el mismo apodo (T293)', () => {
  it('el artista guarda su apodo de siempre y pone y cambia su enlace', async () => {
    const before = await carnetOf(artist.id);
    expect(before.is_artist).toBe(true);
    for (const [platform, url, nickname] of [
      ['soundcloud', 'https://soundcloud.com/edita-t293', before.nickname],
      ['bandcamp', 'https://edita-t293.bandcamp.com/', before.nickname.toUpperCase()],
    ] as const) {
      await ok(
        artist.client.rpc('save_profile', {
          p_nickname: nickname,
          p_avatar_key: 'avatar-1',
        }),
      );
      await ok(artist.client.rpc('set_artist_music', { p_platform: platform, p_url: url }));
      const after = await carnetOf(artist.id);
      expect(after).toMatchObject({ music_platform: platform, music_url: url });
      expect(after.member_number).toBe(before.member_number);
    }
  });

  it('el socio guarda su apodo de siempre y una respuesta con un enlace', async () => {
    const before = await carnetOf(fan.id);
    // La 1 de un socio que no es artista (T294).
    const q = carnetQuestionsFor(false)[0]!;
    for (const answer of ['https://boia-t293.example/uno', 'https://boia-t293.example/dos']) {
      await ok(
        fan.client.rpc('save_profile', {
          p_nickname: before.nickname,
          p_avatar_key: 'avatar-2',
        }),
      );
      // Como la web (server.ts, saveAnswer): cambia la suya o la crea.
      const updated = await ok(
        fan.client
          .from('carnet_answers')
          .update({ answer, question_version: q.version })
          .eq('user_id', fan.id)
          .eq('question_id', q.id)
          .select('question_id'),
      );
      if (!updated?.length) {
        await ok(
          fan.client
            .from('carnet_answers')
            .insert({ user_id: fan.id, question_id: q.id, question_version: q.version, answer }),
        );
      }
    }
    expect(await carnetOf(fan.id)).toMatchObject({
      nickname: before.nickname,
      member_number: before.member_number,
    });
  });

  it('otro miembro que pide un apodo ya tomado: nickname_taken', async () => {
    const taken = (await carnetOf(artist.id)).nickname;
    await expectRejected(
      other.client.rpc('save_profile', { p_nickname: ` ${taken.toLowerCase()} ` }),
      'nickname_taken',
    );
    await expectRejected(
      other.client.rpc('save_profile', { p_nickname: (await carnetOf(fan.id)).nickname }),
      'nickname_taken',
    );
    expect((await carnetOf(other.id)).nickname).toBe(nick('Edita Otro'));
  });
});
