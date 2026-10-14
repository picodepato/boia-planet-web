/**
 * Las preguntas del Carnet de Álvaro (2026-10-14) contra el proyecto de
 * desarrollo: plan 029 T281 (migraciones 20261014100100 y 20261014100110) y
 * plan 030 T294 (20261015100100, preguntas por público):
 *
 * - las activas son, con su público y en su orden, las de `CARNET_QUESTIONS`;
 *   las cuatro antiguas siguen en la tabla, inactivas;
 * - un socio contesta una activa de su público, pero no crea ni cambia una
 *   respuesta a una retirada ni a una de otro público; la que ya tenía se
 *   conserva y la puede borrar;
 * - un artista contesta las 5 de artista y no la 1 del público; si un socio
 *   pasa a ser artista, contesta las de artista desde entonces;
 * - volver a pasar la migración de T294 no borra ninguna respuesta.
 */
import { readFileSync } from 'node:fs';
import { CARNET_QUESTIONS, RETIRED_CARNET_QUESTION_IDS } from '@boia/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { context, expectDenied, ok, type Member } from './context.ts';
import { connectDev } from './dev.ts';
import { REPO_ROOT } from './env.ts';
import { testRunId } from './testkit.ts';

const ctx = context();
const POLICY = 'muestra-2026-10-14';
const run = testRunId();
const [retiredA, retiredB] = RETIRED_CARNET_QUESTION_IDS;
const MIGRATION = `${REPO_ROOT}supabase/migrations/20261015100100_carnet_questions_audience.sql`;
const ARTIST_FIRST = 'momento-quiero-estar';
const PUBLIC_FIRST = 'dia-siguiente';

let fan: Member;
let artist: Member;
let convert: Member;

const answersOf = async (userId: string) =>
  (await ok(
    ctx.service
      .from('carnet_answers')
      .select('question_id, answer')
      .eq('user_id', userId)
      .order('question_id'),
  )) as { question_id: string; answer: string }[];

const insertAnswer = (m: Member, questionId: string, answer: string) =>
  m.client.from('carnet_answers').insert({
    user_id: m.id,
    question_id: questionId,
    question_version: 1,
    answer,
  });

const updateAnswer = async (m: Member, questionId: string, answer: string) =>
  (await ok(
    m.client
      .from('carnet_answers')
      .update({ answer })
      .eq('user_id', m.id)
      .eq('question_id', questionId)
      .select('question_id'),
  )) as unknown[];

/** Una respuesta de antes del cambio (la escribe la clave de servicio). */
const legacy = (m: Member, questionId: string, answer: string) =>
  ok(
    ctx.service.from('carnet_answers').insert({
      user_id: m.id,
      question_id: questionId,
      question_version: 1,
      answer,
    }),
  );

const setArtist = (m: Member) =>
  ok(ctx.service.from('carnets').update({ is_artist: true }).eq('user_id', m.id));

beforeAll(async () => {
  fan = await ctx.member('preguntas-socio');
  artist = await ctx.member('preguntas-artista');
  convert = await ctx.member('preguntas-converso');
  for (const [m, label] of [
    [fan, 'Preguntas'],
    [artist, 'PregArtista'],
    [convert, 'PregConverso'],
  ] as const) {
    await ok(
      m.client.rpc('save_profile', {
        p_nickname: `${label} ${run}`.slice(0, 30),
        p_privacy_version: POLICY,
      }),
    );
  }
  // El «es artista» que da el enlace de artistas (o el Admin).
  await setArtist(artist);
  await legacy(fan, retiredA!, `Antigua ${run}`);
  // Contestada cuando la 1 era de todos (antes de T294).
  await legacy(fan, ARTIST_FIRST, `Momento ${run}`);
  await legacy(convert, ARTIST_FIRST, `Momento converso ${run}`);
});

afterAll(async () => {
  await ctx.cleanup();
});

describe('preguntas del Carnet (T281, T294)', () => {
  it('las activas son las de CARNET_QUESTIONS, con su público y en su orden; las retiradas siguen, inactivas', async () => {
    const rows = (await ok(
      ctx.anon
        .from('carnet_questions')
        .select('id, position, prompt, audience, is_active')
        .order('position')
        .order('audience'),
    )) as {
      id: string;
      position: number;
      prompt: string;
      audience: string;
      is_active: boolean;
    }[];
    const pick = ({ id, position, prompt, audience }: (typeof rows)[number]) => ({
      id,
      position,
      prompt,
      audience,
    });
    expect(rows.filter((r) => r.is_active).map(pick)).toEqual(
      CARNET_QUESTIONS.map(({ id, position, prompt, audience }) => ({
        id,
        position,
        prompt,
        audience,
      })),
    );
    const retired = rows.filter((r) => !r.is_active).map((r) => r.id);
    for (const id of RETIRED_CARNET_QUESTION_IDS) expect(retired).toContain(id);
  });

  it('un socio contesta las activas de su público («al día siguiente…» y la 2 a la 5)', async () => {
    for (const q of CARNET_QUESTIONS.filter((x) => x.audience !== 'artist')) {
      await ok(insertAnswer(fan, q.id, `Nueva ${q.id} ${run}`));
      expect(await updateAnswer(fan, q.id, `Nueva bis ${q.id} ${run}`)).toHaveLength(1);
    }
  });

  it('un socio no contesta la 1 de artistas; la que ya tenía se conserva y no la cambia', async () => {
    expect(await updateAnswer(fan, ARTIST_FIRST, 'No debería cambiar')).toHaveLength(0);
    const rows = await answersOf(fan.id);
    expect(rows.find((r) => r.question_id === ARTIST_FIRST)?.answer).toBe(`Momento ${run}`);
    const other = await ctx.member('preguntas-otro');
    await ok(
      other.client.rpc('save_profile', {
        p_nickname: `PregOtro ${run}`.slice(0, 30),
        p_privacy_version: POLICY,
      }),
    );
    await expectDenied(insertAnswer(other, ARTIST_FIRST, 'No debería entrar'));
    expect(await answersOf(other.id)).toEqual([]);
  });

  it('un artista contesta las 5 de artista y no la 1 del público', async () => {
    for (const q of CARNET_QUESTIONS.filter((x) => x.audience !== 'public')) {
      await ok(insertAnswer(artist, q.id, `Artista ${q.id} ${run}`));
      expect(await updateAnswer(artist, q.id, `Artista bis ${q.id} ${run}`)).toHaveLength(1);
    }
    await expectDenied(insertAnswer(artist, PUBLIC_FIRST, 'No debería entrar'));
    expect((await answersOf(artist.id)).map((r) => r.question_id).sort()).toEqual(
      CARNET_QUESTIONS.filter((x) => x.audience !== 'public')
        .map((q) => q.id)
        .sort(),
    );
  });

  it('si un socio pasa a ser artista, cambia su respuesta a la 1 de artistas desde entonces', async () => {
    expect(await updateAnswer(convert, ARTIST_FIRST, 'Antes no')).toHaveLength(0);
    await setArtist(convert);
    expect(await updateAnswer(convert, ARTIST_FIRST, `Ahora sí ${run}`)).toHaveLength(1);
    await expectDenied(insertAnswer(convert, PUBLIC_FIRST, 'Ya no es del público'));
  });

  it('no crea ni cambia respuestas a preguntas retiradas; la antigua se conserva', async () => {
    await expectDenied(insertAnswer(fan, retiredB!, 'No debería entrar'));
    expect(await updateAnswer(fan, retiredA!, 'Tampoco')).toHaveLength(0);
    const rows = await answersOf(fan.id);
    expect(rows.find((r) => r.question_id === retiredA)?.answer).toBe(`Antigua ${run}`);
    expect(rows.some((r) => r.question_id === retiredB)).toBe(false);
  });

  it('volver a pasar la migración de T294 no borra ninguna respuesta', async () => {
    const users = [fan, artist, convert];
    const before = await Promise.all(users.map((u) => answersOf(u.id)));
    expect(before.every((rows) => rows.length > 0)).toBe(true);
    const client = await connectDev(ctx.env);
    try {
      // Reejecutable; en una transacción, para no dejar las políticas a medias.
      await client.query('begin');
      await client.query(readFileSync(MIGRATION, 'utf8'));
      await client.query('commit');
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally {
      await client.end();
    }
    expect(await Promise.all(users.map((u) => answersOf(u.id)))).toEqual(before);
    expect((await answersOf(fan.id)).find((r) => r.question_id === ARTIST_FIRST)?.answer).toBe(
      `Momento ${run}`,
    );
  });

  it('su dueño puede borrar la respuesta antigua y la de otro público', async () => {
    for (const id of [retiredA!, ARTIST_FIRST]) {
      await ok(
        fan.client.from('carnet_answers').delete().eq('user_id', fan.id).eq('question_id', id),
      );
    }
    const left = (await answersOf(fan.id)).map((r) => r.question_id);
    expect(left).not.toContain(retiredA);
    expect(left).not.toContain(ARTIST_FIRST);
  });
});
