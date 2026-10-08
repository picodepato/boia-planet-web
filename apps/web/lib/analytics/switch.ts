import { browserSupabase } from '../supabase/browser';
import { isSupabaseConfigured } from '../supabase/config';

/**
 * El interruptor de la analítica de visitas del Admin (plan 019 T223,
 * decisión 17). Con Supabase, vale para toda la web: la fila de
 * `site_settings` (la lee cualquiera, sin sesión). En modo local (D-20), los
 * ajustes del Admin de este navegador. Apagada si no se puede leer.
 */
export async function readAnalyticsSwitch(): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const sb = browserSupabase();
    if (!sb) return false;
    const { data, error } = await sb
      .from('site_settings')
      .select('analytics_enabled')
      .maybeSingle();
    return !error && data?.analytics_enabled === true;
  }
  const { gameRepository } = await import('../repo');
  return (await gameRepository().admin.settings()).analyticsEnabled === true;
}
