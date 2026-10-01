import {
  type Viewport,
  hudLayout,
  inside,
  intersects,
  joystickZone,
  minimapZoneRects,
  safeMinimapZones,
} from '@boia/engine/ui';
import { describe, expect, it } from 'vitest';
import { bottleBarRect } from './bottle-bar';

const VIEWPORTS: Viewport[] = [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 640, height: 360 },
  { width: 844, height: 390 },
  { width: 1280, height: 720 },
];

describe('barra de botellas en el HUD', () => {
  it.each(VIEWPORTS)(
    '$width×$height: dentro de la pantalla, fuera del joystick y sin pisar el HUD',
    (vp) => {
      const bar = bottleBarRect(vp);
      expect(inside(bar, vp)).toBe(true);
      expect(intersects(bar, joystickZone(vp))).toBe(false);
      const l = hudLayout(vp);
      for (const r of [l.home, l.compass, l.menu, ...(l.stats ? [l.stats] : [])]) {
        expect(intersects(bar, r)).toBe(false);
      }
      const zones = minimapZoneRects(vp);
      for (const z of safeMinimapZones(vp)) expect(intersects(bar, zones[z]), z).toBe(false);
    },
  );
});
