import { type StreamTuning, planObjects } from '@boia/engine/streaming';
import type { WorldObject } from '@boia/world';
import type { Material, Mesh, MeshStandardMaterial, Object3D } from 'three';
import { Box3, Group, MeshLambertMaterial } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SHIP_MODELS_URL } from './ship-model';

/**
 * Los modelos de Blender del mar 3D que no son el barco (T39): la mascota
 * de BOIA como cada boia (la primera, las informativas, la de WhatsApp y la
 * Boia Fiestera). Pesan ~200 kB cada uno, así que se cargan por distancia
 * (T47 en el 2D, T51 aquí) con el mismo plan que los sectores del 2D
 * (`@boia/engine/streaming`): cerca del barco se piden, lejos se sueltan
 * (geometría y materiales fuera de la GPU). Mientras no llegan, y si fallan,
 * se ve la mascota hecha a mano de siempre.
 */

export type ModelKey = 'boia-mascota' | 'boia-info' | 'boia-whatsapp' | 'boia-fiestera';

export const MODEL_FILES: Record<ModelKey, string> = {
  'boia-mascota': 'boia-mascota.glb',
  'boia-info': 'boia-info.glb',
  'boia-whatsapp': 'boia-whatsapp.glb',
  'boia-fiestera': 'boia-fiestera.glb',
};

/** El modelo de un lugar, o null si en 3D se hace a mano. */
export function modelFor(o: Pick<WorldObject, 'identity'>): ModelKey | null {
  const { id, category } = o.identity;
  if (category === 'encuentro') return 'boia-fiestera';
  if (category !== 'boia') return null;
  if (id.includes('whatsapp')) return 'boia-whatsapp';
  // Las cinco informativas (O12, T45) se llaman `boia-<tema>`; la primera, no.
  if (id.startsWith('boia-')) return 'boia-info';
  return 'boia-mascota';
}

/**
 * Cuándo se pide y se suelta un modelo, en u de motor más allá del barco
 * (la «pantalla» es un punto: el mar 3D no mira un rectángulo). Los rótulos
 * cercanos salen a 70 u de escena (1120 u de motor). muestra
 */
export const MODEL_TUNING: StreamTuning = {
  preload: 1600,
  release: 2600,
  lookahead: 0,
  maxSectors: 0,
};

/** Qué lugares tienen que tener su modelo y cuáles lo pueden soltar. */
export function planModels(
  states: Iterable<{ id: string; x: number; y: number }>,
  ship: { x: number; y: number },
  tuning: StreamTuning = MODEL_TUNING,
): { want: Set<string>; keep: Set<string> } {
  return planObjects(states, [ship], { hx: 0, hy: 0 }, tuning);
}

interface Loaded {
  refs: number;
  ready: Promise<Object3D | null>;
  template: Object3D | null;
}

/** Pasa el material físico a Lambert (en el móvil cuesta menos), como el barco. */
function lambertize(root: Object3D): void {
  const cache = new Map<string, MeshLambertMaterial>();
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const src = m.material as MeshStandardMaterial;
    let mat = cache.get(src.uuid);
    if (!mat) {
      const glowing = src.emissive && src.emissive.getHex() !== 0;
      mat = new MeshLambertMaterial({
        color: src.color,
        ...(src.map ? { map: src.map } : {}),
        ...(glowing ? { emissive: src.emissive, emissiveIntensity: 0.9 } : {}),
      });
      cache.set(src.uuid, mat);
      src.dispose();
    }
    m.material = mat;
  });
}

function disposeTree(root: Object3D): void {
  const mats = new Set<Material>();
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mats.add(mat);
  });
  for (const m of mats) {
    (m as MeshLambertMaterial).map?.dispose();
    m.dispose();
  }
}

/** Un glTF del arte (`/api/art/...`) como escena de three. */
export const loadGltf = async (url: string): Promise<Object3D> =>
  (await new GLTFLoader().loadAsync(url)).scene;

/** La URL del modelo de cada boia (art/barco/3d). */
export const boiaModelUrl = (key: ModelKey) => `${SHIP_MODELS_URL}/${MODEL_FILES[key]}`;

/**
 * Los modelos con recuento de usos: cada vista que lo lleva lo pide y lo
 * suelta; sin nadie, se descarga. `load` (recibe la URL) se puede cambiar en
 * las pruebas; `urlOf` dice dónde está cada modelo (las boias, por defecto;
 * las islas de Blender, T69, con su manifiesto).
 */
export class ModelStore<K extends string = ModelKey> {
  private readonly models = new Map<K, Loaded>();
  private destroyed = false;

  constructor(
    private readonly load: (url: string) => Promise<Object3D> = loadGltf,
    private readonly urlOf: (key: K) => string = (key) => boiaModelUrl(key as unknown as ModelKey),
  ) {}

  /** Una copia del modelo (comparte geometría y materiales), o null si no hay. */
  async acquire(key: K): Promise<Object3D | null> {
    let e = this.models.get(key);
    if (!e) {
      const entry: Loaded = { refs: 0, template: null, ready: Promise.resolve(null) };
      entry.ready = this.load(this.urlOf(key)).then(
        (scene) => {
          lambertize(scene);
          entry.template = scene;
          if (this.destroyed || entry.refs === 0) this.drop(key, entry);
          return scene;
        },
        (err: unknown) => {
          console.warn(`[boia] modelo «${key}» no disponible; se queda el hecho a mano`, err);
          return null;
        },
      );
      this.models.set(key, entry);
      e = entry;
    }
    e.refs++;
    const template = await e.ready;
    return template && !this.destroyed ? template.clone(true) : null;
  }

  release(key: K): void {
    const e = this.models.get(key);
    if (!e) return;
    e.refs = Math.max(0, e.refs - 1);
    if (e.refs === 0 && e.template) this.drop(key, e);
  }

  private drop(key: K, e: Loaded): void {
    if (this.models.get(key) === e) this.models.delete(key);
    if (e.template) disposeTree(e.template);
    e.template = null;
  }

  /** Modelos en memoria (para las pruebas y `data-modelos`). */
  get loaded(): K[] {
    return [...this.models.entries()].filter(([, e]) => e.template).map(([k]) => k);
  }

  destroy(): void {
    this.destroyed = true;
    for (const [key, e] of [...this.models]) this.drop(key, e);
  }
}

/** Escala para que `model` mida de alto lo mismo que `like` (la mascota a mano). */
export function fitHeight(model: Object3D, like: Object3D): number {
  const a = new Box3().setFromObject(like);
  const b = new Box3().setFromObject(model);
  const want = a.isEmpty() ? 2 : a.max.y - a.min.y;
  const have = b.isEmpty() ? 0 : b.max.y - b.min.y;
  return have > 0 ? want / have : 1;
}

/** Un hueco para el modelo: la mascota a mano dentro hasta que llegue. */
export function modelSlot(fallback: Object3D): Group {
  const g = new Group();
  g.name = 'modelo';
  g.add(fallback);
  return g;
}
