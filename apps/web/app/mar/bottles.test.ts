import {
  BOTTLE_DROP_DISTANCE,
  BOTTLE_FIND_RADIUS,
  isSeaSpot,
  sheetZones,
} from '@boia/engine/bottles';
import { SAMPLE_BOTTLES } from '@boia/store';
import { BOTTLE_SPOTS, WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { settleInSea } from '@boia/engine/bottles';
import { bottlesNear, dropSpot, marPeriod, marReadable, marSea, placeBottles } from './bottles';
import { marWorld } from './engine/compact';
import { pointMap } from './engine/compress';
import { planetRect, shortest } from './engine/wrap';

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

/** Las islas del planeta cuya ficha se abre sola al acercarse. */
const islands = sheetZones(mar).filter(
  (z) => mar.objects.find((o) => o.identity.id === z.id)?.identity.category === 'isla',
);

describe('botellas en el mar 3D (T56)', () => {
  it('las de muestra flotan todas en el agua del planeta', () => {
    const placed = placeBottles(samples, shared, mar);
    expect(placed.map((b) => b.id)).toEqual(samples.map((b) => b.id));
    const ok = marReadable(mar);
    for (const b of placed) expect(ok(b), b.id).toBe(true);
  });

  it('una de muestra se encuentra nada más zarpar', () => {
    const placed = placeBottles(samples, shared, mar);
    expect(bottlesNear(spawn, placed, new Set(), period).length).toBeGreaterThan(0);
  });

  it('la que echa el barco se guarda en el agua del mapa y aparece junto a él (lejos de las islas)', () => {
    const r = mar.bounds;
    const zones = sheetZones(mar);
    /** Lejos de toda ficha: todo sitio junto a la popa se puede leer. */
    const clear = (p: { x: number; y: number }) =>
      zones.every((z) => {
        const d = shortest(p, z, period);
        return Math.hypot(d.dx, d.dy) >= z.keepAway + 3 * BOTTLE_DROP_DISTANCE;
      });
    let tried = 0;
    let nearIsland = 0;
    for (let i = 1; i < 10; i++) {
      for (let j = 1; j < 10; j++) {
        const ship = {
          x: r.left + ((r.right - r.left) * i) / 10,
          y: r.top + ((r.bottom - r.top) * j) / 10,
          heading: -Math.PI / 2,
        };
        // Sólo desde el agua (el barco no navega por tierra).
        if (!marSea(mar)(ship)) continue;
        const p = dropSpot(shared, mar, ship);
        expect(p, `${ship.x},${ship.y}`).not.toBeNull();
        expect(isSeaSpot(shared, p!)).toBe(true);
        const [placed] = placeBottles(
          [{ id: 'mia', ...p!, isMine: true, read: false }],
          shared,
          mar,
        );
        expect(placed, `${ship.x},${ship.y}`).toBeDefined();
        expect(marReadable(mar)(placed!), `${ship.x},${ship.y}`).toBe(true);
        if (!clear(ship)) {
          // Junto a una isla (T88): la botella va al agua legible más cercana.
          nearIsland++;
          continue;
        }
        tried++;
        expect(bottlesNear(ship, [placed!], new Set(), period), `${ship.x},${ship.y}`).toEqual([
          'mia',
        ]);
      }
    }
    expect(tried).toBeGreaterThan(10);
    expect(nearIsland).toBeGreaterThan(0);
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

describe('botellas donde se pueden leer (T88)', () => {
  it('una guardada junto a una isla se recoloca donde se lee, siempre en el mismo sitio', () => {
    const map = pointMap(shared);
    expect(islands.length).toBeGreaterThan(0);
    for (const z of islands) {
      // Guardada en el mapa compartido justo fuera de la colisión de la isla, en su ficha.
      const near = {
        x:
          z.x +
          (z.radius + mar.objects.find((o) => o.identity.id === z.id)!.geometry.collision!.radius) /
            2,
        y: z.y,
      };
      const stored = { id: `junto-${z.id}`, ...map.toShared(near), isMine: false, read: false };
      const [a] = placeBottles([stored], shared, mar, map);
      expect(a, z.id).toBeDefined();
      expect(marReadable(mar)(a!), z.id).toBe(true);
      // Desde donde aparece cerca, ninguna isla tiene su ficha abierta: se puede leer.
      for (let i = 0; i < 24; i++) {
        const t = (i / 24) * 2 * Math.PI;
        const ship = {
          x: a!.x + Math.cos(t) * BOTTLE_FIND_RADIUS,
          y: a!.y + Math.sin(t) * BOTTLE_FIND_RADIUS,
        };
        for (const y of islands) {
          const d = shortest(ship, y, period);
          expect(Math.hypot(d.dx, d.dy), `${z.id} ← ${y.id}`).toBeGreaterThan(y.radius);
        }
      }
      // Determinista: la misma botella cae siempre en el mismo sitio.
      expect(placeBottles([stored], shared, mar, map)).toEqual([a]);
    }
  });
});
