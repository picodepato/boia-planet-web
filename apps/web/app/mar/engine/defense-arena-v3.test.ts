import { DEFENSE_CONFIG } from '@boia/engine/defense';
import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { toScene } from './compress';
import {
  ARENA_ELEVATION,
  ARENA_FIT,
  ARENA_FOLLOW_ZOOM,
  ARENA_PORTRAIT_WIDTH,
  ARENA_ZOOM_NEAR,
  arenaCameraPose,
  arenaFollow,
} from './defense-arena';

/**
 * La cámara de la arena v3 (plan 016 T183, decisión 2): desde media vista
 * hacia dentro el avión va en el centro de la pantalla; en la vista de salida
 * es la de siempre (fija en el castillo, corriéndose lo justo hacia el avión).
 */

const R = toScene(DEFENSE_CONFIG.arenaRadius);
const FOV = 40;
const SCREENS = [
  { w: 390, h: 844 },
  { w: 360, h: 640 },
  { w: 768, h: 1024 },
  { w: 1440, h: 900 },
];

/** La cámara como la pone `mar3d` (sin giro): detrás del foco, a `elevation` sobre él. */
function project(
  pose: ReturnType<typeof arenaCameraPose>,
  screen: { w: number; h: number },
  p: { x: number; z: number },
  y = 0,
): { x: number; y: number } {
  const cam = new PerspectiveCamera(FOV, screen.w / screen.h, 0.1, pose.distance * 10);
  const back = Math.cos(pose.elevation) * pose.distance;
  cam.position.set(pose.fx, Math.sin(pose.elevation) * pose.distance, pose.fz + back);
  cam.lookAt(pose.fx, 0, pose.fz);
  cam.updateMatrixWorld();
  const v = new Vector3(p.x, y, p.z).project(cam);
  return { x: ((v.x + 1) / 2) * screen.w, y: ((1 - v.y) / 2) * screen.h };
}

/** La pose de antes del plan 016 (plan 015 T170), para comparar la vista de salida. */
function poseT170(aspect: number, plane: { x: number; z: number }, zoom: number) {
  const t = Math.tan((FOV * Math.PI) / 360);
  const fit = R * ARENA_FIT;
  const widest = fit / (t * Math.min(1, aspect / ARENA_PORTRAIT_WIDTH));
  const distance = widest * Math.pow(ARENA_ZOOM_NEAR, 1 - zoom);
  const kx = Math.min(1, Math.max(0, 1 - (distance * t * aspect) / fit));
  const kz = Math.min(1, Math.max(0, 1 - (distance * t) / fit));
  return { distance, elevation: ARENA_ELEVATION, fx: plane.x * kx, fz: plane.z * kz };
}

const PLANES = [
  { x: 0, z: 0 },
  { x: R * 0.9, z: 0 },
  { x: -R * 0.6, z: R * 0.7 },
  { x: R * 0.3, z: -R * 0.95 },
];

describe('la cámara de la arena v3 (plan 016, decisión 2)', () => {
  it('desde media vista hacia dentro el avión (en el agua o volando) se ve en el centro de la pantalla (±2 px)', () => {
    for (const screen of SCREENS)
      for (const plane of PLANES)
        for (const planeY of [0, 4.5, 12])
          for (const zoom of [0, 0.2, 0.4, ARENA_FOLLOW_ZOOM]) {
            const pose = arenaCameraPose({
              aspect: screen.w / screen.h,
              fovDeg: FOV,
              arenaRadius: R,
              plane,
              planeY,
              zoom,
            });
            expect(pose.follow).toBe(1);
            const s = project(pose, screen, plane, planeY);
            const at = `${screen.w}×${screen.h} zoom ${zoom}`;
            expect(Math.abs(s.x - screen.w / 2), at).toBeLessThan(2);
            expect(Math.abs(s.y - screen.h / 2), at).toBeLessThan(2);
          }
  });

  it('en la vista de salida es la de antes (fija en el castillo, el avión dentro)', () => {
    for (const screen of SCREENS)
      for (const plane of PLANES) {
        const aspect = screen.w / screen.h;
        const pose = arenaCameraPose({ aspect, fovDeg: FOV, arenaRadius: R, plane, zoom: 1 });
        expect(pose).toEqual({ ...poseT170(aspect, plane, 1), follow: 0 });
        // La altura del avión no la mueve: sólo cuenta siguiéndolo.
        expect(
          arenaCameraPose({ aspect, fovDeg: FOV, arenaRadius: R, plane, planeY: 4.5, zoom: 1 }),
        ).toEqual(pose);
        expect(arenaCameraPose({ aspect, fovDeg: FOV, arenaRadius: R, plane })).toEqual(pose);
      }
  });

  it('entre media vista y la de salida, una mezcla suave: el foco se acerca al avión sin saltos', () => {
    const plane = { x: R * 0.8, z: R * 0.4 };
    const aspect = 390 / 844;
    let lastFollow = -1;
    let last: { fx: number; fz: number } | null = null;
    for (let i = 100; i >= 0; i--) {
      const zoom = i / 100;
      const p = arenaCameraPose({ aspect, fovDeg: FOV, arenaRadius: R, plane, zoom });
      expect(p.follow).toBeGreaterThanOrEqual(lastFollow);
      expect(p.follow).toBeCloseTo(arenaFollow(zoom), 12);
      // Sin saltos de un paso de zoom al siguiente.
      if (last) expect(Math.hypot(p.fx - last.fx, p.fz - last.fz)).toBeLessThan(R * 0.05);
      lastFollow = p.follow;
      last = p;
    }
    expect(arenaFollow(1)).toBe(0);
    expect(arenaFollow(ARENA_FOLLOW_ZOOM)).toBe(1);
    expect(arenaFollow(0.75)).toBeGreaterThan(0);
    expect(arenaFollow(0.75)).toBeLessThan(1);
  });
});
