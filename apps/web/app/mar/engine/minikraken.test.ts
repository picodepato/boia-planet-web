import { describe, expect, it } from 'vitest';
import type { BufferGeometry, Mesh } from 'three';
import { createMinikraken } from './minikraken';

/**
 * El minikraken de cubierta (plan 013 T154): pocas piezas, más barato en
 * `baja`, animado sólo con transformaciones y quieto con movimiento reducido.
 */
const tris = (m: Mesh) => (m.geometry as BufferGeometry).getAttribute('position').count / 3;
const total = (k: ReturnType<typeof createMinikraken>) => tris(k.head) + tris(k.skirt) + tris(k.arm);

describe('minikraken (T154)', () => {
  it('tres piezas con un solo material; en baja, menos triángulos', () => {
    const alta = createMinikraken('alta');
    const baja = createMinikraken('baja');
    const meshes: Mesh[] = [];
    alta.group.traverse((o) => {
      if ((o as Mesh).isMesh) meshes.push(o as Mesh);
    });
    expect(meshes).toHaveLength(3);
    expect(new Set(meshes.map((m) => m.material)).size).toBe(1);
    expect(total(baja)).toBeLessThan(total(alta));
    // Barato: por debajo de un barco (los GLB rondan miles de triángulos).
    expect(total(alta)).toBeLessThan(1500);
  });

  it('en alta se mece; en baja sólo flota y saluda; con movimiento reducido, quieto', () => {
    const state = { waving: false, reduced: false } as const;
    const alta = createMinikraken('alta');
    alta.update(1.3, 1 / 60, { ...state, quality: 'alta' });
    expect(alta.skirt.rotation.y).not.toBe(0);
    expect(alta.group.position.y).toBeGreaterThan(0);

    const baja = createMinikraken('baja');
    baja.update(1.3, 1 / 60, { ...state, quality: 'baja' });
    expect(baja.skirt.rotation.y).toBe(0);
    expect(baja.skirt.scale.y).toBe(1);
    expect(baja.group.position.y).toBeGreaterThan(0);

    const quieto = createMinikraken('alta');
    for (let i = 0; i < 120; i++)
      quieto.update(i / 60, 1 / 60, { waving: true, reduced: true, quality: 'alta' });
    expect(quieto.group.position.y).toBe(0);
    expect(quieto.skirt.rotation.y).toBe(0);
    expect(quieto.shoulder.rotation.z).toBe(0);
  });

  it('cerca de una isla levanta el tentáculo y saluda; lejos, lo baja', () => {
    const k = createMinikraken('baja');
    const step = (waving: boolean, n: number, from = 0) => {
      for (let i = 0; i < n; i++)
        k.update((from + i) / 60, 1 / 60, { waving, reduced: false, quality: 'baja' });
    };
    step(false, 30);
    const down = k.shoulder.rotation.x;
    step(true, 120, 30);
    expect(k.shoulder.rotation.x).toBeLessThan(down - 1.5);
    step(false, 240, 150);
    expect(k.shoulder.rotation.x).toBeGreaterThan(down - 0.05);
  });

  it('se libera sin errores', () => {
    const k = createMinikraken('alta');
    expect(() => k.dispose()).not.toThrow();
  });
});
