import { CLIENT_FUNNEL_EVENTS, type ClientFunnelEvent } from '@boia/contracts/analytics';
import type { FunnelCountRow } from './funnel';

/**
 * Los contadores del embudo en modo local (D-20, plan 032 T301): la misma
 * forma que `private.funnel_counts` (día, paso, cuántas), en este
 * navegador, para que el panel «Embudo» del Admin funcione en la demo. Sin
 * identificadores: sólo sumas por día. Se guardan los últimos
 * LOCAL_FUNNEL_DAYS días.
 */

export const LOCAL_FUNNEL_KEY = 'boia.embudo';
export const LOCAL_FUNNEL_DAYS = 90;

/** Día → paso → cuántas. */
type Counts = Record<string, Partial<Record<ClientFunnelEvent, number>>>;

/** Lo mínimo de `Storage` que hace falta. Las pruebas pasan uno falso. */
export interface CountsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** El día de Alicante (Europe/Madrid), «AAAA-MM-DD», como el de la base de datos. */
export function funnelDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** «AAAA-MM-DD» menos `n` días. */
export function dayMinus(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function browserStorage(): CountsStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function load(storage: CountsStorage): Counts {
  try {
    const v: unknown = JSON.parse(storage.getItem(LOCAL_FUNNEL_KEY) ?? '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Counts) : {};
  } catch {
    return {};
  }
}

/** Suma uno al paso de hoy. false si no se pudo guardar o el paso no existe. */
export function addLocalFunnelStep(
  event: ClientFunnelEvent,
  now: Date = new Date(),
  storage: CountsStorage | null = browserStorage(),
): boolean {
  if (!storage || !CLIENT_FUNNEL_EVENTS.includes(event)) return false;
  const today = funnelDay(now);
  const oldest = dayMinus(today, LOCAL_FUNNEL_DAYS - 1);
  const counts = load(storage);
  for (const day of Object.keys(counts)) if (day < oldest) delete counts[day];
  const day = (counts[today] ??= {});
  day[event] = (day[event] ?? 0) + 1;
  try {
    storage.setItem(LOCAL_FUNNEL_KEY, JSON.stringify(counts));
    return true;
  } catch {
    return false;
  }
}

/** Todas las filas guardadas (día, paso, cuántas). */
export function readLocalFunnelCounts(
  storage: CountsStorage | null = browserStorage(),
): FunnelCountRow[] {
  if (!storage) return [];
  const rows: FunnelCountRow[] = [];
  for (const [day, steps] of Object.entries(load(storage))) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !steps || typeof steps !== 'object') continue;
    for (const [event, count] of Object.entries(steps)) {
      if (typeof count === 'number' && count > 0) rows.push({ day, event, count });
    }
  }
  return rows;
}
