import type { BufferGeometry, Object3D, Vector3 } from 'three';
import { Group, Mesh } from 'three';
import { flattenEnemyModel } from './enemy-models';
import { loadGltf } from './models';

/**
 * Las mascotas modeladas en Blender (plan 015, T175): `tools/blender/
 * export_mascotas_glb.py` deja `art/mascotas/3d/<id>.glb` y su manifiesto.
 * Cada mascota va en **piezas**: un nodo del glTF por pieza, con su malla y
 * su pivote (la traslación del nodo). Aquí cada pieza se aplana a una
 * geometría con el color en los vértices (como las piezas del `Kit` y como
 * los enemigos, `enemy-models.ts`) en el espacio de su pivote, y la vista la
 * anima sólo con transformaciones (`canoncito.ts`, `tortuga.ts`).
 *
 * Unidades del modelo: las de la escena de /mar (no se escalan). Mientras
 * no llega, y si falla, la mascota no se ve (no hay versión a mano).
 */

export const MASCOT_MODELS_URL = '/api/art/mascotas/3d';

/** Los GLB de las mascotas de Blender y sus piezas (`PARTS` de `tools/blender/mascotas/*.py`). */
export const MASCOT_MODELS = {
  canoncito: { id: 'canoncito', file: 'canoncito.glb', parts: ['base', 'barrel', 'puff'] },
  'tortuga-turbo': {
    id: 'tortuga-turbo',
    file: 'tortuga-turbo.glb',
    parts: ['body', 'fl', 'fr', 'bl', 'br'],
  },
} as const;

export type MascotModelKey = keyof typeof MASCOT_MODELS;

export const mascotModelUrl = (file: string) => `${MASCOT_MODELS_URL}/${file}`;

/** Cómo se ve ahora una mascota con modelo (para `data-mascota-modelo` y las pruebas). */
export type MascotModelState = 'cargando' | 'glb' | 'error';

/** Una pieza aplanada: su geometría (en el espacio del pivote) y dónde va el pivote. */
export interface MascotPart {
  geometry: BufferGeometry;
  pivot: Vector3;
}

export type MascotParts = ReadonlyMap<string, MascotPart>;

/**
 * Las piezas de una escena glTF de mascota: cada nodo con malla, por su
 * nombre, aplanado en su propio espacio (sin la traslación del nodo, que
 * queda como pivote). Las piezas que faltan en `names` se ignoran; null si
 * falta alguna de las pedidas.
 */
export function splitMascotModel(root: Object3D, names: readonly string[]): MascotParts | null {
  root.updateMatrixWorld(true);
  const out = new Map<string, MascotPart>();
  for (const name of names) {
    // El nodo de la pieza: una `Mesh` si tiene un material; con varios, GLTFLoader deja un
    // `Group` con una malla por material. Todas sus mallas, en el espacio del nodo (sin su
    // traslación, que queda como pivote), en una copia sin padre.
    const node = root.getObjectByName(name);
    if (!node) break;
    const inv = node.matrixWorld.clone().invert();
    const alone = new Group();
    node.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      const copy = new Mesh(m.geometry, m.material);
      copy.matrixAutoUpdate = false;
      copy.matrix.copy(m.matrixWorld).premultiply(inv);
      alone.add(copy);
    });
    const g = flattenEnemyModel(alone, 1);
    if (!g) break;
    out.set(name, { geometry: g, pivot: node.position.clone() });
  }
  if (names.some((n) => !out.has(n))) {
    for (const p of out.values()) p.geometry.dispose();
    return null;
  }
  return out;
}

/**
 * El modelo de una mascota con recuento de usos: cada vista lo pide
 * (`acquire`) y lo suelta (`release`); sin nadie, las geometrías se
 * descargan. Una sola carga; si falla, `acquire` resuelve null y `state`
 * queda en `error`. `load` (recibe la URL) se cambia en las pruebas.
 */
export class MascotModel {
  private refs = 0;
  private ready: Promise<MascotParts | null> | null = null;
  private parts: MascotParts | null = null;
  private destroyed = false;
  state: MascotModelState = 'cargando';

  constructor(
    private readonly spec: { file: string; parts: readonly string[] },
    private readonly load: (url: string) => Promise<Object3D> = loadGltf,
  ) {}

  acquire(): Promise<MascotParts | null> {
    this.refs++;
    if (!this.ready) {
      this.state = 'cargando';
      this.ready = this.load(mascotModelUrl(this.spec.file)).then(
        (scene) => {
          const parts = splitMascotModel(scene, this.spec.parts);
          disposeScene(scene);
          if (!parts || this.destroyed) {
            if (parts) for (const p of parts.values()) p.geometry.dispose();
            this.state = parts ? 'cargando' : 'error';
            if (!parts) console.warn(`[boia] mascota «${this.spec.file}»: faltan piezas`);
            return null;
          }
          this.parts = parts;
          this.state = 'glb';
          if (this.refs === 0) this.drop();
          return this.parts;
        },
        (err: unknown) => {
          console.warn(`[boia] mascota «${this.spec.file}» no disponible`, err);
          this.state = 'error';
          return null;
        },
      );
    }
    return this.ready.then((p) => (this.destroyed ? null : p));
  }

  release(): void {
    this.refs = Math.max(0, this.refs - 1);
    if (this.refs === 0 && this.parts) this.drop();
  }

  /** Las piezas ya cargadas (pruebas), o null. */
  get loaded(): MascotParts | null {
    return this.parts;
  }

  private drop(): void {
    if (this.parts) for (const p of this.parts.values()) p.geometry.dispose();
    this.parts = null;
    this.ready = null;
    if (this.state === 'glb') this.state = 'cargando';
  }

  destroy(): void {
    this.destroyed = true;
    this.drop();
  }
}

/** Un modelo por mascota, creado al pedirlo y destruido con el mar. */
export class MascotModelStore {
  private readonly models = new Map<MascotModelKey, MascotModel>();

  constructor(private readonly load: (url: string) => Promise<Object3D> = loadGltf) {}

  get(key: MascotModelKey): MascotModel {
    let m = this.models.get(key);
    if (!m) {
      m = new MascotModel(MASCOT_MODELS[key], this.load);
      this.models.set(key, m);
    }
    return m;
  }

  destroy(): void {
    for (const m of this.models.values()) m.destroy();
    this.models.clear();
  }
}

function disposeScene(root: Object3D): void {
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat.dispose();
  });
}
