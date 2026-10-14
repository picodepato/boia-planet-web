/**
 * Contraseña del Admin de la demo (plan 029 T283): el hash PBKDF2-SHA-256 con
 * sal nueva y la reescritura de `DEMO_ADMIN_PASSWORD` en `lib/admin/demo-auth.ts`.
 * Sin entrada/salida: lo usa `admin-password.mjs` y lo prueba `admin-password.test.ts`.
 */
import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

export const SALT_BYTES = 16;
export const HASH_BYTES = 32;
export const MIN_LENGTH = 8;

/** Hash nuevo con sal aleatoria; mismos parámetros que `derivePasswordHash`. */
export function makeHash(password, iterations, salt = randomBytes(SALT_BYTES)) {
  return {
    algorithm: 'PBKDF2-SHA-256',
    iterations,
    salt: Buffer.from(salt).toString('base64'),
    hash: pbkdf2Sync(password, salt, iterations, HASH_BYTES, 'sha256').toString('base64'),
  };
}

/**
 * Lo tecleado en modo crudo (sin eco), trozo a trozo: Intro acaba, Ctrl+C
 * cancela, borrar quita el último carácter, y las flechas y demás teclas
 * especiales (secuencias ESC) no entran en la contraseña (T283 audit).
 * Devuelve el texto hasta ahora y si se acabó (`enter`/`cancel`) o no (null).
 */
export function typeKeys(text, chunk) {
  let out = Array.from(text);
  const chars = Array.from(chunk);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === '\r' || ch === '\n') return { text: out.join(''), end: 'enter' };
    if (ch === '\u0003') return { text: '', end: 'cancel' };
    if (ch === '\u007f' || ch === '\b') {
      out = out.slice(0, -1);
    } else if (ch === '\u001b') {
      // ESC [ … final  o  ESC O final: la tecla especial entera fuera; el
      // bucle salta después el carácter final (de @ a ~).
      if (chars[i + 1] === '[' || chars[i + 1] === 'O') {
        i += 2;
        while (i < chars.length && !/[@-~]/.test(chars[i])) i++;
      }
    } else if (ch >= ' ') {
      out.push(ch);
    }
  }
  return { text: out.join(''), end: null };
}

const BLOCK = /export const DEMO_ADMIN_PASSWORD: PasswordHash = \{[\s\S]*?\n\};/;

/** Las vueltas del hash que hay ahora en el código. */
export function currentIterations(source) {
  const block = BLOCK.exec(source)?.[0];
  const n = block && /iterations:\s*([\d_]+)/.exec(block)?.[1];
  if (!n) throw new Error('No encuentro DEMO_ADMIN_PASSWORD en demo-auth.ts');
  return Number(n.replace(/_/g, ''));
}

/** El hash que hay ahora en el código (sal, vueltas y hash). */
export function readHash(source) {
  const block = BLOCK.exec(source)?.[0];
  const salt = block && /salt:\s*'([^']+)'/.exec(block)?.[1];
  const hash = block && /hash:\s*'([^']+)'/.exec(block)?.[1];
  if (!salt || !hash) throw new Error('No encuentro DEMO_ADMIN_PASSWORD en demo-auth.ts');
  return { algorithm: 'PBKDF2-SHA-256', iterations: currentIterations(source), salt, hash };
}

/** ¿`password` da este hash? (lo mismo que `checkPassword` de la demo, en Node). */
export function verifyHash(password, stored) {
  const salt = Buffer.from(stored.salt, 'base64');
  const want = Buffer.from(stored.hash, 'base64');
  const got = pbkdf2Sync(password, salt, stored.iterations, want.length, 'sha256');
  return got.length === want.length && timingSafeEqual(got, want);
}

/** El código con el hash nuevo en lugar del viejo; el resto, intacto. */
export function replaceHash(source, hash) {
  if (!BLOCK.test(source)) throw new Error('No encuentro DEMO_ADMIN_PASSWORD en demo-auth.ts');
  const iterations = String(hash.iterations).replace(/\B(?=(\d{3})+(?!\d))/g, '_');
  const block = [
    'export const DEMO_ADMIN_PASSWORD: PasswordHash = {',
    `  algorithm: '${hash.algorithm}',`,
    `  iterations: ${iterations},`,
    `  salt: '${hash.salt}',`,
    `  hash: '${hash.hash}',`,
    '};',
  ].join('\n');
  return source.replace(BLOCK, () => block);
}
