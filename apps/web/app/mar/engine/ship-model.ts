import type { BufferGeometry, Mesh } from 'three';
import {
  Box3,
  CanvasTexture,
  type Color,
  DoubleSide,
  Group,
  Matrix4,
  MeshBasicMaterial,
  MeshLambertMaterial,
  type MeshStandardMaterial,
  Mesh as ThreeMesh,
  type Object3D,
  PlaneGeometry,
  Raycaster,
  SRGBColorSpace,
  Vector3,
} from 'three';
import type { ShipCatalog } from '../../../lib/barco/catalog';
import type { FlagLook } from '../../../lib/barco/dressing';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Los barcos del 2D en el mar 3D: los mismos modelos de Blender de cada
 * estilo (`tools/blender/export_barcos_glb.py` → `art/barco/3d/<id>.glb`),
 * con un color por pieza sacado de su hoja. Aquí se cargan y se pasan a
 * Lambert, que en el móvil cuesta menos que el material físico.
 */

export const SHIP_MODELS_URL = '/api/art/barco/3d';

export interface ShipModelEntry {
  id: string;
  file: string;
  barco: string;
  label: string;
  /** Hueco de la pasajera en cubierta (x, y de Blender). */
  slot: [number, number];
  /** Archivo de cada skin (`base`, `noche`, `fiesta`…), T39. */
  skins?: Record<string, string>;
  /** Variante sin arte propio (T59): giro de tono, en grados, de cada pieza. */
  hue?: number;
}

/**
 * Los barcos del manifiesto 3D y, detrás, las variantes del catálogo (T59):
 * cada una usa el GLB de su estilo en su skin, con el tono girado. Una
 * variante cuyo estilo no está en el manifiesto no se añade.
 */
export function withShipVariants(
  list: readonly ShipModelEntry[],
  catalog: ShipCatalog | null,
): ShipModelEntry[] {
  const out = [...list];
  for (const style of catalog?.styles ?? []) {
    const v = style.variant;
    if (!v || out.some((b) => b.id === style.id)) continue;
    const base = list.find((b) => b.id === v.of);
    if (!base) continue;
    const file = base.skins?.[v.skin] ?? base.file;
    out.push({
      id: style.id,
      file,
      barco: base.barco,
      label: style.name,
      slot: base.slot,
      skins: { base: file },
      hue: v.hue,
    });
  }
  return out;
}

export interface ShipModel {
  id: string;
  /** Skin cargada (`base` si el estilo no tiene la pedida). */
  skin: string;
  object: Object3D;
  /** Hueco de la pasajera en coordenadas del modelo (three, y arriba). */
  slot: { x: number; y: number; z: number };
}

export async function loadShipManifest(): Promise<ShipModelEntry[]> {
  try {
    const r = await fetch(`${SHIP_MODELS_URL}/manifest.json`);
    if (!r.ok) return [];
    const j = (await r.json()) as { barcos?: ShipModelEntry[] };
    return j.barcos ?? [];
  } catch {
    return [];
  }
}

/** El modelo de un estilo en una skin (T39, T40); sin esa skin, el de base. */
export async function loadShipModel(entry: ShipModelEntry, skin = 'base'): Promise<ShipModel> {
  const file = entry.skins?.[skin] ?? entry.file;
  const used = entry.skins?.[skin] ? skin : 'base';
  const gltf = await new GLTFLoader().loadAsync(`${SHIP_MODELS_URL}/${file}`);
  const root = new Group();
  root.add(gltf.scene);
  const cache = new Map<string, MeshLambertMaterial>();
  gltf.scene.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const src = m.material as MeshStandardMaterial;
    let mat = cache.get(src.uuid);
    if (!mat) {
      const glowing = src.emissive && src.emissive.getHex() !== 0;
      mat = new MeshLambertMaterial({
        color: src.color,
        ...(glowing ? { emissive: src.emissive, emissiveIntensity: 0.9 } : {}),
      });
      if (entry.hue) {
        rotateHue(mat.color, entry.hue);
        if (glowing) rotateHue(mat.emissive, entry.hue);
      }
      cache.set(src.uuid, mat);
      src.dispose();
    }
    m.material = mat;
  });
  // Cubierta: la altura del casco en el hueco; se busca en la caja del modelo.
  const box = new Box3().setFromObject(gltf.scene);
  const deck = Math.max(0.3, box.max.y * 0.32);
  return {
    id: entry.id,
    skin: used,
    object: root,
    slot: { x: entry.slot[0], y: deck, z: -entry.slot[1] },
  };
}

const hsl = { h: 0, s: 0, l: 0 };

/** Gira el tono de un color `deg` grados (las variantes de T59). */
export function rotateHue(c: Color, deg: number): Color {
  c.getHSL(hsl);
  return c.setHSL((((hsl.h + deg / 360) % 1) + 1) % 1, hsl.s, hsl.l);
}

/** Eslora del modelo en su eje X (proa a +X). */
export function modelLength(o: Object3D): { length: number; minX: number; maxX: number } {
  const box = new Box3().setFromObject(o);
  return { length: box.max.x - box.min.x, minX: box.min.x, maxX: box.max.x };
}

/**
 * El punto más alto del modelo (el tope del mástil o de la chimenea), en las
 * coordenadas de `o`: ahí va la bandera del cosmético (T40).
 */
export function topPoint(o: Object3D): Vector3 {
  o.updateMatrixWorld(true);
  const toLocal = new Matrix4().copy(o.matrixWorld).invert();
  const best = new Vector3(0, -Infinity, 0);
  const v = new Vector3();
  o.traverse((c) => {
    const m = c as Mesh;
    if (!m.isMesh) return;
    const pos = (m.geometry as BufferGeometry).getAttribute('position');
    if (!pos) return;
    const k = new Matrix4().multiplyMatrices(toLocal, m.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(k);
      if (v.y > best.y) best.copy(v);
    }
  });
  return Number.isFinite(best.y) ? best : new Vector3();
}

/**
 * La superficie más alta del modelo en (x, z) de su padre (T154): cubierta o,
 * si hay toldo, el techo. Un rayo de arriba abajo; null si no da con nada.
 * La altura vuelve en coordenadas del padre.
 */
export function surfaceY(o: Object3D, x: number, z: number): number | null {
  const parent = o.parent;
  if (!parent) return null;
  parent.updateMatrixWorld(true);
  const from = parent.localToWorld(new Vector3(x, 1e3, z));
  const dir = parent.localToWorld(new Vector3(x, -1e3, z)).sub(from).normalize();
  const hit = new Raycaster(from, dir).intersectObject(o, true)[0];
  return hit ? parent.worldToLocal(hit.point.clone()).y : null;
}

const css = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/**
 * La bandera del cosmético (T40) en 3D: un paño a dos caras con el dibujo de
 * `FlagLook` (liso, dos franjas o cuadros), con el borde en el mástil (x = 0)
 * y ondeando hacia -X (popa). `size`: ancho en unidades del mapa.
 */
export function createFlag(look: FlagLook, size: number): ThreeMesh {
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const [a, b] = look.colors;
    ctx.fillStyle = css(a);
    ctx.fillRect(0, 0, 48, 32);
    ctx.fillStyle = css(b);
    if (look.pattern === 'stripes') ctx.fillRect(0, 16, 48, 16);
    if (look.pattern === 'checker')
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 2; j++) if ((i + j) % 2) ctx.fillRect(i * 16, j * 16, 16, 16);
    ctx.strokeStyle = '#1a1446';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, 45, 29);
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  const geo = new PlaneGeometry(size, size * (2 / 3));
  geo.translate(-size / 2, -size / 3, 0);
  const flag = new ThreeMesh(geo, new MeshBasicMaterial({ map: tex, side: DoubleSide }));
  flag.name = 'bandera';
  return flag;
}
