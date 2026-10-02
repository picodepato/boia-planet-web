import { type ArtManifest, parseArtManifest, parseAssetRef, placePartArt } from '@boia/world';
import { Assets, type Texture } from 'pixi.js';

/** Un manifiesto de arte cargado y la carpeta de la que cuelgan sus archivos. */
export interface LoadedArt {
  manifest: ArtManifest;
  baseUrl: string;
  /** Carpeta del asset dentro de `art/` (la parte del id antes de `#`): prefijo de las claves de atlas (T47). */
  base: string;
}

/** Carga los fotogramas `files` (relativos a la carpeta de `a`). */
export type FrameLoader = (a: LoadedArt, files: string[]) => Promise<Texture[]>;

/** Sin atlas: cada PNG de su URL, en la caché de Assets. */
export const loadFrames: FrameLoader = (a, files) => loadTextures(a.baseUrl, files);

/** Dónde está el manifiesto de un asset. Por defecto, la ruta de desarrollo `/api/art` (D-16). */
export type ArtUrl = (assetId: string) => string;

export const DEV_ART_URL: ArtUrl = (id) =>
  // Los assets de un mundo son carpetas anidadas: `mundos/<mundo>/<lugar>` (T17).
  `/api/art/${id.split('/').map(encodeURIComponent).join('/')}/manifest.json?optional=1`;

/** Manifiestos de carpeta ya pedidos, por carpeta: para pedir cada uno una sola vez (T47). */
export type ArtManifestCache = Map<string, Promise<{ manifest: ArtManifest; baseUrl: string } | null>>;

async function fetchArtManifest(
  base: string,
  url: ArtUrl,
): Promise<{ manifest: ArtManifest; baseUrl: string } | null> {
  const u = new URL(url(base), location.href);
  try {
    const res = await fetch(u, { cache: 'no-store' });
    if (res.status === 204 || res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const r = parseArtManifest(await res.json());
    if (!r.ok) throw new Error(r.error);
    return { manifest: r.manifest, baseUrl: new URL('.', u).href };
  } catch (err) {
    console.warn(`[boia] arte «${base}» no disponible; se usa un marcador`, err);
    return null;
  }
}

/**
 * Descarga y valida los manifiestos de los assets pedidos. Los que faltan o
 * no cumplen el contrato se omiten con un aviso: el objeto se dibuja con un
 * marcador y se comporta igual (§48.1). Un asset de pieza de lugar (T18,
 * `<carpeta>#<pieza>[@variante]`) baja el manifiesto de la carpeta una vez y
 * queda como el manifiesto de esa pieza. Con `cache`, cada carpeta se pide
 * una sola vez entre llamadas.
 */
export async function loadArt(
  ids: Iterable<string>,
  url: ArtUrl = DEV_ART_URL,
  cache?: ArtManifestCache,
) {
  const out = new Map<string, LoadedArt>();
  const wanted = [...new Set(ids)].filter((id) => !id.startsWith('placeholder:'));
  const bases = new Map<string, string[]>();
  for (const id of wanted) {
    const { base } = parseAssetRef(id);
    bases.set(base, [...(bases.get(base) ?? []), id]);
  }
  await Promise.all(
    [...bases].map(async ([base, refs]) => {
      let pending = cache?.get(base);
      if (!pending) {
        pending = fetchArtManifest(base, url);
        cache?.set(base, pending);
      }
      const r = await pending;
      if (!r) return;
      for (const id of refs) {
        const ref = parseAssetRef(id);
        const manifest = ref.part ? placePartArt(r.manifest, ref.part, ref.variant) : r.manifest;
        if (manifest) out.set(id, { manifest, baseUrl: r.baseUrl, base });
        else console.warn(`[boia] arte «${id}»: la pieza no está en el manifiesto; marcador`);
      }
    }),
  );
  return out;
}

export function manifestsOf(art: ReadonlyMap<string, LoadedArt>): Map<string, ArtManifest> {
  return new Map([...art].map(([id, a]) => [id, a.manifest]));
}

export async function loadTextures(baseUrl: string, files: string[]): Promise<Texture[]> {
  return Promise.all(files.map((f) => Assets.load<Texture>(new URL(f, baseUrl).href)));
}
