import { readFileSync } from 'node:fs';
import { WORLD_REGISTRY } from '@boia/world';
import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { marWorld } from './compact';
import { toScene } from './compress';
import { lookAhead, startZoom } from './framing';
import { lerp, smooth } from './kit';
import { bendDrop, periodOf, planetRect } from './wrap';

// Read the real camera's tuning: a change to its framing must also exercise
// this test, rather than testing a separate set of hand-written parameters.
const source = readFileSync(new URL('./mar3d.ts', import.meta.url), 'utf8');
const number = (pattern: RegExp) => {
  const match = source.match(pattern);
  if (!match) throw new Error(`Camera parameter not found: ${pattern}`);
  return Number(match[1]);
};
const world = marWorld(WORLD_REGISTRY.get('arcilla').config);
const lighthouse = world.objects.find((o) => o.identity.id === 'faro')!;

describe('Tabarca desde la cámara inicial (T168)', () => {
  for (const [width, height] of [
    [360, 640],
    [390, 844],
    [768, 1024],
    [1440, 900],
  ]) {
    it(`el faro se ve en la mitad izquierda, sin alejar, a ${width}×${height}`, () => {
      const aspect = width! / height!;
      const zoom = startZoom(aspect);
      const fov = number(/new PerspectiveCamera\((\d+)/);
      const camera = new PerspectiveCamera(fov, aspect, 0.5, 5000);
      const t = Math.tan((fov * Math.PI) / 360);
      const period = periodOf(planetRect(world.bounds));
      const far = Math.max(
        (toScene(period.h) * number(/H \* ([\d.]+)/)) / t,
        (toScene(period.w) * number(/W \* ([\d.]+)/)) / (t * aspect),
      );
      const near = number(/const dNear = ([\d.]+)/);
      const distance = near * Math.pow(far / near, zoom);
      const elevation = lerp(
        number(/const ELEV_NEAR = ([\d.]+)/),
        number(/lerp\(ELEV_NEAR, ([\d.]+)/),
        smooth(0, 1, zoom),
      );
      const back = Math.cos(elevation) * distance;
      const focus = new Vector3(
        toScene(world.spawn!.x),
        0,
        toScene(world.spawn!.y) - distance * lookAhead(aspect).ahead,
      );
      camera.position.set(focus.x, Math.sin(elevation) * distance, focus.z + back);
      const bend = lerp(
        number(/const BEND_NEAR = ([\d.]+)/),
        number(/const BEND_MAP = ([\d.]+)/),
        smooth(0.25, 0.9, zoom),
      );
      focus.y = -bendDrop(bend, back);
      camera.lookAt(focus);
      camera.updateMatrixWorld();
      const point = new Vector3(toScene(lighthouse.position.x), 0, toScene(lighthouse.position.y));
      point.y -= bendDrop(
        bend,
        Math.hypot(point.x - camera.position.x, point.z - camera.position.z),
      );
      point.project(camera);
      expect(point.x).toBeGreaterThan(-1);
      expect(point.x).toBeLessThan(0);
      expect(Math.abs(point.y)).toBeLessThan(1);
      expect(point.z).toBeGreaterThan(-1);
      expect(point.z).toBeLessThan(1);
    });
  }
});
