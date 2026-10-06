import { Group, Mesh, MeshStandardMaterial, type Object3D, SphereGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { CANONCITO_PERIOD_S, CANONCITO_SHOT_S, canoncitoShotAt, createCanoncito } from './canoncito';
import { MASCOT_MODELS, MascotModel } from './mascot-models';

/**
 * El Cañoncito (plan 015 T175): tres piezas con un solo material, el modelo
 * de Blender al llegar; dispara de vez en cuando (el tubo retrocede y la
 * nube crece) y, con movimiento reducido, quieto y sin humo.
 */

function scene(): Object3D {
  const root = new Group();
  MASCOT_MODELS.canoncito.parts.forEach((name, i) => {
    const m = new Mesh(new SphereGeometry(0.1, 6, 4), new MeshStandardMaterial({ color: '#4a5468' }));
    m.name = name;
    m.position.set(0, i * 0.25, 0);
    root.add(m);
  });
  return root;
}

const model = () => new MascotModel(MASCOT_MODELS.canoncito, async () => scene());
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('canoncito (T175)', () => {
  it('dispara cada CANONCITO_PERIOD_S durante CANONCITO_SHOT_S', () => {
    expect(canoncitoShotAt(0)).toBe(1);
    expect(canoncitoShotAt(CANONCITO_SHOT_S * 0.5)).toBeCloseTo(0.5, 6);
    expect(canoncitoShotAt(CANONCITO_SHOT_S + 0.01)).toBe(0);
    expect(canoncitoShotAt(CANONCITO_PERIOD_S - 0.01)).toBe(0);
    expect(canoncitoShotAt(CANONCITO_PERIOD_S)).toBe(1);
  });

  it('tres piezas con un material; el modelo llega y cada pieza va en su pivote', async () => {
    const c = createCanoncito('baja', model());
    expect(c.modelState).toBe('cargando');
    const meshes: Mesh[] = [];
    c.group.traverse((o) => {
      if ((o as Mesh).isMesh) meshes.push(o as Mesh);
    });
    expect(meshes).toHaveLength(3);
    expect(new Set(meshes.map((m) => m.material)).size).toBe(1);
    await settle();
    expect(c.modelState).toBe('glb');
    expect(c.barrel.position.y).toBeCloseTo(0.25, 6);
    expect(c.puff.position.y).toBeCloseTo(0.5, 6);
    expect(c.base.geometry.getAttribute('position').count).toBeGreaterThan(0);
    c.dispose();
  });

  it('al disparar el tubo retrocede y la nube crece; en reposo, nube a 0; con movimiento reducido, quieto', async () => {
    const c = createCanoncito('alta', model());
    await settle();
    const st = { quality: 'alta' as const, reduced: false };
    c.update(CANONCITO_PERIOD_S + CANONCITO_SHOT_S * 0.4, 1 / 60, st);
    expect(c.shot).toBeGreaterThan(0);
    expect(c.barrel.position.x).toBeLessThan(0);
    expect(c.puff.scale.x).toBeGreaterThan(0.3);
    c.update(CANONCITO_PERIOD_S * 0.6, 1 / 60, st);
    expect(c.shot).toBe(0);
    expect(c.barrel.position.x).toBeCloseTo(0, 6);
    expect(c.puff.scale.x).toBe(0);
    expect(c.barrel.rotation.z).not.toBe(0);
    c.update(CANONCITO_PERIOD_S + 0.1, 1 / 60, { ...st, reduced: true });
    expect(c.shot).toBe(0);
    expect(c.puff.scale.x).toBe(0);
    expect(c.barrel.rotation.z).toBe(0);
    expect(c.group.position.y).toBe(0);
    c.dispose();
  });

  it('si el modelo falla, lo dice y no rompe', async () => {
    const bad = new MascotModel(MASCOT_MODELS.canoncito, async () => {
      throw new Error('404');
    });
    const c = createCanoncito('alta', bad);
    await settle();
    expect(c.modelState).toBe('error');
    expect(() => c.update(1, 1 / 60, { quality: 'alta', reduced: false })).not.toThrow();
    c.dispose();
  });
});
