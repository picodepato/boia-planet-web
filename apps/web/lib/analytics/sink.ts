import type { ClientFunnelEvent } from '@boia/contracts/analytics';
import { supabasePublicConfig } from '../supabase/config';
import { addLocalFunnelStep } from './local-counts';

/**
 * Adónde van los pasos del embudo (plan 032 T301). Se carga a demanda desde
 * `./index` (fuera de la ruta crítica de la landing).
 *
 * Con Supabase, dos llamadas sueltas a la Data API con la clave publicable y
 * nada más: ni supabase-js ni la sesión de quien navega (los contadores no
 * saben de quién viene un paso).
 * - El interruptor del Admin (plan 019 T223, decisión 17): la fila de
 *   `site_settings`, que lee cualquiera.
 * - El paso: `funnel_hit`, con `keepalive` para que salga aunque la página
 *   navegue (Explorar, ticketera).
 * En modo local (D-20), el interruptor son los ajustes del Admin de este
 * navegador y los contadores van a `./local-counts`.
 */

function headers(anonKey: string): Record<string, string> {
  return { apikey: anonKey };
}

export async function readAnalyticsSwitch(): Promise<boolean> {
  const sb = supabasePublicConfig();
  if (sb) {
    const res = await fetch(`${sb.url}/rest/v1/site_settings?select=analytics_enabled`, {
      headers: headers(sb.anonKey),
    });
    if (!res.ok) return false;
    const rows = (await res.json()) as { analytics_enabled?: unknown }[];
    return Array.isArray(rows) && rows[0]?.analytics_enabled === true;
  }
  const { gameRepository } = await import('../repo');
  return (await gameRepository().admin.settings()).analyticsEnabled === true;
}

export async function sendFunnelStep(event: ClientFunnelEvent): Promise<boolean> {
  const sb = supabasePublicConfig();
  if (!sb) return addLocalFunnelStep(event);
  const res = await fetch(`${sb.url}/rest/v1/rpc/funnel_hit`, {
    method: 'POST',
    keepalive: true,
    headers: { ...headers(sb.anonKey), 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_event: event }),
  });
  return res.ok;
}
