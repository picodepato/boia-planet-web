import type { GameSurface } from '@boia/engine';

/**
 * Paso del mundo de la landing al juego 2D (REQ-ENT-012). Al pulsar EXPLORAR,
 * la entrada cede su superficie (aplicación Pixi, canvas y mar vivo) y la
 * navegación al 2D es del lado del cliente: el juego la recoge y pinta su
 * mundo en el mismo canvas, sin crear otro contexto WebGL ni repetir la
 * entrada. Vive en memoria del módulo, así que sólo existe dentro de la misma
 * página (una recarga o un enlace directo al 2D arrancan en limpio).
 */

/** Si el 2D no la recoge en este plazo (navegación cancelada), se destruye. */
const CLAIM_WINDOW_MS = 15_000;

let pending: { surface: GameSurface; timer: ReturnType<typeof setTimeout> } | null = null;

export function offerWorld(surface: GameSurface): void {
  discardWorld();
  const timer = setTimeout(discardWorld, CLAIM_WINDOW_MS);
  pending = { surface, timer };
}

/** La superficie cedida, una sola vez; `null` si no hay ninguna. */
export function claimWorld(): GameSurface | null {
  if (!pending) return null;
  clearTimeout(pending.timer);
  const { surface } = pending;
  pending = null;
  return surface;
}

export function discardWorld(): void {
  if (!pending) return;
  clearTimeout(pending.timer);
  const { surface } = pending;
  pending = null;
  surface.app.destroy({ removeView: true }, { children: true });
}

/** La ruta del mundo navegable (el planeta 3D). */
export const MAR_PATH = '/mar';

/**
 * Abrir el mar en un lugar (REQ-ENT-034, REQ-AVE-022, T55): `/mar?ir=<lugar>`
 * arranca el mar 3D con el barco navegando hacia el lugar (sin premios ni
 * descubrimientos al llegar, REQ-ENT-039; «Saltar» llega ya) y, al llegar,
 * abre su ficha. `evento` elige qué evento enseña una isla de evento; sin
 * `ir`, el barco navega a la isla de ese evento. Lo usan los accesos de la
 * landing (Tickets, Fotos, Tienda) y cualquier «Ir a la isla»; el mar lo
 * consume una vez y lo quita de la URL, así una recarga no repite el viaje.
 */
export const PLACE_PARAM = 'ir';
export const PLACE_EVENT_PARAM = 'evento';
/** `?menu=<panel>`: el mar abre ese panel de a bordo al arrancar (T55). */
export const MENU_PARAM = 'menu';
/** Mi Carnet dentro del mar: verlo y editarlo sin salir del mundo (T55). */
export const MAR_CARNET_HREF = `${MAR_PATH}?${MENU_PARAM}=carnet`;

export interface PlaceRequest {
  placeId: string;
  eventId?: string;
}

/** Enlace al mar con el barco rumbo a `placeId` y su ficha al llegar. */
export function placeHref(placeId: string, opts: { eventId?: string } = {}): string {
  const q = new URLSearchParams({ [PLACE_PARAM]: placeId });
  if (opts.eventId) q.set(PLACE_EVENT_PARAM, opts.eventId);
  return `${MAR_PATH}?${q.toString()}`;
}

/** El mar con el barco navegando a la isla de un evento (`?evento=` sin `?ir=`). */
export function eventSailHref(eventId: string): string {
  return `${MAR_PATH}?${PLACE_EVENT_PARAM}=${encodeURIComponent(eventId)}`;
}

/** El lugar pedido en la URL del mar, o `null`. */
export function readPlaceRequest(search: string): PlaceRequest | null {
  const q = new URLSearchParams(search);
  const placeId = q.get(PLACE_PARAM)?.trim();
  if (!placeId) return null;
  const eventId = q.get(PLACE_EVENT_PARAM)?.trim();
  return eventId ? { placeId, eventId } : { placeId };
}

/** La misma ruta sin la petición de lugar (se quita al llegar). */
export function withoutPlaceRequest(href: string): string {
  const url = new URL(href, 'http://boia.invalid');
  url.searchParams.delete(PLACE_PARAM);
  url.searchParams.delete(PLACE_EVENT_PARAM);
  return url.pathname + url.search + url.hash;
}
