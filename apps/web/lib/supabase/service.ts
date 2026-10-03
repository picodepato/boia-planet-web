import { createClient } from '@supabase/supabase-js';
import type { Database } from '@boia/db/types';
import type { BoiaSupabase } from './browser';
import { supabasePublicConfig } from './config';

/**
 * Cliente con la clave secreta (service_role): se salta la RLS. Sólo en el
 * servidor (rutas, scripts), nunca en el navegador: la clave no lleva el
 * prefijo NEXT_PUBLIC_, así que Next no la mete en ningún paquete del
 * cliente, y además esta función se niega a correr en un navegador.
 * null si falta la clave o Supabase.
 */
export function serviceSupabase(): BoiaSupabase | null {
  if (typeof window !== 'undefined') {
    throw new Error('serviceSupabase() sólo existe en el servidor');
  }
  const cfg = supabasePublicConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!cfg || !key) return null;
  return createClient<Database>(cfg.url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
