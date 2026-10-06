import { DEFENSE_CONFIG, buildDefensePath } from '@boia/engine/defense';
import { CASTLE_PLACE_ID, WORLD_REGISTRY } from '@boia/world';
import {
  BoxGeometry,
  Group,
  type InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
} from 'three';
import { describe, expect, it, vi } from 'vitest';
import { marWorld } from './compact';
import { arenaFrame } from './defense-arena';
import { DefenseView } from './defense-view';
import { EnemyModel } from './enemy-models';

/**
 * El Vecino Quejica de Blender en la arena del castillo (plan 015, T174): la
 * pieza instanciada `defense-boss-vecino` empieza con la barcaza de a mano y
 * cambia a la geometría del GLB cuando llega (la misma pieza, el mismo
 * material); si falla, se queda la de a mano. `data-arena-vecino` lo dice.
 */

const world = marWorld(WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config);
const castle = world.objects.find((o) => o.identity.id === CASTLE_PLACE_ID)!;
const path = buildDefensePath(DEFENSE_CONFIG.path, DEFENSE_CONFIG.castle.radius);
const frame = arenaFrame(castle.position, path);

function fakeVecinoScene(): Object3D {
  const root = new Group();
  root.add(new Mesh(new BoxGeometry(4, 1, 2), new MeshStandardMaterial({ color: '#123456' })));
  return root;
}
const tick = () => new Promise<void>((r) => setTimeout(r, 0));
const vecinoMesh = (view: DefenseView) =>
  view.group.getObjectByName('defense-boss-vecino') as InstancedMesh;

describe('the castle Vecino with its Blender model (T174)', () => {
  it('without a model, the handmade barge', () => {
    const view = new DefenseView({ config: DEFENSE_CONFIG, path, frame, quality: 'baja' });
    expect(view.vecinoState).toBe('procedural');
    expect(vecinoMesh(view).geometry.getAttribute('color')).toBeTruthy();
    view.dispose();
  });

  it('swaps the instanced piece to the GLB geometry when it loads and releases it on dispose', async () => {
    const model = new EnemyModel({ file: 'vecino.glb', radius: 1 }, async () => fakeVecinoScene());
    const view = new DefenseView({ config: DEFENSE_CONFIG, path, frame, quality: 'baja', vecinoModel: model });
    const mesh = vecinoMesh(view);
    const handmade = mesh.geometry;
    const handmadeDisposed = vi.fn();
    handmade.addEventListener('dispose', handmadeDisposed);
    expect(view.vecinoState).toBe('cargando');
    await tick();
    expect(view.vecinoState).toBe('glb');
    expect(mesh.geometry).toBe(model.loaded);
    expect(mesh.geometry).not.toBe(handmade);
    expect(handmadeDisposed).toHaveBeenCalledOnce();
    expect(mesh.geometry.getAttribute('color')).toBeTruthy();
    // The piece stays instanced with its cap; the scale per instance comes from the boss radius as before.
    expect(mesh.instanceMatrix.count).toBeGreaterThan(0);
    const shared = model.loaded!;
    const sharedDisposed = vi.fn();
    shared.addEventListener('dispose', sharedDisposed);
    view.dispose();
    // Last user: the model drops the geometry itself (the view never disposes it).
    expect(sharedDisposed).toHaveBeenCalledOnce();
    expect(model.loaded).toBeNull();
  });

  it('keeps the handmade barge when the GLB fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = new EnemyModel({ file: 'vecino.glb', radius: 1 }, async () => {
      throw new Error('no');
    });
    const view = new DefenseView({ config: DEFENSE_CONFIG, path, frame, quality: 'baja', vecinoModel: model });
    const handmade = vecinoMesh(view).geometry;
    await tick();
    expect(view.vecinoState).toBe('error');
    expect(vecinoMesh(view).geometry).toBe(handmade);
    view.dispose();
    warn.mockRestore();
  });

  it('shares one load between the Cañón and the castle', async () => {
    const load = vi.fn(async () => fakeVecinoScene());
    const model = new EnemyModel({ file: 'vecino.glb', radius: 1 }, load);
    const a = new DefenseView({ config: DEFENSE_CONFIG, path, frame, quality: 'baja', vecinoModel: model });
    const b = new DefenseView({ config: DEFENSE_CONFIG, path, frame, quality: 'baja', vecinoModel: model });
    await tick();
    expect(load).toHaveBeenCalledTimes(1);
    expect(vecinoMesh(a).geometry).toBe(vecinoMesh(b).geometry);
    a.dispose();
    expect(model.loaded).toBeTruthy();
    b.dispose();
    expect(model.loaded).toBeNull();
  });
});
