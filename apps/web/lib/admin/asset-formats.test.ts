import { describe, expect, it } from 'vitest';
import { ASSET_ACCEPT, checkAsset } from './asset-validation';
import { CLIP_UPLOAD_LIMITS, PHOTO_UPLOAD_LIMITS, photoUploadProblem } from './photo-upload';
import { STAMP_IMAGE_LIMITS, stampImageProblem } from './stamp-image';
import { SONG_UPLOAD_LIMITS, songFileProblem } from '../radio/upload';

/**
 * REQ-MUN-034, formatos de assets (§34, §48.8): cada puerta por la que el
 * Admin sube arte o audio lee el formato real (sus primeros bytes, no el
 * nombre) y rechaza lo que está fuera del contrato. El contrato de la spec
 * más lo que sumaron decisiones posteriores: el modelo `.glb` de los objetos
 * del mar 3D (D-25, plan 017 T190) y los clips mp4 de la Galería (plan 019
 * T216). El logo y los iconos SVG no se suben desde el Admin (van en el
 * código), y el arte de Blender lo valida `tools/blender/check.py`.
 */

/** Cabecera de un PNG de `w` × `h`. */
function png(w: number, h: number): Uint8Array {
  const b = new Uint8Array(64);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
  b.set([0x49, 0x48, 0x44, 0x52], 12);
  const v = new DataView(b.buffer);
  v.setUint32(16, w);
  v.setUint32(20, h);
  return b;
}

const ascii = (s: string, size = 64) => {
  const b = new Uint8Array(size);
  b.set([...s].map((c) => c.charCodeAt(0)));
  return b;
};

// Formatos fuera del contrato, con sus bytes de verdad.
const OUTSIDE: Record<string, Uint8Array> = {
  gif: ascii('GIF89a\u0001\u0000\u0001\u0000'),
  svg: ascii('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"></svg>', 128),
  bmp: ascii('BM'),
  tiff: new Uint8Array([0x49, 0x49, 0x2a, 0x00, ...new Array(60).fill(0)]),
  pdf: ascii('%PDF-1.7'),
  wav: ascii('RIFF$\u0000\u0000\u0000WAVEfmt '),
  ogg: ascii('OggS'),
  flac: ascii('fLaC'),
  zip: new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...new Array(60).fill(0)]),
};

describe('formatos de assets: el validador rechaza lo que está fuera del contrato (REQ-MUN-034)', () => {
  it('objetos del mar (imagen o .glb): ningún formato de fuera pasa la regla de formato, se llame como se llame', () => {
    for (const [ext, bytes] of Object.entries(OUTSIDE)) {
      for (const name of [`a.${ext}`, 'a.png', 'a.glb']) {
        const report = checkAsset(name, bytes);
        expect(report.type, `${name} con bytes de ${ext}`).toBeNull();
        expect(report.ok).toBe(false);
      }
    }
    expect(checkAsset('a.png', png(64, 64)).ok).toBe(true);
    expect(ASSET_ACCEPT).not.toMatch(/svg|gif/);
  });

  it('fotos de isla y sellos: sólo PNG, WebP o JPEG; la foto se guarda como WebP o JPG', () => {
    for (const [ext, bytes] of Object.entries(OUTSIDE)) {
      expect(photoUploadProblem(bytes), ext).toBe('type');
      expect(stampImageProblem(bytes), ext).toBe('type');
    }
    expect(photoUploadProblem(png(800, 600))).toBeNull();
    expect(stampImageProblem(png(600, 600))).toBeNull();
    expect([...PHOTO_UPLOAD_LIMITS.types, ...STAMP_IMAGE_LIMITS.types].every((t) =>
      ['image/png', 'image/webp', 'image/jpeg'].includes(t),
    )).toBe(true);
    expect(CLIP_UPLOAD_LIMITS.types).toEqual(['video/mp4']);
  });

  it('música de la radio: sólo MP3; WAV, OGG, FLAC o una imagen, no', () => {
    for (const [ext, bytes] of Object.entries(OUTSIDE)) {
      expect(songFileProblem(bytes), ext).toBe('type');
    }
    expect(songFileProblem(png(64, 64))).toBe('type');
    expect(songFileProblem(ascii('ID3\u0004'))).toBeNull();
    expect(SONG_UPLOAD_LIMITS.types).toEqual(['audio/mpeg']);
  });
});
