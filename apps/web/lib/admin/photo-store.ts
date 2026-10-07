import { LOCAL_PHOTO_PREFIX, isLocalPhotoRef, localPhotoKey } from '@boia/contracts';

/**
 * Los archivos de las fotos que sube el Admin en modo local (plan 017 T189,
 * D-20): viven en IndexedDB de este navegador, no en el documento de
 * localStorage (que es pequeño y se reescribe entero). La foto los nombra con
 * `local-photo:<clave>`; quien la pinta pide aquí su URL de objeto.
 */

const DB = 'boia-fotos';
const STORE = 'fotos';

let opening: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('indexeddb'));
  opening ??= new Promise<IDBDatabase>((ok, ko) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
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
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const d = await db();
  return new Promise<T>((ok, ko) => {
    const t = d.transaction(STORE, mode);
    const req = work(t.objectStore(STORE));
    t.oncomplete = () => ok(req.result);
    t.onerror = () => ko(t.error ?? new Error('indexeddb'));
    t.onabort = () => ko(t.error ?? new Error('indexeddb'));
  });
}

/** Guarda el archivo y devuelve la referencia para `photo.src`. */
export async function putLocalPhoto(key: string, blob: Blob): Promise<string> {
  await tx('readwrite', (s) => s.put(blob, key));
  return `${LOCAL_PHOTO_PREFIX}${key}`;
}

export async function getLocalPhoto(src: string): Promise<Blob | null> {
  if (!isLocalPhotoRef(src)) return null;
  const v = await tx<unknown>('readonly', (s) => s.get(localPhotoKey(src)));
  return v instanceof Blob ? v : null;
}

export async function deleteLocalPhoto(src: string): Promise<void> {
  if (!isLocalPhotoRef(src)) return;
  await tx('readwrite', (s) => s.delete(localPhotoKey(src)));
}

/** URLs de objeto ya creadas, una por referencia (se pintan muchas veces). */
const urls = new Map<string, Promise<string | null>>();

/** La URL que se puede poner en `<img src>`: la misma si no es local; null si no está. */
export function displayablePhotoUrl(src: string): Promise<string | null> {
  if (!isLocalPhotoRef(src)) return Promise.resolve(src);
  let p = urls.get(src);
  if (!p) {
    p = getLocalPhoto(src)
      .catch(() => null)
      .then((b) => {
        if (b) return URL.createObjectURL(b);
        urls.delete(src); // Puede llegar más tarde (otra pestaña del Admin).
        return null;
      });
    urls.set(src, p);
  }
  return p;
}
