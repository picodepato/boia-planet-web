import {
  CIRCUIT_MEDALS,
  BOARD_REF,
  INFO_BOIES,
  LIGHTHOUSE_PLACE_ID,
  WORLD_REGISTRY,
} from '@boia/world';
import { describe, expect, it } from 'vitest';
import {
  BOARD_CARDS,
  bestMedal,
  boardDestinations,
  canonBoardMedal,
  raceBoardMedal,
} from './board';
import { CANON_BEST_KEY, canonBoardBosses, canonBoardKey } from './ranking-canon';

/**
 * El «Tablón del faro» (plan 014 T157): de qué lugar va cada tarjeta, qué
 * medalla enseña. La ficha de viaje se prueba en sheet.test.ts y e2e.
 */

const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config;
const objects = world.objects;
const byId = (id: string) => objects.find((o) => o.identity.id === id)!;

describe('el Tablón del faro (T157)', () => {
  it('el faro ya no tiene minijuego: abre el tablón', () => {
    const faro = byId(LIGHTHOUSE_PLACE_ID);
    expect(faro.behaviors.some((b) => b.type === 'start_minigame')).toBe(false);
    expect(faro.behaviors.find((b) => b.type === 'content')?.params).toMatchObject({
      target: 'info',
      ref: BOARD_REF,
    });
  });

  it('cada tarjeta lleva a su lugar: la isla del Cañón, la del Castillo y la salida de la carrera', () => {
    const to = boardDestinations(objects);
    expect(Object.keys(to)).toEqual([...BOARD_CARDS]);
    const game = (id: string | null) =>
      byId(id!).behaviors.find((b) => b.type === 'start_minigame')?.params.gameId;
    expect(game(to.canon)).toBe('canon');
    expect(game(to.castillo)).toBe('castillo');
    expect(
      byId(to.carrera!).behaviors.some((b) => b.type === 'checkpoint' && b.params.order === 0),
    ).toBe(true);
    // Un mundo sin esos lugares no inventa destinos.
    expect(boardDestinations([])).toEqual({ canon: null, castillo: null, carrera: null });
  });

  it('las boies informativas que mandaban al faro mandan al tablón', () => {
    const toBoard = INFO_BOIES.filter((b) => b.guide === LIGHTHOUSE_PLACE_ID);
    expect(toBoard.length).toBeGreaterThan(0);
    // Y todas las demás señalan un lugar que existe.
    for (const b of INFO_BOIES) expect(byId(b.guide), b.id).toBeDefined();
    const target = byId(toBoard[0]!.guide);
    expect(target.behaviors.find((b) => b.type === 'content')?.params).toMatchObject({
      ref: BOARD_REF,
    });
  });

  it('los lugares inactivos no aparecen como destinos', () => {
    expect(
      boardDestinations(
        objects.map((o) => ({
          ...o,
          identity: { ...o.identity, active: false },
        })),
      ),
    ).toEqual(boardDestinations([]));
  });

  it('la medalla: la mejor del Cañón en este navegador y la del mejor tiempo de la carrera', () => {
    expect(bestMedal([null, 'bronce', undefined, 'plata'])).toBe('plata');
    expect(bestMedal([])).toBeNull();
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    expect(canonBoardMedal(storage)).toBeNull();
    const [first, second] = canonBoardBosses();
    const best = (medal: string | null) => ({
      score: 100,
      at: '2026-10-05T19:00:00.000Z',
      medal,
      difficulty: 'normal',
      games: 1,
    });
    store.set(
      CANON_BEST_KEY,
      JSON.stringify({
        [canonBoardKey(first!)]: best('bronce'),
        ...(second ? { [canonBoardKey(second)]: best('oro') } : {}),
      }),
    );
    expect(canonBoardMedal(storage)).toBe(second ? 'oro' : 'bronce');
    expect(raceBoardMedal(null, CIRCUIT_MEDALS)).toBeNull();
    expect(raceBoardMedal(CIRCUIT_MEDALS.gold, CIRCUIT_MEDALS)).toBe('oro');
    expect(raceBoardMedal(CIRCUIT_MEDALS.silver, CIRCUIT_MEDALS)).toBe('plata');
    expect(raceBoardMedal(CIRCUIT_MEDALS.bronze, CIRCUIT_MEDALS)).toBe('bronce');
    expect(raceBoardMedal(CIRCUIT_MEDALS.bronze + 1, CIRCUIT_MEDALS)).toBeNull();
  });
});
