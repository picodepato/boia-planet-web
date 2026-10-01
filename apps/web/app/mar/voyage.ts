import type { WorldConfig } from '@boia/world';
import type { PositionStore } from '../../lib/mundo/ship-position';
import type { VoyageEnd } from './engine/mar3d';
import { type EventTrip, islandOfEvent } from './sheet';

/**
 * Viajes y memoria del barco en el mar 3D, sin React ni three.js (T51):
 * «Ir a la isla» de un código (T43), qué pasa al llegar o al «Saltar», y la
 * posición guardada de una recarga (T44), aparte de la de /juego porque el
 * mar 3D es el mapa compartido a otra escala (el mundo compacto de T50).
 */

/** Clave de la posición del barco de /mar (la de /juego es `boia.barco.posicion`). */
export const MAR_POSITION_KEY = 'boia.mar.barco.posicion';

/**
 * El almacén de posiciones de /juego (`ship-position.ts`) con la clave de
 * /mar: mismas funciones de guardar y restaurar, otro sitio.
 */
export function marPositionStore(base: PositionStore): PositionStore {
  return {
    getItem: () => base.getItem(MAR_POSITION_KEY),
    setItem: (_key, value) => base.setItem(MAR_POSITION_KEY, value),
  };
}

/**
 * «Ir a la isla» de un código de descuento (T43): el viaje en turbo a la isla
 * del evento del código, que al llegar abre su ficha (con el aviso del
 * descuento). Sin isla en este mapa, null.
 */
export function islandTrip(world: WorldConfig, eventId: string): EventTrip | null {
  const o = islandOfEvent(world, eventId);
  return o ? { placeId: o.identity.id, placeName: o.identity.name, eventId, then: 'sheet' } : null;
}

/** Qué hace la web cuando termina un viaje: comprar, abrir la ficha o nada (tomó el timón). */
export type TripOutcome = 'checkout' | 'sheet' | 'none';

export function tripOutcome(trip: EventTrip, how: VoyageEnd | 'skip'): TripOutcome {
  if (how === 'cancelled') return 'none';
  return trip.then === 'sheet' ? 'sheet' : 'checkout';
}
