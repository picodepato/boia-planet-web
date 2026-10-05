import { afterEach, describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { loadShipModel, modelLength } from './ship-model';

afterEach(() => vi.restoreAllMocks());

describe('T167: boat models without a cosmetic flag', () => {
  it.each([false, true])(
    'loads the model and preserves its own geometry (built-in flag: %s)',
    async (builtInFlag) => {
      const scene = new Group();
      const hull = new Mesh(new BoxGeometry(4, 1, 2), new MeshStandardMaterial());
      scene.add(hull);
      if (builtInFlag) {
        const flag = new Mesh(new BoxGeometry(0.4, 0.2, 0.02), new MeshStandardMaterial());
        flag.name = 'model-flag';
        flag.position.y = 2;
        scene.add(flag);
      }
      const pieces = [...scene.children];
      vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue({ scene } as GLTF);
      const model = await loadShipModel({
        id: 'arcilla',
        file: 'arcilla.glb',
        barco: 'B05',
        label: 'Arcilla',
        slot: [0, 0],
      });
      expect(model.object.children).toEqual([scene]);
      expect(scene.children).toEqual(pieces);
      expect(model.object.getObjectByName('bandera')).toBeUndefined();
      expect(Boolean(model.object.getObjectByName('model-flag'))).toBe(builtInFlag);
      expect(modelLength(model.object).length).toBe(4);
      expect(Number.isFinite(model.slot.y)).toBe(true);
    },
  );
});
