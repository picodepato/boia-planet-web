/**
 * La moderación fina de un Carnet con cuentas (plan 020 T229, migración
 * 20261008200100) contra el proyecto de desarrollo:
 *
 * - el Admin retira una sola respuesta de un Carnet y las demás (y el Carnet)
 *   siguen a la vista;
 * - cambia o quita el enlace a la música de un Carnet de artista;
 * - los dos cambios van a la papelera de moderación y se deshacen; deshacer
 *   no pisa lo que su dueño haya cambiado después;
 * - un socio, un artista o anon no pueden nada de esto.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  AdminCarnetContent,
  ArtistLinkRotation,
  CarnetModerationTrashItem,
} from '../rpc.ts';
import { context, expectDenied, expectRejected, ok, type Member } from './context.ts';
import { elevateToAal2, testRunId } from './testkit.ts';

const ctx = context();
const POLICY = 'muestra-2026-10-08';
const run = testRunId();
const nick = (s: string) => `${s} ${run}`.slice(0, 30);
const SC = { platform: 'soundcloud', url: 'https://soundcloud.com/t229-mod' };
const BC = { platform: 'bandcamp', url: 'https://t229.bandcamp.com/' };

let admin: Member;
let artist: Member;
let fan: Member;
let questions: { id: string; version: number }[] = [];

const answersOf = async (userId: string) =>
  ok(
    ctx.anon
      .from('carnet_answers')
      .select('question_id, answer')
      .eq('user_id', userId)
      .order('question_id'),
  );

const musicOf = async (userId: string) =>
  ok(ctx.anon.from('carnets').select('music_platform, music_url').eq('user_id', userId).single());

const trash = async () =>
  (await ok(
    admin.client.rpc('admin_list_moderation_trash', {}),
  )) as unknown as CarnetModerationTrashItem[];

beforeAll(async () => {
  admin = await ctx.member('mod-fina-admin');
  await ok(ctx.service.from('staff_roles').insert({ user_id: admin.id, role: 'admin' }));
  await elevateToAal2(admin.client);
  const { code } = (await ok(
    admin.client.rpc('admin_rotate_artist_link', { p_reason: 'prueba T229' }),
  )) as unknown as ArtistLinkRotation;
  artist = await ctx.member('mod-fina-artista');
  fan = await ctx.member('mod-fina-socio');
  await ok(
    artist.client.rpc('save_profile', {
      p_nickname: nick('ModFina Art'),
      p_privacy_version: POLICY,
      p_artist_code: code,
    }),
  );
  await ok(
    fan.client.rpc('save_profile', { p_nickname: nick('ModFina Fan'), p_privacy_version: POLICY }),
  );
  await ok(artist.client.rpc('set_artist_music', { p_platform: SC.platform, p_url: SC.url }));
  questions = (await ok(
    ctx.anon
      .from('carnet_questions')
      .select('id, version')
      .eq('is_active', true)
      .order('position')
      .limit(2),
  )) as { id: string; version: number }[];
  expect(questions).toHaveLength(2);
  for (const [i, q] of questions.entries()) {
    await ok(
      fan.client.from('carnet_answers').insert({
        user_id: fan.id,
        question_id: q.id,
        question_version: q.version,
        answer: `Respuesta ${i} ${run}`,
      }),
    );
  }
});

afterAll(async () => {
  await ctx.cleanup();
});

describe('permisos', () => {
  it('un socio, un artista o anon no retiran, no cambian, no leen la papelera ni deshacen', async () => {
    for (const who of [fan, artist]) {
      await expectRejected(
        who.client.rpc('admin_remove_carnet_answer', {
          p_user: fan.id,
          p_question: questions[0]!.id,
          p_reason: 'yo mismo',
        }),
        'forbidden',
      );
      await expectRejected(
        who.client.rpc('admin_set_carnet_music', { p_user: artist.id, p_reason: 'yo mismo' }),
        'forbidden',
      );
      await expectRejected(who.client.rpc('admin_list_moderation_trash', {}), 'forbidden');
      await expectRejected(who.client.rpc('admin_carnet_content', { p_user: fan.id }), 'forbidden');
      await expectRejected(
        who.client.rpc('admin_undo_carnet_moderation', {
          p_id: '00000000-0000-0000-0000-000000000000',
        }),
        'forbidden',
      );
    }
    await expectDenied(
      ctx.anon.rpc('admin_remove_carnet_answer', { p_user: fan.id, p_question: questions[0]!.id }),
    );
    await expectDenied(ctx.anon.rpc('admin_set_carnet_music', { p_user: artist.id }));
    await expectDenied(ctx.anon.rpc('admin_list_moderation_trash', {}));
    await expectDenied(ctx.anon.rpc('admin_carnet_content', { p_user: fan.id }));
    await expectDenied(
      ctx.anon.rpc('admin_undo_carnet_moderation', { p_id: '00000000-0000-0000-0000-000000000000' }),
    );
  });

  it('retirar o cambiar pide motivo; lo que no existe se rechaza', async () => {
    await expectRejected(
      admin.client.rpc('admin_remove_carnet_answer', {
        p_user: fan.id,
        p_question: questions[0]!.id,
        p_reason: '',
      }),
      'reason_required',
    );
    await expectRejected(
      admin.client.rpc('admin_remove_carnet_answer', {
        p_user: fan.id,
        p_question: 'no-existe',
        p_reason: 'prueba',
      }),
      'unknown_answer',
    );
    await expectRejected(
      admin.client.rpc('admin_set_carnet_music', { p_user: artist.id }),
      'reason_required',
    );
    await expectRejected(
      admin.client.rpc('admin_set_carnet_music', { p_user: fan.id, p_reason: 'prueba' }),
      'artist_required',
    );
    await expectRejected(
      admin.client.rpc('admin_set_carnet_music', {
        p_user: artist.id,
        p_platform: 'spotify',
        p_url: 'https://soundcloud.com/x',
        p_reason: 'prueba',
      }),
      'invalid_music',
    );
    await expectRejected(
      admin.client.rpc('admin_undo_carnet_moderation', {
        p_id: '00000000-0000-0000-0000-000000000000',
      }),
      'unknown_trash',
    );
  });
});

describe('una respuesta', () => {
  it('se retira sola, va a la papelera y se deshace', async () => {
    const content = (await ok(
      admin.client.rpc('admin_carnet_content', { p_user: fan.id }),
    )) as unknown as AdminCarnetContent;
    expect(content.answers.map((a) => a.question_id)).toEqual(questions.map((q) => q.id));
    const before = await answersOf(fan.id);

    await ok(
      admin.client.rpc('admin_remove_carnet_answer', {
        p_user: fan.id,
        p_question: questions[0]!.id,
        p_reason: 'respuesta ofensiva',
      }),
    );
    const left = await answersOf(fan.id);
    expect(left.map((a) => a.question_id)).toEqual(
      before.map((a) => a.question_id).filter((id) => id !== questions[0]!.id),
    );
    // El Carnet sigue a la vista.
    expect(
      await ok(ctx.anon.from('carnets').select('user_id').eq('user_id', fan.id)),
    ).toHaveLength(1);

    const item = (await trash()).find((t) => t.user_id === fan.id && t.kind === 'answer')!;
    expect(item).toMatchObject({ question_id: questions[0]!.id, reason: 'respuesta ofensiva' });
    expect(new Date(item.expires_at).getTime() - new Date(item.created_at).getTime()).toBe(
      30 * 86_400_000,
    );

    await ok(admin.client.rpc('admin_undo_carnet_moderation', { p_id: item.id }));
    expect(await answersOf(fan.id)).toEqual(before);
    expect((await trash()).some((t) => t.id === item.id)).toBe(false);
    await expectRejected(
      admin.client.rpc('admin_undo_carnet_moderation', { p_id: item.id }),
      'unknown_trash',
    );
  });

  it('si su dueño ya respondió otra vez, deshacer no la pisa', async () => {
    const q = questions[1]!;
    await ok(
      admin.client.rpc('admin_remove_carnet_answer', {
        p_user: fan.id,
        p_question: q.id,
        p_reason: 'prueba',
      }),
    );
    await ok(
      fan.client.from('carnet_answers').insert({
        user_id: fan.id,
        question_id: q.id,
        question_version: q.version,
        answer: `Otra ${run}`,
      }),
    );
    const item = (await trash()).find((t) => t.user_id === fan.id && t.question_id === q.id)!;
    await expectRejected(
      admin.client.rpc('admin_undo_carnet_moderation', { p_id: item.id }),
      'answer_exists',
    );
  });
});

describe('el enlace a la música de un artista', () => {
  it('se cambia y se quita sin ocultar el Carnet, y cada cambio se deshace', async () => {
    await ok(
      admin.client.rpc('admin_set_carnet_music', {
        p_user: artist.id,
        p_platform: BC.platform,
        p_url: BC.url,
        p_reason: 'enlace roto',
      }),
    );
    expect(await musicOf(artist.id)).toEqual({ music_platform: BC.platform, music_url: BC.url });
    await ok(
      admin.client.rpc('admin_set_carnet_music', { p_user: artist.id, p_reason: 'enlace a spam' }),
    );
    expect(await musicOf(artist.id)).toEqual({ music_platform: null, music_url: null });

    const items = (await trash()).filter((t) => t.user_id === artist.id && t.kind === 'music');
    expect(items.map((t) => [t.before, t.after])).toEqual([
      [BC, null],
      [SC, BC],
    ]);
    // Deshacer lo más nuevo primero: vuelve el de Bandcamp, luego el de SoundCloud.
    await ok(admin.client.rpc('admin_undo_carnet_moderation', { p_id: items[0]!.id }));
    expect(await musicOf(artist.id)).toEqual({ music_platform: BC.platform, music_url: BC.url });
    await ok(admin.client.rpc('admin_undo_carnet_moderation', { p_id: items[1]!.id }));
    expect(await musicOf(artist.id)).toEqual({ music_platform: SC.platform, music_url: SC.url });
  });

  it('si el artista lo cambió después, deshacer no lo pisa', async () => {
    await ok(
      admin.client.rpc('admin_set_carnet_music', { p_user: artist.id, p_reason: 'quitar' }),
    );
    await ok(artist.client.rpc('set_artist_music', { p_platform: BC.platform, p_url: BC.url }));
    const item = (await trash()).find((t) => t.user_id === artist.id && t.kind === 'music')!;
    await expectRejected(
      admin.client.rpc('admin_undo_carnet_moderation', { p_id: item.id }),
      'music_changed',
    );
  });

  it('cada cambio queda en la auditoría con su motivo', async () => {
    const rows = await ok(
      ctx.service
        .from('audit_log')
        .select('action, reason')
        .eq('entity_id', artist.id)
        .like('action', 'moderate_carnet:%'),
    );
    expect(rows.map((r) => r.action)).toEqual(
      expect.arrayContaining(['moderate_carnet:set_music', 'moderate_carnet:undo_music']),
    );
    expect(rows.some((r) => r.reason === 'enlace roto')).toBe(true);
  });
});
