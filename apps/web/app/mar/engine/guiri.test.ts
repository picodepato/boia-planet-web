import { BoxGeometry, Group, Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { GUIRI_LOOK, Guiri, type GuiriFrame } from './guiri';
import {
  CHARACTER_MODELS,
  CHARACTER_MODELS_URL,
  MascotModel,
  mascotModelUrl,
} from './mascot-models';

/**
 * El guiri del flamenco (plan 029 T270): deriva despacio por el agua sin
 * meterse en tierra, se queda en la copia del barco, pide su modelo sólo
 * cuando el barco se acerca y saluda al tocarlo.
 */

const DT = 1 / 60;
const PERIOD = { w: 400, h: 300 };

function scene(parts: readonly string[]): Object3D {
  const root = new Group();
  parts.forEach((name, i) => {
    const m = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: '#ff8800' }));
    m.name = name;
    m.position.set(0, i * 0.3, 0);
    root.add(m);
  });
  return root;
}

/** Agua en todas partes menos una isla redonda en (60, 0) de radio 20. */
const isWater = (x: number, z: number) => Math.hypot(x - 60, z) > 20;

function frame(over: Partial<GuiriFrame> = {}): GuiriFrame {
  return { ship: { x: 0, z: 0 }, period: PERIOD, isWater, reduced: false, ...over };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('Guiri (T270)', () => {
  it('no pide el modelo hasta que el barco se acerca; cuando llega, se ve con sus tres piezas', async () => {
    const load = vi.fn(async () => scene([...CHARACTER_MODELS.guiri.parts]));
    const model = new MascotModel(CHARACTER_MODELS.guiri, load);
    const g = new Guiri(model, { x: 0, z: -100, heading: 0 }, () => 0.5);
    expect(g.modelState).toBe('lejos');
    g.update(DT, 0, frame({ ship: { x: 0, z: 100 } }));
    expect(load).not.toHaveBeenCalled();
    expect(g.group.visible).toBe(false);
    g.update(DT, 0, frame({ ship: { x: 0, z: -100 + GUIRI_LOOK.loadWithin * 0.5 } }));
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith(`${CHARACTER_MODELS_URL}/guiri.glb`);
    expect(mascotModelUrl(CHARACTER_MODELS.guiri.file, CHARACTER_MODELS.guiri.url)).toBe(
      `${CHARACTER_MODELS_URL}/guiri.glb`,
    );
    expect(g.modelState).toBe('cargando');
    await settle();
    expect(g.modelState).toBe('glb');
    g.update(DT, 1, frame());
    expect(g.visible).toBe(true);
    expect(g.group.visible).toBe(true);
    expect(g.parts.brazo.position.y).toBeCloseTo(0.6, 5);
    g.dispose();
    expect(model.loaded).toBeNull();
  });

  it('deriva despacio, sin meterse en la isla, y se queda en la copia del barco', () => {
    const model = new MascotModel(CHARACTER_MODELS.guiri, async () => scene([]));
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // Empieza al oeste de la isla, rumbo a ella.
    const g = new Guiri(model, { x: 30, z: 0, heading: 0 }, rnd);
    const start = { ...g.pos };
    let maxStep = 0;
    for (let i = 0; i < 60 * 240; i++) {
      const before = { ...g.pos };
      g.update(DT, i * DT, frame({ ship: { x: 1000, z: 1000 } }));
      expect(isWater(g.pos.x, g.pos.z), `fotograma ${i}`).toBe(true);
      const d = Math.hypot(g.pos.x - before.x, g.pos.z - before.z);
      if (d < PERIOD.h / 2) maxStep = Math.max(maxStep, d);
    }
    // Se movió (está a la deriva), pero nunca más rápido que su velocidad.
    expect(Math.hypot(g.pos.x - start.x, g.pos.z - start.z)).toBeGreaterThan(2);
    expect(maxStep).toBeLessThanOrEqual(GUIRI_LOOK.speed * DT + 1e-6);
    // En la copia del barco: a menos de medio periodo.
    expect(Math.abs(g.pos.x - 1000)).toBeLessThanOrEqual(PERIOD.w / 2 + 1e-6);
    expect(Math.abs(g.pos.z - 1000)).toBeLessThanOrEqual(PERIOD.h / 2 + 1e-6);
  });

  it('saluda al tocarlo durante un rato; con movimiento reducido, el brazo sube sin agitarse', async () => {
    const model = new MascotModel(CHARACTER_MODELS.guiri, async () =>
      scene([...CHARACTER_MODELS.guiri.parts]),
    );
    const g = new Guiri(model, { x: 0, z: 0, heading: 0 }, () => 0.5);
    g.update(DT, 0, frame());
    await settle();
    g.update(DT, 0.5, frame());
    expect(g.waving).toBe(false);
    const idle = g.parts.brazo.rotation.z;
    g.tap();
    g.update(DT, 0.6, frame());
    expect(g.waving).toBe(true);
    expect(g.parts.brazo.rotation.z).toBeGreaterThan(idle);
    for (let i = 0; i < Math.round(GUIRI_LOOK.waveS / DT) + 2; i++)
      g.update(DT, 1 + i * DT, frame());
    expect(g.waving).toBe(false);
    g.tap();
    g.update(DT, 5, frame({ reduced: true }));
    expect(g.parts.brazo.rotation.z).toBe(0.6);
    expect(g.group.position.y).toBe(-0.03);
    g.dispose();
  });
});
