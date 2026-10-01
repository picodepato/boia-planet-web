import { BOTTLE_FIND_RADIUS, isSeaSpot } from '@boia/engine/bottles';
import { SAMPLE_BOTTLES } from '@boia/store';
import { BOTTLE_SPOTS, WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { settleInSea } from '@boia/engine/bottles';
import { bottlesNear, dropSpot, marPeriod, marSea, placeBottles } from './bottles';
import { marWorld } from './engine/compact';
import { planetRect } from './engine/wrap';

const shared = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config;
const mar = marWorld(shared);
const spawn = mar.spawn!;
const period = marPeriod(mar);
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

/** Las de muestra como las deja el repositorio de la web (lib/repo.ts). */
const samples = settleInSea(
  shared,
  SAMPLE_BOTTLES.map((b, i) => {
    const spot = BOTTLE_SPOTS[i];
    return spot ? { ...b, x: spot.x, y: spot.y } : b;
  }),
).map((b) => ({ ...b, isMine: false, read: false }));

describe('botellas en el mar 3D (T56)', () => {
  it('las de muestra flotan todas en el agua del planeta', () => {
    const placed = placeBottles(samples, shared, mar);
    expect(placed.map((b) => b.id)).toEqual(samples.map((b) => b.id));
    const ok = marSea(mar);
    for (const b of placed) expect(ok(b), b.id).toBe(true);
  });

  it('una de muestra se encuentra nada más zarpar', () => {
    const placed = placeBottles(samples, shared, mar);
    expect(bottlesNear(spawn, placed, new Set(), period).length).toBeGreaterThan(0);
  });

  it('la que echa el barco se guarda en el agua del mapa y aparece junto a él', () => {
    const r = mar.bounds;
    let tried = 0;
    for (let i = 1; i < 10; i++) {
      for (let j = 1; j < 10; j++) {
        const ship = {
          x: r.left + ((r.right - r.left) * i) / 10,
          y: r.top + ((r.bottom - r.top) * j) / 10,
          heading: -Math.PI / 2,
        };
        // Sólo desde el agua (el barco no navega por tierra).
        if (!marSea(mar)(ship)) continue;
        tried++;
        const p = dropSpot(shared, mar, ship);
        expect(p, `${ship.x},${ship.y}`).not.toBeNull();
        expect(isSeaSpot(shared, p!)).toBe(true);
        const [placed] = placeBottles(
          [{ id: 'mia', ...p!, isMine: true, read: false }],
          shared,
          mar,
        );
        expect(placed, `${ship.x},${ship.y}`).toBeDefined();
        expect(bottlesNear(ship, [placed!], new Set(), period), `${ship.x},${ship.y}`).toEqual([
          'mia',
        ]);
      }
    }
    expect(tried).toBeGreaterThan(20);
  });

  it('desde la salida también', () => {
    const p = dropSpot(shared, mar, spawn as { x: number; y: number; heading: number })!;
    const [placed] = placeBottles([{ id: 'mia', ...p, isMine: true, read: false }], shared, mar);
    expect(dist(placed!, spawn)).toBeLessThanOrEqual(BOTTLE_FIND_RADIUS);
  });

  it('cerca por el camino corto: al otro lado del borde del planeta también', () => {
    const rect = planetRect(mar.bounds);
    const ship = { x: rect.right - 20, y: spawn.y };
    const b = { id: 'b', x: rect.left + 40, y: spawn.y, mine: false, read: false };
    expect(bottlesNear(ship, [b], new Set(), period)).toEqual(['b']);
    expect(bottlesNear({ x: rect.left + 600, y: spawn.y }, [b], new Set(), period)).toEqual([]);
  });
});
