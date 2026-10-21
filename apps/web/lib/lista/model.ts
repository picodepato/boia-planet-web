import type { BoiaEvent } from '@boia/contracts';
import type { GuestListStatus } from '@boia/store';
import { fill } from '../i18n/core';
import { esListaBoton, type ListaBotonKey } from '../i18n/es-lista-boton';

/**
 * La lista de una fiesta, del lado del socio (plan 034 T309): lo que decide
 * qué se enseña, sin React. Lo usan el botón de la landing y la ficha, el
 * diálogo y /mar. Los datos y las reglas, en `lib/guestlist` (T308).
 */

/**
 * Traduce sólo las claves del botón: va en la landing (presupuesto de T14).
 * Las del diálogo, `tl` de `./t`.
 */
export function tlb(key: ListaBotonKey, vars?: Record<string, string | number>): string {
  return fill(esListaBoton[key], vars);
}

/** Lo que la interfaz de la lista necesita de una fiesta. */
export type ListEvent = Pick<
  BoiaEvent,
  'id' | 'slug' | 'name' | 'timeZone' | 'guestList' | 'boxOfficeOnly' | 'priceCents'
>;

/** Sólo lo que la lista necesita (lo que viaja de la página al botón de la landing). */
export function listEventOf(event: ListEvent): ListEvent {
  const out: ListEvent = {
    id: event.id,
    slug: event.slug,
    name: event.name,
    timeZone: event.timeZone,
  };
  if (event.guestList) out.guestList = event.guestList;
  if (event.boxOfficeOnly) out.boxOfficeOnly = event.boxOfficeOnly;
  if (event.priceCents !== undefined) out.priceCents = event.priceCents;
  return out;
}

/** La misma fiesta sin lista: como era antes del plan 034 (las pruebas de la puerta). */
export function withoutGuestList<E extends Pick<BoiaEvent, 'guestList'>>(event: E): E {
  const copy = { ...event };
  delete copy.guestList;
  return copy;
}

/**
 * ¿Va la fiesta en lista? Manda sobre la compra, el «Solo en puerta» y el
 * «Tickets todavía no disponibles»: en una fiesta en lista no se compra nada.
 */
export function inListMode(event: Pick<BoiaEvent, 'guestList'> | undefined | null): boolean {
  return !!event?.guestList;
}

/**
 * «5 € con carnet en puerta»: el precio de la puerta o, sin él, el del
 * evento. null si no hay ninguno (no se dice nada).
 */
export function listDoorPrice(
  event: Pick<BoiaEvent, 'boxOfficeOnly' | 'priceCents'>,
): string | null {
  const cents = event.boxOfficeOnly?.doorPriceCents ?? event.priceCents;
  if (cents === undefined) return null;
  const euros = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(cents / 100);
  return tlb('lista.doorPrice', { euros });
}

/** «22:30»: la hora de cierre en la zona horaria de la fiesta. */
export function listClosingTime(closesAt: string, timeZone: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(closesAt));
}

/**
 * «La lista vale hasta las 22:30; después, por orden de llegada». null sin
 * hora de cierre (sólo cierra el interruptor del Admin): no hay nada que decir.
 */
export function listNotice(closesAt: string | null | undefined, timeZone: string): string | null {
  if (!closesAt) return null;
  return tlb('lista.notice', { time: listClosingTime(closesAt, timeZone) });
}

/**
 * Qué enseña el diálogo según el estado de la lista y si hay Carnet:
 * - `closed`: interruptor cerrado o pasada la hora («Lista cerrada»), sin
 *   botones de apuntarse ni de borrarse (con la inscripción, si la hay);
 * - `mine`: ya apuntado (fecha, nombre y «Borrarme de la lista»);
 * - `full`: «Lista completa»;
 * - `carnet`: sin Carnet, entrar o sacárselo y volver;
 * - `join`: el nombre (el apodo del Carnet) y «Apuntarme».
 */
export type ListPhase = 'closed' | 'mine' | 'full' | 'carnet' | 'join';

export function listPhase(
  status: Pick<GuestListStatus, 'closed' | 'full' | 'mine'>,
  hasCarnet: boolean,
): ListPhase {
  if (status.closed) return 'closed';
  if (status.mine) return 'mine';
  if (status.full) return 'full';
  if (!hasCarnet) return 'carnet';
  return 'join';
}
