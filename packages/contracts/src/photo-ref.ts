/**
 * Una foto subida en el Admin de la demo (plan 017 T189, decisión 4): el
 * archivo se queda en este navegador (IndexedDB) y la foto lo nombra con
 * `local-photo:<clave>`. Con cuentas, la foto es una URL https del bucket.
 *
 * Sin zod ni esquemas (el esquema, en content.ts): lo importa el collage de
 * la landing, que no puede cargar `@boia/contracts` entero en su ruta
 * crítica (T29, plan 020 T234).
 */
export const LOCAL_PHOTO_PREFIX = 'local-photo:';

export function isLocalPhotoRef(src: string | undefined | null): src is string {
  return typeof src === 'string' && src.startsWith(LOCAL_PHOTO_PREFIX);
}

/** La clave del archivo en el navegador de una referencia `local-photo:`. */
export function localPhotoKey(src: string): string {
  return src.slice(LOCAL_PHOTO_PREFIX.length);
}
