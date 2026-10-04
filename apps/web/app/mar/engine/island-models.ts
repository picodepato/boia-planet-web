import type { StreamTuning } from '@boia/engine/streaming';
import type { Mesh, MeshLambertMaterial, Object3D } from 'three';

/**
 * Las islas modeladas en Blender (T69): `tools/blender/export_islas_glb.py`
 * deja `art/islas/3d/<id>.glb` y un manifiesto con las que hay. Una isla del
 * mapa con entrada en el manifiesto se ve con su modelo cuando el barco se
 * acerca (por distancia, como las boias de `models.ts`); lejos, mientras
 * llega o si falla, con su composición a mano de `islands.ts`. Sin entrada,
 * siempre la de a mano.
 *
 * Los lugares con contrato propio (T107, `tools/blender/places/`) entran por
 * el mismo camino con `loadPlaceManifests`: `art/places/3d/<id>/manifest.json`.
 */

export const ISLAND_MODELS_URL = '/api/art/islas/3d';

/** Una isla del manifiesto (lo que escribe export_islas_glb.py). */
export interface IslandModelEntry {
  id: string;
  file: string;
  /** Dónde está el GLB, si no es `ISLAND_MODELS_URL/file` (los lugares de T107). */
  url?: string;
  label: string;
  /** Radio de la orilla en unidades del modelo: /mar escala por radio del lugar / radius. */
  radius: number;
  /** Cima del terreno y alto total, en unidades del modelo. */
  top: number;
  height: number;
  tris: number;
  /**
   * Lo que se mueve del modelo (T110/T112: la boia del club de Benidorm), de
   * su manifiesto de lugar: un nodo, su clip de glTF y la pose quieta.
   */
  motion?: PlaceMotionSpec[];
}

/**
 * Un movimiento de un lugar (`motion[]` de `place3d.schema.json`): el clip
 * `clip` del GLB mueve el nodo `node`, en bucle de `duration` s; con
 * movimiento reducido se queda en `staticTime` (su `static_frame` de
 * Blender, en s desde el principio del clip).
 */
export interface PlaceMotionSpec {
  node: string;
  clip: string;
  duration: number;
  staticTime: number;
}

/** Cómo se ve ahora una isla con modelo (para `data-islas-modelo` y las pruebas). */
export type IslandModelState = 'procedural' | 'cargando' | 'glb' | 'error';

/**
 * Cuándo se pide y se suelta el modelo de una isla, en u de motor más allá
 * del barco. Las islas se ven desde más lejos que las boias, así que se piden
 * antes (la de a mano se ve hasta entonces). muestra
 */
export const ISLAND_MODEL_TUNING: StreamTuning = {
  preload: 2200,
  release: 3200,
  lookahead: 0,
  maxSectors: 0,
};

const isEntry = (e: unknown): e is IslandModelEntry => {
  const o = e as Partial<IslandModelEntry> | null;
  return (
    !!o &&
    typeof o.id === 'string' &&
    typeof o.file === 'string' &&
    /^[a-z0-9-]+\.glb$/.test(o.file) &&
    typeof o.radius === 'number' &&
    o.radius > 0
  );
};

/** Las islas con modelo de un manifiesto (lo que no encaja se ignora). */
export function parseIslandManifest(json: unknown): Map<string, IslandModelEntry> {
  const out = new Map<string, IslandModelEntry>();
  const list = (json as { islas?: unknown } | null)?.islas;
  if (!Array.isArray(list)) return out;
  for (const e of list) if (isEntry(e)) out.set(e.id, e);
  return out;
}

/** El manifiesto de las islas; sin él (o si falla), ninguna: todas a mano. */
export async function loadIslandManifest(
  get: (url: string) => Promise<Response> = (url) => fetch(url),
): Promise<Map<string, IslandModelEntry>> {
  try {
    const r = await get(`${ISLAND_MODELS_URL}/manifest.json?optional=1`);
    if (r.status !== 200) return new Map();
    return parseIslandManifest(await r.json());
  } catch {
    return new Map();
  }
}

export const islandModelUrl = (e: Pick<IslandModelEntry, 'file' | 'url'>) =>
  e.url ?? `${ISLAND_MODELS_URL}/${e.file}`;

// --- Lugares de Blender con contrato propio (T107, T108) -----------------------------

export const PLACE_MODELS_URL = '/api/art/places/3d';

/**
 * Los lugares cuyo modelo de `art/places/3d/<id>/` sustituye en /mar a la
 * isla entera: el Puerto de Alicante (`cala`, T108), la Isla de Benidorm
 * (`fotos`, con la boia del club bailando) e Ibiza (`tienda`), T112.
 */
export const PLACE_MODEL_IDS: readonly string[] = ['cala', 'fotos', 'tienda'];

/** Fotogramas por segundo de los clips de los lugares (Blender, `static_frame`). */
export const PLACE_MOTION_FPS = 24;

/** Los movimientos de un manifiesto de lugar; lo que no encaja se ignora. */
export function parsePlaceMotion(list: unknown): PlaceMotionSpec[] {
  if (!Array.isArray(list)) return [];
  const out: PlaceMotionSpec[] = [];
  for (const m of list as Record<string, unknown>[]) {
    if (!m || typeof m.node !== 'string' || typeof m.clip !== 'string') continue;
    if (typeof m.duration !== 'number' || !(m.duration > 0)) continue;
    const v = m.validation as { fps?: unknown } | undefined;
    const fps = typeof v?.fps === 'number' && v.fps > 0 ? v.fps : PLACE_MOTION_FPS;
    const frame = typeof m.static_frame === 'number' && m.static_frame >= 1 ? m.static_frame : 1;
    out.push({
      node: m.node,
      clip: m.clip,
      duration: m.duration,
      staticTime: Math.min(m.duration, (frame - 1) / fps),
    });
  }
  return out;
}

/**
 * La entrada de un lugar a partir de su manifiesto (`place-glb`, versión 1,
 * `tools/blender/places/place3d.schema.json`): radio normalizado, frente +z,
 * agua en y = 0; /mar lo escala por el radio de colisión de la isla / radius,
 * como a las islas. Si no encaja (otro id, otro archivo, sin radio o sin
 * alto), null: se queda la composición a mano.
 */
export function parsePlaceManifest(json: unknown, id: string): IslandModelEntry | null {
  const o = json as {
    kind?: unknown;
    version?: unknown;
    id?: unknown;
    file?: unknown;
    radius?: unknown;
    height?: unknown;
    tris?: unknown;
    motion?: unknown;
  } | null;
  if (!o || o.kind !== 'place-glb' || o.version !== 1 || o.id !== id) return null;
  if (o.file !== `${id}.glb` || !/^[a-z0-9-]+$/.test(id)) return null;
  if (typeof o.radius !== 'number' || !(o.radius > 0)) return null;
  if (typeof o.height !== 'number' || !(o.height > 0)) return null;
  return {
    id,
    file: o.file,
    url: `${PLACE_MODELS_URL}/${id}/${o.file}`,
    label: id,
    radius: o.radius,
    // Un lugar no tiene «cima del terreno» en su contrato: su suelo está a ras de agua.
    top: 0,
    height: o.height,
    tris: typeof o.tris === 'number' ? o.tris : 0,
    motion: parsePlaceMotion(o.motion),
  };
}

/** Los manifiestos de los lugares de `ids`; el que falta o falla no cuenta (su isla, a mano). */
export async function loadPlaceManifests(
  ids: readonly string[] = PLACE_MODEL_IDS,
  get: (url: string) => Promise<Response> = (url) => fetch(url),
): Promise<Map<string, IslandModelEntry>> {
  const out = new Map<string, IslandModelEntry>();
  await Promise.all(
    ids.map(async (id) => {
      try {
        const r = await get(`${PLACE_MODELS_URL}/${id}/manifest.json?optional=1`);
        if (r.status !== 200) return;
        const e = parsePlaceManifest(await r.json(), id);
        if (e) out.set(id, e);
      } catch {
        // sin manifiesto: la isla se queda con su composición a mano
      }
    }),
  );
  return out;
}

/** Todas las islas con modelo: las de `art/islas/3d` y los lugares de `art/places/3d`. */
export async function loadIslandModels(
  get: (url: string) => Promise<Response> = (url) => fetch(url),
): Promise<Map<string, IslandModelEntry>> {
  const [islands, places] = await Promise.all([
    loadIslandManifest(get),
    loadPlaceManifests(PLACE_MODEL_IDS, get),
  ]);
  return new Map([...islands, ...places]);
}

/** Escala del modelo para que su orilla caiga en el radio R (escena) de la isla del mapa. */
export const islandScale = (e: Pick<IslandModelEntry, 'radius'>, R: number) => R / e.radius;

/** Brillo de las caras emisivas según la noche (`glow`: 0 de día … 1 de noche). muestra */
export const islandGlowIntensity = (glow: number) => 0.35 + 1.05 * glow;

/**
 * Lo que brilla del modelo (la cara de la calabaza, las calabacitas…): una
 * función que pone su brillo según la noche.
 */
export function islandGlow(model: Object3D): (glow: number) => void {
  const mats = new Set<MeshLambertMaterial>();
  model.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      const l = mat as MeshLambertMaterial;
      if (l.emissive && l.emissive.getHex() !== 0) mats.add(l);
    }
  });
  let last = -1;
  return (glow) => {
    const k = islandGlowIntensity(glow);
    if (Math.abs(k - last) < 0.01) return;
    last = k;
    for (const m of mats) m.emissiveIntensity = k;
  };
}

/** `data-islas-modelo`: «id:estado» de cada isla con modelo, por id. */
export function islandStates(states: Iterable<[string, IslandModelState]>): string {
  return [...states]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, s]) => `${id}:${s}`)
    .join(' ');
}
