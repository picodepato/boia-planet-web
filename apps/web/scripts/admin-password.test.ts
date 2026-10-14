import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkDemoAdmin, checkPassword, DEMO_ADMIN_PASSWORD } from '../lib/admin/demo-auth';
import {
  currentIterations,
  makeHash,
  readHash,
  replaceHash,
  typeKeys,
  verifyHash,
} from './admin-password-lib.mjs';

/**
 * `pnpm admin:password` (plan 029 T283): el hash que escribe lo verifica
 * `checkPassword` de la demo y sólo cambia ese bloque del archivo. Contraseñas
 * de juguete, sólo de estas pruebas.
 */
const SOURCE = readFileSync(path.resolve(__dirname, '../lib/admin/demo-auth.ts'), 'utf8');

describe('pnpm admin:password', () => {
  it('lee las vueltas del hash que hay en el código', () => {
    expect(currentIterations(SOURCE)).toBe(DEMO_ADMIN_PASSWORD.iterations);
  });

  it('el hash nuevo lo verifica la demo, con sal nueva cada vez', async () => {
    const a = makeHash('clave de juguete 1', 1000);
    const b = makeHash('clave de juguete 1', 1000);
    expect(a.salt).not.toBe(b.salt);
    expect(Buffer.from(a.salt, 'base64')).toHaveLength(16);
    expect(Buffer.from(a.hash, 'base64')).toHaveLength(32);
    expect(await checkPassword('clave de juguete 1', a)).toBe(true);
    expect(await checkPassword('otra', a)).toBe(false);
    expect(await checkDemoAdmin('000', 'clave de juguete 1', a)).toBe(true);
  });

  it('reescribe sólo DEMO_ADMIN_PASSWORD y el resultado sigue leyéndose', async () => {
    const hash = makeHash('clave de juguete 2', currentIterations(SOURCE));
    const next = replaceHash(SOURCE, hash);
    expect(next).not.toBe(SOURCE);
    expect(next).toContain(`salt: '${hash.salt}'`);
    expect(next).toContain(`hash: '${hash.hash}'`);
    expect(next).not.toContain(DEMO_ADMIN_PASSWORD.hash);
    const shown = DEMO_ADMIN_PASSWORD.iterations.toLocaleString('en').replace(/,/g, '_');
    expect(next).toContain(`iterations: ${shown},`);
    // todo lo demás, intacto
    const strip = (s: string) => s.replace(/export const DEMO_ADMIN_PASSWORD[\s\S]*?\n\};/, '');
    expect(strip(next)).toBe(strip(SOURCE));
    // aplicarlo otra vez sigue funcionando (idempotente en forma)
    expect(currentIterations(next)).toBe(DEMO_ADMIN_PASSWORD.iterations);
    // lo que queda escrito lo verifican el script y la demo
    expect(readHash(next)).toEqual(hash);
    expect(verifyHash('clave de juguete 2', readHash(next))).toBe(true);
    expect(verifyHash('otra', readHash(next))).toBe(false);
    expect(await checkPassword('clave de juguete 2', hash)).toBe(true);
  });

  it('si no encuentra el bloque, falla en vez de escribir', () => {
    expect(() => replaceHash('nada', makeHash('x', 1000))).toThrow();
    expect(() => currentIterations('nada')).toThrow();
  });

  it('el hash de ahora se lee igual que lo usa la demo, y el script lo verifica como ella', async () => {
    expect(readHash(SOURCE)).toEqual(DEMO_ADMIN_PASSWORD);
    const h = makeHash('clave de juguete 3', 1000);
    expect(verifyHash('clave de juguete 3', h)).toBe(await checkPassword('clave de juguete 3', h));
  });

  it('teclas: Intro acaba, borrar quita, Ctrl+C cancela, flechas fuera', () => {
    expect(typeKeys('', 'abc')).toEqual({ text: 'abc', end: null });
    expect(typeKeys('abc', 'd\r')).toEqual({ text: 'abcd', end: 'enter' });
    expect(typeKeys('abc', '\u007f\u007fz\n')).toEqual({ text: 'az', end: 'enter' });
    expect(typeKeys('abc', '\b')).toEqual({ text: 'ab', end: null });
    expect(typeKeys('abc', '\u0003')).toEqual({ text: '', end: 'cancel' });
    // flechas (ESC [ A, ESC [ 1 ; 5 C) y ESC O H: no entran
    expect(typeKeys('a', '\u001b[A\u001b[1;5Cb\u001bOHc')).toEqual({ text: 'abc', end: null });
    // emoji: borrar quita el carácter entero
    expect(typeKeys('a\u{1F600}', '\u007f')).toEqual({ text: 'a', end: null });
    // otros controles (tab, Ctrl+D) no entran
    expect(typeKeys('a', '\t\u0004b')).toEqual({ text: 'ab', end: null });
  });
});
