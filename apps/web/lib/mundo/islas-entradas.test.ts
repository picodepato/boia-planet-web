import { canBuy } from '@boia/contracts';
import { SAMPLE_EVENTS, TICKET_EVENT_ISLANDS } from '@boia/store';
import {
  HALLOWEEN_PLACE_ID,
  TICKET_ISLAND_EVENTS,
  type WorldObject,
} from '@boia/world';
import { describe, expect, it } from 'vitest';
import { marWorld } from '../../app/mar/engine/compact';
import { worldTickets } from '../../app/mar/entradas-model';
import { eventOfPlace } from '../../app/mar/sheet';
import { islandEvent } from '../admin/world';
import { resolveTicketsPanel } from '../landing/resolve';
import { SAMPLE_CONTENT } from '../landing/sample-content';
import { worlds } from './demo-world';

/**
 * Las islas y los eventos con entradas del 2026-10-02 (T67, decisión de
 * Hernán y Álvaro): los nombres del mundo principal, la Isla de Halloween en
 * los dos mundos y exactamente tres eventos a la venta, cada uno en su isla,
 * en la landing y en «Elige tu evento» de /mar.
 */

/** Hoy, antes del primero de los tres. */
const NOW = new Date('2026-10-02T12:00:00+02:00');

/** Lo que decidieron: id de lugar → nombre en Arcilla, el mundo principal. */
const ARCILLA_NAMES: Record<string, string> = {
  // Desde el 2026-10-04 (T108), el puerto donde se cambia de barco.
  cala: 'Puerto de Alicante',
  fotos: 'Isla de Benidorm',
  tienda: 'Botiga Ibiza',
  faro: 'Tabarca',
  canon: 'Puig Campana',
  allday: 'ALL DAY BOIA',
  ultima: 'Isla de Nochevieja',
  halloween: 'HALLOWEEN IN THE CLUB',
  // Igual que antes.
  puerto: 'El Varadero',
  naufrago: 'El náufrago',
  fiestera: 'El Remanso de los Cocodrilos',
  // El circuito, de El Freu a Los Rápidos (el id no cambia).
  circuito: 'Los Rápidos',
};

/** Los tres eventos: nombre, día (en Madrid) e isla. */
const TICKET_EVENTS: [name: string, day: string, island: string][] = [
  ['HALLOWEEN IN THE CLUB', '2026-10-31', 'halloween'],
  ['ALL DAY BOIA', '2026-12-05', 'allday'],
  ['BOIA Nochevieja', '2026-12-31', 'ultima'],
];

const dayInMadrid = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(iso));

const objectIn = (worldId: string, id: string): WorldObject | undefined =>
  worlds.get(worldId).config.objects.find((o) => o.identity.id === id);

describe('islas y entradas del 2026-10-02 (T67)', () => {
  it('Arcilla lleva los nombres decididos', () => {
    const got = Object.fromEntries(
      Object.keys(ARCILLA_NAMES).map((id) => [id, objectIn('arcilla', id)?.identity.name]),
    );
    expect(got).toEqual(ARCILLA_NAMES);
  });

  it('la Isla de Halloween está en los dos mundos: isla activa que vende su evento', () => {
    expect(worlds.ids()).toEqual(expect.arrayContaining(['arcilla', 'acuarela']));
    for (const w of worlds.ids()) {
      const o = objectIn(w, HALLOWEEN_PLACE_ID);
      expect(o, w).toBeDefined();
      expect(o!.identity).toMatchObject({
        category: 'isla',
        active: true,
        name: 'HALLOWEEN IN THE CLUB',
      });
      expect(eventOfPlace(o)).toBe(TICKET_ISLAND_EVENTS.halloween);
      expect(o!.behaviors.some((b) => b.type === 'ticket')).toBe(true);
      // También en el mar 3D (el mundo compacto de /mar).
      expect(marWorld(worlds.get(w).config).objects.map((x) => x.identity.id)).toContain(
        HALLOWEEN_PLACE_ID,
      );
    }
  });

  it('las tres islas con entradas se llaman igual en los dos mundos', () => {
    for (const [, , island] of TICKET_EVENTS) {
      expect(objectIn('acuarela', island)?.identity.name, island).toBe(
        objectIn('arcilla', island)?.identity.name,
      );
    }
  });

  it('exactamente tres eventos a la venta, en su isla y en su fecha', () => {
    const onSale = SAMPLE_EVENTS.filter((e) => e.state === 'on_sale');
    expect(onSale.map((e) => [e.name, dayInMadrid(e.startsAt), e.islandId])).toEqual(TICKET_EVENTS);
    // Los ids del mapa y los del contenido son los mismos.
    expect(
      Object.fromEntries(Object.entries(TICKET_ISLAND_EVENTS).map(([island, id]) => [id, island])),
    ).toEqual(TICKET_EVENT_ISLANDS);
    for (const e of SAMPLE_CONTENT.events.filter((x) => x.state === 'on_sale')) {
      expect(canBuy(e, NOW), e.id).toBe(true);
      expect(e.priceSample, e.id).toBe(true);
      // Cada isla abre su evento (el vivo del Admin también lo liga).
      expect(eventOfPlace(objectIn('arcilla', e.islandId!))).toBe(e.id);
      expect(islandEvent(e.islandId!, SAMPLE_CONTENT.events, NOW)?.id).toBe(e.id);
    }
  });

  it('el panel de Tickets de la landing y «Elige tu evento» de /mar enseñan sólo esos tres', () => {
    const panel = resolveTicketsPanel(SAMPLE_CONTENT, NOW);
    const listed = [...(panel.featured ? [panel.featured] : []), ...panel.others];
    expect(listed.map((e) => e.name).sort()).toEqual(TICKET_EVENTS.map(([n]) => n).sort());
    const world = marWorld(worlds.get('arcilla').config);
    const tickets = worldTickets(
      SAMPLE_CONTENT,
      NOW,
      (id) => world.objects.find((o) => eventOfPlace(o) === id)?.identity.id ?? null,
    );
    expect(tickets.entries.map((t) => [t.event.name, t.placeId, t.buyable])).toEqual(
      TICKET_EVENTS.map(([name, , island]) => [name, island, true]),
    );
  });
});
