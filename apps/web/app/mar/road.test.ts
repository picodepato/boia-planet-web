import { circuitFromWorld } from '@boia/engine/circuit';
import { CIRCUIT_ID, WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { marWorld } from './engine/compact';
import { roadPath } from './race';
import {
  OFFROAD_GRACE,
  OffRoad,
  ROAD_HALF_WIDTH,
  ROAD_MARK_STEP,
  distToPath,
  isOffRoad,
  roadMarks,
} from './road';

/**
 * La carretera de la carrera (T76): las boyitas de los lados y los 5 s para
 * volver cuando el barco se sale de ella.
 */

const L = [
  { x: 0, y: 0 },
  { x: 1000, y: 0 },
  { x: 1000, y: 1000 },
];

describe('carretera', () => {
  it('mide la distancia al trazado y dice si se salió', () => {
    expect(distToPath(L, { x: 500, y: 90 })).toBe(90);
    expect(isOffRoad(L, { x: 500, y: ROAD_HALF_WIDTH - 1 })).toBe(false);
    expect(isOffRoad(L, { x: 500, y: ROAD_HALF_WIDTH + 1 })).toBe(true);
  });

  it('con el planeta que da la vuelta, mide por el camino corto', () => {
    const period = { w: 2000, h: 2000 };
    // Sale por la izquierda del mapa: está a 100 de la recta de x = 1000 por el otro lado.
    expect(distToPath(L, { x: -900, y: 500 })).toBeCloseTo(Math.hypot(900, 500));
    expect(distToPath(L, { x: -900, y: 500 }, period)).toBe(100);
  });

  it('pone boyitas a los dos lados, a un ancho de la línea y ninguna dentro', () => {
    const { right, left } = roadMarks(L);
    expect(right.length).toBeGreaterThan(5);
    expect(left.length).toBeGreaterThan(5);
    for (const p of [...right, ...left]) {
      expect(distToPath(L, p)).toBeGreaterThanOrEqual(ROAD_HALF_WIDTH * 0.95);
    }
    // Una a cada lado de la recta de arriba: y = -ancho y y = +ancho.
    expect(right.some((p) => Math.abs(p.y - ROAD_HALF_WIDTH) < 1 && p.x > 100 && p.x < 900)).toBe(
      true,
    );
    expect(left.some((p) => Math.abs(p.y + ROAD_HALF_WIDTH) < 1 && p.x > 100 && p.x < 900)).toBe(
      true,
    );
  });

  it('el circuito de verdad: boyitas fuera de la carretera y las rocas dentro', () => {
    const w = marWorld(WORLD_REGISTRY.get(WORLD_REGISTRY.ids()[0]!).config);
    const path = roadPath(w, circuitFromWorld(w, CIRCUIT_ID)!);
    expect(path.length).toBe(11);
    expect(path[0]).toEqual(path[10]);
    const { right, left } = roadMarks(path);
    expect(right.length + left.length).toBeGreaterThan(60);
    for (const o of w.objects.filter((x) => /^circuito-(roca|medusa)/.test(x.identity.id))) {
      expect(isOffRoad(path, o.position), o.identity.id).toBe(false);
    }
  });
});

describe('el borde del circuito, cerrado (T96)', () => {
  const w = marWorld(WORLD_REGISTRY.get(WORLD_REGISTRY.ids()[0]!).config);
  const spec = circuitFromWorld(w, CIRCUIT_ID)!;
  const path = roadPath(w, spec);
  const { right, left } = roadMarks(path);
  const marks = [...right, ...left];
  const nearestMark = (p: { x: number; y: number }) =>
    Math.min(...marks.map((m) => Math.hypot(m.x - p.x, m.y - p.y)));
  const at = (c: { x: number; y: number }, angle: number, r: number) => ({
    x: c.x + Math.cos(angle) * r,
    y: c.y + Math.sin(angle) * r,
  });
  /** La boia de orden `order` (su vértice del trazado: `path[order]`). */
  const buoy = (order: number) => {
    const id = spec.gates.find((g) => g.order === order)!.objectId;
    const o = w.objects.find((x) => x.identity.id === id)!;
    expect(path[order]).toEqual({ x: o.position.x, y: o.position.y });
    return path[order]!;
  };
  /** Hacia fuera de la curva en un vértice: contra la bisectriz de los dos tramos. */
  const outward = (i: number) => {
    const v = path[i]!;
    const a = path[i - 1]!;
    const b = path[i + 1]!;
    const u = (p: { x: number; y: number }) => {
      const d = Math.hypot(p.x - v.x, p.y - v.y);
      return { x: (p.x - v.x) / d, y: (p.y - v.y) / d };
    };
    const s = { x: u(a).x + u(b).x, y: u(a).y + u(b).y };
    return Math.atan2(-s.y, -s.x);
  };

  it('ningún hueco en todo el borde: siempre hay una boyita a menos de un paso', () => {
    let worst = 0;
    let where = '';
    for (let i = 0; i < path.length; i++) {
      for (let deg = 0; deg < 360; deg += 2) {
        const p = at(path[i]!, (deg * Math.PI) / 180, ROAD_HALF_WIDTH);
        // Sólo los puntos del borde (los de dentro de otra parte de la carretera no).
        if (distToPath(path, p) < ROAD_HALF_WIDTH - 1) continue;
        const d = nearestMark(p);
        if (d > worst) {
          worst = d;
          where = `vértice ${i}, ${deg}°`;
        }
      }
    }
    expect(worst, where).toBeLessThanOrEqual(ROAD_MARK_STEP * 0.6);
  });

  it('por debajo de la boia 8 y por encima de la 3 (el hueco de antes) hay boyitas y es fuera', () => {
    for (const order of [8, 3]) {
      const v = buoy(order);
      const out = outward(order);
      // El rumbo del hueco: abajo (+y) en la 8 y arriba (−y) en la 3.
      expect(Math.sin(out) * (order === 8 ? 1 : -1), `boia ${order}`).toBeGreaterThan(0.5);
      // El borde, donde antes no había boyita a menos de 140 u.
      expect(nearestMark(at(v, out, ROAD_HALF_WIDTH)), `boia ${order}`).toBeLessThanOrEqual(
        ROAD_MARK_STEP * 0.6,
      );
      // Seguir recto por ahí es salirse: cuenta como fuera de la carretera.
      for (const r of [ROAD_HALF_WIDTH + 20, ROAD_HALF_WIDTH * 2, ROAD_HALF_WIDTH * 4]) {
        expect(isOffRoad(path, at(v, out, r)), `boia ${order} a ${r}`).toBe(true);
      }
      const t = new OffRoad();
      let ended = false;
      // Alejarse por el hueco a 220 u/s: a los 5 s se acaba la carrera.
      for (let s = 0; s <= OFFROAD_GRACE + 1 && !ended; s += 0.5) {
        ended = t.step(0.5, distToPath(path, at(v, out, ROAD_HALF_WIDTH + 220 * s)));
      }
      expect(ended, `boia ${order}`).toBe(true);
    }
  });
});

describe('«te saliste»', () => {
  const OUT = ROAD_HALF_WIDTH + 50;

  it('cuenta 5 s fuera y avisa al agotarse', () => {
    const t = new OffRoad();
    expect(t.remaining).toBeNull();
    expect(t.step(1, OUT)).toBe(false);
    expect(t.remaining).toBe(OFFROAD_GRACE - 1);
    for (let i = 0; i < 3; i++) expect(t.step(1, OUT + i)).toBe(false);
    expect(t.step(1, OUT + 10)).toBe(true);
  });

  it('si vuelve a tiempo se apaga y la próxima salida cuenta otra vez 5 s', () => {
    const t = new OffRoad();
    t.step(4, OUT);
    expect(t.step(0.1, ROAD_HALF_WIDTH - 1)).toBe(false);
    expect(t.remaining).toBeNull();
    t.step(1, OUT);
    expect(t.remaining).toBe(OFFROAD_GRACE - 1);
  });

  it('salir y entrar rápido varias veces nunca acaba la carrera', () => {
    const t = new OffRoad();
    for (let i = 0; i < 20; i++) {
      expect(t.step(3, OUT)).toBe(false);
      expect(t.step(0.1, 0)).toBe(false);
    }
  });

  it('mientras vuelve hacia la carretera la cuenta se para', () => {
    const t = new OffRoad();
    // Se aleja 3 s (la vuelta del barco), y luego tarda 3 s en volver: no se acaba.
    for (let i = 0; i < 3; i++) expect(t.step(1, OUT + i * 100)).toBe(false);
    expect(t.remaining).toBe(OFFROAD_GRACE - 3);
    for (let i = 0; i < 3; i++) expect(t.step(1, OUT + 200 - (i + 1) * 70)).toBe(false);
    expect(t.remaining).toBe(OFFROAD_GRACE - 3);
    // Si se vuelve a alejar, sigue contando donde lo dejó.
    t.step(1, OUT + 200);
    expect(t.remaining).toBe(OFFROAD_GRACE - 4);
  });

  it('atascado o a la deriva (se acerca muy despacio) la cuenta sigue', () => {
    const t = new OffRoad();
    t.step(1, OUT + 100);
    for (let i = 0; i < 3; i++) expect(t.step(1, OUT + 100 - (i + 1) * 5)).toBe(false);
    expect(t.step(1, OUT + 80)).toBe(true);
  });
});
