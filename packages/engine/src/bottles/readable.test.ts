import { WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { BOTTLE_FIND_RADIUS } from './finder';
import {
  BOTTLE_READ_MARGIN,
  bottleKeepAway,
  findReadableDropSpot,
  readableSpot,
  relocateBottle,
  sheetRadius,
  sheetZones,
  unreadableBecause,
} from './readable';
import { isSeaSpot } from './sea';

const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config;
const zones = sheetZones(world);
const islands = zones.filter(
  (z) => world.objects.find((o) => o.identity.id === z.id)?.identity.category === 'isla',
);
/** Agua donde se lee una botella: el mar del mapa, lejos de toda ficha. */
const ok = (p: { x: number; y: number }) => isSeaSpot(world, p) && readableSpot(zones)(p);
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const around = (c: { x: number; y: number }, r: number, n = 16) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI;
    return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
  });

describe('botellas donde se pueden leer (T88)', () => {
  it('las islas que abren su ficha solas tienen zona: proximidad + histéresis', () => {
    expect(islands.length).toBeGreaterThan(0);
    for (const z of islands) {
      const o = world.objects.find((x) => x.identity.id === z.id)!;
      const prox = o.behaviors.find((b) => b.type === 'proximity');
      const r =
        (prox?.type === 'proximity' ? prox.params.radius : undefined) ?? o.geometry.proximityRadius!;
      const h = prox?.type === 'proximity' ? prox.params.hysteresis : 0;
      expect(sheetRadius(o), z.id).toBe(r + h);
      expect(z.keepAway, z.id).toBe(z.radius + BOTTLE_FIND_RADIUS + BOTTLE_READ_MARGIN);
    }
    // Lo que no abre ficha no aparta botellas.
    for (const o of world.objects.filter((x) => !x.behaviors.some((b) => b.type === 'content'))) {
      expect(sheetRadius(o), o.identity.id).toBeNull();
    }
  });

  it('rechaza los sitios dentro de la ficha de una isla más el radio de lectura', () => {
    for (const z of islands) {
      for (const p of [
        { x: z.x, y: z.y },
        ...around(z, z.radius),
        ...around(z, z.radius + BOTTLE_FIND_RADIUS),
        ...around(z, z.keepAway - 1),
      ]) {
        expect(unreadableBecause(zones, p), `${z.id} @ ${p.x},${p.y}`).not.toBeNull();
        expect(readableSpot(zones)(p)).toBe(false);
      }
    }
  });

  it('una botella legible no deja leerla desde dentro de una ficha', () => {
    const r = world.bounds;
    let tried = 0;
    for (let i = 1; i < 20; i++) {
      for (let j = 1; j < 20; j++) {
        const b = {
          x: r.left + ((r.right - r.left) * i) / 20,
          y: r.top + ((r.bottom - r.top) * j) / 20,
        };
        if (!ok(b)) continue;
        tried++;
        // Desde cualquier punto donde aparece cerca, ninguna isla tiene su ficha abierta.
        for (const s of [...around(b, BOTTLE_FIND_RADIUS, 24), ...around(b, BOTTLE_FIND_RADIUS / 2)]) {
          for (const z of islands) {
            expect(dist(s, z), `${z.id} @ ${b.x},${b.y}`).toBeGreaterThan(z.radius);
          }
        }
        // Y la botella nunca flota dentro de ninguna ficha.
        for (const z of zones) expect(dist(b, z), z.id).toBeGreaterThan(z.radius);
      }
    }
    expect(tried).toBeGreaterThan(20);
  });

  it('con vuelta (el planeta), la distancia va por el camino corto', () => {
    const z = { id: 'borde', x: 10, y: 0, radius: 50, keepAway: bottleKeepAway(50, true) };
    const period = { w: 1000, h: 1000 };
    // A 20 u por el otro lado del borde: dentro con vuelta, fuera sin ella.
    expect(unreadableBecause([z], { x: 990, y: 0 }, period)).toBe(z);
    expect(unreadableBecause([z], { x: 990, y: 0 })).toBeNull();
  });

  it('recoloca una botella guardada junto a una isla en el agua legible más cercana, siempre la misma', () => {
    for (const z of islands) {
      const stored = { x: z.x + z.radius * 0.8, y: z.y };
      expect(ok(stored)).toBe(false);
      const a = relocateBottle(ok, stored);
      expect(a, z.id).not.toBeNull();
      expect(ok(a!), z.id).toBe(true);
      for (const y of zones) expect(dist(a!, y), `${z.id} ← ${y.id}`).toBeGreaterThanOrEqual(y.keepAway);
      // Determinista: la misma botella cae siempre en el mismo sitio.
      expect(relocateBottle(ok, stored)).toEqual(a);
    }
    // La que ya se lee se queda donde está.
    const fine = relocateBottle(ok, relocateBottle(ok, { x: islands[0]!.x, y: islands[0]!.y })!);
    expect(relocateBottle(ok, fine!)).toEqual(fine);
  });

  it('al echarla junto a una isla, cae donde se puede leer', () => {
    for (const z of islands) {
      // El barco en el agua, justo fuera de la colisión de la isla.
      const ship = around(z, z.radius * 0.9, 32).find((p) => isSeaSpot(world, p));
      if (!ship) continue;
      const p = findReadableDropSpot(ok, { ...ship, heading: 0 });
      expect(p, z.id).not.toBeNull();
      expect(ok(p!), z.id).toBe(true);
    }
  });
});
