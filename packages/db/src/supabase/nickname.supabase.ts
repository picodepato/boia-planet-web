/**
 * nickname_status (plan 008, T89): la hoja de acceso pregunta si un apodo se
 * puede usar antes de crear la cuenta. Mismo criterio que save_profile, sin
 * crear nada; sólo para cuentas con email.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { context, expectDenied, ok, type Member } from './context.ts';
import { testRunId } from './testkit.ts';

const ctx = context();
const POLICY = 'muestra-2026-10-03';
const run = testRunId();
const taken = `Apodo ${run}`;

let a: Member;
let b: Member;

beforeAll(async () => {
  a = await ctx.member('apodo-a');
  b = await ctx.member('apodo-b');
  await ok(a.client.rpc('save_profile', { p_nickname: taken, p_privacy_version: POLICY }));
});

afterAll(async () => {
  await ctx.cleanup();
});

describe('nickname_status: el apodo antes de crear la cuenta', () => {
  it('libre, o el propio', async () => {
    expect(await ok(b.client.rpc('nickname_status', { p_nickname: `Otro ${run}` }))).toBe('ok');
    expect(await ok(a.client.rpc('nickname_status', { p_nickname: taken.toUpperCase() }))).toBe(
      'ok',
    );
  });

  it('ocupado sin distinguir mayúsculas, corto o que no pasa el filtro', async () => {
    const status = (p_nickname: string) => ok(b.client.rpc('nickname_status', { p_nickname }));
    expect(await status(` ${taken.toLowerCase()} `)).toBe('nickname_taken');
    expect(await status('x')).toBe('nickname_invalid');
    expect(await status('Gilipollas 3000')).toBe('text_offensive');
    expect(await status('ven a boia.com')).toBe('text_link');
    expect(await status('yo@correo.es')).toBe('text_email');
    expect(await status('tel 600 123 456')).toBe('text_phone');
  });

  it('no crea nada y anon no la llama', async () => {
    const rows = await ok(ctx.service.from('carnets').select('user_id').eq('user_id', b.id));
    expect(rows).toEqual([]);
    await expectDenied(ctx.anon.rpc('nickname_status', { p_nickname: 'Hola' }));
  });
});
