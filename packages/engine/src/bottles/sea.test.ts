import { WORLD_REGISTRY, bottleObject } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { BOTTLE_FIND_RADIUS, BOTTLE_LOSE_RADIUS, nearbyBottles } from './finder';
import {
  BOTTLE_DROP_DISTANCE,
  SEA_PROBLEM_TEXT,
  bottlePositionValidator,
  bottleSpotProblem,
  findDropSpot,
  findDropSpotWhere,
  isSeaSpot,
  nearestSpotWhere,
  settleInSea,
} from './sea';

const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config;
const land = world.objects.filter((o) => o.geometry.collision);
const island = land.reduce((a, b) =>
  (b.geometry.collision?.radius ?? 0) > (a.geometry.collision?.radius ?? 0) ? b : a,
);
const spawn = world.spawn!;

describe('mar válido para una botella (REQ-IDE-040)', () => {
  it('en tierra no: el centro de cada lugar con colisión es tierra', () => {
    expect(land.length).toBeGreaterThan(0);
    for (const o of land) {
      expect(bottleSpotProblem(world, o.position), o.identity.id).toBe('tierra');
    }
  });

  it('fuera de los límites navegables tampoco', () => {
    const b = world.bounds;
    for (const p of [
      { x: b.left - 10, y: spawn.y },
      { x: b.right + 10, y: spawn.y },
      { x: spawn.x, y: b.bottom + 10 },
      { x: spawn.x, y: b.top - 10 },
      { x: Number.NaN, y: 0 },
    ]) {
      expect(bottleSpotProblem(world, p)).toBe('fuera');
    }
  });

  it('el validador para el repositorio devuelve el motivo en texto', () => {
    const v = bottlePositionValidator(() => world);
    expect(v(island.position)).toBe(SEA_PROBLEM_TEXT.tierra);
    expect(v(spawn)).toBeNull();
  });

  it('el mar es el mismo en todos los mundos (mapa compartido)', () => {
    for (const w of WORLD_REGISTRY.list()) {
      const cfg = WORLD_REGISTRY.get(w.id).config;
      for (const o of land) expect(isSeaSpot(cfg, o.position)).toBe(false);
      expect(isSeaSpot(cfg, spawn)).toBe(true);
    }
  });
});

describe('echar la botella junto al barco', () => {
  it('cae en el mar, a su lado y por la popa si se puede', () => {
    // En mar abierto, al norte del puerto.
    const ship = { x: spawn.x, y: spawn.y - 1500, heading: -Math.PI / 2 };
    const p = findDropSpot(world, ship)!;
    expect(isSeaSpot(world, p)).toBe(true);
    expect(Math.hypot(p.x - ship.x, p.y - ship.y)).toBeCloseTo(BOTTLE_DROP_DISTANCE, 5);
    // Rumbo norte (-y): la popa queda al sur (+y).
    expect(p.y).toBeGreaterThan(ship.y);
  });

  it('en el puerto, con el paseo a popa, cae a un lado y en el mar', () => {
    const p = findDropSpot(world, spawn)!;
    expect(p).not.toBeNull();
    expect(isSeaSpot(world, p)).toBe(true);
  });

  it('pegado a una isla busca otro lado, nunca la isla', () => {
    const r = island.geometry.collision!.radius;
    const ship = { x: island.position.x, y: island.position.y + r + 16, heading: Math.PI / 2 };
    const p = findDropSpot(world, ship)!;
    expect(p).not.toBeNull();
    expect(isSeaSpot(world, p)).toBe(true);
  });

  it('sin mar alrededor, no hay sitio', () => {
    const b = world.bounds;
    expect(findDropSpot(world, { x: b.left - 500, y: b.top - 500, heading: 0 })).toBeNull();
  });
});

describe('botellas de muestra', () => {
  it('las que no caen en el mar se recolocan en el mar, siempre igual; las del mar se quedan', () => {
    const items = [
      { id: 'a', x: island.position.x, y: island.position.y },
      { id: 'b', x: spawn.x, y: spawn.y - 40 },
      { id: 'c', x: world.bounds.left - 5000, y: world.bounds.top - 5000 },
    ];
    const out = settleInSea(world, items);
    expect(out).toHaveLength(3);
    for (const p of out) expect(isSeaSpot(world, p)).toBe(true);
    expect(out[1]).toEqual(items[1]);
    expect(settleInSea(world, items)).toEqual(out);
  });

  it('la primera recolocada queda a la vista nada más zarpar', () => {
    const b = world.bounds;
    const [first] = settleInSea(world, [{ id: 'a', x: b.left - 5000, y: b.bottom + 5000 }]);
    expect(Math.hypot(first!.x - spawn.x, first!.y - spawn.y)).toBeLessThanOrEqual(
      BOTTLE_FIND_RADIUS,
    );
  });
});

describe('botellas cerca del barco', () => {
  const bottles = [
    { id: 'lejos', x: 0, y: 0 },
    { id: 'cerca', x: 10, y: 1000 + BOTTLE_FIND_RADIUS - 20 },
    { id: 'justo', x: 0, y: 1000 + BOTTLE_FIND_RADIUS - 5 },
  ];
  const ship = { x: 0, y: 1000 };

  it('de la más cercana a la más lejana, sólo dentro del radio', () => {
    expect(nearbyBottles(ship, bottles)).toEqual(['cerca', 'justo']);
  });

  it('una encontrada no se pierde al frenar un poco más allá', () => {
    const away = { x: 0, y: 1000 - (BOTTLE_LOSE_RADIUS - BOTTLE_FIND_RADIUS) + 10 };
    const prev = new Set(nearbyBottles(ship, bottles));
    expect(nearbyBottles(away, bottles, prev)).toContain('cerca');
    expect(nearbyBottles(away, bottles)).not.toContain('cerca');
    expect(nearbyBottles({ x: 0, y: -9999 }, bottles, prev)).toEqual([]);
  });

  it('la botella como objeto del mundo no colisiona ni tiene comportamientos', () => {
    const o = bottleObject({ id: 'x', x: 1, y: 2 });
    expect(o.geometry.collision).toBeUndefined();
    expect(o.behaviors).toEqual([]);
    expect(o.appearance.asset).toMatch(/^placeholder:/);
    expect(bottleObject({ id: 'x', x: 1, y: 2 }, 'mundos/arcilla/botella').appearance.asset).toBe(
      'mundos/arcilla/botella',
    );
  });
});

describe('sitios con otra regla de mar (T56: el planeta de /mar)', () => {
  it('la botella cae por la popa si la regla lo permite, y si no a un lado', () => {
    const pose = { x: 0, y: 0, heading: 0 };
    const stern = findDropSpotWhere(() => true, pose)!;
    expect(stern.x).toBeCloseTo(-BOTTLE_DROP_DISTANCE, 6);
    expect(stern.y).toBeCloseTo(0, 6);
    // Sin agua detrás (x < 0), a un lado.
    const side = findDropSpotWhere((p) => p.x > -1, pose)!;
    expect(side.x).toBeGreaterThan(-1);
    expect(findDropSpotWhere(() => false, pose)).toBeNull();
  });

  it('el punto más cercano que cumple la regla, o null si no hay ninguno a mano', () => {
    const ok = (p: { x: number; y: number }) => Math.hypot(p.x, p.y) >= 100;
    const q = nearestSpotWhere(ok, { x: 10, y: 0 })!;
    expect(ok(q)).toBe(true);
    expect(Math.hypot(q.x - 10, q.y)).toBeLessThanOrEqual(100);
    expect(nearestSpotWhere(ok, { x: 200, y: 0 })).toEqual({ x: 200, y: 0 });
    expect(nearestSpotWhere(() => false, { x: 0, y: 0 }, 64)).toBeNull();
  });
});
