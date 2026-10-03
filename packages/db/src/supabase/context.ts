/**
 * Contexto común de las pruebas `*.supabase.ts`: el entorno, los clientes y
 * las cuentas creadas por cada archivo (se borran en su afterAll).
 */
import { expect } from 'vitest';
import type { RpcRejection } from '../rpc.ts';
import { supabaseEnv, type SupabaseEnv } from './env.ts';
import {
  anonClient,
  createTestUser,
  deleteTestUsers,
  serviceClient,
  signIn,
  type Client,
  type TestUser,
} from './testkit.ts';

export interface Member extends TestUser {
  client: Client;
}

export interface Ctx {
  env: SupabaseEnv;
  service: Client;
  anon: Client;
  users: TestUser[];
  /** Cuenta nueva sin sesión. */
  user(label: string): Promise<TestUser>;
  /** Cuenta nueva con sesión (entra con su código de 6 cifras). */
  member(label: string): Promise<Member>;
  cleanup(): Promise<void>;
}

export function context(): Ctx {
  const r = supabaseEnv();
  if (!r.ok) throw new Error(r.problem ?? `faltan ${r.missing.join(', ')}`);
  const env = r.env;
  const service = serviceClient(env);
  const users: TestUser[] = [];
  return {
    env,
    service,
    anon: anonClient(env),
    users,
    async user(label) {
      const u = await createTestUser(service, label);
      users.push(u);
      return u;
    },
    async member(label) {
      const u = await createTestUser(service, label);
      users.push(u);
      return { ...u, client: await signIn(env, service, u.email) };
    },
    async cleanup() {
      await deleteTestUsers(service, users);
    },
  };
}

interface PgError {
  code?: string;
  message?: string;
}

/** La llamada falla con el rechazo `reason` (mensaje de la RPC). */
export async function expectRejected(
  call: PromiseLike<{ error: PgError | null }>,
  reason: RpcRejection,
): Promise<void> {
  const { error } = await call;
  expect(error?.message).toBe(reason);
}

/** La llamada falla por permisos (sin GRANT o fuera de la RLS): 42501. */
export async function expectDenied(call: PromiseLike<{ error: PgError | null }>): Promise<void> {
  const { error } = await call;
  expect(error?.code).toBe('42501');
}

/**
 * Devuelve `data` y falla la prueba si hubo error. Sin error, `data` es lo
 * que devolvió la llamada (null sólo en las que no devuelven nada).
 */
export async function ok<T>(
  call: PromiseLike<{ data: T; error: PgError | null }>,
): Promise<NonNullable<T>> {
  const { data, error } = await call;
  expect(error).toBeNull();
  return data as NonNullable<T>;
}

/** Un evento publicado de prueba con su código de sello (borrar con dropEvents). */
export async function testEvent(
  ctx: Ctx,
  slug: string,
  window: { from: Date; until: Date },
): Promise<{ id: string; slug: string; code: string }> {
  const start = new Date(window.from.getTime() + 60 * 60_000);
  const ev = await ok(
    ctx.service
      .from('events')
      .insert({
        slug,
        title: `Prueba ${slug}`,
        state: 'on_sale',
        published_at: new Date().toISOString(),
        starts_at: start.toISOString(),
        is_sample: true,
      })
      .select('id, slug')
      .single(),
  );
  const code = `T${Math.random().toString(36).slice(2, 10).toUpperCase()}`.replace(
    /[^A-Z0-9]/g,
    'X',
  );
  await ok(
    ctx.service.from('event_stamp_codes').insert({
      event_id: ev.id,
      code,
      valid_from: window.from.toISOString(),
      valid_until: window.until.toISOString(),
    }),
  );
  return { id: ev.id, slug: ev.slug, code };
}

export async function dropEvents(ctx: Ctx, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await ctx.service.from('events').delete().in('id', ids);
}
