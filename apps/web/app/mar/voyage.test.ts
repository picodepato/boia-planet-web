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
import { MAR_POSITION_KEY, islandTrip, marPositionStore, tripOutcome } from './voyage';

/**
 * Viajes y posición del barco en el mar 3D (T51): «Ir a la isla» de un
 * código lleva a la isla de su evento y abre su ficha; «Entradas», la
 * compra; tomar el timón no abre nada. La posición de /mar se guarda aparte
 * de la de /juego (otra escala del mismo mapa).
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
  it('guarda la posición de /mar aparte de la de /juego', () => {
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
