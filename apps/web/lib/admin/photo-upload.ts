import { imageSize, sniffImageType } from './stamp-image';

/**
 * Las fotos de una isla que sube el Admin (plan 017 T189, decisión 4): qué
 * se acepta y cómo se guarda. Sin aprobación: lo que sube el Admin se
 * publica.
 *
 * - PNG, WebP o JPEG (por los primeros bytes, nunca SVG ni GIF), de como
 *   mucho 15 MB (una foto de móvil) y al menos 200 px de lado corto.
 * - Se guarda una copia propia en WebP (JPEG si el navegador no sabe
 *   codificar WebP), con el lado largo en 1600 px como mucho, sin recortar.
 * - Modo local: el archivo se queda en este navegador (`photo-store.ts`).
 *   Con cuentas: el bucket público `event-photos` de Supabase.
 */

export const EVENT_PHOTO_BUCKET = 'event-photos';

export const PHOTO_UPLOAD_LIMITS = {
  maxBytes: 15 * 1024 * 1024,
  minSide: 200,
  maxSide: 1600,
  quality: 0.82,
  /** Tope de la copia en el bucket (lo repite la migración). */
  maxStoredBytes: 4 * 1024 * 1024,
  types: ['image/png', 'image/webp', 'image/jpeg'] as const,
} as const;

export type PhotoOutputType = 'image/webp' | 'image/jpeg';

/** Por qué no vale un archivo (claves estables; el texto va en i18n). */
export type PhotoUploadProblem = 'type' | 'size' | 'small';

/** null si el archivo vale; si no, por qué. Lee el tipo real, no la extensión. */
export function photoUploadProblem(bytes: Uint8Array): PhotoUploadProblem | null {
  if (bytes.length > PHOTO_UPLOAD_LIMITS.maxBytes) return 'size';
  if (!sniffImageType(bytes)) return 'type';
  const size = imageSize(bytes);
  if (!size || size.width <= 0 || size.height <= 0) return 'type';
  if (Math.min(size.width, size.height) < PHOTO_UPLOAD_LIMITS.minSide) return 'small';
  return null;
}

/** El tamaño de la copia: cabe en `max` × `max` sin deformarse y nunca se agranda. */
export function fitWithin(
  width: number,
  height: number,
  max: number = PHOTO_UPLOAD_LIMITS.maxSide,
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Lo que hace falta para decodificar y codificar (el navegador; las pruebas pasan uno falso). */
export interface PhotoCodec {
  decode(source: Blob): Promise<{ width: number; height: number; close(): void }>;
  /** Dibuja lo decodificado a `size` y lo codifica en `type`; null si no sabe. */
  encode(
    decoded: { width: number; height: number },
    size: { width: number; height: number },
    type: PhotoOutputType,
    quality: number,
  ): Promise<Blob | null>;
}

export interface ResizedPhoto {
  blob: Blob;
  type: PhotoOutputType;
  width: number;
  height: number;
}

/** La copia propia: WebP del tamaño de `fitWithin`, o JPEG si no hay WebP. */
export async function resizePhoto(
  source: Blob,
  codec: PhotoCodec = browserPhotoCodec(),
): Promise<ResizedPhoto> {
  const decoded = await codec.decode(source);
  try {
    const size = fitWithin(decoded.width, decoded.height);
    const q = PHOTO_UPLOAD_LIMITS.quality;
    const webp = await codec.encode(decoded, size, 'image/webp', q);
    if (webp && webp.type === 'image/webp') return { blob: webp, type: 'image/webp', ...size };
    const jpeg = await codec.encode(decoded, size, 'image/jpeg', q);
    if (!jpeg) throw new Error('canvas');
    return { blob: jpeg, type: 'image/jpeg', ...size };
  } finally {
    decoded.close();
  }
}

/** El códec del navegador: `createImageBitmap` y un `<canvas>`. */
export function browserPhotoCodec(): PhotoCodec {
  const bitmaps = new WeakMap<object, ImageBitmap>();
  return {
    async decode(source) {
      const bitmap = await createImageBitmap(source);
      const handle = { width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
      bitmaps.set(handle, bitmap);
      return handle;
    },
    async encode(decoded, size, type, quality) {
      const bitmap = bitmaps.get(decoded);
      if (!bitmap) throw new Error('canvas');
      const canvas = document.createElement('canvas');
      canvas.width = size.width;
      canvas.height = size.height;
      const g = canvas.getContext('2d');
      if (!g) throw new Error('canvas');
      g.imageSmoothingQuality = 'high';
      g.drawImage(bitmap, 0, 0, size.width, size.height);
      return new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, quality));
    },
  };
}

/** Una marca corta y única para ids y nombres de archivo. */
export function uploadStamp(now: number = Date.now(), rand: () => number = Math.random): string {
  return `${now.toString(36)}${rand().toString(36).slice(2, 7)}`;
}

/** Dónde va la copia en el bucket: `<evento>/<marca>.<ext>`. */
export function eventPhotoPath(eventSlug: string, stamp: string, type: PhotoOutputType): string {
  const safe = eventSlug.replace(/[^A-Za-z0-9_-]/g, '-');
  return `${safe}/${stamp}.${type === 'image/webp' ? 'webp' : 'jpg'}`;
}

/** El texto alternativo de cada foto: el escrito, numerado si hay varias. */
export function photoAlt(base: string, index: number, total: number): string {
  const alt = base.trim();
  return total > 1 ? `${alt} (${index + 1}/${total})` : alt;
}
