/**
 * Las preguntas del Carnet de Álvaro (2026-10-14, plan 029 T281) contra el
 * proyecto de desarrollo (migraciones 20261014100100 y 20261014100110):
 *
 * - las activas son, en su orden, las de `CARNET_QUESTIONS`; las cuatro
 *   antiguas siguen en la tabla, inactivas;
 * - un socio contesta una pregunta activa, pero no crea ni cambia una
 *   respuesta a una retirada; la que ya tenía se conserva y la puede borrar.
 */
import { CARNET_QUESTIONS, RETIRED_CARNET_QUESTION_IDS } from '@boia/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { context, expectDenied, ok, type Member } from './context.ts';
import { testRunId } from './testkit.ts';

const ctx = context();
const POLICY = 'muestra-2026-10-14';
const run = testRunId();
const [retiredA, retiredB] = RETIRED_CARNET_QUESTION_IDS;

let fan: Member;

const answersOf = async (userId: string) =>
  (await ok(
    ctx.service
      .from('carnet_answers')
      .select('question_id, answer')
      .eq('user_id', userId)
      .order('question_id'),
  )) as { question_id: string; answer: string }[];

beforeAll(async () => {
  fan = await ctx.member('preguntas-socio');
  await ok(
    fan.client.rpc('save_profile', {
      p_nickname: `Preguntas ${run}`.slice(0, 30),
      p_privacy_version: POLICY,
    }),
  );
  // Una respuesta de antes del cambio (la escribe la clave de servicio).
  await ok(
    ctx.service.from('carnet_answers').insert({
      user_id: fan.id,
      question_id: retiredA!,
      question_version: 1,
      answer: `Antigua ${run}`,
    }),
  );
});

afterAll(async () => {
  await ctx.cleanup();
});

describe('preguntas del Carnet (T281)', () => {
  it('las activas son las de CARNET_QUESTIONS, en su orden; las retiradas siguen, inactivas', async () => {
    const rows = (await ok(
      ctx.anon.from('carnet_questions').select('id, position, prompt, is_active').order('position'),
    )) as { id: string; position: number; prompt: string; is_active: boolean }[];
    expect(
      rows.filter((r) => r.is_active).map(({ id, position, prompt }) => ({ id, position, prompt })),
    ).toEqual(CARNET_QUESTIONS.map(({ id, position, prompt }) => ({ id, position, prompt })));
    const retired = rows.filter((r) => !r.is_active).map((r) => r.id);
    for (const id of RETIRED_CARNET_QUESTION_IDS) expect(retired).toContain(id);
  });

  it('un socio contesta una activa', async () => {
    const q = CARNET_QUESTIONS[0]!;
    await ok(
      fan.client.from('carnet_answers').insert({
        user_id: fan.id,
        question_id: q.id,
        question_version: q.version,
        answer: `Nueva ${run}`,
      }),
    );
    const updated = await ok(
      fan.client
        .from('carnet_answers')
        .update({ answer: `Nueva bis ${run}` })
        .eq('user_id', fan.id)
        .eq('question_id', q.id)
        .select('question_id'),
    );
    expect(updated).toHaveLength(1);
  });

  it('no crea ni cambia respuestas a preguntas retiradas; la antigua se conserva', async () => {
    await expectDenied(
      fan.client.from('carnet_answers').insert({
        user_id: fan.id,
        question_id: retiredB!,
        question_version: 1,
        answer: 'No debería entrar',
      }),
    );
    const updated = await ok(
      fan.client
        .from('carnet_answers')
        .update({ answer: 'Tampoco' })
        .eq('user_id', fan.id)
        .eq('question_id', retiredA!)
        .select('question_id'),
    );
    expect(updated).toHaveLength(0);
    const rows = await answersOf(fan.id);
    expect(rows.find((r) => r.question_id === retiredA)?.answer).toBe(`Antigua ${run}`);
    expect(rows.some((r) => r.question_id === retiredB)).toBe(false);
  });

  it('su dueño puede borrar la respuesta antigua', async () => {
    await ok(
      fan.client.from('carnet_answers').delete().eq('user_id', fan.id).eq('question_id', retiredA!),
    );
    expect((await answersOf(fan.id)).some((r) => r.question_id === retiredA)).toBe(false);
  });
});
