/**
 * Ayudas de las pruebas contra el proyecto Supabase de desarrollo
 * (`pnpm test:supabase`): cuentas de usar y tirar bajo `@example.test`,
 * entrada con el código de 6 cifras sacado con `auth.admin.generateLink` (no
 * se lee ningún buzón) y segundo factor TOTP calculado aquí (RFC 6238).
 */
import { createHmac, randomBytes } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types.ts';
import type { SupabaseEnv } from './env.ts';

export type Client = SupabaseClient<Database>;

export const TEST_EMAIL_DOMAIN = 'example.test';

const NO_SESSION = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

export function anonClient(env: SupabaseEnv): Client {
  return createClient<Database>(env.url, env.anonKey, { auth: NO_SESSION });
}

export function serviceClient(env: SupabaseEnv): Client {
  return createClient<Database>(env.url, env.serviceKey, { auth: NO_SESSION });
}

/**
 * Una marca nueva, sólo letras: va dentro de apodos y mensajes de prueba, y
 * con cifras (`T230 123456`) el filtro de texto la tomaba por un teléfono
 * (`text_phone`) y la prueba fallaba según la suerte (T276).
 */
export function newRunId(): string {
  return Array.from(randomBytes(6), (b) => String.fromCharCode(97 + (b % 26))).join('');
}

/**
 * Marca de esta ejecución: va en el email de cada cuenta, así varias
 * ejecuciones a la vez (otra tarea, otro árbol) no se borran las cuentas.
 * La fija `pnpm test:supabase` en BOIA_TEST_RUN.
 */
export function testRunId(): string {
  const id = process.env.BOIA_TEST_RUN ?? (process.env.BOIA_TEST_RUN = newRunId());
  return (
    id
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 12) || 'run'
  );
}

export function testEmail(label: string): string {
  const safe = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 20);
  return `boia-${testRunId()}-${safe}-${randomBytes(4).toString('hex')}@${TEST_EMAIL_DOMAIN}`;
}

/** ¿Es una cuenta de esta ejecución? */
export function isThisRun(email: string): boolean {
  return email.startsWith(`boia-${testRunId()}-`) && email.endsWith(`@${TEST_EMAIL_DOMAIN}`);
}

export interface TestUser {
  id: string;
  email: string;
  createdAt?: string;
}

/** Crea una cuenta confirmada (sin contraseña: se entra con código). */
export async function createTestUser(service: Client, label: string): Promise<TestUser> {
  const email = testEmail(label);
  const { data, error } = await service.auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser: ${error?.message ?? 'sin usuario'}`);
  return { id: data.user.id, email };
}

/** El código de 6 cifras de un email, como el que llegaría al buzón. */
export async function otpFor(service: Client, email: string): Promise<string> {
  const { data, error } = await service.auth.admin.generateLink({ type: 'magiclink', email });
  const otp = data?.properties?.email_otp;
  if (error || !otp) throw new Error(`generateLink: ${error?.message ?? 'sin código'}`);
  return otp;
}

/**
 * Cuánto se espera, como mucho, a que Supabase Auth deje volver a entrar.
 * Su límite de verificaciones por IP (30 cada 5 minutos por defecto) se va
 * rellenando, así que la suite entera choca con él a mitad (T276): se
 * reintenta cada RATE_LIMIT_STEP_MS hasta este tope.
 */
export const RATE_LIMIT_WAIT_MS = 6 * 60_000;
const RATE_LIMIT_STEP_MS = 12_000;

/** Un cliente con la sesión de esa cuenta, entrando con su código. */
export async function signIn(env: SupabaseEnv, service: Client, email: string): Promise<Client> {
  const client = anonClient(env);
  const deadline = Date.now() + RATE_LIMIT_WAIT_MS;
  for (;;) {
    const token = await otpFor(service, email);
    const { data, error } = await client.auth.verifyOtp({ email, token, type: 'email' });
    if (!error && data.session) return client;
    const limited = error && (error.status === 429 || /rate limit/i.test(error.message));
    if (!limited || Date.now() > deadline) {
      throw new Error(`verifyOtp: ${error?.message ?? 'sin sesión'}`);
    }
    await new Promise((r) => setTimeout(r, RATE_LIMIT_STEP_MS));
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

/** Código TOTP de 6 cifras (SHA-1, 30 s) de un secreto en base32. */
export function totp(secret: string, now: number = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 1000 / 30)));
  const h = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const o = h[h.length - 1]! & 0x0f;
  const n = (h.readUInt32BE(o) & 0x7fffffff) % 1_000_000;
  return String(n).padStart(6, '0');
}

/** Los secretos de los TOTP dados de alta aquí, por factor. */
const totpSecrets = new Map<string, string>();

/**
 * Sube la sesión a aal2 (segundo factor, D-10). Si la cuenta ya tiene un TOTP
 * dado de alta en esta ejecución (una sesión nueva de la misma cuenta, T276),
 * se usa ése: Supabase no deja dar de alta otro desde aal1. Si no, da de alta
 * uno nuevo.
 */
export async function elevateToAal2(client: Client): Promise<void> {
  const listed = await client.auth.mfa.listFactors();
  const known = listed.data?.totp.find((f) => f.status === 'verified' && totpSecrets.has(f.id));
  if (known) {
    const secret = totpSecrets.get(known.id)!;
    let v = await client.auth.mfa.challengeAndVerify({ factorId: known.id, code: totp(secret) });
    if (v.error) {
      // El mismo código no vale dos veces: el de la siguiente ventana de 30 s.
      await new Promise((r) => setTimeout(r, 30_000 - (Date.now() % 30_000) + 500));
      v = await client.auth.mfa.challengeAndVerify({ factorId: known.id, code: totp(secret) });
    }
    if (v.error) throw new Error(`mfa.verify: ${v.error.message}`);
    return;
  }
  const { data, error } = await client.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `boia-test-${randomBytes(3).toString('hex')}`,
  });
  if (error || !data) throw new Error(`mfa.enroll: ${error?.message ?? 'sin factor'}`);
  const secret = data.totp.secret;
  totpSecrets.set(data.id, secret);
  const v = await client.auth.mfa.challengeAndVerify({ factorId: data.id, code: totp(secret) });
  if (v.error) throw new Error(`mfa.verify: ${v.error.message}`);
}

/** Todas las cuentas `@example.test` del proyecto. */
export async function listTestUsers(service: Client): Promise<TestUser[]> {
  const out: TestUser[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    for (const u of data.users) {
      if (u.email?.endsWith(`@${TEST_EMAIL_DOMAIN}`)) {
        out.push({ id: u.id, email: u.email, createdAt: u.created_at });
      }
    }
    if (data.users.length < 1000) break;
  }
  return out;
}

/** Borra cuentas (y en cascada todo lo suyo). */
export async function deleteTestUsers(service: Client, users: readonly TestUser[]): Promise<void> {
  for (const u of users) {
    // Un rol del equipo se quita antes: el último propietario no se borra.
    await service.from('staff_roles').delete().eq('user_id', u.id);
    const { error } = await service.auth.admin.deleteUser(u.id);
    if (error && !/not.*found/i.test(error.message)) {
      throw new Error(`deleteUser: ${error.message}`);
    }
  }
}

/** Cuentas de prueba olvidadas por una ejecución cortada (más de 30 min). */
export async function staleTestUsers(service: Client, minutes = 30): Promise<TestUser[]> {
  const limit = Date.now() - minutes * 60_000;
  return (await listTestUsers(service)).filter(
    (u) => isThisRun(u.email) || (u.createdAt !== undefined && Date.parse(u.createdAt) < limit),
  );
}
