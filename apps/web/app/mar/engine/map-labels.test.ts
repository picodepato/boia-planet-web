import { readFileSync } from 'node:fs';
import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { worlds } from '../../../lib/mundo/demo-world';
import { eventOfPlace } from '../sheet';
import { marWorld } from './compact';
import { toScene } from './compress';
import { lerp, smooth } from './kit';
import {
  BEHIND_ALPHA,
  MAP_KEEP,
  type PinSight,
  type Rect,
  intersects,
  layoutPins,
  pinBox,
} from './labels';
import { bendDrop, periodOf, planetRect } from './wrap';

/**
 * T275: el Puig Campana en la vista de mapa (la que abre el minimapa, zoom 1),
 * con las posiciones reales del mar y la cámara de `mar3d.ts` (sus números se
 * leen del código, como en `lighthouse-framing.test.ts`). Antes su rótulo caía
 * sobre el de la isla del ALL DAY, más cercana a la cámara, y se apagaba.
 */
const source = readFileSync(new URL('./mar3d.ts', import.meta.url), 'utf8');
const number = (pattern: RegExp) => {
  const match = source.match(pattern);
  if (!match) throw new Error(`Camera parameter not found: ${pattern}`);
  return Number(match[1]);
};
const world = marWorld(worlds.get('arcilla').config);

/** El zoom de la vista de mapa: `toggleMap` pone `zoomGoal = 1`. */
const MAP_VIEW_ZOOM = number(/this\.zoomGoal = (\d+(?:\.\d+)?);\s*\}\s*\}\s*backToBoat/);

/**
 * Lo que mide un rótulo `.mar-pin.is-map` (× `k`), con lo medido en /mar el
 * 2026-10-13: la letra de píxeles a 11 px ocupa ~11,7 px por carácter, el
 * relleno, el icono y su hueco ~36 px, el ancho tope `min(170px, 46vw)`; una
 * línea mide 32 px de alto y cada línea más ~15.
 */
function pinSize(text: string, W: number, k: number): { w: number; h: number } {
  const char = 11.7 * k;
  const chrome = 36;
  const max = Math.min(170, W * 0.46);
  let lines = 1;
  let line = 0;
  let widest = 0;
  for (const word of text.split(' ')) {
    const ww = word.length * char;
    const next = line ? line + char + ww : ww;
    if (line && next + chrome > max) {
      lines++;
      line = ww;
    } else line = next;
    widest = Math.max(widest, line);
  }
  return { w: Math.min(max, widest + chrome), h: 32 + (lines - 1) * 15 };
}

/** Los rótulos del mar (como `pinsOf` en `mar-client.tsx`) vistos por la cámara del mapa. */
function mapSights(W: number, H: number, k: number): { ids: string[]; sights: PinSight[] } {
  const aspect = W / H;
  const fov = number(/new PerspectiveCamera\((\d+)/);
  const camera = new PerspectiveCamera(fov, aspect, 0.5, 50000);
  const t = Math.tan((fov * Math.PI) / 360);
  const rect = planetRect(world.bounds);
  const b = {
    left: toScene(rect.left),
    right: toScene(rect.right),
    top: toScene(rect.top),
    bottom: toScene(rect.bottom),
  };
  const period = periodOf(b);
  const dFar = Math.max(
    ((b.bottom - b.top) * number(/H \* ([\d.]+)/)) / t,
    ((b.right - b.left) * number(/W \* ([\d.]+)/)) / (t * aspect),
  );
  const near = number(/const dNear = ([\d.]+)/);
  const z = MAP_VIEW_ZOOM;
  const dist = near * Math.pow(dFar / near, z);
  const elev = lerp(
    number(/const ELEV_NEAR = ([\d.]+)/),
    number(/lerp\(ELEV_NEAR, ([\d.]+)/),
    smooth(0, 1, z),
  );
  const bend = number(/const BEND_MAP = ([\d.]+)/);
  const mapLift = (number(/const MAP_LIFT_PX = ([\d.]+)/) * 2 * dist * t) / H;
  // La carta centrada (sin arrastrar), subida `MAP_LIFT_PX`.
  const cx = (b.left + b.right) / 2;
  const cz = (b.top + b.bottom) / 2;
  const back = Math.cos(elev) * dist;
  const look = new Vector3(cx, -bendDrop(bend, back), cz + mapLift);
  camera.position.set(look.x, Math.sin(elev) * dist, look.z + back);
  camera.lookAt(look);
  camera.updateMatrixWorld();
  const project = (x: number, y: number, zz: number) => {
    const r = Math.hypot(x - camera.position.x, zz - camera.position.z);
    const v = new Vector3(x, y - bendDrop(bend, r), zz).project(camera);
    return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H };
  };
  const wrap = (v: number, c: number, p: number) => c + ((((v - c) % p) + p * 1.5) % p) - p / 2;
  const boatD = camera.position.distanceTo(new Vector3(cx, 0, cz));
  const ids: string[] = [];
  const sights: PinSight[] = [];
  for (const o of world.objects) {
    if (!o.identity.active) continue;
    const cat = o.identity.category;
    const start =
      cat === 'circuito' &&
      o.behaviors.some((bb) => bb.type === 'checkpoint' && bb.params.order === 0);
    if (cat !== 'isla' && cat !== 'naufrago' && cat !== 'encuentro' && !start) continue;
    const x = wrap(toScene(o.position.x), cx, period.w);
    const zz = wrap(toScene(o.position.y), cz, period.h);
    const r = toScene(o.geometry.collision?.radius ?? o.geometry.activation?.radius ?? 12);
    const R = cat === 'naufrago' ? Math.max(1.5, r * 1.2) : r;
    // Altura del rótulo: la de una isla (escena); a esta distancia apenas cuenta.
    const labelY = 6;
    const tip = project(x, labelY, zz);
    const top = project(x, labelY * 0.7, zz);
    const sides = [
      project(x - R, 0, zz),
      project(x + R, 0, zz),
      project(x, 0, zz - R),
      project(x, 0, zz + R),
    ];
    const body: Rect = {
      left: Math.min(top.x, ...sides.map((s) => s.x)),
      right: Math.max(top.x, ...sides.map((s) => s.x)),
      top: top.y,
      bottom: Math.max(top.y, ...sides.map((s) => s.y)),
    };
    const sells = (cat === 'isla' && !!eventOfPlace(o)) || cat === 'encuentro';
    sights.push({
      ...tip,
      ...pinSize(o.identity.name, W, k),
      depth:
        Math.hypot(x - camera.position.x, labelY - camera.position.y, zz - camera.position.z) /
        boatD,
      horizon: false,
      always: sells,
      // Como `placePins`: en la vista de mapa (`far`), `keep` para los de `MAP_KEEP`.
      keep: MAP_KEEP.includes(o.identity.id),
      body,
    });
    ids.push(o.identity.id);
  }
  return { ids, sights };
}

/**
 * Los mandos de `PIN_AVOID` en la vista de mapa, medidos en /mar el
 * 2026-10-13 con las pantallas de las e2e (móvil 360×640, escritorio
 * 1280×720): la barra de enlaces, el minimapa, los saldos, «Menú», «!», el
 * zoom, los nudos, «Entradas» y el turbo.
 */
const MEASURED_HUD: Record<string, [number, number, number, number][]> = {
  '360x640': [
    [8, 6, 352, 36],
    [10, 48, 66, 109],
    [265, 48, 350, 84],
    [19, 146, 73, 200],
    [19, 208, 73, 262],
    [302, 400, 346, 556],
    [12, 572, 68, 628],
    [100, 574, 260, 626],
    [288, 568, 352, 632],
  ],
  '1280x720': [
    [349, 14, 931, 48],
    [10, 10, 82, 87],
    [1185, 10, 1270, 46],
    [31, 132, 85, 186],
    [31, 194, 85, 248],
    [1222, 472, 1266, 628],
    [12, 648, 68, 704],
    [560, 650, 720, 702],
    [1200, 640, 1272, 712],
  ],
};
const hudOf = (W: number, H: number): Rect[] =>
  MEASURED_HUD[`${W}x${H}`]!.map(([left, top, right, bottom]) => ({ left, top, right, bottom }));
const ABOVE_SCREEN: Rect = { left: -1e6, top: -1e6, right: 1e6, bottom: -4 };

describe('el Puig Campana en la vista de mapa (T275)', () => {
  it('el Puig Campana es de los rótulos que se ven enteros en el mapa', () => {
    expect(MAP_KEEP).toContain('canon');
    expect(world.objects.find((o) => o.identity.id === 'canon')?.identity.name).toBe(
      'Puig Campana',
    );
    expect(MAP_VIEW_ZOOM).toBe(1);
  });

  for (const [W, H] of [
    [360, 640],
    [1280, 720],
  ] as const) {
    for (const k of [1, 1.15]) {
      it(`a ${W}×${H} (letra ×${k}) su rótulo sale entero y sin pisar otro`, () => {
        const { ids, sights } = mapSights(W, H, k);
        const hud = [...hudOf(W, H), ABOVE_SCREEN];
        const looks = layoutPins(sights, hud, W);
        const i = ids.indexOf('canon');
        expect(i).toBeGreaterThanOrEqual(0);
        const look = looks[i]!;
        expect(look.on).toBe(true);
        expect(look.behind).toBe(false);
        expect(look.alpha).toBe(1);
        expect(look.scale).toBe(1);
        // No pisa ningún rótulo encendido ni lugar más cercano, ni los mandos.
        const box = pinBox({ ...sights[i]!, x: look.x, y: look.y }, look.scale);
        ids.forEach((_, j) => {
          if (j === i) return;
          const s = sights[j]!;
          const l = looks[j]!;
          if (l.on && l.alpha > BEHIND_ALPHA)
            expect(intersects(box, pinBox({ ...s, x: l.x, y: l.y }, l.scale)), ids[j]).toBe(false);
          if (s.body && s.depth < sights[i]!.depth)
            expect(intersects(box, s.body), ids[j]).toBe(false);
        });
        for (const r of hud) expect(intersects(box, r)).toBe(false);
        // Su punta sigue señalando su isla (como la dibuja `.mar-pin`).
        expect(Math.abs(look.x - sights[i]!.x)).toBeLessThanOrEqual(sights[i]!.w / 2 - 10);
      });
    }
  }

  it('sin `keep` (como antes de T275), en el móvil no salía', () => {
    const { ids, sights } = mapSights(360, 640, 1);
    const looks = layoutPins(
      sights.map((s) => ({ ...s, keep: false })),
      [...hudOf(360, 640), ABOVE_SCREEN],
      360,
    );
    const look = looks[ids.indexOf('canon')]!;
    expect(look.on && look.alpha === 1).toBe(false);
  });
});
