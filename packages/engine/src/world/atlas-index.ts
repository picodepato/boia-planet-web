import type { QualityTier } from './sectors';

/**
 * Índice de los atlas por sector (T47) que escribe `tools/atlas/build.ts` en
 * `apps/web/public/atlas/index.json`. Por mundo (id de su `WorldConfig`) y
 * sector, las hojas de cada calidad; y las costas, que se repiten en losas y
 * no caben en un atlas, como imágenes sueltas comprimidas. Las rutas son
 * relativas al índice. Sin índice, o sin un mundo o sector en él, el motor
 * usa los PNG de `/api/art` uno a uno: el atlas acelera, no es obligatorio.
 */

export const ATLAS_INDEX_VERSION = 1;

/** Una hoja: JSON de fotogramas (formato Spritesheet de Pixi) y su imagen. */
export interface AtlasSheetRef {
  /** JSON de la hoja, relativo al índice. */
  url: string;
  /** Imagen de la hoja, relativa al índice. */
  image: string;
  /** Bytes del JSON y de la imagen, para el presupuesto. */
  bytes: number;
  /** Claves (`ArtFile.key`) de los fotogramas que lleva. */
  keys: string[];
}

export interface AtlasSingle {
  url: string;
  bytes: number;
}

export interface AtlasWorld {
  sectors: Record<string, Partial<Record<QualityTier, AtlasSheetRef[]>>>;
  /** Imágenes sueltas por clave (las losas de costa). */
  singles: Record<string, AtlasSingle>;
}

export interface AtlasIndex {
  version: typeof ATLAS_INDEX_VERSION;
  /** Huella de las fuentes con que se construyó (para no rehacerlo igual). */
  source: string;
  worlds: Record<string, AtlasWorld>;
}

const isObj = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

function sheet(x: unknown): AtlasSheetRef | null {
  if (!isObj(x)) return null;
  const { url, image, bytes, keys } = x;
  if (typeof url !== 'string' || typeof image !== 'string' || typeof bytes !== 'number') return null;
  if (!Array.isArray(keys) || !keys.every((k) => typeof k === 'string')) return null;
  return { url, image, bytes, keys };
}

/** Valida el índice; `null` si no es de esta versión o está mal formado. */
export function parseAtlasIndex(input: unknown): AtlasIndex | null {
  if (!isObj(input) || input.version !== ATLAS_INDEX_VERSION || !isObj(input.worlds)) return null;
  const worlds: Record<string, AtlasWorld> = {};
  for (const [id, w] of Object.entries(input.worlds)) {
    if (!isObj(w) || !isObj(w.sectors) || !isObj(w.singles)) return null;
    const sectors: AtlasWorld['sectors'] = {};
    for (const [sid, tiers] of Object.entries(w.sectors)) {
      if (!isObj(tiers)) return null;
      const out: Partial<Record<QualityTier, AtlasSheetRef[]>> = {};
      for (const [tier, list] of Object.entries(tiers)) {
        if (tier !== 'alta' && tier !== 'baja') continue;
        if (!Array.isArray(list)) return null;
        const sheets = list.map(sheet);
        if (sheets.some((s) => !s)) return null;
        out[tier] = sheets as AtlasSheetRef[];
      }
      sectors[sid] = out;
    }
    const singles: Record<string, AtlasSingle> = {};
    for (const [key, s] of Object.entries(w.singles)) {
      if (!isObj(s) || typeof s.url !== 'string' || typeof s.bytes !== 'number') return null;
      singles[key] = { url: s.url, bytes: s.bytes };
    }
    worlds[id] = { sectors, singles };
  }
  return {
    version: ATLAS_INDEX_VERSION,
    source: typeof input.source === 'string' ? input.source : '',
    worlds,
  };
}

/** Las hojas de un sector en una calidad (la otra si falta la pedida). */
export function sectorSheets(
  world: AtlasWorld | null | undefined,
  sector: string,
  tier: QualityTier,
): AtlasSheetRef[] {
  const s = world?.sectors[sector];
  if (!s) return [];
  return s[tier] ?? s[tier === 'alta' ? 'baja' : 'alta'] ?? [];
}
