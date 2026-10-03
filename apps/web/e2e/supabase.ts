/**
 * Ayudas de las e2e con Supabase (`E2E_SUPABASE=1`, plan 008): cuentas de
 * usar y tirar bajo `@example.test`, el código de 6 cifras sacado con
 * `auth.admin.generateLink` (no se lee ningún buzón) y la sesión puesta en el
 * navegador donde la busca el cliente de la web.
 *
 * Uso en un spec:
 *   test.skip(!E2E_SUPABASE, 'sólo con E2E_SUPABASE=1');
 *   const m = await createMember('carnet');
 *   await signInPage(page, m);          // antes de page.goto
 *   …
 *   await deleteMembers([m]);           // en afterAll / finally
 */
import { createHmac, randomBytes } from 'node:crypto';
import type { Page } from '@playwright/test';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_AUTH_STORAGE_KEY } from '../lib/supabase/config';
import { E2E_SUPABASE, supabaseTestEnv, type SupabaseTestEnv } from './supabase-env';

export { E2E_SUPABASE };

export const TEST_EMAIL_DOMAIN = 'example.test';

const NO_SESSION = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

function env(): SupabaseTestEnv {
  const e = supabaseTestEnv();
  if (!e) throw new Error('Faltan las variables de Supabase (apps/web/.env.local)');
  return e;
}

export function serviceClient(): SupabaseClient {
  const e = env();
  return createClient(e.url, e.serviceKey, { auth: NO_SESSION });
}

export function anonClient(): SupabaseClient {
  const e = env();
  return createClient(e.url, e.anonKey, { auth: NO_SESSION });
}

export interface TestMember {
  id: string;
  email: string;
}

export function testEmail(label: string): string {
  const safe = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 20);
  return `boia-e2e-${safe}-${randomBytes(4).toString('hex')}@${TEST_EMAIL_DOMAIN}`;
}

/** Una cuenta confirmada nueva (se entra con código, sin contraseña). */
export async function createMember(label: string): Promise<TestMember> {
  const email = testEmail(label);
  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser: ${error?.message ?? 'sin usuario'}`);
  return { id: data.user.id, email };
}

/** El código de 6 cifras que llegaría al buzón (para teclearlo en la web). */
export async function otpFor(email: string): Promise<string> {
  const { data, error } = await serviceClient().auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  const otp = data?.properties?.email_otp;
  if (error || !otp) throw new Error(`generateLink: ${error?.message ?? 'sin código'}`);
  return otp;
}

/** Entra con el código fuera del navegador y devuelve la sesión. */
export async function signInSession(member: TestMember): Promise<Session> {
  const token = await otpFor(member.email);
  const { data, error } = await anonClient().auth.verifyOtp({
    email: member.email,
    token,
    type: 'email',
  });
  if (error || !data.session) throw new Error(`verifyOtp: ${error?.message ?? 'sin sesión'}`);
  return data.session;
}

/**
 * Deja la página con la sesión de `member`: la guarda en localStorage con la
 * clave del cliente de la web (`SUPABASE_AUTH_STORAGE_KEY`) antes de que
 * cargue. Llamar antes de `page.goto`.
 */
export async function signInPage(page: Page, member: TestMember): Promise<Session> {
  const session = await signInSession(member);
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [SUPABASE_AUTH_STORAGE_KEY, JSON.stringify(session)] as const,
  );
  return session;
}

/** Borra las cuentas (y en cascada todo lo suyo). */
export async function deleteMembers(members: readonly TestMember[]): Promise<void> {
  const service = serviceClient();
  for (const m of members) {
    await service.from('staff_roles').delete().eq('user_id', m.id);
    const { error } = await service.auth.admin.deleteUser(m.id);
    if (error && !/not.*found/i.test(error.message))
      throw new Error(`deleteUser: ${error.message}`);
  }
}

function base32Decode(s: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of s.replace(/=+$/, '').toUpperCase()) {
    const i = alphabet.indexOf(ch);
    if (i < 0) continue;
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/**
 * El código de 6 cifras de una app de autenticación (TOTP, RFC 6238: SHA-1,
 * 30 s) para el secreto en base32 que enseña el alta del Admin (T94).
 */
export function totp(secret: string, now: number = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 1000 / 30)));
  const h = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const o = h[h.length - 1]! & 0x0f;
  const n = (h.readUInt32BE(o) & 0x7fffffff) % 1_000_000;
  return String(n).padStart(6, '0');
}
