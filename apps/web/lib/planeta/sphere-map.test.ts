import { describe, expect, it } from 'vitest';
import { arc, dirOf, frameAt, lonLat, sphereMap, wrapPoint } from './sphere-map';

const rect = { left: -80, right: 80, top: -130, bottom: 130 };
const map = sphereMap(rect, 60, -40);
const len = (v: number[]) => Math.hypot(v[0]!, v[1]!, v[2]!);

describe('el mar de /mar en una esfera (T57)', () => {
  it('el ecuador mide lo que el periodo del mar: de este a oeste nada cambia de tamaño', () => {
    expect(2 * Math.PI * map.radius).toBeCloseTo(rect.right - rect.left);
  });

  it('la x da la vuelta entera y la y va del norte al sur del mapa', () => {
    expect(lonLat(map, 0, 0).lon).toBeCloseTo(0);
    expect(lonLat(map, rect.left, 0).lon).toBeCloseTo(-Math.PI);
    expect(lonLat(map, rect.right, 0).lon).toBeCloseTo(Math.PI);
    expect(lonLat(map, 0, rect.top).lat).toBeCloseTo((60 * Math.PI) / 180);
    expect(lonLat(map, 0, rect.bottom).lat).toBeCloseTo((-40 * Math.PI) / 180);
  });

  it('el marco local es una rotación: este, arriba y sur ortonormales y sin espejo', () => {
    for (const [lon, lat] of [
      [0, 0],
      [1.2, 0.5],
      [-2.5, -0.6],
    ] as const) {
      const { up, east, south } = frameAt(dirOf(lon, lat));
      const dot = (a: number[], b: number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
      expect(dot(up, east)).toBeCloseTo(0);
      expect(dot(up, south)).toBeCloseTo(0);
      expect(dot(east, south)).toBeCloseTo(0);
      // (este, arriba, sur) como (x, y, z): det = este · (arriba × sur) = 1.
      const cross = [
        up[1] * south[2] - up[2] * south[1],
        up[2] * south[0] - up[0] * south[2],
        up[0] * south[1] - up[1] * south[0],
      ];
      expect(dot(east, cross)).toBeCloseTo(1);
      // El sur baja de latitud.
      expect(south[1]).toBeLessThan(0);
    }
  });

  it('una pieza se dobla sobre la superficie: lo que está a ras de agua queda en la esfera', () => {
    const frame = frameAt(dirOf(0.3, 0.2));
    for (const [x, z] of [
      [0, 0],
      [6, 0],
      [-4, 5],
    ] as const) {
      const p = wrapPoint(frame, map.radius, x, 0, z);
      expect(len(p)).toBeCloseTo(map.radius);
      // La distancia sobre el arco es la del mapa.
      expect(arc(frame.up, [p[0] / map.radius, p[1] / map.radius, p[2] / map.radius])).toBeCloseTo(
        Math.hypot(x, z) / map.radius,
      );
    }
    expect(len(wrapPoint(frame, map.radius, 2, 3, 1))).toBeCloseTo(map.radius + 3);
  });
});
