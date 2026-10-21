import type { GuestListApi, GuestListStatus } from '../guestlist';
import { OPEN_PARAM } from '../scanner/carnet-url';
import { isSupabaseConfigured } from '../supabase/config';
import { type ListEvent, listEventOf } from './model';

/**
 * La lista de una fiesta según el Admin (plan 034 T311). Un trozo perezoso:
 * lo carga `useLiveList` tras hidratar, fuera de la ruta crítica de la
 * landing (T14).
 *
 * Con cuentas manda el estado vivo (`status()` de `lib/guestlist`): si la
 * fiesta va en lista y hasta qué hora (el aviso); abierta, completa o
 * cerrada lo dice el diálogo, que también lo pide. El contenido
 * (`event.guestList`) es sólo lo que se pinta primero y lo que vale en la
 * demo (D-20, sin Supabase), donde nada cambia.
 *
 * Resultado: la fiesta en lista (con la hora del Admin), `null` si el Admin
 * la quitó de la lista (vuelve la compra de siempre) o `undefined` si se
 * queda lo del contenido (la demo, sin cliente o si falla la consulta).
 */
export type LiveListResult = ListEvent | null | undefined;

/** La fiesta con la lista del Admin, o null si no va en lista. */
export function liveListEvent(
  event: ListEvent,
  status: Pick<GuestListStatus, 'enabled' | 'cap' | 'closesAt' | 'open'>,
): ListEvent | null {
  if (!status.enabled) return null;
  const out = listEventOf(event);
  out.guestList = {
    // Sin tope en el Admin (null): el botón no lo usa; se queda el del contenido.
    cap: status.cap ?? event.guestList?.cap ?? 1,
    open: status.open,
  };
  if (status.closesAt) out.guestList.closesAt = status.closesAt;
  return out;
}

export interface LiveListDeps {
  /** ¿Hay cuentas (Supabase)? Sin ellas, lo del contenido. */
  accounts: boolean;
  client: () => Promise<GuestListApi | null>;
  /** Las fiestas del contenido (para una que no iba en lista). */
  events: () => Promise<readonly ListEvent[]>;
}

// El cliente y el repositorio, aparte: en la demo no se descargan.
const browserDeps = (): LiveListDeps => ({
  accounts: isSupabaseConfigured(),
  client: () => import('../guestlist/client').then((m) => m.guestListClient()),
  events: () => import('../repo').then((m) => m.gameRepository().content.events()),
});

/** Lo que dice el Admin de la lista de `eventId` (sin caché; lo prueban las unitarias). */
export async function resolveLiveList(
  eventId: string,
  deps: LiveListDeps,
): Promise<LiveListResult> {
  if (!deps.accounts) return undefined;
  try {
    const api = await deps.client();
    if (!api) return undefined;
    const [status, events] = await Promise.all([api.status(eventId), deps.events()]);
    const event = events.find((e) => e.id === eventId);
    if (!event) return undefined;
    return liveListEvent(event, status);
  } catch (err) {
    console.warn('[boia] la lista en vivo', err);
    return undefined;
  }
}

/**
 * `?abrir=<id>` al volver del alta del Carnet (`returnHere`): true una sola
 * vez por página (se quita de la dirección), para que sólo un botón lo abra.
 */
export function takeOpen(
  eventId: string,
  loc: { href: string } = window.location,
  history: Pick<History, 'replaceState'> = window.history,
): boolean {
  const url = new URL(loc.href);
  if (url.searchParams.get(OPEN_PARAM) !== eventId) return false;
  url.searchParams.delete(OPEN_PARAM);
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  return true;
}

const cache = new Map<string, Promise<LiveListResult>>();

/**
 * Lo de `resolveLiveList` con las de este navegador, una consulta por fiesta
 * y página (la tarjeta y el panel de Tickets comparten), y si hay que abrir.
 */
export async function liveList(
  eventId: string,
  opens: boolean,
): Promise<{ list: LiveListResult; open: boolean }> {
  let pending = cache.get(eventId);
  if (!pending) {
    pending = resolveLiveList(eventId, browserDeps());
    cache.set(eventId, pending);
  }
  const list = await pending;
  return { list, open: opens && takeOpen(eventId) };
}
