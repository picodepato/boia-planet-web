import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { encode } from 'uqr';
import { describe, expect, it } from 'vitest';
import { decodeFrame, nativeQrDetector } from './decode';
import { parseSelloUrl, selloFromParams, selloUrl } from './sello-url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** El PNG del QR impreso de una fiesta de muestra (fixtures/sello-qr.png). */
const FIXTURE_URL =
  'https://boia-planet-roan.vercel.app/sello?e=boia-halloween-2026&c=7F3A9C21B04E';

function pngFrame(file: string) {
  const png = PNG.sync.read(readFileSync(path.join(HERE, 'fixtures', file)));
  return { data: new Uint8ClampedArray(png.data), width: png.width, height: png.height };
}

/** Un QR pintado aquí (blanco y negro, 6 px por módulo). */
function qrFrame(text: string) {
  const qr = encode(text, { ecc: 'M', border: 4 });
  const s = 6;
  const side = qr.size * s;
  const data = new Uint8ClampedArray(side * side * 4);
  for (let y = 0; y < side; y++)
    for (let x = 0; x < side; x++) {
      const v = qr.data[Math.floor(y / s)]![Math.floor(x / s)] ? 0 : 255;
      data.set([v, v, v, 255], (y * side + x) * 4);
    }
  return { data, width: side, height: side };
}

describe('el decodificador del escáner (plan 008, T91, decisión 9)', () => {
  it('lee el PNG del QR de una fiesta y es un sello de BOIA', async () => {
    const text = await decodeFrame(pngFrame('sello-qr.png'));
    expect(text).toBe(FIXTURE_URL);
    expect(parseSelloUrl(text!)).toEqual({ event: 'boia-halloween-2026', code: '7F3A9C21B04E' });
  });

  it('otro QR se lee pero no es un sello', async () => {
    const text = await decodeFrame(qrFrame('https://example.com/carta?mesa=4'));
    expect(text).toBe('https://example.com/carta?mesa=4');
    expect(parseSelloUrl(text!)).toBeNull();
  });

  it('una imagen sin QR no da nada', async () => {
    const side = 64;
    const blank = new Uint8ClampedArray(side * side * 4).fill(255);
    expect(await decodeFrame({ data: blank, width: side, height: side })).toBeNull();
  });

  it('sin BarcodeDetector (Node) se usa el decodificador', async () => {
    expect(await nativeQrDetector()).toBeNull();
  });
});

describe('el decodificador no entra en el paquete inicial', () => {
  const WEB = path.resolve(HERE, '../..');
  const sources = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory())
        return e.name === 'node_modules' || e.name.startsWith('.') ? [] : sources(p);
      return /\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
    });
  const files = [...sources(path.join(WEB, 'lib')), ...sources(path.join(WEB, 'app'))];

  it('jsqr sólo se carga con import() desde decode.ts, y la cámara también a demanda', () => {
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      const rel = path.relative(WEB, f);
      // Ninguna importación estática de jsqr (sólo tipos).
      expect(src, rel).not.toMatch(/^import\s+(?!type\b)[^;]*from\s+'jsqr'/m);
      // La capa de la cámara (que trae decode.ts) se importa con import() o sólo sus tipos.
      expect(src, rel).not.toMatch(
        /^import\s+(?!type\b)[^;]*from\s+'[./]*(?:scanner\/)?scan-layer'/m,
      );
    }
    const decode = readFileSync(path.join(HERE, 'decode.ts'), 'utf8');
    expect(decode).toContain("import('jsqr')");
    const own = readFileSync(path.join(WEB, 'lib/mundo/carnet/own-carnet.tsx'), 'utf8');
    expect(own).toContain("import('../../scanner/scan-layer')");
  });
});

describe('la URL del sello', () => {
  it('vale cualquier dominio con /sello, e y c', () => {
    const sello = { event: 'all-day-boia-junio', code: 'ABC123' };
    for (const origin of ['http://127.0.0.1:3107', 'https://boia-planet-roan.vercel.app']) {
      expect(parseSelloUrl(selloUrl(origin, sello))).toEqual(sello);
    }
    expect(parseSelloUrl('https://x.test/sello/?e=fiesta&c=ABCDEF')).toEqual({
      event: 'fiesta',
      code: 'ABCDEF',
    });
  });

  it('rechaza lo que no tiene la forma', () => {
    for (const bad of [
      'no es una url',
      'ftp://x.test/sello?e=fiesta&c=ABCDEF',
      'https://x.test/otra?e=fiesta&c=ABCDEF',
      'https://x.test/sello?e=fiesta',
      'https://x.test/sello?e=Fiesta Mala&c=ABCDEF',
      'https://x.test/sello?e=fiesta&c=abc',
      'https://x.test/sello?e=fiesta&c=AB-CD-EF',
    ]) {
      expect(parseSelloUrl(bad), bad).toBeNull();
    }
    expect(selloFromParams(new URLSearchParams('e=fiesta&c=ABCDEF'))).toEqual({
      event: 'fiesta',
      code: 'ABCDEF',
    });
  });
});
