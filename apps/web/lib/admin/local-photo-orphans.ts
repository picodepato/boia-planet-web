import { LOCAL_PHOTO_PREFIX, localPhotoKey } from '@boia/contracts';

/**
 * Qué archivos locales (`local-photo:<clave>`, IndexedDB) siguen en uso. Puro,
 * sin navegador: lo que usa el Admin para decidir qué blob se puede borrar.
 */

/** Las claves de los archivos locales que aparecen en un valor, a cualquier profundidad. */
export function localPhotoKeysIn(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (typeof value === 'string') {
    if (value.startsWith(LOCAL_PHOTO_PREFIX)) out.add(localPhotoKey(value));
  } else if (Array.isArray(value)) {
    for (const v of value) localPhotoKeysIn(v, out);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) localPhotoKeysIn(v, out);
  }
  return out;
}

/** Las claves guardadas que nada referencia: se pueden borrar. */
export function orphanPhotoKeys(stored: readonly string[], referenced: ReadonlySet<string>): string[] {
  return stored.filter((key) => !referenced.has(key));
}

/** Dónde viven los blobs: el navegador (`photo-store.ts`) o un sustituto en pruebas. */
export interface LocalPhotoStore {
  keys(): Promise<string[]>;
  remove(keys: readonly string[]): Promise<void>;
}
