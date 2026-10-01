import type { WorldConfig } from '@boia/world';
import { planArrival } from '../../lib/mundo/arrival';
import type { PositionStore } from '../../lib/mundo/ship-position';
import type { MarSail } from './deep-link';
import type { VoyageEnd } from './engine/mar3d';
import { type EventTrip, type SheetState, islandOfEvent } from './sheet';

/**
 * Viajes y memoria del barco en el mar 3D, sin React ni three.js (T51):
 * «Ir a la isla» de un código (T43), los enlaces profundos de la landing
 * (T55), qué pasa al llegar o al «Saltar», y la posición guardada de una
 * recarga (T44), aparte de la del 2D porque el mar 3D es el mapa compartido
 * a otra escala (el mundo compacto de T50).
 */

/** Clave de la posición del barco de /mar (la del 2D es `boia.barco.posicion`). */
export const MAR_POSITION_KEY = 'boia.mar.barco.posicion';

/**
 * El almacén de posiciones del 2D (`ship-position.ts`) con la clave de /mar:
 * mismas funciones de guardar y restaurar, otro sitio.
 */
export function marPositionStore(base: PositionStore): PositionStore {
  return {
    getItem: () => base.getItem(MAR_POSITION_KEY),
    setItem: (_key, value) => base.setItem(MAR_POSITION_KEY, value),
  };
}

/**
 * Viaje a un lugar sin evento pedido por enlace (`?ir=fotos`, `?ir=tienda`,
 * T55): al llegar abre la ficha del lugar (la galería, el escaparate…).
 */
export interface PlaceTrip {
  placeId: string;
  placeName: string;
  then: 'place';
  /** La ficha que abre al llegar. */
  open: SheetState;
}

/** Un viaje en turbo del mar: a un evento (comprar o su ficha) o a un lugar. */
export type Trip = EventTrip | PlaceTrip;

/**
 * «Ir a la isla» de un código de descuento (T43): el viaje en turbo a la isla
 * del evento del código, que al llegar abre su ficha (con el aviso del
 * descuento). Sin isla en este mapa, null.
 */
export function islandTrip(world: WorldConfig, eventId: string): EventTrip | null {
  const o = islandOfEvent(world, eventId);
  return o ? { placeId: o.identity.id, placeName: o.identity.name, eventId, then: 'sheet' } : null;
}

/**
 * El viaje que pide un enlace profundo (T55, REQ-ENT-034): `?ir=<lugar>` va a
 * ese lugar y abre su ficha al llegar (en una isla de evento, la del evento
 * pedido si existe y si no la del suyo); `?evento=` sin lugar va a la isla
 * del evento. `eventIdOf` pasa un id o un slug al id del evento (null si no
 * existe). Sin lugar activo ni isla en este mapa, null.
 */
export function linkTrip(
  world: WorldConfig,
  sail: MarSail,
  eventIdOf: (idOrSlug: string) => string | null,
): Trip | null {
  const eventId = sail.eventId ? eventIdOf(sail.eventId) : null;
  if (sail.placeId) {
    const plan = planArrival(
      world.objects,
      { placeId: sail.placeId, ...(eventId ? { eventId } : {}) },
      (id) => eventIdOf(id) === id,
    );
    const o = plan ? world.objects.find((x) => x.identity.id === plan.placeId) : undefined;
    if (!plan || !o) return eventId ? islandTrip(world, eventId) : null;
    const base = { placeId: plan.placeId, placeName: o.identity.name };
    const p = plan.panel;
    if (p?.kind === 'event') return { ...base, eventId: p.eventId, then: 'sheet' };
    const open: SheetState = p
      ? {
          kind: 'content',
          placeId: plan.placeId,
          target: p.target,
          ...(p.ref ? { ref: p.ref } : {}),
        }
      : { kind: 'preview', placeId: plan.placeId };
    return { ...base, then: 'place', open };
  }
  return eventId ? islandTrip(world, eventId) : null;
}

/** La ficha que abre un viaje al llegar (si abre ficha y no la compra). */
export function arrivalSheet(trip: Trip): SheetState {
  return trip.then === 'place'
    ? trip.open
    : { kind: 'event', placeId: trip.placeId, eventId: trip.eventId };
}

/** Qué hace la web cuando termina un viaje: comprar, abrir la ficha o nada (tomó el timón). */
export type TripOutcome = 'checkout' | 'sheet' | 'none';

export function tripOutcome(trip: Trip, how: VoyageEnd | 'skip'): TripOutcome {
  if (how === 'cancelled') return 'none';
  return trip.then === 'sheet' || trip.then === 'place' ? 'sheet' : 'checkout';
}
