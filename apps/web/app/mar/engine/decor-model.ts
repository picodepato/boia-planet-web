import type { Group, Mesh, Object3D } from 'three';
import { ModelStore } from './models';

/** Same scene units, origin and radius as the procedural castle; no automatic fitting. */
export const CASTLE_MODEL_URL = '/api/art/decor/3d/santa-barbara.glb';

/** Single local landmark. Keep its procedural fallback on errors; guard late loads at teardown. */
export class DecorModel {
  private readonly store: ModelStore<'castillo'>;
  private destroyed = false;

  constructor(load?: (url: string) => Promise<Object3D>) {
    this.store = new ModelStore(load, () => CASTLE_MODEL_URL);
  }

  async mount(
    slot: Group,
    fallback: Object3D,
    prepare: (model: Object3D) => void,
  ): Promise<boolean> {
    const model = await this.store.acquire('castillo');
    if (!model || this.destroyed) return false;
    prepare(model);
    slot.remove(fallback);
    fallback.traverse((o) => (o as Mesh).geometry?.dispose());
    slot.add(model);
    return true;
  }

  destroy(): void {
    this.destroyed = true;
    this.store.destroy();
  }
}
