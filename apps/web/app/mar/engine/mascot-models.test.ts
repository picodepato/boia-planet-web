import { readFileSync } from 'node:fs';
import path from 'node:path';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  MASCOT_MODELS,
  MASCOT_MODELS_URL,
  MascotModel,
  MascotModelStore,
  mascotModelUrl,
  splitMascotModel,
} from './mascot-models';

const REPO = path.resolve(__dirname, '../../../../..');

/** Una escena como la que deja GLTFLoader de una mascota: una malla por pieza, en su pivote. */
function scene(parts: readonly string[]): Object3D {
  const root = new Group();
  parts.forEach((name, i) => {
    const m = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: '#ff0000' }));
    m.name = name;
    m.position.set(i, 0.5, 0);
    root.add(m);
  });
  return root;
}

describe('splitMascotModel: una geometría por pieza, en el espacio de su pivote', () => {
  it('cada pieza sale aplanada con color en los vértices, sin la traslación del nodo, y con su pivote', () => {
    const parts = splitMascotModel(scene(['base', 'barrel']), ['base', 'barrel'])!;
    expect([...parts.keys()]).toEqual(['base', 'barrel']);
    const barrel = parts.get('barrel')!;
    expect(barrel.pivot.toArray()).toEqual([1, 0.5, 0]);
    barrel.geometry.computeBoundingBox();
    // La caja unitaria centrada en su pivote: de -0,5 a 0,5, no de 0,5 a 1,5.
    expect(barrel.geometry.boundingBox!.min.x).toBeCloseTo(-0.5, 5);
    expect(barrel.geometry.boundingBox!.max.x).toBeCloseTo(0.5, 5);
    expect(barrel.geometry.getAttribute('color').count).toBe(36);
    for (const p of parts.values()) p.geometry.dispose();
  });

  it('una pieza con varios materiales (un Group con una malla por material, como deja GLTFLoader) sale entera', () => {
    const root = new Group();
    const node = new Group();
    node.name = 'base';
    node.position.set(0, 0.25, 0);
    const a = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: '#ff0000' }));
    a.name = 'base_1';
    const b = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: '#00ff00' }));
    b.name = 'base_2';
    b.position.set(2, 0, 0);
    node.add(a, b);
    root.add(node);
    const parts = splitMascotModel(root, ['base'])!;
    const base = parts.get('base')!;
    expect(base.pivot.toArray()).toEqual([0, 0.25, 0]);
    expect(base.geometry.getAttribute('position').count).toBe(72);
    base.geometry.computeBoundingBox();
    // Las dos cajas, en el espacio del nodo: de -0,5 a 2,5 en x; sin la traslación del nodo en y.
    expect(base.geometry.boundingBox!.max.x).toBeCloseTo(2.5, 5);
    expect(base.geometry.boundingBox!.max.y).toBeCloseTo(0.5, 5);
    base.geometry.dispose();
  });

  it('si falta una pieza pedida, null', () => {
    expect(splitMascotModel(scene(['base']), ['base', 'barrel'])).toBeNull();
  });
});

describe('MascotModel: una carga compartida con recuento de usos', () => {
  it('carga una vez, la comparten, y al soltar la última se descarga', async () => {
    const load = vi.fn(async () => scene(['base', 'barrel', 'puff']));
    const m = new MascotModel(MASCOT_MODELS.canoncito, load);
    const [a, b] = await Promise.all([m.acquire(), m.acquire()]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith(mascotModelUrl('canoncito.glb'));
    expect(a).toBe(b);
    expect(m.state).toBe('glb');
    m.release();
    expect(m.loaded).not.toBeNull();
    m.release();
    expect(m.loaded).toBeNull();
    expect(m.state).toBe('cargando');
  });

  it('si falla, null y `error`; si faltan piezas, también null', async () => {
    const bad = new MascotModel(MASCOT_MODELS.canoncito, async () => {
      throw new Error('404');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await bad.acquire()).toBeNull();
    expect(bad.state).toBe('error');
    const short = new MascotModel(MASCOT_MODELS.canoncito, async () => scene(['base']));
    expect(await short.acquire()).toBeNull();
    expect(short.state).toBe('error');
    warn.mockRestore();
  });

  it('destruido antes de llegar: null y nada queda', async () => {
    const m = new MascotModel(MASCOT_MODELS.canoncito, async () => scene(['base', 'barrel', 'puff']));
    const p = m.acquire();
    m.destroy();
    expect(await p).toBeNull();
    expect(m.loaded).toBeNull();
  });

  it('el almacén da un modelo por mascota y los destruye todos', async () => {
    const store = new MascotModelStore(async (url) =>
      scene(url.endsWith('canoncito.glb') ? MASCOT_MODELS.canoncito.parts : MASCOT_MODELS['tortuga-turbo'].parts),
    );
    expect(store.get('canoncito')).toBe(store.get('canoncito'));
    expect(store.get('canoncito')).not.toBe(store.get('tortuga-turbo'));
    expect(await store.get('tortuga-turbo').acquire()).not.toBeNull();
    store.destroy();
    expect(store.get('tortuga-turbo').loaded).toBeNull();
  });
});

describe('los GLB de las mascotas (art/mascotas/3d, T175)', () => {
  const manifest = JSON.parse(readFileSync(path.join(REPO, 'art/mascotas/3d/manifest.json'), 'utf8')) as {
    max_tris: number;
    mascotas: { id: string; file: string; tris: number; parts: { name: string; pivot: number[] }[] }[];
  };

  it.each(Object.values(MASCOT_MODELS))('$id: el manifiesto y el GLB existen, con las piezas que usa /mar', (spec) => {
    const entry = manifest.mascotas.find((e) => e.id === spec.id)!;
    expect(entry).toBeDefined();
    expect(entry.file).toBe(spec.file);
    expect(entry.parts.map((p) => p.name)).toEqual([...spec.parts]);
    expect(mascotModelUrl(entry.file)).toBe(`${MASCOT_MODELS_URL}/${spec.file}`);
    const glb = readFileSync(path.join(REPO, 'art/mascotas/3d', entry.file));
    expect(glb.subarray(0, 4).toString()).toBe('glTF');
    expect(entry.tris).toBeLessThanOrEqual(manifest.max_tris);
    // Baratas en `baja`: menos que un barco (12 000) y que un enemigo (9 000).
    expect(entry.tris).toBeLessThan(4500);
  });
});
