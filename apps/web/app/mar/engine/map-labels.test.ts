import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { worlds } from '../../../lib/mundo/demo-world';
import { AFTER_PLACE_ID } from '@boia/engine/after';
import { eventOfPlace } from '../sheet';
import { marWorld } from './compact';
import { toScene } from './compress';
import {
  BEHIND_ALPHA,
  KEEP_SHRINK,
  PIN_AVOID,
  type PinSight,
  type Rect,
  intersects,
  layoutPins,
  lookBox,
  mapKeeps,
} from './labels';
import {
  MAP_SAFE,
  mapCamera,
  mapFit,
  mapFits,
  mapIslandsOf,
  mapProject,
  wrapNear,
} from './map-fit';
import { periodOf, planetRect } from './wrap';

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

/** La cámara de la vista de mapa en una pantalla W×H, como la pone `mar3d.ts` (T279: con todas las islas dentro). */
function mapView(W: number, H: number) {
  const fov = number(/new PerspectiveCamera\((\d+)/);
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
    ((b.right - b.left) * number(/W \* ([\d.]+)/)) / (t * (W / H)),
  );
  const near = number(/const dNear = ([\d.]+)/);
  // La carta centrada (sin arrastrar).
  const center = { x: (b.left + b.right) / 2, z: (b.top + b.bottom) / 2 };
  const view = { fovDeg: fov, width: W, height: H, center };
  const islands = mapIslandsOf(world.objects, center, period);
  // Zoom 1: `dNear · (dFar/dNear)^1`, alejada y subida o bajada para que quepan todas las islas.
  const fit = mapFit(near * Math.pow(dFar / near, MAP_VIEW_ZOOM), view, islands);
  const camera = mapCamera(fit.dist, view, fit.liftPx);
  return { view, camera, period, center, islands, dFar, dist: fit.dist, fit };
}

/**
 * Los rótulos del mar (como `pinsOf` en `mar-client.tsx`) vistos por la cámara
 * del mapa. De día (`night` false) la isla del after está bajo el agua y no
 * tiene rótulo (`placePins`, T273); de 03:00 a 07:00 sí.
 */
function mapSights(
  W: number,
  H: number,
  k: number,
  night = true,
): { ids: string[]; sights: PinSight[] } {
  const { view, camera, period, center } = mapView(W, H);
  const cx = center.x;
  const cz = center.z;
  const project = (x: number, y: number, zz: number) => mapProject(camera, view, x, y, zz);
  const wrap = wrapNear;
  const boatD = camera.position.distanceTo(new Vector3(cx, 0, cz));
  const ids: string[] = [];
  const sights: PinSight[] = [];
  for (const o of world.objects) {
    if (!o.identity.active) continue;
    if (!night && o.identity.id === AFTER_PLACE_ID) continue;
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
      // Como `placePins`: en la vista de mapa (`far`), `keep` para las islas (`mapKeeps`, T280) y lo que vende (T279).
      keep: mapKeeps(cat) || sells,
      body,
    });
    ids.push(o.identity.id);
  }
  return { ids, sights };
}

/**
 * Los mandos de `PIN_AVOID` en la vista de mapa, medidos en /mar (Chromium,
 * las pantallas de las e2e) el 2026-10-14 (T280): la barra de enlaces, el
 * minimapa, los saldos, «Menú», «!», la Radio, el zoom, el «Cerrar» del
 * mapa (pequeño, abajo a la izquierda, donde fuera del mapa van los nudos),
 * «Entradas» y el turbo (en el mapa no salen los nudos ni la bocina).
 */
const MEASURED_HUD: Record<string, [number, number, number, number][]> = {
  '360x640': [
    [8, 6, 352, 36],
    [10, 48, 66, 109],
    [265, 48, 350, 84],
    [19, 146, 73, 200],
    [19, 208, 73, 262],
    [19, 270, 73, 324],
    [302, 400, 346, 556],
    [18, 578, 62, 622],
    [100, 574, 260, 626],
    [288, 568, 352, 632],
  ],
  '390x844': [
    [8, 6, 382, 36],
    [10, 48, 66, 109],
    [295, 48, 380, 84],
    [19, 146, 73, 200],
    [19, 208, 73, 262],
    [19, 270, 73, 324],
    [332, 604, 376, 760],
    [18, 782, 62, 826],
    [115, 778, 275, 830],
    [318, 772, 382, 836],
  ],
  '1280x720': [
    [349, 14, 931, 48],
    [10, 10, 82, 87],
    [1185, 10, 1270, 46],
    [31, 132, 85, 186],
    [31, 194, 85, 248],
    [31, 256, 85, 310],
    [1222, 472, 1266, 628],
    [18, 654, 62, 698],
    [560, 650, 720, 702],
    [1200, 640, 1272, 712],
  ],
};
/** Dónde queda el «Cerrar» del mapa en cada pantalla (de `MEASURED_HUD`). */
const CLOSE_AT: Record<string, Rect> = {
  '360x640': { left: 18, top: 578, right: 62, bottom: 622 },
  '390x844': { left: 18, top: 782, right: 62, bottom: 826 },
  '1280x720': { left: 18, top: 654, right: 62, bottom: 698 },
};
const hudOf = (W: number, H: number): Rect[] =>
  MEASURED_HUD[`${W}x${H}`]!.map(([left, top, right, bottom]) => ({ left, top, right, bottom }));
const ABOVE_SCREEN: Rect = { left: -1e6, top: -1e6, right: 1e6, bottom: -4 };

describe('el Puig Campana en la vista de mapa (T275)', () => {
  it('el Puig Campana es de los rótulos que se ven enteros en el mapa', () => {
    const canon = world.objects.find((o) => o.identity.id === 'canon');
    expect(canon?.identity.name).toBe('Puig Campana');
    expect(mapKeeps(canon!.identity.category)).toBe(true);
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
        const box = lookBox(sights[i]!, look);
        ids.forEach((_, j) => {
          if (j === i) return;
          const s = sights[j]!;
          const l = looks[j]!;
          if (l.on && l.alpha > BEHIND_ALPHA)
            expect(intersects(box, lookBox(s, l)), ids[j]).toBe(false);
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

describe('Nochevieja y Puig Campana en la vista de mapa (T279)', () => {
  for (const [W, H] of [
    [360, 640],
    [1280, 720],
  ] as const) {
    for (const k of [1, 1.15]) {
      it(`a ${W}×${H} (letra ×${k}) los dos rótulos salen enteros, sin pisarse`, () => {
        const { ids, sights } = mapSights(W, H, k);
        const looks = layoutPins(sights, [...hudOf(W, H), ABOVE_SCREEN], W);
        const at = (id: string) => {
          const i = ids.indexOf(id);
          expect(i, id).toBeGreaterThanOrEqual(0);
          return { s: sights[i]!, l: looks[i]! };
        };
        const ultima = at('ultima');
        const canon = at('canon');
        // La Isla de Nochevieja es de un evento: siempre se ve.
        expect(ultima.s.always).toBe(true);
        for (const { l } of [ultima, canon]) {
          expect(l.on).toBe(true);
          expect(l.behind).toBe(false);
          expect(l.alpha).toBe(1);
          expect(l.scale).toBe(1);
        }
        expect(
          intersects(
            lookBox(ultima.s, ultima.l),
            lookBox(canon.s, canon.l),
          ),
        ).toBe(false);
      });
    }
  }

  it('un `keep` sin hueco cede ante el rótulo de un evento (no se le pone encima)', () => {
    const body: Rect = { left: 90, right: 110, top: 100, bottom: 120 };
    // En la vista de mapa lo que vende también es `keep` (T279) y va antes que nadie.
    const event: PinSight = {
      x: 100,
      y: 100,
      w: 120,
      h: 40,
      depth: 1.2,
      horizon: false,
      always: true,
      keep: true,
      body,
    };
    // Más cerca de la cámara y justo encima, con mandos alrededor: no hay hueco.
    const kept: PinSight = { ...event, depth: 1, always: false, body: null };
    const wall: Rect[] = [
      { left: 0, right: 400, top: -100, bottom: 40 },
      { left: 0, right: 30, top: 0, bottom: 400 },
      { left: 170, right: 400, top: 0, bottom: 400 },
    ];
    const [e, k] = layoutPins([event, kept], wall, 400);
    expect(e!.on).toBe(true);
    expect(e!.alpha).toBe(1);
    expect(e!.behind).toBe(false);
    expect(e!.scale).toBe(1);
    // El otro, si sale (T280: más pequeño, en un hueco), nunca encima del evento.
    if (k!.on && k!.alpha > BEHIND_ALPHA)
      expect(intersects(lookBox(event, e!), lookBox(kept, k!))).toBe(false);
  });
});

describe('la vista de mapa enseña todas las islas (T279)', () => {
  it('mar3d.ts pone la cámara del mapa con `mapFit`', () => {
    expect(source).toMatch(/mapFit\(/);
    expect(source).toMatch(/const mapLift = this\.mapLiftPx \* perPx \* w;/);
    expect(source).toMatch(/dist \*= lerp\(1, this\.mapStretch, smooth\(MAP_ZOOM, 1, z\)\)/);
  });

  for (const [W, H] of [
    [360, 640],
    [390, 844],
    [1280, 720],
  ] as const) {
    it(`a ${W}×${H} cada isla (y la punta de su rótulo) cae dentro de la pantalla, libre de mandos`, () => {
      const { view, camera, islands, dist } = mapView(W, H);
      expect(islands.length).toBeGreaterThan(10);
      expect(dist).toBeGreaterThan(0);
      for (const i of islands) {
        for (const [x, y, z] of [
          [i.x, 6, i.z],
          [i.x - i.r, 0, i.z],
          [i.x + i.r, 0, i.z],
          [i.x, 0, i.z - i.r],
          [i.x, 0, i.z + i.r],
        ] as const) {
          const p = mapProject(camera, view, x, y, z);
          expect(p.x).toBeGreaterThanOrEqual(MAP_SAFE.side - 0.5);
          expect(p.x).toBeLessThanOrEqual(W - MAP_SAFE.side + 0.5);
          expect(p.y).toBeGreaterThanOrEqual(MAP_SAFE.top - 0.5);
          expect(p.y).toBeLessThanOrEqual(H - MAP_SAFE.bottom + 0.5);
        }
      }
    });
  }

  it('no se aleja más de lo justo: un poco más cerca, alguna isla ya no cabe', () => {
    for (const [W, H] of [
      [360, 640],
      [1280, 720],
    ] as const) {
      const { view, islands, dist, dFar, fit } = mapView(W, H);
      expect(mapFits(fit, view, islands)).toBe(true);
      // Más cerca, con la carta subida o bajada como sea, alguna isla se sale.
      if (dist > dFar)
        for (let lift = -200; lift <= 200; lift += 4)
          expect(mapFits({ dist: dist * 0.97, liftPx: lift }, view, islands)).toBe(false);
    }
  });
});

describe('todas las islas con su rótulo en la vista de mapa (T280)', () => {
  /** Las islas del mar (como `pinsOf`): las que en el mapa se ven enteras. */
  const islandIds = world.objects
    .filter((o) => o.identity.active && mapKeeps(o.identity.category))
    .map((o) => o.identity.id);

  it('el «Cerrar» del mapa y la Radio son de los mandos que los rótulos no pisan', () => {
    expect(PIN_AVOID).toContain('.mar-mapclose');
    expect(PIN_AVOID).toContain('.radio-btn--mar');
    const css = readFileSync(new URL('../mar.css', import.meta.url), 'utf8');
    const rule = css.match(/\n\.mar-mapclose \{([^}]*)\}/)?.[1] ?? '';
    // Pequeño y abajo a la izquierda (no centrado sobre los rótulos).
    expect(rule).toMatch(/width: 44px;/);
    expect(rule).toMatch(/height: 44px;/);
    expect(rule).toMatch(/left: calc\(var\(--safe-l\)/);
    expect(rule).not.toMatch(/right:/);
    expect(rule).not.toMatch(/margin: 0 auto/);
  });

  it('el Castillo de Santa Bárbara y Las Calitas son islas del mar', () => {
    const name = (id: string) => world.objects.find((o) => o.identity.id === id)?.identity.name;
    expect(islandIds).toContain('castillo');
    expect(islandIds).toContain('calitas');
    expect(name('castillo')).toBe('Castillo de Santa Bárbara');
    expect(name('calitas')).toBe('Las Calitas');
  });

  for (const [W, H] of [
    [360, 640],
    [390, 844],
    [1280, 720],
  ] as const) {
    // De día y de noche (con la isla del after); la letra un 15 % más grande, de día.
    for (const [k, night] of [
      [1, false],
      [1.15, false],
      [1, true],
    ] as const) {
      it(`a ${W}×${H} (letra ×${k}${night ? ', de noche' : ''}) cada isla tiene su rótulo entero, sin pisar otro ni un mando`, () => {
        const { ids, sights } = mapSights(W, H, k, night);
        const hud = [...hudOf(W, H), ABOVE_SCREEN];
        const looks = layoutPins(sights, hud, W);
        const close = CLOSE_AT[`${W}x${H}`]!;
        expect(hudOf(W, H)).toContainEqual(close);
        const boxes = ids.map((_, j) => lookBox(sights[j]!, looks[j]!));
        for (const id of islandIds) {
          // La isla del after: bajo el agua de día (T273). De noche, en el móvil
          // más pequeño no le queda hueco entre el minimapa, «Menú», Nochevieja
          // y el Puig Campana: es la única que puede no salir (se busca igual).
          if (id === AFTER_PLACE_ID && (!night || W < 390)) continue;
          const i = ids.indexOf(id);
          expect(i, id).toBeGreaterThanOrEqual(0);
          const look = looks[i]!;
          expect(look.on, id).toBe(true);
          expect(look.behind, id).toBe(false);
          expect(look.alpha, id).toBe(1);
          // A su tamaño o, si no cabe (un móvil de 360 px), un poco más pequeño (`KEEP_SHRINK`).
          expect(look.scale, id).toBeGreaterThanOrEqual(KEEP_SHRINK);
          const box = boxes[i]!;
          expect(box.left, id).toBeGreaterThanOrEqual(0);
          expect(box.right, id).toBeLessThanOrEqual(W);
          expect(intersects(box, close), `${id} bajo el «Cerrar»`).toBe(false);
          for (const r of hud) expect(intersects(box, r), id).toBe(false);
          // Ningún otro rótulo encendido encima.
          ids.forEach((other, j) => {
            if (j === i || !looks[j]!.on || looks[j]!.alpha <= BEHIND_ALPHA) return;
            expect(intersects(box, boxes[j]!), `${id} / ${other}`).toBe(false);
          });
        }
      });
    }
  }
});

