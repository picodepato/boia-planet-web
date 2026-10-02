import { WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { marWorld, seaRoute } from './compact';
import {
  type GlobePin,
  type GlobePoint,
  acrossSeam,
  discOf,
  drawGlobe,
  globeHeading,
  globeProject,
} from './globe';
import { periodOf, planetRect } from './wrap';

const world = marWorld(WORLD_REGISTRY.get('arcilla').config);
const rect = planetRect(world.bounds);
const period = periodOf(rect);
const cx = (rect.left + rect.right) / 2;
const cy = (rect.top + rect.bottom) / 2;
const r = (p: GlobePoint) => Math.hypot(p.x, p.y);

describe('el minimapa redondo de /mar (globo)', () => {
  it('todo el planeta cabe en el disco, y los bordes del periodo van al borde del disco', () => {
    for (const o of world.objects) {
      expect(r(globeProject(o.position.x, o.position.y, rect, 0))).toBeLessThanOrEqual(1 + 1e-9);
    }
    expect(r(globeProject(rect.left, rect.top, rect, 0))).toBeCloseTo(1, 6);
    expect(r(globeProject(rect.left, cy, rect, 0))).toBeCloseTo(1, 6);
    expect(r(globeProject(cx, rect.top, rect, 0))).toBeCloseTo(1, 6);
    const mid = globeProject(cx, cy, rect, 0);
    expect(mid.x).toBeCloseTo(0, 9);
    expect(mid.y).toBeCloseTo(0, 9);
  });

  it('cada sitio sale una sola vez: la vuelta cae en el mismo punto y dos sitios nunca coinciden', () => {
    const a = globeProject(cx + 300, cy - 200, rect, 0.4);
    const b = globeProject(cx + 300 + period.w, cy - 200 - period.h, rect, 0.4);
    expect(b.x).toBeCloseTo(a.x, 9);
    expect(b.y).toBeCloseTo(a.y, 9);
    // Una rejilla del periodo: puntos distintos van a puntos distintos del disco.
    const n = 24;
    const pts: GlobePoint[] = [];
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        pts.push(
          globeProject(
            rect.left + ((i + 0.5) / n) * period.w,
            rect.top + ((j + 0.5) / n) * period.h,
            rect,
            0,
          ),
        );
    let min = Infinity;
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++)
        min = Math.min(min, Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.y - pts[j]!.y));
    expect(min).toBeGreaterThan(1e-3);
  });

  it('el centro sale más grande que el borde (se abomba como una esfera)', () => {
    const step = 0.02;
    const center = discOf(step, 0).x - discOf(0, 0).x;
    const edge = discOf(1, 0).x - discOf(1 - step, 0).x;
    expect(center).toBeGreaterThan(step);
    expect(edge).toBeLessThan(step);
  });

  it('gira con el planeta: una vuelta entera cada 2π y el mar se desplaza hacia el este', () => {
    const p = globeProject(cx - 400, cy + 300, rect, 0);
    const turn = globeProject(cx - 400, cy + 300, rect, 2 * Math.PI);
    expect(turn.x).toBeCloseTo(p.x, 9);
    expect(turn.y).toBeCloseTo(p.y, 9);
    const later = globeProject(cx - 400, cy + 300, rect, 0.3);
    expect(later.x).toBeGreaterThan(p.x);
    // Media vuelta: el centro del planeta pasa a la costura (el borde del disco).
    expect(Math.abs(globeProject(cx, cy, rect, Math.PI).u)).toBeCloseTo(1, 9);
  });

  it('el barco apunta hacia donde va, también junto a la costura', () => {
    const north = globeHeading(cx, cy, -Math.PI / 2, rect, 0);
    expect(north).toBeCloseTo(-Math.PI / 2, 2);
    const east = globeHeading(cx, cy, 0, rect, 0);
    expect(east).toBeCloseTo(0, 2);
    // Pegado al borde este, rumbo este: el paso de delante cae al otro lado.
    const atSeam = globeHeading(rect.right - 1, cy, 0, rect, 0);
    expect(Math.cos(atSeam)).toBeGreaterThan(0.5);
  });

  it('la ruta de boyas se corta sólo donde cruza un borde del planeta', () => {
    const route = seaRoute(world);
    let cuts = 0;
    let crossings = 0;
    const tile = (v: number, min: number, p: number) => Math.floor((v - min) / p);
    for (let i = 1; i < route.path.length; i++) {
      const a = route.path[i - 1]!;
      const b = route.path[i]!;
      if (acrossSeam(globeProject(a.x, a.y, rect, 0), globeProject(b.x, b.y, rect, 0))) cuts++;
      if (
        tile(a.x, rect.left, period.w) !== tile(b.x, rect.left, period.w) ||
        tile(a.y, rect.top, period.h) !== tile(b.y, rect.top, period.h)
      )
        crossings++;
    }
    expect(cuts).toBe(crossings);
  });

  it('pinta el barco, cada isla (la del evento con aro), el rumbo y la ruta', () => {
    const calls: Record<string, number> = {};
    const ctx = new Proxy(
      {},
      {
        get(target: Record<string, unknown>, key: string) {
          if (key in target) return target[key];
          if (key === 'createRadialGradient') return () => ({ addColorStop() {} });
          return (..._args: unknown[]) => {
            calls[key] = (calls[key] ?? 0) + 1;
          };
        },
        set(target: Record<string, unknown>, key: string, value: unknown) {
          target[key] = value;
          return true;
        },
      },
    ) as unknown as CanvasRenderingContext2D;
    const pins: GlobePin[] = world.objects
      .filter((o) => o.identity.category === 'isla')
      .map((o) => ({
        id: o.identity.id,
        x: o.position.x,
        y: o.position.y,
        accent: o.identity.id === 'allday',
      }));
    const accents = pins.filter((p) => p.accent).length;
    expect(accents).toBe(1);
    drawGlobe(ctx, 168, {
      rect,
      spin: 0.2,
      ship: { x: cx, y: cy, heading: 0 },
      pins,
      route: seaRoute(world).path,
      course: { x: cx + 100, y: cy },
    });
    // Recorte + borde + halo del barco (3) + una por isla + el aro de la del evento + el rumbo.
    expect(calls.arc).toBe(3 + pins.length + accents + 1);
    expect(calls.lineTo).toBeGreaterThan(seaRoute(world).path.length / 2);
  });

  it('centrado como el mapa grande (T68): el giro no corre las islas ni el barco', () => {
    // Un lienzo que apunta dónde pinta cada círculo.
    const record = () => {
      const arcs: [number, number][] = [];
      const ctx = new Proxy(
        {},
        {
          get(target: Record<string, unknown>, key: string) {
            if (key in target) return target[key];
            if (key === 'createRadialGradient') return () => ({ addColorStop() {} });
            if (key === 'arc') return (x: number, y: number) => arcs.push([x, y]);
            return () => undefined;
          },
          set(target: Record<string, unknown>, key: string, value: unknown) {
            target[key] = value;
            return true;
          },
        },
      ) as unknown as CanvasRenderingContext2D;
      return { arcs, ctx };
    };
    const pins: GlobePin[] = world.objects
      .filter((o) => o.identity.category === 'isla')
      .map((o) => ({ id: o.identity.id, x: o.position.x, y: o.position.y }));
    const scene = (spin: number) => ({
      rect,
      spin,
      ship: { x: cx + 200, y: cy + 300, heading: 0.4 },
      pins,
      route: [],
      course: null,
    });
    const a = record();
    const b = record();
    const size = 144;
    const centerA = drawGlobe(a.ctx, size, scene(0));
    const centerB = drawGlobe(b.ctx, size, scene(2.5));
    // El centro del planeta, en el centro del lienzo, gire lo que gire.
    for (const c of [centerA, centerB]) {
      expect(c.x).toBeCloseTo(size / 2, 6);
      expect(c.y).toBeCloseTo(size / 2, 6);
    }
    // Y cada isla y el barco, en el mismo sitio con cualquier giro.
    expect(b.arcs).toEqual(a.arcs);
  });
});
