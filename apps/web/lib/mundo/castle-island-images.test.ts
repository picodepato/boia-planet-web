import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFENSE_TOWER_KINDS } from '@boia/engine/defense';
import { describe, expect, it } from 'vitest';
import { CASTLE_ISLAND_IMAGES, CASTLE_ISLAND_IMAGE_SIZE } from './castle-island-images';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '../../public');

/** Ancho, alto y si trae canal alfa, leídos de la cabecera de un WebP (VP8X o VP8L). */
function webpInfo(buf: Buffer): { width: number; height: number; alpha: boolean } {
  expect(buf.toString('ascii', 0, 4)).toBe('RIFF');
  expect(buf.toString('ascii', 8, 12)).toBe('WEBP');
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    const flags = buf[20]!;
    const width = 1 + buf.readUIntLE(24, 3);
    const height = 1 + buf.readUIntLE(27, 3);
    // Con pérdida, el alfa va en su trozo ALPH; sin pérdida, en el VP8L.
    const alpha = (flags & 0x10) !== 0 && (buf.includes('ALPH') || buf.includes('VP8L'));
    return { width, height, alpha };
  }
  if (chunk === 'VP8L') {
    const bits = buf.readUInt32LE(21);
    return {
      width: 1 + (bits & 0x3fff),
      height: 1 + ((bits >> 14) & 0x3fff),
      alpha: ((bits >> 28) & 1) === 1,
    };
  }
  return { width: 0, height: 0, alpha: false };
}

describe('imágenes de las islas de «Construir» (T172)', () => {
  it('el manifiesto trae una por cada isla que se construye', () => {
    expect(Object.keys(CASTLE_ISLAND_IMAGES).sort()).toEqual([...DEFENSE_TOWER_KINDS].sort());
    expect(DEFENSE_TOWER_KINDS).toHaveLength(7);
  });

  it.each(DEFENSE_TOWER_KINDS)('%s: existen las dos, con alfa y a su tamaño', (kind) => {
    const img = CASTLE_ISLAND_IMAGES[kind];
    for (const [src, side] of [
      [img.src, CASTLE_ISLAND_IMAGE_SIZE],
      [img.src2x, CASTLE_ISLAND_IMAGE_SIZE * 2],
    ] as const) {
      expect(src.startsWith('/') && !src.startsWith('/atlas/')).toBe(true);
      const info = webpInfo(readFileSync(join(PUBLIC, src)));
      expect(info).toEqual({ width: side, height: side, alpha: true });
    }
  });
});
