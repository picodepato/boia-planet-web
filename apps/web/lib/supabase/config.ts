/**
 * ¿Hay Supabase? (plan 008). Sin `NEXT_PUBLIC_SUPABASE_URL` y
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY` (producción en Vercel hoy, pruebas
 * unitarias, e2e por defecto) la web sigue en modo local, todo en el
 * navegador como dice D-20: `isSupabaseConfigured()` es false y nadie crea
 * un cliente. Una variable vacía cuenta como ausente.
 *
 * Next sustituye `process.env.NEXT_PUBLIC_…` al compilar, así que las dos se
 * nombran literalmente aquí (no con `process.env[nombre]`).
 */

export interface SupabasePublicConfig {
  url: string;
  /** La clave publicable (anon): va en el navegador, la RLS hace el resto. */
  anonKey: string;
}

/** Dónde guarda la sesión el cliente del navegador (localStorage). */
export const SUPABASE_AUTH_STORAGE_KEY = 'boia.supabase.auth';

export interface SupabasePublicEnv {
  url?: string | undefined;
  anonKey?: string | undefined;
}

function fromProcess(): SupabasePublicEnv {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function supabasePublicConfig(
  env: SupabasePublicEnv = fromProcess(),
): SupabasePublicConfig | null {
  const url = env.url?.trim();
  const anonKey = env.anonKey?.trim();
  if (!url || !anonKey) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.hostname !== '127.0.0.1' && u.hostname !== 'localhost') {
      return null;
    }
  } catch {
    return null;
  }
  return { url, anonKey };
}

export function isSupabaseConfigured(env?: SupabasePublicEnv): boolean {
  return supabasePublicConfig(env) !== null;
}
