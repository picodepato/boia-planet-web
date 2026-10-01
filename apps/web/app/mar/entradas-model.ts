import { type BoiaEvent, type HomeContent, canBuy } from '@boia/contracts';
import { resolveTicketsPanel } from '../../lib/landing/resolve';

/**
 * El panel «Elige tu evento» dentro del mar 3D (T58, REQ-ENT-037), sin React
 * ni three.js: los mismos eventos que el panel de Tickets de la landing (el
 * prioritario vigente, aunque no se venda, y los próximos a la venta, por
 * `resolveTicketsPanel`), cada uno con su compra y con la isla a la que
 * volar en este mapa, si la tiene.
 */
export interface WorldTicket {
  /** Con su estado de ahora (el contenido llega ya resuelto, `liveContent`). */
  event: BoiaEvent;
  /** El evento destacado (el prioritario). */
  featured: boolean;
  /** Se puede comprar ya (`canBuy`). */
  buyable: boolean;
  /** Su isla en este mapa, o null si no tiene (un satélite sin isla). */
  placeId: string | null;
}

export interface WorldTickets {
  entries: WorldTicket[];
  /** Falso si no hay nada que comprar: el panel dice «Próximamente». */
  onSale: boolean;
}

export function worldTickets(
  content: HomeContent,
  now: Date,
  islandOf: (eventId: string) => string | null,
): WorldTickets {
  const view = resolveTicketsPanel(content, now);
  const entry = (event: BoiaEvent, featured: boolean): WorldTicket => ({
    event,
    featured,
    buyable: canBuy(event),
    placeId: islandOf(event.id),
  });
  return {
    entries: [
      ...(view.featured ? [entry(view.featured, true)] : []),
      ...view.others.map((e) => entry(e, false)),
    ],
    onSale: view.onSale,
  };
}
