/**
 * Lo que usan las botellas globales de la web (plan 008, T93, decisión 12)
 * además de `place_bottle` y `latest_bottles` (community.supabase.ts): la
 * lectura registrada (`bottle_reads`), el reporte (`bottle_reports`), y que
 * el autor edite el mensaje o retire la suya directamente, con el filtro de
 * texto también ahí, y que la posición sólo la fije `place_bottle` (T94). Las pruebas miran sólo sus propias botellas.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { context, expectDenied, expectRejected, ok, type Member } from './context.ts';
import { testRunId } from './testkit.ts';

const ctx = context();
const run = testRunId();
const POLICY = 'muestra-2026-10-03';

let author: Member;
let reader: Member;
let bottleId: string;

beforeAll(async () => {
  author = await ctx.member('botella-autora');
  reader = await ctx.member('botella-lectora');
  await ok(
    author.client.rpc('save_profile', { p_nickname: `Autora ${run}`, p_privacy_version: POLICY }),
  );
  await ok(
    reader.client.rpc('save_profile', { p_nickname: `Lectora ${run}`, p_privacy_version: POLICY }),
  );
  const b = (await ok(
    author.client.rpc('place_bottle', { p_message: `Para leer ${run}`, p_x: 12, p_y: 34 }),
  )) as { id: string };
  bottleId = b.id;
});

afterAll(async () => {
  await ctx.cleanup();
});

describe('botellas globales: leer, reportar, editar y retirar', () => {
  it('leer queda registrado una vez por persona; cada una ve sólo sus lecturas', async () => {
    await ok(
      reader.client.from('bottle_reads').insert({ bottle_id: bottleId, reader_id: reader.id }),
    );
    const again = await reader.client
      .from('bottle_reads')
      .insert({ bottle_id: bottleId, reader_id: reader.id });
    expect(again.error?.code).toBe('23505');
    const mine = await ok(
      reader.client.from('bottle_reads').select('bottle_id').eq('reader_id', reader.id),
    );
    expect(mine).toEqual([{ bottle_id: bottleId }]);
    const others = await ok(
      author.client.from('bottle_reads').select('bottle_id').eq('bottle_id', bottleId),
    );
    expect(others).toEqual([]);
    // Nadie apunta una lectura a nombre de otro, y anon no lee ni escribe lecturas.
    const forged = await author.client
      .from('bottle_reads')
      .insert({ bottle_id: bottleId, reader_id: reader.id });
    expect(forged.error?.code).toBe('42501');
    const anon = await ctx.anon
      .from('bottle_reads')
      .insert({ bottle_id: bottleId, reader_id: reader.id });
    expect(anon.error).not.toBeNull();
  });

  it('reportar: una vez por persona; el autor no ve los reportes ajenos', async () => {
    await ok(
      reader.client
        .from('bottle_reports')
        .insert({ bottle_id: bottleId, reporter_id: reader.id, reason: 'prueba' }),
    );
    const twice = await reader.client
      .from('bottle_reports')
      .insert({ bottle_id: bottleId, reporter_id: reader.id, reason: null });
    expect(twice.error?.code).toBe('23505');
    const seen = await ok(
      author.client.from('bottle_reports').select('id').eq('bottle_id', bottleId),
    );
    expect(seen).toEqual([]);
    const stored = await ok(
      ctx.service.from('bottle_reports').select('reporter_id, reason').eq('bottle_id', bottleId),
    );
    expect(stored).toEqual([{ reporter_id: reader.id, reason: 'prueba' }]);
    const anon = await ctx.anon
      .from('bottle_reports')
      .insert({ bottle_id: bottleId, reporter_id: reader.id, reason: null });
    expect(anon.error).not.toBeNull();
  });

  it('el autor edita la suya con el filtro; otra cuenta no la toca', async () => {
    const edited = await ok(
      author.client
        .from('bottles')
        .update({ message: `Editada ${run}` })
        .eq('id', bottleId)
        .eq('user_id', author.id)
        .eq('status', 'active')
        .select('id, message'),
    );
    expect(edited).toEqual([{ id: bottleId, message: `Editada ${run}` }]);
    await expectRejected(
      author.client.from('bottles').update({ message: 'llama al 612 345 678' }).eq('id', bottleId),
      'text_phone',
    );
    const hijack = await ok(
      reader.client.from('bottles').update({ message: 'mía' }).eq('id', bottleId).select('id'),
    );
    expect(hijack).toEqual([]);
  });

  it('sólo place_bottle fija la posición: el autor no mueve x/y ni inserta a mano (T94)', async () => {
    await expectDenied(
      author.client.from('bottles').update({ x: 999, y: 999 }).eq('id', bottleId).select('id'),
    );
    await expectDenied(author.client.from('bottles').update({ x: 1 }).eq('id', bottleId));
    await expectDenied(
      author.client
        .from('bottles')
        .insert({ user_id: author.id, message: `A mano ${run}`, x: 0, y: 0 }),
    );
    const row = await ok(ctx.service.from('bottles').select('x, y').eq('id', bottleId).single());
    expect(row).toEqual({ x: 12, y: 34 });
  });

  it('el autor la retira y sale del mar', async () => {
    const retired = await ok(
      author.client
        .from('bottles')
        .update({ status: 'retired' })
        .eq('id', bottleId)
        .eq('user_id', author.id)
        .eq('status', 'active')
        .select('id'),
    );
    expect(retired).toEqual([{ id: bottleId }]);
    const sea = await ok(ctx.anon.rpc('latest_bottles', { p_limit: 10 }));
    expect(sea.some((b) => b.id === bottleId)).toBe(false);
  });
});
