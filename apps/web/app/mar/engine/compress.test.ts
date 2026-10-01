import { WorldRuntime } from '@boia/engine/headless';
import { WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { MAR3D_SCALE, compressWorld, pointMap } from './compress';

const original = WORLD_REGISTRY.get('arcilla').config;
const world = compressWorld(original);
/** Escala de las posiciones fuera de las composiciones locales. */
const k = MAR3D_SCALE.compact / MAR3D_SCALE.spread;
const byId = (w: typeof world, id: string) => w.objects.find((o) => o.identity.id === id)!;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe('el mapa compartido en el mar 3D', () => {
  it('conserva todos los lugares, con sus ids y comportamientos', () => {
    expect(world.objects.map((o) => o.identity.id)).toEqual(
      original.objects.map((o) => o.identity.id),
    );
    for (const o of world.objects) {
      const before = byId(original, o.identity.id);
      expect(o.behaviors.map((b) => b.type)).toEqual(before.behaviors.map((b) => b.type));
    }
  });

  it('acorta el agua entre zonas y deja el puerto a 1:1', () => {
    // (Sin compactar, el mar de T33: `compact: 1`.)
    expect(byId(compressWorld(original, { compact: 1 }), 'allday').position.y).toBeCloseTo(
      byId(original, 'allday').position.y / MAR3D_SCALE.spread,
      1,
    );
    const a = byId(world, 'allday').position;
    const a0 = byId(original, 'allday').position;
    expect(a.y).toBeCloseTo(a0.y * k, 1);
    // La boia de la entrada queda a la misma distancia del anillo que en el 2D.
    const d = dist(byId(world, 'puerto-boia').position, world.spawn!);
    const d0 = dist(byId(original, 'puerto-boia').position, original.spawn!);
    expect(d).toBeCloseTo(d0, 0);
  });

  it('agranda las islas y su proximidad sigue fuera del casco', () => {
    for (const o of world.objects.filter((x) => x.identity.category === 'isla')) {
      const before = byId(original, o.identity.id);
      const r = o.geometry.collision!.radius;
      expect(r).toBeCloseTo(before.geometry.collision!.radius * MAR3D_SCALE.islandGrow, 1);
      expect(o.geometry.proximityRadius!).toBeGreaterThan(r + 60);
    }
  });

  it('todo cae dentro del mar y nada ajeno queda dentro de una isla', () => {
    const { left, right, top, bottom } = world.bounds;
    expect(left).toBeLessThan(right);
    expect(top).toBeLessThan(bottom);
    const islands = world.objects.filter((o) => o.identity.category === 'isla');
    for (const o of world.objects) {
      if (o.identity.category === 'isla' || o.identity.id === 'puerto') continue;
      expect(o.position.x, o.identity.id).toBeGreaterThanOrEqual(left);
      expect(o.position.x, o.identity.id).toBeLessThanOrEqual(right);
      expect(o.position.y, o.identity.id).toBeGreaterThanOrEqual(top);
      for (const i of islands) {
        if (o.position.zone === i.identity.id) continue;
        expect(
          dist(o.position, i.position),
          `${o.identity.id} en ${i.identity.id}`,
        ).toBeGreaterThan(i.geometry.collision!.radius);
      }
    }
  });

  it('el barco sale libre del anillo y el runtime acepta el mundo', () => {
    const rt = new WorldRuntime(world);
    const s = world.spawn!;
    const safe = rt.safePoint(s.x, s.y, 13.5);
    expect(dist(safe, s)).toBeLessThan(1);
  });

  it('los puntos de los parámetros (vaivén, rastro, entrega) cambian de escala', () => {
    const croc = byId(world, 'circuito-cocodrilo');
    const pts = (croc.params!.patrol as { points: { x: number; y: number }[] }).points;
    const pts0 = (
      byId(original, 'circuito-cocodrilo').params!.patrol as typeof croc.params & {
        points: { x: number; y: number }[];
      }
    ).points;
    expect(pts[0]!.x).toBeCloseTo(pts0[0]!.x * k, 1);
  });

  it('los sitios donde reaparecen restos y cofres cambian de escala con ellos', () => {
    for (const o of world.objects.filter((x) => x.behaviors.some((b) => b.type === 'spawn'))) {
      const b = o.behaviors.find((x) => x.type === 'spawn');
      const b0 = byId(original, o.identity.id).behaviors.find((x) => x.type === 'spawn');
      if (b?.type !== 'spawn' || b0?.type !== 'spawn') continue;
      (b.params.positions ?? []).forEach((p, i) => {
        const p0 = b0.params.positions![i]!;
        expect(p.x, o.identity.id).toBeCloseTo(p0.x * k, 1);
        expect(p.y, o.identity.id).toBeCloseTo(p0.y * k, 1);
      });
    }
  });
});

describe('puntos sueltos entre el mapa y el mar 3D (T56)', () => {
  const map = pointMap(original);

  it('cada lugar cae donde lo pone compressWorld', () => {
    for (const o of original.objects) {
      const q = map.toMar(o.position);
      const want = byId(world, o.identity.id).position;
      expect(q.x, o.identity.id).toBeCloseTo(want.x, 1);
      expect(q.y, o.identity.id).toBeCloseTo(want.y, 1);
    }
  });

  it('ida y vuelta: un punto del mar 3D vuelve al mapa y cae otra vez en el mismo sitio', () => {
    const b = world.bounds;
    let found = 0;
    for (let i = 0; i <= 12; i++) {
      for (let j = 0; j <= 12; j++) {
        const q = {
          x: b.left + ((b.right - b.left) * i) / 12,
          y: b.top + ((b.bottom - b.top) * j) / 12,
        };
        const p = map.toShared(q);
        const again = map.toMar(p);
        // El agua abierta al separar islas no tiene punto en el mapa: sólo esa no vuelve.
        if (dist(again, q) < 0.05) found++;
      }
    }
    expect(found / 169).toBeGreaterThan(0.95);
    for (const o of world.objects) {
      const q = o.position;
      expect(dist(map.toMar(map.toShared(q)), q), o.identity.id).toBeLessThan(0.05);
    }
  });
});
