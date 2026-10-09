import type { RadioCatalog } from '@boia/contracts';
import type { RadioKV } from './store';

/**
 * La radio del modo local en IndexedDB (D-20): la base `boia-radio`, con el
 * catálogo (una clave) y los MP3 que sube el Admin (uno por canción). No va
 * en localStorage: los archivos no caben y el documento se reescribe entero.
 */

const DB = 'boia-radio';
const META = 'catalogo';
const FILES = 'canciones';
const CATALOG_KEY = 'catalogo';

let opening: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('indexeddb'));
  opening ??= new Promise<IDBDatabase>((ok, ko) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      for (const store of [META, FILES]) {
        if (!req.result.objectStoreNames.contains(store)) req.result.createObjectStore(store);
      }
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => {
      opening = null;
      ko(req.error ?? new Error('indexeddb'));
    };
  });
  return opening;
}

async function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  work: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const d = await db();
  return new Promise<T>((ok, ko) => {
    const t = d.transaction(store, mode);
    const req = work(t.objectStore(store));
    t.oncomplete = () => ok(req.result);
    t.onerror = () => ko(t.error ?? new Error('indexeddb'));
    t.onabort = () => ko(t.error ?? new Error('indexeddb'));
  });
}

export const indexedDbRadioKV: RadioKV = {
  getCatalog: () => tx<unknown>(META, 'readonly', (s) => s.get(CATALOG_KEY)).then((v) => v ?? null),
  putCatalog: async (c: RadioCatalog) => {
    await tx(META, 'readwrite', (s) => s.put(c, CATALOG_KEY));
  },
  putFile: async (key, blob) => {
    await tx(FILES, 'readwrite', (s) => s.put(blob, key));
  },
  getFile: async (key) => {
    const v = await tx<unknown>(FILES, 'readonly', (s) => s.get(key));
    return v instanceof Blob ? v : null;
  },
  deleteFile: async (key) => {
    await tx(FILES, 'readwrite', (s) => s.delete(key));
  },
};
