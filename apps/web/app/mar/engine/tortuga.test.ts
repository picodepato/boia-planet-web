import { Group, Mesh, MeshStandardMaterial, type Object3D, SphereGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { MASCOT_MODELS, MascotModel } from './mascot-models';
import { TORTUGA_BEHIND, TORTUGA_MIN_BEHIND, WakeFollower, createTortuga } from './tortuga';

/**
 * La Tortuga turbo (plan 015 T175): nada detrás del barco por su estela, a
 * una distancia corta, nunca por delante, y le sigue el ritmo a toda máquina
 * y en turbo; al cambiar de copia del planeta va con él; rema más deprisa
 * cuanto más corre y, con movimiento reducido, no rema.
 */

/** Velocidad máxima del barco en escena: ~15 u de motor/s a 16 u por u de escena → ~0,94; con turbo ×1,4. */
const MAX = 0.94;
const TURBO = MAX * 1.4;
const DT = 1 / 60;

/** Navega `s` segundos a `speed` con el rumbo que dé `heading(t)`; comprueba cada fotograma tras el arranque. */
function sail(
  f: WakeFollower,
  from: { x: number; z: number },
  speed: number,
  s: number,
  heading: (t: number) => number,
  check: (t: number, x: number, z: number, h: number) => void,
) {
  let { x, z } = from;
  for (let i = 0; i < s * 60; i++) {
    const t = i * DT;
    const h = heading(t);
    x += Math.cos(h) * speed * DT;
    z += Math.sin(h) * speed * DT;
    f.update(DT, x, z, h, speed);
    if (t > 1.5) check(t, x, z, h);
  }
  return { x, z };
}

describe('WakeFollower: detrás del barco por la estela', () => {
  it('a toda máquina y en turbo se queda a su distancia por detrás, nunca por delante', () => {
    for (const speed of [MAX * 0.4, MAX, TURBO]) {
      const f = new WakeFollower();
      sail(f, { x: 0, z: 0 }, speed, 6, () => 0.3, (_t, x, z, h) => {
        const behind = f.behind(x, z, h);
        expect(behind, `v=${speed.toFixed(2)}`).toBeGreaterThanOrEqual(TORTUGA_MIN_BEHIND - 1e-6);
        expect(behind, `v=${speed.toFixed(2)}`).toBeLessThan(TORTUGA_BEHIND * 1.6);
        // Y sin desviarse del trazo (una recta): a un lado como mucho un poco.
        const side = -(f.pos.x - x) * Math.sin(h) + (f.pos.z - z) * Math.cos(h);
        expect(Math.abs(side)).toBeLessThan(0.3);
      });
    }
  });

  it('en una curva sigue el camino del barco (no corta por dentro) y mira hacia donde nada', () => {
    const f = new WakeFollower();
    // Un giro continuo cerrado: círculo de radio v/ω ≈ 2,7 (menos de una eslora).
    const w = 0.35;
    sail(f, { x: 0, z: 0 }, MAX, 8, (t) => w * t, (_t, x, z, h) => {
      const behind = f.behind(x, z, h);
      expect(behind).toBeGreaterThan(0.6);
      expect(behind).toBeLessThan(TORTUGA_BEHIND * 1.6);
      // El rumbo de la tortuga va por detrás del del barco (gira después que él), sin pasarse.
      const lag = Math.atan2(Math.sin(h - f.heading), Math.cos(h - f.heading));
      expect(lag).toBeGreaterThan(-0.2);
      expect(lag).toBeLessThan(1.6);
    });
  });

  it('si el barco para, la tortuga llega hasta su sitio y no lo pasa; al arrancar otra vez, sigue', () => {
    const f = new WakeFollower();
    const end = sail(f, { x: 0, z: 0 }, MAX, 4, () => 1.0, () => {});
    for (let i = 0; i < 180; i++) f.update(DT, end.x, end.z, 1.0, 0);
    const behind = f.behind(end.x, end.z, 1.0);
    expect(behind).toBeGreaterThan(TORTUGA_MIN_BEHIND - 1e-6);
    expect(behind).toBeLessThanOrEqual(TORTUGA_BEHIND + 0.05);
    sail(f, end, TURBO, 4, () => 1.0, (_t, x, z, h) => {
      expect(f.behind(x, z, h)).toBeGreaterThanOrEqual(TORTUGA_MIN_BEHIND - 1e-6);
    });
  });

  it('un salto del barco (otra copia del planeta, un viaje) la lleva con él, detrás', () => {
    const f = new WakeFollower();
    sail(f, { x: 0, z: 0 }, MAX, 3, () => 0, () => {});
    f.update(DT, 500, 500, Math.PI / 2, MAX);
    expect(Math.hypot(f.pos.x - 500, f.pos.z - 500)).toBeCloseTo(TORTUGA_BEHIND, 3);
    expect(f.behind(500, 500, Math.PI / 2)).toBeCloseTo(TORTUGA_BEHIND, 3);
  });
});

/** Una escena como la que deja GLTFLoader: una malla por pieza, en su pivote. */
function scene(parts: readonly string[]): Object3D {
  const root = new Group();
  parts.forEach((name, i) => {
    const m = new Mesh(new SphereGeometry(0.1, 6, 4), new MeshStandardMaterial({ color: '#3f8f5a' }));
    m.name = name;
    m.position.set(i * 0.1, 0, 0);
    root.add(m);
  });
  return root;
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('createTortuga: la vista con el modelo', () => {
  const model = () =>
    new MascotModel(MASCOT_MODELS['tortuga-turbo'], async () => scene(MASCOT_MODELS['tortuga-turbo'].parts));
  const state = (speed: number, reduced = false) => ({
    x: 0,
    z: 0,
    heading: 0,
    speed,
    quality: 'alta' as const,
    reduced,
    hidden: false,
  });

  it('escondida hasta que llega el modelo; con él, se ve, con las piezas en sus pivotes', async () => {
    const t = createTortuga('alta', model());
    expect(t.modelState).toBe('cargando');
    t.update(0, DT, state(0));
    expect(t.group.visible).toBe(false);
    await settle();
    expect(t.modelState).toBe('glb');
    t.update(0.1, DT, state(0));
    expect(t.group.visible).toBe(true);
    expect(t.flippers[0]!.position.x).toBeCloseTo(0.1, 6);
    expect(t.body.geometry.getAttribute('position').count).toBeGreaterThan(0);
    t.dispose();
  });

  it('rema más deprisa cuanto más corre; con movimiento reducido, no rema ni se hunde; escondida al volar', async () => {
    const t = createTortuga('baja', model());
    await settle();
    const sweep = (speed: number) => {
      let total = 0;
      let prev = 0;
      for (let i = 0; i < 120; i++) {
        t.update(i * DT, DT, state(speed));
        total += Math.abs(t.flippers[0]!.rotation.y - prev);
        prev = t.flippers[0]!.rotation.y;
      }
      return total;
    };
    const slow = sweep(0.1);
    const fast = sweep(TURBO);
    expect(fast).toBeGreaterThan(slow * 1.5);
    t.update(3, DT, state(MAX, true));
    expect(t.flippers[0]!.rotation.y).toBe(0);
    expect(t.group.rotation.z).toBe(0);
    t.update(3.1, DT, { ...state(MAX), hidden: true });
    expect(t.group.visible).toBe(false);
    t.dispose();
  });
});
