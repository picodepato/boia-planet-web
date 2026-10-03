import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import {
  STAMP_IMAGE_LIMITS,
  imageSize,
  isFetchableImageUrl,
  sniffImageType,
  stampImagePath,
  stampImageProblem,
} from './stamp-image';

function png(width: number, height: number): Uint8Array {
  const img = new PNG({ width, height });
  return new Uint8Array(PNG.sync.write(img));
}

/** La cabecera de un JPEG hasta su SOF0 (lo que lee imageSize). */
function jpeg(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xe0,
    0x00,
    0x10,
    0x4a,
    0x46,
    0x49,
    0x46,
    0x00,
    0x01,
    0x01,
    0x00,
    0x00,
    0x01,
    0x00,
    0x01,
    0x00,
    0x00,
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    0x03,
    0x01,
    0x22,
    0x00,
    0xff,
    0xd9,
  ]);
}

/** Un WebP extendido (VP8X) con su lienzo. */
function webp(width: number, height: number): Uint8Array {
  const b = new Uint8Array(30);
  b.set(
    [...'RIFF'].map((c) => c.charCodeAt(0)),
    0,
  );
  b.set(
    [...'WEBP'].map((c) => c.charCodeAt(0)),
    8,
  );
  b.set(
    [...'VP8X'].map((c) => c.charCodeAt(0)),
    12,
  );
  b[16] = 10;
  const w = width - 1;
  const h = height - 1;
  b.set([w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff], 24);
  b.set([h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff], 27);
  return b;
}

describe('la imagen del sello (T87 «Image stamps», T94)', () => {
  it('reconoce PNG, JPEG y WebP por sus bytes y lee su tamaño', () => {
    expect(sniffImageType(png(600, 520))).toBe('image/png');
    expect(imageSize(png(600, 520))).toEqual({ width: 600, height: 520 });
    expect(sniffImageType(jpeg(800, 640))).toBe('image/jpeg');
    expect(imageSize(jpeg(800, 640))).toEqual({ width: 800, height: 640 });
    expect(sniffImageType(webp(1024, 512))).toBe('image/webp');
    expect(imageSize(webp(1024, 512))).toEqual({ width: 1024, height: 512 });
  });

  it('no vale un SVG, un GIF, algo de menos de 512 px ni más de 2 MB', () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
    const gif = new TextEncoder().encode('GIF89a......');
    expect(stampImageProblem(svg)).toBe('type');
    expect(stampImageProblem(gif)).toBe('type');
    expect(stampImageProblem(png(511, 900))).toBe('small');
    expect(stampImageProblem(png(STAMP_IMAGE_LIMITS.minSide, 600))).toBeNull();
    const big = new Uint8Array(STAMP_IMAGE_LIMITS.maxBytes + 1);
    big.set(png(600, 600));
    expect(stampImageProblem(big)).toBe('size');
  });

  it('el servidor sólo trae URL https de fuera de la red local', () => {
    expect(isFetchableImageUrl('https://boia.example.org/sello.png')).toBe(true);
    expect(isFetchableImageUrl('https://abc.supabase.co/storage/v1/object/public/x.png')).toBe(
      true,
    );
    for (const bad of [
      'http://boia.example.org/sello.png',
      'https://localhost/sello.png',
      'https://127.0.0.1/sello.png',
      'https://10.0.0.8/a.png',
      'https://192.168.1.2/a.png',
      'https://172.20.0.1/a.png',
      'https://169.254.169.254/latest',
      'https://[::1]/a.png',
      'https://router.local/a.png',
      'https://user:pw@boia.example.org/a.png',
      'https://boia.example.org:8443/a.png',
      'ftp://boia.example.org/a.png',
      'no es una url',
    ]) {
      expect(isFetchableImageUrl(bad), bad).toBe(false);
    }
  });

  it('cada copia va en la carpeta de su fiesta', () => {
    expect(stampImagePath('halloween-2026', 'image/webp')).toMatch(
      /^halloween-2026\/[a-z0-9]+-[a-z0-9]+\.webp$/,
    );
    expect(stampImagePath('x', 'image/png')).toMatch(/\.png$/);
  });
});
