import type { BufferGeometry, Mesh, MeshStandardMaterial, Object3D } from 'three';
import { BufferAttribute, Color } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadGltf } from './models';

/**
 * Los enemigos modelados en Blender (plan 015, T174): `tools/blender/
 * export_enemigos_glb.py` deja `art/enemigos/3d/<id>.glb` (una malla, un
 * color plano por material, sin texturas) y su manifiesto. Aquí el GLB se
 * aplana a **una sola geometría con el color en los vértices**, como las
 * piezas hechas a mano del `Kit`: así la misma geometría sirve en el Cañón
 * (una `Mesh` con `litMaterial`) y en el castillo (una `InstancedMesh`), con
 * la curva del planeta y todo lo que ya hacen sus materiales. Mientras no
 * llega, y si falla, se ve la geometría de a mano de siempre.
 *
 * Unidades del modelo: 1 = el radio de choque del enemigo (`radius` del
 * manifiesto); la geometría sale escalada por `1 / radius`, con lo que la
 * vista la escala por su radio de escena como a la de a mano.
 */

export const ENEMY_MODELS_URL = '/api/art/enemigos/3d';

/** El GLB del Vecino Quejica y su radio en el modelo (`RADIUS` de `tools/blender/enemigos/vecino.py`). */
export const VECINO_MODEL = { id: 'vecino', file: 'vecino.glb', radius: 1 } as const;

export const enemyModelUrl = (file: string) => `${ENEMY_MODELS_URL}/${file}`;

/** Cómo se ve ahora un enemigo con modelo (para `data-*` y las pruebas). */
export type EnemyModelState = 'procedural' | 'cargando' | 'glb' | 'error';

const tmpColor = new Color();

/**
 * Todas las mallas de una escena glTF en una geometría sin índices con
 * `position`, `normal` y `color` (el color base de cada material, ya
 * lineal), en el espacio de la raíz y a escala `1 / radius`. Null si no hay
 * ninguna malla.
 */
export function flattenEnemyModel(root: Object3D, radius = 1): BufferGeometry | null {
  root.updateMatrixWorld(true);
  const parts: BufferGeometry[] = [];
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const src = m.geometry;
    const g = src.index ? src.toNonIndexed() : src.clone();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    }
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const n = g.getAttribute('position').count;
    const colors = new Float32Array(n * 3);
    const groups = g.groups.length ? g.groups : [{ start: 0, count: n, materialIndex: 0 }];
    for (const grp of groups) {
      // Un grupo sin material propio (las cajas de three traen seis) usa el único de la malla.
      const mat = (mats[grp.materialIndex ?? 0] ?? mats[0]) as MeshStandardMaterial | undefined;
      tmpColor.copy(mat?.color ?? new Color(1, 1, 1));
      const end = Math.min(n, grp.start + grp.count);
      for (let i = grp.start; i < end; i++) {
        colors[i * 3] = tmpColor.r;
        colors[i * 3 + 1] = tmpColor.g;
        colors[i * 3 + 2] = tmpColor.b;
      }
    }
    g.clearGroups();
    g.setAttribute('color', new BufferAttribute(colors, 3));
    g.applyMatrix4(m.matrixWorld);
    parts.push(g);
  });
  if (parts.length === 0) return null;
  const merged = parts.length === 1 ? parts[0]! : mergeGeometries(parts, false);
  if (parts.length > 1) for (const p of parts) p.dispose();
  if (!merged) return null;
  if (radius !== 1) merged.scale(1 / radius, 1 / radius, 1 / radius);
  merged.computeBoundingSphere();
  return merged;
}

/**
 * El modelo de un enemigo con recuento de usos: cada vista que lo lleva lo
 * pide (`acquire`) y lo suelta (`release`); sin nadie, la geometría se
 * descarga. Una sola carga por modelo; si falla, `acquire` resuelve null y
 * `state` queda en `error` (la vista sigue con la pieza de a mano). `load`
 * (recibe la URL) se cambia en las pruebas.
 */
export class EnemyModel {
  private refs = 0;
  private ready: Promise<BufferGeometry | null> | null = null;
  private geometry: BufferGeometry | null = null;
  private destroyed = false;
  state: EnemyModelState = 'procedural';

  constructor(
    private readonly spec: { file: string; radius: number } = VECINO_MODEL,
    private readonly load: (url: string) => Promise<Object3D> = loadGltf,
  ) {}

  /** La geometría compartida (no se destruye desde fuera: `release`), o null si no hay. */
  acquire(): Promise<BufferGeometry | null> {
    this.refs++;
    if (!this.ready) {
      this.state = 'cargando';
      this.ready = this.load(enemyModelUrl(this.spec.file)).then(
        (scene) => {
          const g = flattenEnemyModel(scene, this.spec.radius);
          disposeScene(scene);
          if (!g || this.destroyed) {
            g?.dispose();
            this.state = g ? 'procedural' : 'error';
            return null;
          }
          this.geometry = g;
          this.state = 'glb';
          if (this.refs === 0) this.drop();
          return this.geometry;
        },
        (err: unknown) => {
          console.warn(`[boia] modelo «${this.spec.file}» no disponible; se queda el hecho a mano`, err);
          this.state = 'error';
          return null;
        },
      );
    }
    return this.ready.then((g) => (this.destroyed ? null : g));
  }

  release(): void {
    this.refs = Math.max(0, this.refs - 1);
    if (this.refs === 0 && this.geometry) this.drop();
  }

  /** La geometría ya cargada (pruebas y `data-*`), o null. */
  get loaded(): BufferGeometry | null {
    return this.geometry;
  }

  private drop(): void {
    this.geometry?.dispose();
    this.geometry = null;
    this.ready = null;
    if (this.state === 'glb') this.state = 'procedural';
  }

  destroy(): void {
    this.destroyed = true;
    this.drop();
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
