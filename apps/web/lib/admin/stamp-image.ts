/**
 * La imagen del sello de una fiesta (T87 «Image stamps», T94): lo que se
 * acepta y cómo se guarda. Lo usan el Admin (subida y URL) y la ruta del
 * servidor que trae una URL una sola vez (`/api/admin/stamp-image`).
 *
 * - PNG, WebP o JPEG (nunca SVG: puede llevar script; ni GIF ni animación),
 *   de al menos 512 × 512 px y como mucho 2 MB.
 * - Se guarda una copia propia de 512 × 512 (recortada al cuadrado, `cover`)
 *   en WebP (PNG si el navegador no sabe codificar WebP) en el bucket
 *   `stamp-images` de Supabase. El Carnet nunca enlaza la URL de fuera.
 */

export const STAMP_IMAGE_BUCKET = 'stamp-images';

export const STAMP_IMAGE_LIMITS = {
  maxBytes: 2 * 1024 * 1024,
  minSide: 512,
  outSide: 512,
  types: ['image/png', 'image/webp', 'image/jpeg'] as const,
} as const;

export type StampImageType = (typeof STAMP_IMAGE_LIMITS.types)[number];

/** Por qué no vale una imagen (claves estables; el texto va en i18n). */
export type StampImageProblem = 'type' | 'size' | 'small' | 'url' | 'fetch' | 'forbidden';

/** El tipo real por los primeros bytes (no por la extensión ni la cabecera). */
export function sniffImageType(b: Uint8Array): StampImageType | null {
  if (
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

function ascii(b: Uint8Array, at: number, n: number): string {
  return String.fromCharCode(...b.subarray(at, at + n));
}

const u16be = (b: Uint8Array, i: number) => (b[i]! << 8) | b[i + 1]!;
const u16le = (b: Uint8Array, i: number) => b[i]! | (b[i + 1]! << 8);
const u24le = (b: Uint8Array, i: number) => b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16);
const u32be = (b: Uint8Array, i: number) =>
  ((b[i]! << 24) | (b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!) >>> 0;

/** Ancho y alto leídos de la cabecera, sin decodificar la imagen. */
export function imageSize(b: Uint8Array): { width: number; height: number } | null {
  const type = sniffImageType(b);
  if (type === 'image/png') {
    if (b.length < 24 || ascii(b, 12, 4) !== 'IHDR') return null;
    return { width: u32be(b, 16), height: u32be(b, 20) };
  }
  if (type === 'image/jpeg') {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = b[i + 1]!;
      // SOF0…SOF15 menos DHT (C4), JPG (C8) y DAC (CC).
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: u16be(b, i + 5), width: u16be(b, i + 7) };
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      i += 2 + u16be(b, i + 2);
    }
    return null;
  }
  if (type === 'image/webp') {
    const chunk = ascii(b, 12, 4);
    if (chunk === 'VP8 ' && b.length >= 30) {
      return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
    }
    if (chunk === 'VP8L' && b.length >= 25) {
      const bits = b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24);
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    if (chunk === 'VP8X' && b.length >= 30) {
      return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
    }
  }
  return null;
}

/** null si la imagen vale; si no, por qué (tipo, tamaño o lado). */
export function stampImageProblem(b: Uint8Array): StampImageProblem | null {
  if (b.length > STAMP_IMAGE_LIMITS.maxBytes) return 'size';
  if (!sniffImageType(b)) return 'type';
  const size = imageSize(b);
  if (!size) return 'type';
  if (Math.min(size.width, size.height) < STAMP_IMAGE_LIMITS.minSide) return 'small';
  return null;
}

/**
 * Una URL que el servidor puede ir a buscar: https, con nombre de host y
 * nada de la red local (localhost, IP privadas, `.local`, `.internal`). Es
 * una guarda básica: la ruta además sólo atiende al equipo con TOTP.
 */
export function isFetchableImageUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' || u.username || u.password) return false;
  if (u.port && u.port !== '443') return false;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host.includes('.') || host.includes(':')) return false; // sin IPv6 literal
  if (/(^|\.)(localhost|local|internal|lan|home|intranet)$/.test(host)) return false;
  const ip = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ip) {
    const [a, b] = [Number(ip[1]), Number(ip[2])];
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    ) {
      return false;
    }
  }
  return true;
}

/** Dónde se guarda la copia: `<fiesta>/<marca>.<ext>`. */
export function stampImagePath(eventSlug: string, type: 'image/webp' | 'image/png'): string {
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return `${eventSlug}/${stamp}.${type === 'image/webp' ? 'webp' : 'png'}`;
}

/**
 * La copia propia (sólo en el navegador): recorta al cuadrado central y la
 * deja en 512 × 512, en WebP si el navegador sabe, si no en PNG.
 */
export async function stampImageCopy(
  source: Blob,
): Promise<{ blob: Blob; type: 'image/webp' | 'image/png' }> {
  const bitmap = await createImageBitmap(source);
  try {
    const side = STAMP_IMAGE_LIMITS.outSide;
    const canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side;
    const g = canvas.getContext('2d');
    if (!g) throw new Error('canvas');
    const crop = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - crop) / 2;
    const sy = (bitmap.height - crop) / 2;
    g.imageSmoothingQuality = 'high';
    g.drawImage(bitmap, sx, sy, crop, crop, 0, 0, side, side);
    const webp = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/webp', 0.86));
    if (webp && webp.type === 'image/webp') return { blob: webp, type: 'image/webp' };
    const png = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/png'));
    if (!png) throw new Error('canvas');
    return { blob: png, type: 'image/png' };
  } finally {
    bitmap.close();
  }
}
