/**
 * Las variables del proyecto Supabase de desarrollo (plan 008). Se leen de
 * `apps/web/.env.local`, el mismo archivo que usa Next, sin pisar lo que ya
 * esté en el entorno: como en Next, una variable definida (aunque esté
 * vacía) gana al archivo. Así `NEXT_PUBLIC_SUPABASE_URL= pnpm test:supabase`
 * prueba el modo sin Supabase aunque el archivo exista.
 *
 * Nunca se imprime un valor: sólo los nombres de las que faltan.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
export const ENV_FILE = `${REPO_ROOT}apps/web/.env.local`;

export const SUPABASE_ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_DB_URL',
] as const;
export type SupabaseEnvKey = (typeof SUPABASE_ENV_KEYS)[number];

export interface SupabaseEnv {
  url: string;
  anonKey: string;
  serviceKey: string;
  dbUrl: string;
  /** Referencia del proyecto (el subdominio de supabase.co). */
  ref: string;
}

/** `CLAVE=valor` por línea; ignora comentarios y quita comillas. */
export function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = m[2]!;
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    out[m[1]!] = value;
  }
  return out;
}

/** Copia al entorno las variables del archivo que el entorno no define. */
export function loadEnvFile(path: string = ENV_FILE, env: NodeJS.ProcessEnv = process.env): void {
  if (!existsSync(path)) return;
  for (const [k, v] of Object.entries(parseEnvFile(readFileSync(path, 'utf8')))) {
    if (env[k] === undefined) env[k] = v;
  }
}

export function projectRefFromUrl(url: string): string | null {
  try {
    const m = /^([a-z0-9]{20})\.supabase\.(co|in)$/.exec(new URL(url).hostname);
    return m ? m[1]! : null;
  } catch {
    return null;
  }
}

/**
 * Referencia del proyecto en la cadena de conexión: el usuario
 * `postgres.<ref>` del pooler o el host `db.<ref>.supabase.co`.
 */
export function projectRefFromDbUrl(dbUrl: string): string | null {
  try {
    const u = new URL(dbUrl);
    const user = /^postgres\.([a-z0-9]{20})$/.exec(decodeURIComponent(u.username));
    if (user) return user[1]!;
    const host = /^db\.([a-z0-9]{20})\.supabase\.(co|in)$/.exec(u.hostname);
    return host ? host[1]! : null;
  } catch {
    return null;
  }
}

export type SupabaseEnvResult =
  { ok: true; env: SupabaseEnv } | { ok: false; missing: SupabaseEnvKey[]; problem?: string };

/** Lee y comprueba las cuatro variables (vacía cuenta como ausente). */
export function readSupabaseEnv(env: NodeJS.ProcessEnv = process.env): SupabaseEnvResult {
  const missing = SUPABASE_ENV_KEYS.filter((k) => !env[k]?.trim());
  if (missing.length > 0) return { ok: false, missing };
  const url = env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const dbUrl = env.SUPABASE_DB_URL!.trim();
  const ref = projectRefFromUrl(url);
  if (!ref) {
    return {
      ok: false,
      missing: [],
      problem: 'NEXT_PUBLIC_SUPABASE_URL no es https://<ref>.supabase.co',
    };
  }
  const dbRef = projectRefFromDbUrl(dbUrl);
  if (dbRef !== ref) {
    return {
      ok: false,
      missing: [],
      problem:
        'SUPABASE_DB_URL no es del mismo proyecto que NEXT_PUBLIC_SUPABASE_URL: no se toca esa base',
    };
  }
  return {
    ok: true,
    env: {
      url,
      anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
      serviceKey: env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
      dbUrl,
      ref,
    },
  };
}

/** Carga el archivo y lee las variables. */
export function supabaseEnv(): SupabaseEnvResult {
  loadEnvFile();
  return readSupabaseEnv();
}
