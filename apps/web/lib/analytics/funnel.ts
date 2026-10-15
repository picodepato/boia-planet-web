import { CLIENT_FUNNEL_EVENTS, type ClientFunnelEvent } from '@boia/contracts/analytics';

/**
 * Las cuentas del panel «Embudo» del Admin (plan 032 T301): por paso, lo
 * contado en los últimos N días (hoy incluido) y qué parte es del paso
 * anterior. Sólo el Admin lo importa: nada de esto va a la landing.
 */

/** Una fila de los contadores: la de `admin_funnel_counts` o la del modo local. */
export interface FunnelCountRow {
  day: string;
  event: string;
  count: number;
}

export interface FunnelStepSummary {
  event: ClientFunnelEvent;
  count: number;
  /** % del paso anterior, redondeado; null en el primero o si el anterior es 0. */
  pctFromPrev: number | null;
}

/** Los pasos, en orden. `purchase_confirmed` llegará con la ticketera real. */
export const FUNNEL_STEPS: readonly ClientFunnelEvent[] = CLIENT_FUNNEL_EVENTS;

/** Las ventanas del panel, en días. */
export const FUNNEL_WINDOWS = [7, 30] as const;

/** «AAAA-MM-DD» del primer día de la ventana de `days` días que acaba en `today`. */
export function windowStart(today: string, days: number): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d.toISOString().slice(0, 10);
}

export function funnelSummary(
  rows: readonly FunnelCountRow[],
  today: string,
  days: number,
): FunnelStepSummary[] {
  const from = windowStart(today, days);
  const totals = new Map<string, number>();
  for (const r of rows) {
    if (r.day < from || r.day > today) continue;
    totals.set(r.event, (totals.get(r.event) ?? 0) + r.count);
  }
  let prev: number | null = null;
  return FUNNEL_STEPS.map((event) => {
    const count = totals.get(event) ?? 0;
    const pctFromPrev = prev ? Math.round((count / prev) * 100) : null;
    prev = count;
    return { event, count, pctFromPrev };
  });
}
