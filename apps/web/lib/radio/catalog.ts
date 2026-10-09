import { type RadioCatalog, type RadioSong, isLocalRadioRef, localRadioKey } from '@boia/contracts';
import { isSupabaseConfigured } from '../supabase/config';
import { sampleRadioCatalog } from './muestra';
import { createLocalRadioStore, type RadioKV } from './store';

/**
 * El catálogo que lee el reproductor de la radio (plan 022 T246 → T247).
 *
 * Es un módulo perezoso: el reproductor lo carga con `import()` al primer
 * toque o en reposo, nunca desde la ruta crítica de la landing. Devuelve un
 * JSON pequeño (géneros y canciones con título, artista, género, duración,
 * archivo, orden y la primera); los MP3 se piden de uno en uno al sonar.
 *
 * - Modo local (D-20): la radio de este navegador (IndexedDB), la que edita
 *   el Admin de la demo; la primera vez, la muestra.
 * - Con cuentas: las tablas de Supabase; mientras no haya canciones (o la
 *   migración no esté aplicada), la muestra.
 */

export type RadioSource = 'local' | 'shared' | 'muestra';

export interface LoadedRadioCatalog extends RadioCatalog {
  source: RadioSource;
}

export interface CatalogDeps {
  supabase: boolean;
  readShared: () => Promise<RadioCatalog>;
  localKV: () => Promise<RadioKV>;
}

async function browserDeps(): Promise<CatalogDeps> {
  return {
    supabase: isSupabaseConfigured(),
    readShared: async () => {
      const [{ browserSupabase }, { readSharedRadioCatalog }] = await Promise.all([
        import('../supabase/browser'),
        import('./shared-store'),
      ]);
      const sb = browserSupabase();
      if (!sb) throw new Error('supabase');
      return readSharedRadioCatalog(sb);
    },
    localKV: async () => (await import('./idb')).indexedDbRadioKV,
  };
}

const sample = (): LoadedRadioCatalog => ({ ...sampleRadioCatalog(), source: 'muestra' });

/** Lee el catálogo de donde toque (sin caché; `loadRadioCatalog` guarda el resultado). */
export async function readRadioCatalog(deps?: CatalogDeps): Promise<LoadedRadioCatalog> {
  const d = deps ?? (await browserDeps());
  try {
    if (d.supabase) {
      const shared = await d.readShared();
      return shared.songs.length > 0 ? { ...shared, source: 'shared' } : sample();
    }
    const local = await createLocalRadioStore(await d.localKV()).catalog();
    return local.songs.length > 0 ? { ...local, source: 'local' } : sample();
  } catch (err) {
    console.warn('[boia] radio: catálogo sin leer, muestra', err);
    return sample();
  }
}

let cached: Promise<LoadedRadioCatalog> | null = null;

/** El catálogo para el reproductor (se lee una vez por carga de página). */
export function loadRadioCatalog(): Promise<LoadedRadioCatalog> {
  cached ??= readRadioCatalog();
  return cached;
}

/** Olvida el catálogo leído (el Admin, tras un cambio). */
export function forgetRadioCatalog(): void {
  cached = null;
}

const objectUrls = new Map<string, Promise<string | null>>();

/**
 * La URL que se pone en `<audio src>`: la misma para una ruta o https; para
 * un MP3 subido en la demo, una URL de objeto de su blob (null si no está).
 */
export function radioSongUrl(
  song: Pick<RadioSong, 'src'>,
  kv?: () => Promise<RadioKV>,
): Promise<string | null> {
  if (!isLocalRadioRef(song.src)) return Promise.resolve(song.src);
  let p = objectUrls.get(song.src);
  if (!p) {
    const getKV = kv ?? (async () => (await import('./idb')).indexedDbRadioKV);
    p = getKV()
      .then((k) => k.getFile(localRadioKey(song.src)))
      .catch(() => null)
      .then((blob) => {
        if (blob) return URL.createObjectURL(blob);
        objectUrls.delete(song.src);
        return null;
      });
    objectUrls.set(song.src, p);
  }
  return p;
}
