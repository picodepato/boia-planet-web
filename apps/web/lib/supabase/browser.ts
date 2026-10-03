import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@boia/db/types';
import { SUPABASE_AUTH_STORAGE_KEY, supabasePublicConfig } from './config';

export type BoiaSupabase = SupabaseClient<Database>;

let client: BoiaSupabase | null | undefined;

/**
 * El cliente del navegador, uno por pestaña, con la sesión en localStorage
 * (`SUPABASE_AUTH_STORAGE_KEY`). null en modo local o en el servidor: allí
 * no hay sesión de nadie. La entrada es por código de 6 cifras (decisión 2),
 * sin enlace mágico, así que no se lee la sesión de la URL.
 */
export function browserSupabase(): BoiaSupabase | null {
  if (typeof window === 'undefined') return null;
  if (client !== undefined) return client;
  const cfg = supabasePublicConfig();
  client = cfg
    ? createClient<Database>(cfg.url, cfg.anonKey, {
        auth: {
          storageKey: SUPABASE_AUTH_STORAGE_KEY,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null;
  return client;
}

/** Sólo pruebas: olvida el cliente creado. */
export function resetBrowserSupabaseForTests(): void {
  client = undefined;
}
