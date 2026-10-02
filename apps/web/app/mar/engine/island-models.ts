import type { StreamTuning } from '@boia/engine/streaming';
import type { Mesh, MeshLambertMaterial, Object3D } from 'three';

/**
 * Las islas modeladas en Blender (T69): `tools/blender/export_islas_glb.py`
 * deja `art/islas/3d/<id>.glb` y un manifiesto con las que hay. Una isla del
 * mapa con entrada en el manifiesto se ve con su modelo cuando el barco se
 * acerca (por distancia, como las boias de `models.ts`); lejos, mientras
 * llega o si falla, con su composición a mano de `islands.ts`. Sin entrada,
 * siempre la de a mano.
 */

export const ISLAND_MODELS_URL = '/api/art/islas/3d';

/** Una isla del manifiesto (lo que escribe export_islas_glb.py). */
export interface IslandModelEntry {
  id: string;
  file: string;
  label: string;
  /** Radio de la orilla en unidades del modelo: /mar escala por radio del lugar / radius. */
  radius: number;
  /** Cima del terreno y alto total, en unidades del modelo. */
  top: number;
  height: number;
  tris: number;
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

export const islandModelUrl = (e: Pick<IslandModelEntry, 'file'>) =>
  `${ISLAND_MODELS_URL}/${e.file}`;

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
