import { WORLD_REGISTRY } from '@boia/world';
import { SAMPLE_DISCOUNTS } from '@boia/store';
import { describe, expect, it } from 'vitest';
import { SAMPLE_CONTENT } from '../../lib/landing/sample-content';
import {
  SHIP_POSITION_KEY,
  loadShipPosition,
  saveShipPosition,
} from '../../lib/mundo/ship-position';
import { marWorld } from './engine/compact';
import { PHOTOS_PLACE_ID, STORE_PLACE_ID } from '../../lib/landing/access';
import { readMarLinks } from './deep-link';
import {
  MAR_POSITION_KEY,
  arrivalSheet,
  islandTrip,
  linkTrip,
  marPositionStore,
  tripOutcome,
} from './voyage';

/**
 * Viajes y posición del barco en el mar 3D (T51): «Ir a la isla» de un
 * código lleva a la isla de su evento y abre su ficha; «Entradas», la
 * compra; tomar el timón no abre nada; los enlaces profundos (T55) navegan
 * a su lugar y abren su ficha. La posición de /mar se guarda aparte de la del
 * 2D (otra escala del mismo mapa).
 */

const world = marWorld(WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config);

describe('islandTrip', () => {
  it('cada código de un evento con isla lleva a esa isla y abre su ficha al llegar', () => {
    const withIsland = SAMPLE_DISCOUNTS.filter((d) => {
      const e = SAMPLE_CONTENT.events.find((x) => x.id === d.eventId);
      return e?.islandId && world.objects.some((o) => o.identity.id === e.islandId);
    });
    expect(withIsland.length).toBeGreaterThan(0);
    for (const d of withIsland) {
      const e = SAMPLE_CONTENT.events.find((x) => x.id === d.eventId)!;
      const trip = islandTrip(world, e.id);
      expect(trip).toMatchObject({ placeId: e.islandId, eventId: e.id, then: 'sheet' });
    }
  });

  it('un evento sin isla no tiene viaje', () => {
    expect(islandTrip(world, 'no-existe')).toBeNull();
  });
});

const eventIdOf = (idOrSlug: string) =>
  SAMPLE_CONTENT.events.find((e) => e.id === idOrSlug || e.slug === idOrSlug)?.id ?? null;
const sailOf = (search: string) => readMarLinks(search).sail!;

describe('linkTrip (enlaces profundos, T55)', () => {
  it('`?ir=` del Puerto de Fotos y de la tienda: navega allí y abre su ficha', () => {
    for (const [id, target] of [
      [PHOTOS_PLACE_ID, 'photos'],
      [STORE_PLACE_ID, 'store'],
    ] as const) {
      const trip = linkTrip(world, sailOf(`?ir=${id}`), eventIdOf)!;
      expect(trip).toMatchObject({ placeId: id, then: 'place' });
      expect(tripOutcome(trip, 'arrived')).toBe('sheet');
      expect(arrivalSheet(trip)).toMatchObject({ kind: 'content', placeId: id, target });
    }
  });

  it('`?ir=<isla>&evento=<id>` y `?evento=<id o slug>`: a la isla del evento, con su ficha', () => {
    const e = SAMPLE_CONTENT.events.find(
      (x) => x.islandId && world.objects.some((o) => o.identity.id === x.islandId),
    )!;
    const searches = [`?ir=${e.islandId}&evento=${e.id}`, `?evento=${e.id}`, `?evento=${e.slug}`];
    for (const search of searches) {
      const trip = linkTrip(world, sailOf(search), eventIdOf)!;
      expect(trip, search).toMatchObject({ placeId: e.islandId, eventId: e.id, then: 'sheet' });
      expect(arrivalSheet(trip)).toEqual({ kind: 'event', placeId: e.islandId, eventId: e.id });
    }
  });

  it('un lugar o un evento que no existe no tiene viaje', () => {
    expect(linkTrip(world, sailOf('?ir=no-existe'), eventIdOf)).toBeNull();
    expect(linkTrip(world, sailOf('?evento=no-existe'), eventIdOf)).toBeNull();
  });
});

describe('tripOutcome', () => {
  const tickets = { placeId: 'allday', placeName: 'x', eventId: 'e' };
  const code = { ...tickets, then: 'sheet' as const };
  it('«Entradas» acaba en la compra; «Ir a la isla», en la ficha', () => {
    expect(tripOutcome(tickets, 'arrived')).toBe('checkout');
    expect(tripOutcome(tickets, 'skip')).toBe('checkout');
    expect(tripOutcome(code, 'arrived')).toBe('sheet');
    expect(tripOutcome(code, 'timeout')).toBe('sheet');
    expect(tripOutcome(code, 'skip')).toBe('sheet');
  });
  it('tomar el timón no abre nada', () => {
    expect(tripOutcome(tickets, 'cancelled')).toBe('none');
    expect(tripOutcome(code, 'cancelled')).toBe('none');
  });
});

describe('marPositionStore', () => {
  it('guarda la posición de /mar aparte de la del 2D', () => {
    const data = new Map<string, string>();
    const base = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    };
    saveShipPosition(base, { x: 1, y: 2, heading: 0 });
    const store = marPositionStore(base);
    saveShipPosition(store, { x: 30, y: -40, heading: 1.5 });
    expect(loadShipPosition(store)).toMatchObject({ x: 30, y: -40, heading: 1.5 });
    expect(loadShipPosition(base)).toMatchObject({ x: 1, y: 2 });
    expect([...data.keys()].sort()).toEqual([MAR_POSITION_KEY, SHIP_POSITION_KEY].sort());
  });
});
