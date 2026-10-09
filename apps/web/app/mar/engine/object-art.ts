import { isLocalPhotoRef } from '@boia/contracts/photo-ref';

/**
 * El arte subido de un objeto nuevo del Admin (plan 017 T190, plan 022 T241):
 * de dónde sale el archivo que el mar 3D tiene que pintar. El objeto guarda en
 * `appearance.asset` lo que dejó la subida (`prepareAsset`):
 *
 * - `local-photo:<clave>` en modo local (D-20): el archivo vive en IndexedDB
 *   de este navegador y se pinta con una URL de objeto;
 * - una URL `https://` (con cuentas, un archivo del Storage): se pide tal cual;
 * - cualquier otra cosa es arte de la biblioteca (`placeholder:<forma>` o el id
 *   de convención de un lugar): lo pinta el mar como siempre.
 *
 * Si el archivo no está (otro navegador, borrado) o no es un formato que el
 * mar sepa pintar, queda el respaldo hecho a mano.
 */

export type ObjectArtSource =
  { kind: 'library' } | { kind: 'local'; ref: string } | { kind: 'remote'; url: string };

/** Qué es `asset`: biblioteca, archivo de este navegador o URL. */
export function objectArtSource(asset: string | undefined): ObjectArtSource {
  if (!asset) return { kind: 'library' };
  if (isLocalPhotoRef(asset)) return { kind: 'local', ref: asset };
  if (/^https?:\/\//i.test(asset)) return { kind: 'remote', url: asset };
  return { kind: 'library' };
}

/** ¿Lleva el objeto un archivo subido (y no arte de la biblioteca)? */
export const hasUploadedArt = (asset: string | undefined) =>
  objectArtSource(asset).kind !== 'library';

export type ObjectArtFormat = 'model' | 'image';

export type ResolvedObjectArt =
  | {
      status: 'ready';
      format: ObjectArtFormat;
      url: string;
      /** Suelta la URL de objeto (una URL remota no se suelta). */
      release: () => void;
    }
  | { status: 'fallback'; reason: 'library' | 'missing' | 'unsupported' };

/** Lo que necesita el resolutor (el navegador, por defecto; las pruebas pasan uno falso). */
export interface ObjectArtDeps {
  getBlob: (ref: string) => Promise<Blob | null>;
  createUrl: (blob: Blob) => string;
  revokeUrl: (url: string) => void;
}

const GLB_MAGIC = [0x67, 0x6c, 0x54, 0x46]; // «glTF»

/** El formato por el tipo MIME o el nombre (`.glb`, la clave `-original-glb`). */
export function artFormatOf(type: string, name: string): ObjectArtFormat | null {
  const t = type.toLowerCase();
  if (t === 'model/gltf-binary') return 'model';
  if (t.startsWith('image/')) return 'image';
  const n = name.toLowerCase().split(/[?#]/)[0] ?? '';
  if (/[.-]glb$/.test(n)) return 'model';
  if (/[.-](png|webp|jpe?g)$/.test(n)) return 'image';
  return null;
}

async function sniffBlob(blob: Blob): Promise<ObjectArtFormat | null> {
  try {
    const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    if (GLB_MAGIC.every((b, i) => head[i] === b)) return 'model';
    if (head[0] === 0x89 && head[1] === 0x50) return 'image'; // PNG
    if (head[0] === 0xff && head[1] === 0xd8) return 'image'; // JPEG
    if (head[0] === 0x52 && head[1] === 0x49) return 'image'; // RIFF (WebP)
  } catch {
    // Sin lectura, sin formato.
  }
  return null;
}

/**
 * La URL que pinta el arte de `asset`: un archivo local → URL de objeto
 * (hay que soltarla con `release`), uno remoto → la URL, y si no hay archivo
 * o no se sabe pintar → respaldo, con el motivo.
 */
export async function resolveObjectArt(
  asset: string | undefined,
  deps: ObjectArtDeps,
): Promise<ResolvedObjectArt> {
  const src = objectArtSource(asset);
  if (src.kind === 'library') return { status: 'fallback', reason: 'library' };
  if (src.kind === 'remote') {
    const format = artFormatOf('', new URL(src.url).pathname) ?? 'image';
    return { status: 'ready', format, url: src.url, release: () => {} };
  }
  const blob = await deps.getBlob(src.ref).catch(() => null);
  if (!blob) return { status: 'fallback', reason: 'missing' };
  const format = artFormatOf(blob.type, src.ref) ?? (await sniffBlob(blob));
  if (!format) return { status: 'fallback', reason: 'unsupported' };
  const url = deps.createUrl(blob);
  let released = false;
  return {
    status: 'ready',
    format,
    url,
    release: () => {
      if (released) return;
      released = true;
      deps.revokeUrl(url);
    },
  };
}

/** El navegador: los archivos del Admin en IndexedDB (cargado sólo si hace falta). */
export const BROWSER_OBJECT_ART: ObjectArtDeps = {
  getBlob: async (ref) => (await import('../../../lib/admin/photo-store')).getLocalPhoto(ref),
  createUrl: (blob) => URL.createObjectURL(blob),
  revokeUrl: (url) => URL.revokeObjectURL(url),
};

/**
 * La caja del arte en la escena: de ancho, el diámetro de su huella (mínimo
 * `min`) por la escala del objeto; de alto, la mitad de eso, entre `min` y
 * `maxHeight` (una isla de 15 u de ancho no se vuelve una torre de 15 u).
 */
export function artBox(
  radius: number,
  scale = 1,
  min = 2.5,
  maxHeight = 6,
): { span: number; height: number } {
  const span = Math.max(min, radius * 2) * (scale > 0 ? scale : 1);
  return { span, height: Math.max(min, Math.min(span / 2, maxHeight)) };
}
