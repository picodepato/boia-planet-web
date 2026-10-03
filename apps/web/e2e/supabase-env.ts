/**
 * El interruptor de las e2e con Supabase (plan 008, T86). Sin
 * `E2E_SUPABASE=1` las e2e corren en modo local como siempre: el servidor
 * arranca con las variables de Supabase vacías, que en Next ganan a
 * `apps/web/.env.local` (no pisa una variable ya definida), así el build no
 * ve Supabase aunque el archivo exista. Con `E2E_SUPABASE=1` el servidor
 * arranca con las del entorno o, si faltan, las de ese archivo.
 *
 * Sin dependencias: lo importa playwright.config.ts.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const E2E_SUPABASE = process.env.E2E_SUPABASE === '1';

export const ENV_FILE = fileURLToPath(new URL('../.env.local', import.meta.url));

export const SUPABASE_ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_DB_URL',
] as const;

/** Lo que hace falta en las pruebas: URL, clave publicable y clave secreta. */
export interface SupabaseTestEnv {
  url: string;
  anonKey: string;
  serviceKey: string;
}

function fileVars(): Record<string, string> {
  if (!existsSync(ENV_FILE)) return {};
  const out: Record<string, string> = {};
  for (const raw of readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(raw);
    if (!m || raw.trim().startsWith('#')) continue;
    out[m[1]!] = m[2]!.replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

/** Las variables de Supabase: el entorno gana al archivo, como en Next. */
export function supabaseVars(): Record<(typeof SUPABASE_ENV_KEYS)[number], string> {
  const file = fileVars();
  return Object.fromEntries(
    SUPABASE_ENV_KEYS.map((k) => [k, (process.env[k] ?? file[k] ?? '').trim()]),
  ) as Record<(typeof SUPABASE_ENV_KEYS)[number], string>;
}

export function supabaseTestEnv(): SupabaseTestEnv | null {
  const v = supabaseVars();
  if (
    !v.NEXT_PUBLIC_SUPABASE_URL ||
    !v.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    !v.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return null;
  }
  return {
    url: v.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: v.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceKey: v.SUPABASE_SERVICE_ROLE_KEY,
  };
}

/** El entorno del servidor de las e2e (`webServer.env`). */
export function webServerSupabaseEnv(): Record<string, string> {
  if (!E2E_SUPABASE) {
    return Object.fromEntries(SUPABASE_ENV_KEYS.map((k) => [k, '']));
  }
  const v = supabaseVars();
  const missing = SUPABASE_ENV_KEYS.filter((k) => k !== 'SUPABASE_DB_URL' && !v[k]);
  if (missing.length > 0) {
    throw new Error(`E2E_SUPABASE=1 sin ${missing.join(', ')} (en el entorno o en ${ENV_FILE})`);
  }
  return { ...v };
}
