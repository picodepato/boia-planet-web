import { SAMPLE_WORLD, parseWorldConfig, worldToScreen } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { DEFAULT_INTRO_CONFIG, pickFraming } from './config';
import {
  appearPose,
  idleZoom,
  landingK,
  landingPose,
  landingProgressForK,
  rhoOf,
  sphereProbeParams,
  worldPointAt,
} from './sphere-probe-pose';

const world = parseWorldConfig(SAMPLE_WORLD);
const views = [
  { width: 360, height: 640 },
  { width: 1280, height: 720 },
];

describe('prueba de la esfera (T13, opción A)', () => {
  it('aterriza en la isla de evento con el encuadre de llegada de T03', () => {
    for (const v of views) {
      const p = sphereProbeParams(world, v.width);
      const island = world.objects.find((o) => o.behaviors.some((b) => b.type === 'ticket'))!;
      expect(p.landing).toEqual(worldToScreen(island.position));
      const f = pickFraming(DEFAULT_INTRO_CONFIG, v.width);
      const end = landingPose(p, v, 1, 2.5);
      expect(end.flat).toBe(true);
      expect(end.k).toBe(0);
      expect(end.zoom).toBeCloseTo(f.zoom, 9);
      expect(end.center.x).toBeCloseTo(v.width * f.anchor[0], 9);
      expect(end.center.y).toBeCloseTo(v.height * f.anchor[1], 9);
      expect(end.liveAlpha).toBe(1);
      // En el centro de la vista final está el punto de aterrizaje.
      expect(worldPointAt(p, end, { x: 0, y: 0 })).toEqual(p.landing);
    }
  });

  it('la curvatura baja de 1 a 0 sin retroceder', () => {
    let prev = landingK(0);
    expect(prev).toBe(1);
    for (let i = 1; i <= 200; i++) {
      const k = landingK(i / 200);
      expect(k).toBeLessThanOrEqual(prev);
      prev = k;
    }
    expect(prev).toBe(0);
    expect(landingK(landingProgressForK(0.5))).toBeCloseTo(0.5, 6);
  });

  it('el aterrizaje empieza donde está el planeta en reposo', () => {
    const v = views[0]!;
    const p = sphereProbeParams(world, v.width);
    const spin = 2.9;
    const idle = appearPose(p, v, 1, spin);
    const start = landingPose(p, v, 0, spin);
    expect(start.k).toBe(idle.k);
    expect(start.zoom).toBeCloseTo(idle.zoom, 9);
    expect(start.center).toEqual(idle.center);
    // La misma longitud, módulo una vuelta.
    const d = (start.front.x - idle.front.x) / (2 * Math.PI);
    expect(Math.abs(d - Math.round(d))).toBeLessThan(1e-9);
    expect(start.front.y).toBeCloseTo(idle.front.y, 9);
    expect(idleZoom(p, v) * rhoOf(p) * 2).toBeCloseTo(p.fit * v.width, 9);
  });

  it('cuando entra el mundo vivo, la esfera ya coincide con la cámara plana', () => {
    for (const v of views) {
      const p = sphereProbeParams(world, v.width);
      const near = landingPose(p, v, p.liveFrom, 1.3);
      expect(near.flat).toBe(false);
      const flat = { ...near, k: 0, flat: true };
      for (const s of [
        { x: 0, y: 0 },
        { x: v.width / 2, y: 0 },
        { x: -v.width / 2, y: v.height / 3 },
      ]) {
        const a = worldPointAt(p, near, s)!;
        const b = worldPointAt(p, flat, s)!;
        // Menos de medio píxel de pantalla de diferencia.
        expect(Math.hypot(a.x - b.x, a.y - b.y) * near.zoom).toBeLessThan(0.5);
      }
    }
  });
});
