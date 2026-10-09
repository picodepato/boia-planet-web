import {
  LOCAL_RADIO_PREFIX,
  type RadioCatalog,
  type RadioSongPatch,
  addRadioGenre,
  addRadioSong,
  deleteRadioGenre,
  isLocalRadioRef,
  localRadioKey,
  moveRadioSong,
  normalizeRadioCatalog,
  radioCatalogSchema,
  removeRadioSong,
  renameRadioGenre,
  setFirstRadioSong,
  updateRadioSong,
} from '@boia/contracts';
import { sampleRadioCatalog } from './muestra';

/**
 * El catálogo de la radio que edita el Admin (plan 022 T246). Dos
 * implementaciones con la misma forma: la local (D-20: todo en este
 * navegador, IndexedDB; `createLocalRadioStore`) y la de Supabase (tablas
 * `radio_genres`/`radio_songs` y bucket `radio-songs`; `shared-store.ts`).
 * Las reglas (una sola primera, géneros) son las de `@boia/contracts`.
 */

/** Lo que se sube: los campos de la canción y su MP3. */
export interface NewSongUpload {
  title: string;
  artist: string;
  genreId: string;
  durationSeconds: number;
  file: Blob;
  first?: boolean;
}

export interface RadioAdminStore {
  /** Local o con cuentas (el Admin lo dice en la cabecera de la sección). */
  readonly kind: 'local' | 'shared';
  catalog(): Promise<RadioCatalog>;
  addSong(input: NewSongUpload): Promise<RadioCatalog>;
  updateSong(id: string, patch: RadioSongPatch): Promise<RadioCatalog>;
  /** Quita la canción y su archivo. */
  removeSong(id: string): Promise<RadioCatalog>;
  moveSong(id: string, to: number): Promise<RadioCatalog>;
  setFirst(id: string): Promise<RadioCatalog>;
  addGenre(name: string): Promise<RadioCatalog>;
  renameGenre(id: string, name: string): Promise<RadioCatalog>;
  deleteGenre(id: string): Promise<RadioCatalog>;
}

/** Dónde guarda la radio local: el catálogo (un JSON) y los MP3 subidos. */
export interface RadioKV {
  getCatalog(): Promise<unknown>;
  putCatalog(catalog: RadioCatalog): Promise<void>;
  putFile(key: string, blob: Blob): Promise<void>;
  getFile(key: string): Promise<Blob | null>;
  deleteFile(key: string): Promise<void>;
}

/** Un id corto y único para canciones y archivos. */
export function radioStamp(now: number = Date.now(), rand: () => number = Math.random): string {
  return `${now.toString(36)}${rand().toString(36).slice(2, 7)}`;
}

export interface LocalStoreOptions {
  /** De dónde parte la radio si este navegador aún no tiene la suya (la muestra). */
  seed?: () => RadioCatalog;
  stamp?: () => string;
}

/**
 * La radio del modo local: el catálogo en IndexedDB (o lo que pase la
 * prueba), sembrado con la muestra la primera vez; cada MP3 subido, como
 * blob con su clave `local-radio:<clave>`.
 */
export function createLocalRadioStore(kv: RadioKV, opts: LocalStoreOptions = {}): RadioAdminStore {
  const seed = opts.seed ?? sampleRadioCatalog;
  const stamp = opts.stamp ?? (() => radioStamp());
  // Una operación detrás de otra: cada una lee, cambia y escribe el catálogo entero.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(work: () => Promise<T>): Promise<T> => {
    const next = queue.then(work, work);
    queue = next.catch(() => undefined);
    return next;
  };

  async function read(): Promise<RadioCatalog> {
    const raw = await kv.getCatalog();
    const parsed = raw == null ? null : radioCatalogSchema.safeParse(raw);
    if (parsed?.success) return parsed.data;
    if (parsed && !parsed.success) console.warn('[boia] radio: catálogo local no válido, muestra');
    const fresh = seed();
    await kv.putCatalog(fresh);
    return fresh;
  }

  const change = (apply: (c: RadioCatalog) => RadioCatalog | Promise<RadioCatalog>) =>
    serial(async () => {
      const next = normalizeRadioCatalog(await apply(await read()));
      await kv.putCatalog(next);
      return next;
    });

  return {
    kind: 'local',
    catalog: () => serial(read),
    addSong: (input) =>
      change(async (c) => {
        const id = `cancion-${stamp()}`;
        const src = `${LOCAL_RADIO_PREFIX}${id}`;
        const next = addRadioSong(c, {
          id,
          title: input.title,
          artist: input.artist,
          genreId: input.genreId,
          durationSeconds: input.durationSeconds,
          src,
          ...(input.first ? { first: true } : {}),
        });
        await kv.putFile(id, input.file);
        return next;
      }),
    updateSong: (id, patch) => change((c) => updateRadioSong(c, id, patch)),
    removeSong: (id) =>
      change(async (c) => {
        const song = c.songs.find((s) => s.id === id);
        const next = removeRadioSong(c, id);
        if (song && isLocalRadioRef(song.src)) await kv.deleteFile(localRadioKey(song.src));
        return next;
      }),
    moveSong: (id, to) => change((c) => moveRadioSong(c, id, to)),
    setFirst: (id) => change((c) => setFirstRadioSong(c, id)),
    addGenre: (name) => change((c) => addRadioGenre(c, name)),
    renameGenre: (id, name) => change((c) => renameRadioGenre(c, id, name)),
    deleteGenre: (id) => change((c) => deleteRadioGenre(c, id)),
  };
}

/** Un almacén en memoria (pruebas, y el navegador sin IndexedDB). */
export function memoryRadioKV(): RadioKV & { files: Map<string, Blob> } {
  let catalog: unknown = null;
  const files = new Map<string, Blob>();
  return {
    files,
    getCatalog: async () => (catalog == null ? null : structuredClone(catalog)),
    putCatalog: async (c) => {
      catalog = structuredClone(c);
    },
    putFile: async (k, b) => {
      files.set(k, b);
    },
    getFile: async (k) => files.get(k) ?? null,
    deleteFile: async (k) => {
      files.delete(k);
    },
  };
}
