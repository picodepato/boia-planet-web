/**
 * Leer un QR de una imagen (plan 008, T91). En el navegador, primero
 * `BarcodeDetector` (Chrome en Android, Safari reciente); si no lo hay, este
 * decodificador pequeño (`jsqr`), que se carga a demanda sólo al escanear:
 * nunca entra en el paquete inicial de la landing ni de /mar (este módulo se
 * importa desde la capa de la cámara, que se carga con `import()`).
 */

import type JsQrFn from 'jsqr';

/** Píxeles RGBA de un fotograma (lo que da `getImageData` o un PNG decodificado). */
export interface Frame {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

type JsQr = typeof JsQrFn;
let jsqr: Promise<JsQr> | null = null;

function loadJsQr(): Promise<JsQr> {
  jsqr ??= import('jsqr').then((m) => (m.default ?? m) as JsQr);
  return jsqr;
}

/** El texto del QR del fotograma, o null si no se lee ninguno. */
export async function decodeFrame(frame: Frame): Promise<string | null> {
  const read = await loadJsQr();
  const hit = read(frame.data, frame.width, frame.height, { inversionAttempts: 'attemptBoth' });
  return hit?.data || null;
}

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
interface BarcodeDetectorClass {
  new (opts?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

/** Un `BarcodeDetector` que lee QR, si el navegador lo trae. */
export async function nativeQrDetector(): Promise<BarcodeDetectorLike | null> {
  const Ctor = (globalThis as { BarcodeDetector?: BarcodeDetectorClass }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    const formats = (await Ctor.getSupportedFormats?.()) ?? ['qr_code'];
    if (!formats.includes('qr_code')) return null;
    return new Ctor({ formats: ['qr_code'] });
  } catch {
    return null;
  }
}
