import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Box3, type Mesh, type MeshLambertMaterial, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { describe, expect, it, vi } from 'vitest';
import { repoRoot } from '../../../lib/barco/load';
import { islandGlowIntensity, parsePlaceManifest, parsePlaceMotion } from './island-models';
import { ModelStore } from './models';
import {
  PLACE_SCREENS,
  animatedNodeNames,
  batchAnimatedNodes,
  placeMotion,
  screenPulse,
} from './place-motion';

/**
 * El movimiento de los lugares de Blender en /mar (T112): la boia del club
 * de Benidorm (`art/places/3d/fotos/`, clip `boia-pole-dance` de T110) baila
 * con el reloj de /mar, junta sus piezas en pocas mallas, se queda en su
 * pose quieta con movimiento reducido y se suelta al irse el modelo.
 */

const ROOT = repoRoot();
const dir = (id: string) => path.join(ROOT, 'art/places/3d', id);
const manifestOf = (id: string) =>
  JSON.parse(readFileSync(path.join(dir(id), 'manifest.json'), 'utf8')) as {
    motion: { node: string; clip: string; duration: number; static_frame: number }[];
    static_node: string;
  };

/** El GLB de un lugar como lo carga /mar (`loadGltf`: la escena con sus clips). */
async function loadPlace(id: string): Promise<Object3D> {
  const b = readFileSync(path.join(dir(id), `${id}.glb`));
  const buf = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  const gltf = await new GLTFLoader().parseAsync(buf, '');
  gltf.scene.animations = gltf.animations;
  return gltf.scene;
}

const meshesUnder = (o: Object3D) => {
  const out: Mesh[] = [];
  o.traverse((x) => {
    if ((x as Mesh).isMesh) out.push(x as Mesh);
  });
  return out;
};

/** Una copia del modelo como la da el almacén de /mar (con Lambert y sus nombres). */
async function storeCopy(id: string) {
  const store = new ModelStore<string>(
    async () => batchAnimatedNodes(await loadPlace(id)),
    () => id,
  );
  const model = (await store.acquire(id))!;
  return { store, model };
}

describe('los movimientos de un manifiesto de lugar', () => {
  it('Benidorm: el clip de la boia, su nodo, 4 s y la pose quieta del fotograma 1', () => {
    const m = manifestOf('fotos');
    const entry = parsePlaceManifest(m, 'fotos')!;
    expect(entry.motion).toEqual(
      m.motion.map((x) => ({
        node: x.node,
        clip: x.clip,
        duration: x.duration,
        staticTime: (x.static_frame - 1) / 24,
      })),
    );
    expect(entry.motion?.length).toBeGreaterThan(0);
  });

  it('Ibiza y el puerto no se mueven', () => {
    for (const id of ['tienda', 'cala']) {
      expect(parsePlaceManifest(manifestOf(id), id)!.motion).toEqual([]);
    }
  });

  it('lo que no encaja se ignora', () => {
    expect(parsePlaceMotion(null)).toEqual([]);
    expect(
      parsePlaceMotion([
        { node: 'a', clip: 'b', duration: 0 },
        { node: 'a', duration: 2 },
        null,
        { node: 'a', clip: 'b', duration: 2, static_frame: 13, validation: { fps: 12 } },
      ]),
    ).toEqual([{ node: 'a', clip: 'b', duration: 2, staticTime: 1 }]);
  });
});

describe('el GLB de Benidorm en /mar', () => {
  it('trae el clip y el nodo que dice su manifiesto, y nada más se anima', async () => {
    const m = manifestOf('fotos');
    const scene = await loadPlace('fotos');
    expect(scene.animations.map((c) => c.name)).toEqual(m.motion.map((x) => x.clip));
    expect(animatedNodeNames(scene)).toEqual(m.motion.map((x) => x.node));
    for (const x of m.motion) expect(scene.getObjectByName(x.node)).toBeTruthy();
    expect(scene.getObjectByName(m.static_node)).toBeTruthy();
  });

  it('la boia se junta en una malla por material y el clip la sigue encontrando', async () => {
    const m = manifestOf('fotos');
    const scene = await loadPlace('fotos');
    const node = scene.getObjectByName(m.motion[0]!.node)!;
    const before = meshesUnder(node);
    const mats = new Set(before.map((x) => x.material));
    const tris = (list: Mesh[]) =>
      list.reduce(
        (n, x) => n + (x.geometry.index?.count ?? x.geometry.attributes.position!.count) / 3,
        0,
      );
    const trisBefore = tris(before);
    scene.updateMatrixWorld(true);
    const box = (o: Object3D) => {
      o.updateMatrixWorld(true);
      const b = new Box3().setFromObject(o, true);
      return [b.min.toArray(), b.max.toArray()] as const;
    };
    const [min0, max0] = box(node);
    batchAnimatedNodes(scene);
    const after = meshesUnder(node);
    expect(before.length).toBeGreaterThan(10);
    expect(after.length).toBe(mats.size);
    expect(tris(after)).toBe(trisBefore);
    // Mismo sitio: las piezas no se mueven al juntarlas.
    const [min1, max1] = box(node);
    for (let i = 0; i < 3; i++) {
      expect(min1[i]).toBeCloseTo(min0[i]!, 5);
      expect(max1[i]).toBeCloseTo(max0[i]!, 5);
    }
    // Sus materiales son copias: no laten con las pantallas.
    for (const x of after) {
      expect(PLACE_SCREENS.fotos).not.toContain((x.material as MeshLambertMaterial).name);
    }
    expect(scene.getObjectByName(m.motion[0]!.node)).toBe(node);
  });

  it('baila con el reloj de /mar: sube y baja, y a los 4 s vuelve al principio', async () => {
    const m = manifestOf('fotos');
    const { store, model } = await storeCopy('fotos');
    const entry = parsePlaceManifest(m, 'fotos')!;
    const motion = placeMotion(model, entry, PLACE_SCREENS.fotos)!;
    expect(motion.clips).toEqual(m.motion.map((x) => x.clip));
    const ys: number[] = [];
    for (let t = 0; t <= 4; t += 0.25) {
      motion.update(t, 0, false);
      ys.push(motion.pose()!);
    }
    const lo = Math.min(...ys);
    const hi = Math.max(...ys);
    // La ley de T110: z = 0.42 + 0.085·(1 − cos(2πt/4)) en Blender (y en glTF).
    expect(lo).toBeCloseTo(0.42, 3);
    expect(hi).toBeCloseTo(0.59, 3);
    expect(ys[8]).toBeCloseTo(0.59, 3);
    expect(ys[0]).toBeCloseTo(ys[16]!, 4);
    // Otra vuelta del reloj: la misma pose.
    motion.update(1.3, 0, false);
    const a = motion.pose();
    motion.update(1.3 + 4 * 7, 0, false);
    expect(motion.pose()).toBeCloseTo(a!, 4);
    motion.dispose();
    store.destroy();
  });

  it('con movimiento reducido se queda en la pose quieta y las pantallas fijas', async () => {
    const m = manifestOf('fotos');
    const { store, model } = await storeCopy('fotos');
    const motion = placeMotion(model, parsePlaceManifest(m, 'fotos')!, PLACE_SCREENS.fotos)!;
    expect(motion.screens).toBe(PLACE_SCREENS.fotos!.length);
    const screens: MeshLambertMaterial[] = [];
    model.traverse((o) => {
      const mat = (o as Mesh).material as MeshLambertMaterial | undefined;
      if (mat && PLACE_SCREENS.fotos!.includes(mat.name) && !screens.includes(mat))
        screens.push(mat);
    });
    const poses = new Set<number>();
    for (const t of [0.3, 1.1, 2.0, 3.7]) {
      motion.update(t, 1, true);
      poses.add(Number(motion.pose()!.toFixed(5)));
      for (const s of screens) expect(s.emissiveIntensity).toBeCloseTo(islandGlowIntensity(1), 6);
    }
    expect([...poses]).toEqual([0.42]);
    // Y sin reducir, las pantallas laten (a destiempo entre sí).
    motion.update(0, 1, false);
    const k0 = screens.map((s) => s.emissiveIntensity);
    motion.update(0.25 / 2, 1, false);
    const k1 = screens.map((s) => s.emissiveIntensity);
    expect(k0).not.toEqual(k1);
    motion.dispose();
    store.destroy();
  });

  it('al irse el modelo se para y suelta: vuelve a su pose de siempre y no se mueve más', async () => {
    const m = manifestOf('fotos');
    const { store, model } = await storeCopy('fotos');
    const motion = placeMotion(model, parsePlaceManifest(m, 'fotos')!)!;
    motion.update(0, 0, true);
    const still = motion.pose();
    motion.update(2, 0, false);
    expect(motion.pose()).not.toBeCloseTo(still!, 2);
    motion.dispose();
    motion.dispose();
    expect(motion.pose()).toBeCloseTo(still!, 6);
    motion.update(2, 0, false);
    expect(motion.pose()).toBeCloseTo(still!, 6);
    store.destroy();
  });

  it('un clip que no está en el modelo se ignora; sin nada que mover, null', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { store, model } = await storeCopy('tienda');
    expect(placeMotion(model, { motion: [] })).toBeNull();
    expect(
      placeMotion(model, { motion: [{ node: 'x', clip: 'y', duration: 1, staticTime: 0 }] }),
    ).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    store.destroy();
  });
});

describe('el latido de las pantallas', () => {
  it('se queda entre 0.7 y 1.3 y vuelve cada latido', () => {
    for (let t = 0; t < 3; t += 0.037) {
      const k = screenPulse(t, 0);
      expect(k).toBeGreaterThanOrEqual(0.7 - 1e-9);
      expect(k).toBeLessThanOrEqual(1.3 + 1e-9);
      expect(screenPulse(t + 0.5, 0)).toBeCloseTo(k, 9);
    }
  });
});
