import { describe, expect, it } from 'vitest';
import {
  type PositionStore,
  SHIP_POSITION_KEY,
  SHIP_POSITION_MIN_MOVE,
  loadShipPosition,
  movedEnough,
  restoreShipPosition,
  saveShipPosition,
  shouldRestorePosition,
} from './ship-position';

/**
 * Posición del barco en el dispositivo (T44, REQ-IDE-004): se guarda al
 * navegar y una recarga de /juego la restaura con su rumbo.
 */

class MemoryStore implements PositionStore {
  readonly map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
}

/** Un barco de mentira: `moveShip` como el del motor (deja el barco donde se pide). */
function fakeGame() {
  const moves: Array<{ x: number; y: number; heading?: number }> = [];
  return {
    moves,
    moveShip(x: number, y: number, heading?: number) {
      moves.push({ x, y, ...(heading === undefined ? {} : { heading }) });
      return { x, y };
    },
  };
}

const reload = {
  navigationType: 'reload',
  bootedBefore: false,
  handedOver: false,
  placeRequested: false,
};

describe('posición del barco (REQ-IDE-004)', () => {
  it('se restaura tras recargar: misma posición y mismo rumbo', () => {
    const store = new MemoryStore();
    // Primera visita: el barco navega y la posición se guarda.
    saveShipPosition(store, { x: 1234.56, y: -987.64, heading: 1.2345 });
    // Recarga: página nueva, el mismo almacén del dispositivo.
    const game = fakeGame();
    const at = restoreShipPosition(game, store, reload);
    expect(at).toEqual({ x: 1234.6, y: -987.6 });
    expect(game.moves).toEqual([{ x: 1234.6, y: -987.6, heading: 1.235 }]);
  });

  it('no se restaura al llegar desde EXPLORAR, con ?ir= o ?cerca=, ni en una carga nueva', () => {
    const store = new MemoryStore();
    saveShipPosition(store, { x: 10, y: 20, heading: 0 });
    for (const when of [
      { ...reload, handedOver: true },
      { ...reload, placeRequested: true },
      { ...reload, navigationType: 'navigate' },
    ]) {
      const game = fakeGame();
      expect(restoreShipPosition(game, store, when)).toBeNull();
      expect(game.moves).toEqual([]);
    }
  });

  it('volver a /juego sin recargar (Atrás o desde otra página) también sigue donde estaba', () => {
    expect(shouldRestorePosition({ ...reload, navigationType: 'back_forward' })).toBe(true);
    expect(
      shouldRestorePosition({ ...reload, navigationType: 'navigate', bootedBefore: true }),
    ).toBe(true);
  });

  it('sin nada guardado, o con basura, el barco sale de donde siempre', () => {
    const store = new MemoryStore();
    expect(restoreShipPosition(fakeGame(), store, reload)).toBeNull();
    store.setItem(SHIP_POSITION_KEY, '{roto');
    expect(loadShipPosition(store)).toBeNull();
    store.setItem(SHIP_POSITION_KEY, JSON.stringify({ x: 'a', y: 2 }));
    expect(loadShipPosition(store)).toBeNull();
    expect(restoreShipPosition(fakeGame(), null, reload)).toBeNull();
  });

  it('parado no vuelve a escribir; al moverse o girar, sí', () => {
    const p = { x: 0, y: 0, heading: 0 };
    expect(movedEnough(null, p)).toBe(true);
    expect(movedEnough(p, { ...p, x: SHIP_POSITION_MIN_MOVE / 2 })).toBe(false);
    expect(movedEnough(p, { ...p, x: SHIP_POSITION_MIN_MOVE })).toBe(true);
    expect(movedEnough(p, { ...p, heading: 0.5 })).toBe(true);
  });
});
