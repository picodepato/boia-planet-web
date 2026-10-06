import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  SphereGeometry,
} from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  ENEMY_MODELS_URL,
  EnemyModel,
  VECINO_MODEL,
  enemyModelUrl,
  flattenEnemyModel,
} from './enemy-models';

const REPO = path.resolve(__dirname, '../../../../..');

/** Una escena como la que deja GLTFLoader: dos mallas con materiales de color plano y una transformación. */
function scene(): Object3D {
  const root = new Group();
  const a = new Mesh(new BoxGeometry(2, 1, 1), new MeshStandardMaterial({ color: '#ff0000' }));
  const b = new Mesh(new SphereGeometry(0.5, 6, 4), new MeshStandardMaterial({ color: '#00ff00' }));
  b.position.set(0, 2, 0);
  root.add(a, b);
  return root;
}

describe('flattenEnemyModel: un GLB a una geometría con el color en los vértices', () => {
  it('junta las mallas sin índices, con posición, normal y color por material, en el espacio de la raíz', () => {
    const g = flattenEnemyModel(scene())!;
    expect(g.index).toBeNull();
    expect(Object.keys(g.attributes).sort()).toEqual(['color', 'normal', 'position']);
    const box = new BoxGeometry(2, 1, 1).toNonIndexed();
    const sphere = new SphereGeometry(0.5, 6, 4).toNonIndexed();
    const n = g.getAttribute('position').count;
    expect(n).toBe(box.getAttribute('position').count + sphere.getAttribute('position').count);
    g.computeBoundingBox();
    // La esfera, trasladada a y = 2: la caja de la geometría llega a 2,5.
    expect(g.boundingBox!.max.y).toBeCloseTo(2.5, 5);
    expect(g.boundingBox!.min.x).toBeCloseTo(-1, 5);
    const red = new Color('#ff0000');
    const green = new Color('#00ff00');
    const col = g.getAttribute('color');
    let reds = 0;
    let greens = 0;
    for (let k = 0; k < col.count; k++) {
      if (Math.abs(col.getX(k) - red.r) + Math.abs(col.getY(k) - red.g) + Math.abs(col.getZ(k) - red.b) < 1e-6) reds++;
      if (Math.abs(col.getX(k) - green.r) + Math.abs(col.getY(k) - green.g) + Math.abs(col.getZ(k) - green.b) < 1e-6) greens++;
    }
    expect(reds).toBe(box.getAttribute('position').count);
    expect(greens).toBe(sphere.getAttribute('position').count);
    expect(g.groups).toEqual([]);
    g.dispose();
  });

  it('escala por 1 / radius y devuelve null sin mallas', () => {
    const g = flattenEnemyModel(scene(), 2)!;
    g.computeBoundingBox();
    expect(g.boundingBox!.max.y).toBeCloseTo(1.25, 5);
    expect(g.boundingBox!.min.x).toBeCloseTo(-0.5, 5);
    g.dispose();
    expect(flattenEnemyModel(new Group())).toBeNull();
  });
});

describe('EnemyModel: una carga compartida con recuento de usos', () => {
  it('carga una vez, comparte la geometría, y la suelta con el último release', async () => {
    const load = vi.fn(async () => scene());
    const model = new EnemyModel({ file: 'x.glb', radius: 1 }, load);
    expect(model.state).toBe('procedural');
    const [a, b] = await Promise.all([model.acquire(), model.acquire()]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith(`${ENEMY_MODELS_URL}/x.glb`);
    expect(a).toBeTruthy();
    expect(a).toBe(b);
    expect(model.state).toBe('glb');
    expect(model.loaded).toBe(a);
    const disposed = vi.fn();
    a!.addEventListener('dispose', disposed);
    model.release();
    expect(disposed).not.toHaveBeenCalled();
    model.release();
    expect(disposed).toHaveBeenCalledOnce();
    expect(model.loaded).toBeNull();
    expect(model.state).toBe('procedural');
    // Pedirlo de nuevo vuelve a cargar.
    await model.acquire();
    expect(load).toHaveBeenCalledTimes(2);
    model.destroy();
    expect(model.loaded).toBeNull();
  });

  it('si la carga falla, resuelve null, avisa y queda en error (la vista sigue con la pieza de a mano)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = new EnemyModel({ file: 'x.glb', radius: 1 }, async () => {
      throw new Error('404');
    });
    expect(await model.acquire()).toBeNull();
    expect(model.state).toBe('error');
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('destruido antes de que llegue, no guarda nada', async () => {
    let resolve!: (o: Object3D) => void;
    const model = new EnemyModel(
      { file: 'x.glb', radius: 1 },
      () => new Promise<Object3D>((r) => (resolve = r)),
    );
    const p = model.acquire();
    model.destroy();
    resolve(scene());
    expect(await p).toBeNull();
    expect(model.loaded).toBeNull();
  });
});

describe('el Vecino Quejica de Blender (art/enemigos/3d, T174)', () => {
  const manifest = JSON.parse(
    readFileSync(path.join(REPO, 'art/enemigos/3d/manifest.json'), 'utf8'),
  ) as {
    max_tris: number;
    enemigos: { id: string; file: string; radius: number; length: number; height: number; tris: number }[];
  };
  const entry = manifest.enemigos.find((e) => e.id === VECINO_MODEL.id)!;

  it('está en el manifiesto con el archivo y el radio que usa /mar, y su GLB existe', () => {
    expect(entry).toBeTruthy();
    expect(entry.file).toBe(VECINO_MODEL.file);
    expect(entry.radius).toBe(VECINO_MODEL.radius);
    expect(enemyModelUrl(entry.file)).toBe(`/api/art/enemigos/3d/${VECINO_MODEL.file}`);
    const glb = readFileSync(path.join(REPO, 'art/enemigos/3d', entry.file));
    expect(glb.subarray(0, 4).toString()).toBe('glTF');
    expect(entry.tris).toBeLessThanOrEqual(manifest.max_tris);
  });

  it('mide como la barcaza de a mano: unas 2,6 de largo por radio de choque y más alto que ancho de barcaza', () => {
    // La geometría de a mano (`vecinoGeometry`) mide 2,6 × 1,35 con el megáfono a ~2,1 de alto.
    expect(entry.length / entry.radius).toBeGreaterThan(2.3);
    expect(entry.length / entry.radius).toBeLessThan(3);
    expect(entry.height / entry.radius).toBeGreaterThan(1.8);
    expect(entry.height / entry.radius).toBeLessThan(2.4);
  });
});
