import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot } from '../../../lib/barco/load';
import { glowOffsets, glowPoints, showGlows } from './effects';
import { islandScale, parseIslandManifest } from './island-models';
import {
  BEHIND_ALPHA,
  BEHIND_SCALE,
  FAR_ALPHA,
  FAR_SCALE,
  FAR_TO,
  HUD_MARGIN,
  LABEL_GAP,
  PIN_TIP,
  type PinSight,
  type Rect,
  clearOfHud,
  intersects,
  layoutPins,
  modelLabelY,
  pinBox,
} from './labels';
import { Glows } from './props';

/**
 * Los rótulos de los lugares del mar 3D (T75): nunca bajo los mandos, los
 * lejanos más pequeños y tenues, los que caen sobre un lugar más cercano casi
 * apagados, y sobre las islas de Blender a su alto real.
 */

const pin = (o: Partial<PinSight> = {}): PinSight => ({
  x: 200,
  y: 300,
  w: 120,
  h: 30,
  depth: 1,
  horizon: false,
  always: false,
  body: { left: 100, top: 300, right: 300, bottom: 420 },
  ...o,
});

/** La barra de enlaces de arriba, de lado a lado. */
const BAR: Rect = { left: 0, top: 6, right: 400, bottom: 36 };

describe('la caja del rótulo', () => {
  it('va encima de su punta, centrada, y escala desde la punta', () => {
    const b = pinBox(pin());
    expect(b).toEqual({ left: 140, right: 260, bottom: 300 - PIN_TIP, top: 300 - PIN_TIP - 30 });
    const half = pinBox(pin(), 0.5);
    expect(half.bottom).toBe(b.bottom);
    expect(half.right - half.left).toBe(60);
  });
});

describe('los mandos', () => {
  it('un rótulo libre se queda donde está', () => {
    expect(clearOfHud(pin(), 1, [BAR])).toBe(300);
  });

  it('bajo la barra, baja justo por debajo mientras siga sobre su isla', () => {
    const p = pin({ y: 40, body: { left: 100, top: 20, right: 300, bottom: 400 } });
    const y = clearOfHud(p, 1, [BAR])!;
    const box = pinBox({ ...p, y });
    expect(box.top).toBeGreaterThanOrEqual(BAR.bottom + HUD_MARGIN);
    expect(box.top).toBeLessThanOrEqual(BAR.bottom + HUD_MARGIN + 2);
    expect(y).toBeLessThanOrEqual(p.body!.bottom);
  });

  it('sin su isla en pantalla (o si bajarlo lo saca de ella) se apaga', () => {
    expect(clearOfHud(pin({ y: 40, body: null }), 1, [BAR])).toBeNull();
    const small = pin({ y: 40, body: { left: 190, top: 30, right: 210, bottom: 50 } });
    expect(clearOfHud(small, 1, [BAR])).toBeNull();
    const looks = layoutPins([pin({ y: 40, body: null })], [BAR]);
    expect(looks[0]!.on).toBe(false);
  });

  it('un mando a un lado (la columna de la izquierda) lo desliza un poco, sin apagarlo (T165)', () => {
    // Un rótulo ancho, centrado, que roza por 1 px una columna de mandos a la izquierda.
    const p = pin({ x: 187, y: 200, w: 221, body: { left: 60, top: 40, right: 315, bottom: 260 } });
    const left: Rect = { left: 19, top: 146, right: 73, bottom: 262 };
    expect(intersects(pinBox(p), left, HUD_MARGIN)).toBe(true);
    const [look] = layoutPins([p], [left]);
    expect(look!.on).toBe(true);
    expect(look!.y).toBe(p.y);
    expect(look!.x).toBeGreaterThan(p.x);
    expect(look!.x - p.x).toBeLessThanOrEqual(p.w / 4);
    expect(intersects(pinBox({ ...p, x: look!.x }), left, HUD_MARGIN)).toBe(false);
    // Sin isla debajo no se desliza: se apaga como antes.
    expect(layoutPins([{ ...p, body: null }], [left])[0]!.on).toBe(false);
  });

  it('ningún rótulo encendido pisa un mando', () => {
    const hud = [BAR, { left: 300, top: 40, right: 400, bottom: 80 }];
    const pins = [
      pin({ y: 30, x: 330, body: { left: 250, top: 20, right: 400, bottom: 500 } }),
      pin({ y: 60, x: 100, body: { left: 0, top: 50, right: 200, bottom: 500 } }),
      pin({ y: 600, x: 200, body: null }),
    ];
    const looks = layoutPins(pins, hud);
    looks.forEach((l, i) => {
      if (!l.on) return;
      const box = pinBox({ ...pins[i]!, x: l.x, y: l.y }, l.scale);
      for (const h of hud) expect(intersects(box, h, HUD_MARGIN)).toBe(false);
    });
    expect(looks.filter((l) => l.on).length).toBeGreaterThan(0);
    expect(looks[0]!.lowered).toBe(true);
  });
});

describe('lejos y detrás', () => {
  it('de cerca, entero; lejos o asomado al horizonte, más pequeño y tenue', () => {
    const [near, far, horizon] = layoutPins(
      [
        pin({ depth: 1, x: 100 }),
        pin({ depth: FAR_TO + 1, x: 600, body: null }),
        pin({ horizon: true, depth: Infinity, x: 900, body: null, always: true }),
      ],
      [],
    );
    expect(near).toMatchObject({ on: true, scale: 1, alpha: 1, behind: false });
    expect(far!.scale).toBeCloseTo(FAR_SCALE);
    expect(far!.alpha).toBeCloseTo(FAR_ALPHA);
    expect(horizon).toMatchObject({ on: true });
    expect(horizon!.scale).toBeCloseTo(FAR_SCALE);
  });

  it('el de una isla lejana que cae sobre la isla cercana no parece suyo', () => {
    // La cercana ocupa el centro de la pantalla; la lejana, detrás, cae encima.
    const near = pin({ depth: 1.2, y: 200, body: { left: 100, top: 200, right: 300, bottom: 400 } });
    const sells = pin({ depth: 3, y: 260, always: true, body: null });
    const plain = pin({ depth: 3, y: 260, body: null });
    const [a, b] = layoutPins([sells, near], []);
    expect(b).toMatchObject({ on: true, behind: false, scale: 1 });
    // Lo que vende se queda, pequeño y tenue.
    expect(a).toMatchObject({ on: true, behind: true });
    expect(a!.scale).toBeLessThanOrEqual(BEHIND_SCALE);
    expect(a!.alpha).toBeLessThanOrEqual(BEHIND_ALPHA);
    // Lo demás se apaga.
    const [c] = layoutPins([plain, near], []);
    expect(c!.on).toBe(false);
  });

  it('un lugar sin rótulo (lejos) también tapa a los de detrás', () => {
    const hiddenNear = pin({ depth: 1, label: false });
    const behind = pin({ depth: 2, y: 330, body: null });
    const [a, b] = layoutPins([hiddenNear, behind], []);
    expect(a!.on).toBe(false);
    expect(b!.on).toBe(false);
  });
});

describe('la altura del rótulo sobre una isla de Blender', () => {
  const manifest = parseIslandManifest(
    JSON.parse(readFileSync(path.join(repoRoot(), 'art/islas/3d/manifest.json'), 'utf8')),
  );

  it('es su alto real del manifiesto, escalado al radio de la isla, y un respiro', () => {
    expect(manifest.size).toBeGreaterThan(0);
    for (const e of manifest.values()) {
      const R = 12;
      expect(modelLabelY(e, R)).toBeCloseTo(e.height * islandScale(e, R) + LABEL_GAP);
    }
  });

  it('sin alto en el manifiesto, ninguna (se queda la de a mano)', () => {
    expect(modelLabelY({ radius: 7 }, 12)).toBeNull();
    expect(modelLabelY({ radius: 7, height: 0 }, 12)).toBeNull();
  });
});

describe('las luces de a mano de una isla', () => {
  it('se apagan y vuelven a su color sin tocar las de las demás', () => {
    const a = new Glows();
    a.add([0, 1, 0], '#ff0000', 2);
    const b = new Glows();
    b.add([5, 1, 0], '#00ff00', 2);
    b.add([6, 1, 0], '#0000ff', 2);
    const c = new Glows();
    c.add([9, 1, 0], '#ffffff', 2);
    const groups = [a, b, c];
    const pts = glowPoints(groups);
    const starts = glowOffsets(groups);
    expect(starts).toEqual([0, 1, 3]);
    const col = () => [...(pts.geometry.getAttribute('color').array as Float32Array)];
    const before = col();
    showGlows(pts, starts[1]!, b, false);
    const off = col();
    expect(off.slice(3, 9)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(off.slice(0, 3)).toEqual(before.slice(0, 3));
    expect(off.slice(9)).toEqual(before.slice(9));
    showGlows(pts, starts[1]!, b, true);
    expect(col()).toEqual(before);
  });
});
