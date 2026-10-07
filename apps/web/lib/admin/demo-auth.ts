/**
 * Entrar al Admin de la demo con el Carnet 000 (plan 017 T193, decisión 9).
 *
 * El Carnet número 000 es el del Admin. En modo local (D-20, sin servidor)
 * se entra con «000» y una contraseña que se comprueba en el navegador
 * contra un hash con sal (PBKDF2-SHA-256, Web Crypto). En el repositorio
 * sólo está el hash: la contraseña nunca.
 *
 * Esto es una puerta de la demo, no seguridad: el Admin local sólo cambia
 * los datos de este navegador y todo su código está en el navegador. Con
 * Supabase manda el servidor (`real/gate.tsx`: contraseña de la cuenta del
 * Carnet 000 y TOTP).
 */

/** El número del Carnet del Admin. Nunca se da a un socio. */
export const ADMIN_CARNET_NUMBER = 0;

/** Cómo se enseña: «000». */
export const ADMIN_CARNET_LABEL = '000';

export interface PasswordHash {
  algorithm: 'PBKDF2-SHA-256';
  iterations: number;
  /** Sal aleatoria, base64. */
  salt: string;
  /** 32 bytes derivados, base64. */
  hash: string;
}

/**
 * El hash de la contraseña del Admin de la demo (elegida por Hernán,
 * 2026-10-07). Para cambiarla: un hash nuevo con otra sal (ver ESTADO.md,
 * plan 017 T193); nunca el texto.
 */
export const DEMO_ADMIN_PASSWORD: PasswordHash = {
  algorithm: 'PBKDF2-SHA-256',
  iterations: 310_000,
  salt: 'wnAJLLFBB4i3t048uYKQTw==',
  hash: 'I4Rdy3MFodn8RreF62N/lWPPbmGRpcIk4LFSmVON1bk=',
};

/**
 * El número de un Carnet escrito a mano: «000», «0», «Nº 000», «#000»… Sólo
 * cifras (con espacios o un prefijo «nº»/«#» alrededor); otra cosa, null.
 */
export function parseCarnetNumber(input: string): number | null {
  const clean = input
    .trim()
    .replace(/^(n[ºo°.]?|#)\s*/i, '')
    .replace(/\s+/g, '');
  if (!/^\d{1,9}$/.test(clean)) return null;
  return Number(clean);
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(text: string): Uint8Array {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** PBKDF2-SHA-256 de `password` con `salt` (base64): 32 bytes en base64. */
export async function derivePasswordHash(
  password: string,
  salt: string,
  iterations: number,
): Promise<string> {
  const subtle = globalThis.crypto.subtle;
  const key = await subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64(salt) as BufferSource, iterations },
    key,
    256,
  );
  return toBase64(new Uint8Array(bits));
}

/** Compara sin cortar en la primera diferencia. */
function sameText(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** ¿Es `password` la del hash? */
export async function checkPassword(password: string, stored: PasswordHash): Promise<boolean> {
  if (!password) return false;
  const derived = await derivePasswordHash(password, stored.salt, stored.iterations);
  return sameText(derived, stored.hash);
}

/**
 * ¿Es el Admin? El Carnet 000 y su contraseña. Otro número no entra nunca
 * (y no se dice si el fallo es el número o la contraseña).
 */
export async function checkDemoAdmin(
  carnet: string,
  password: string,
  stored: PasswordHash = DEMO_ADMIN_PASSWORD,
): Promise<boolean> {
  const ok = await checkPassword(password, stored);
  return ok && parseCarnetNumber(carnet) === ADMIN_CARNET_NUMBER;
}

// ---------------------------------------------------------------------------
// La sesión del Admin de la demo en este navegador

/** Clave en localStorage (dura 12 horas o hasta «Salir del Admin»). */
export const DEMO_ADMIN_SESSION_KEY = 'boia.admin.demo';
export const DEMO_ADMIN_SESSION_MS = 12 * 60 * 60 * 1000;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function storage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** ¿Hay sesión del Admin de la demo sin caducar? */
export function hasDemoSession(store: StorageLike | null = storage(), now = Date.now()): boolean {
  try {
    const raw = store?.getItem(DEMO_ADMIN_SESSION_KEY);
    if (!raw) return false;
    const v = JSON.parse(raw) as { carnet?: unknown; at?: unknown };
    return (
      v.carnet === ADMIN_CARNET_LABEL &&
      typeof v.at === 'number' &&
      v.at <= now &&
      now - v.at < DEMO_ADMIN_SESSION_MS
    );
  } catch {
    return false;
  }
}

export function startDemoSession(store: StorageLike | null = storage(), now = Date.now()): void {
  try {
    store?.setItem(DEMO_ADMIN_SESSION_KEY, JSON.stringify({ carnet: ADMIN_CARNET_LABEL, at: now }));
  } catch {
    // sin almacenamiento: dura lo que dure la página
  }
}

export function endDemoSession(store: StorageLike | null = storage()): void {
  try {
    store?.removeItem(DEMO_ADMIN_SESSION_KEY);
  } catch {
    // nada que borrar
  }
}
