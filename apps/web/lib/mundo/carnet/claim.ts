/**
 * Reclamar el sello de una fiesta por QR (plan 008, T91, decisión 9). Lo
 * usan la cámara del Carnet («Escanear sello») y la página /sello.
 *
 * 1. Se mira qué fiesta es (nombre, fecha y lugar) para decirlo.
 * 2. Sin cuenta, la hoja de acceso con el motivo `stamp` (decisión 1): el
 *    código ya leído se guarda en memoria y se reclama al volver.
 * 3. `claim_stamp(e, c)`: una vez por cuenta, sólo en la ventana de la
 *    fiesta, +50 puntos (`muestra`).
 * 4. Concedido: la cuenta se vuelve a leer y el sello está en el Carnet.
 *
 * Sin Supabase (modo local, D-20) no hay a quién reclamar: `local`. El sello
 * de la compra de prueba sigue como siempre.
 */
import { requireAccount } from '../../account/gate';
import { accountClient, accountSnapshot } from '../../account/session';
import { gameRepository, refreshMemberAccount } from '../../repo';
import type { SelloCode } from '../../scanner/sello-url';
import { isSupabaseConfigured } from '../../supabase/config';

export interface StampEvent {
  slug: string;
  /** Id del evento en el servidor (para leer el sello propio). */
  id: string | null;
  name: string;
  startsAt: string | null;
  endsAt: string | null;
  place: string | null;
  /** Imagen del sello (T94); sin ella, el sello generado. */
  image: string | null;
}

export type ClaimOutcome =
  | { kind: 'granted'; event: StampEvent; points: number }
  | { kind: 'already'; event: StampEvent; at: string | null }
  | { kind: 'early' | 'late'; event: StampEvent; from: string | null; until: string | null }
  | { kind: 'invalid'; event: StampEvent | null }
  | { kind: 'offline'; event: StampEvent | null }
  | { kind: 'local' }
  | { kind: 'cancelled' };

/** Un nombre que enseñar aunque la fiesta no se encuentre: su slug, legible. */
export function fallbackEvent(slug: string): StampEvent {
  const name = slug.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  return { slug, id: null, name, startsAt: null, endsAt: null, place: null, image: null };
}

async function localEvent(slug: string): Promise<StampEvent | null> {
  try {
    const events = await gameRepository().content.list('events');
    const e = events.find((x) => x.id === slug || x.slug === slug);
    if (!e) return null;
    return {
      slug,
      id: null,
      name: e.name,
      startsAt: e.startsAt,
      endsAt: e.endsAt ?? null,
      place: e.placeLabel,
      image: null,
    };
  } catch {
    return null;
  }
}

/** La fiesta de un sello: la del servidor si hay Supabase, si no la del contenido. */
export async function stampEvent(slug: string): Promise<StampEvent | null> {
  const sb = await accountClient();
  if (sb) {
    try {
      const { data } = await sb
        .from('events')
        .select('id, slug, title, starts_at, ends_at, venue_public')
        .eq('slug', slug)
        .maybeSingle();
      if (data) {
        const local = await localEvent(slug);
        return {
          slug,
          id: data.id,
          name: data.title,
          startsAt: data.starts_at,
          endsAt: data.ends_at ?? local?.endsAt ?? null,
          place: data.venue_public ?? local?.place ?? null,
          image: null,
        };
      }
    } catch {
      // sin red: lo que diga el contenido local
    }
  }
  return localEvent(slug);
}

/**
 * La ventana del QR, del detalle de `outside_window` («El sello vale de
 * 2026-10-31 22:00:00+00 a 2026-11-01 06:00:00+00.»).
 */
export function parseWindow(
  detail: string | null | undefined,
): { from: string; until: string } | null {
  if (!detail) return null;
  const re = /(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(Z|[+-]\d{2}(?::?\d{2})?)?/g;
  const found = [...detail.matchAll(re)].map((m) => {
    let zone = m[3] ?? 'Z';
    if (/^[+-]\d{2}$/.test(zone)) zone += ':00';
    else if (/^[+-]\d{4}$/.test(zone)) zone = `${zone.slice(0, 3)}:${zone.slice(3)}`;
    const d = new Date(`${m[1]}T${m[2]}${zone}`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  });
  const [from, until] = found;
  return from && until ? { from, until } : null;
}

interface RpcError {
  message?: string;
  code?: string;
  details?: string | null;
}

function isTransient(err: RpcError | null | undefined, thrown: boolean): boolean {
  if (thrown) return true;
  const code = err?.code ?? '';
  return !code || code.startsWith('PGRST3') || /fetch|network/i.test(err?.message ?? '');
}

async function ownStampAt(eventId: string | null): Promise<string | null> {
  const uid = accountSnapshot().userId;
  const sb = await accountClient();
  if (!sb || !uid || !eventId) return null;
  try {
    const { data } = await sb
      .from('stamps')
      .select('granted_at')
      .eq('user_id', uid)
      .eq('event_id', eventId)
      .is('revoked_at', null)
      .maybeSingle();
    return data?.granted_at ?? null;
  } catch {
    return null;
  }
}

/** Reclama el sello de `sello`; pide la cuenta antes si hace falta. */
export async function claimStamp(
  sello: SelloCode,
  opts: { now?: () => number } = {},
): Promise<ClaimOutcome> {
  if (!isSupabaseConfigured()) return { kind: 'local' };
  const info = await stampEvent(sello.event);
  const event = info ?? fallbackEvent(sello.event);
  if (!(await requireAccount('stamp', { event: event.name }))) return { kind: 'cancelled' };
  const sb = await accountClient();
  if (!sb) return { kind: 'local' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { kind: 'offline', event };
  }
  let data: unknown = null;
  let error: RpcError | null = null;
  try {
    const res = await sb.rpc('claim_stamp', { p_event: sello.event, p_code: sello.code });
    data = res.data;
    error = res.error;
  } catch {
    return { kind: 'offline', event };
  }
  if (error) {
    const reason = error.message ?? '';
    if (reason === 'outside_window') {
      const w = parseWindow(error.details);
      const from = w?.from ?? event.startsAt;
      const until = w?.until ?? event.endsAt;
      const now = (opts.now ?? Date.now)();
      const early = from ? now < new Date(from).getTime() : false;
      return { kind: early ? 'early' : 'late', event, from, until };
    }
    if (reason === 'unknown_event' || reason === 'invalid_code' || reason === 'invalid_input') {
      return { kind: 'invalid', event: info };
    }
    if (isTransient(error, false)) return { kind: 'offline', event };
    return { kind: 'invalid', event: info };
  }
  const result = (data ?? {}) as { granted?: boolean; points?: number };
  if (result.granted) {
    await refreshMemberAccount().catch(() => {});
    return { kind: 'granted', event, points: Number(result.points ?? 0) };
  }
  return { kind: 'already', event, at: await ownStampAt(event.id) };
}
