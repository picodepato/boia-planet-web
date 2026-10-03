import { createClient } from '@supabase/supabase-js';
import type { Database } from '@boia/db/types';
import type { BoiaSupabase } from './browser';
import { supabasePublicConfig } from './config';

/**
 * Cliente del servidor con la clave publicable y sin sesión: para lecturas
 * públicas (Carnet público, rankings, botellas) desde componentes de
 * servidor o rutas. Ve lo mismo que un visitante anónimo. null en modo local.
 */
export function serverSupabase(): BoiaSupabase | null {
  const cfg = supabasePublicConfig();
  if (!cfg) return null;
  return createClient<Database>(cfg.url, cfg.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
