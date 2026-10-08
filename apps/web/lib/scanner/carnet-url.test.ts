import { encode } from 'uqr';
import { describe, expect, it } from 'vitest';
import { carnetPath } from '../mundo/carnet/share';
import { decodeFrame } from './decode';
import { parseCarnetQr, signupUrl, wantsCreate } from './carnet-url';
import { parseSelloUrl } from './sello-url';

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

const ID = '3f2b8c1e-9d4a-4f6b-8a2e-1c5d7e9f0a1b';
const ORIGIN = 'https://boia-planet-roan.vercel.app';

describe('los QR de la puerta (plan 019 T218, decisión 11)', () => {
  it('el QR del Carnet (su URL pública) dice de quién es, en cualquier dominio', async () => {
    const url = `${ORIGIN}${carnetPath(ID)}`;
    const text = await decodeFrame(qrFrame(url));
    expect(text).toBe(url);
    expect(parseCarnetQr(text!)).toBe(ID);
    expect(parseCarnetQr(`http://localhost:3000${carnetPath('crew-ana')}/`)).toBe('crew-ana');
    // A mano, el id tal cual.
    expect(parseCarnetQr(` ${ID.toUpperCase()} `)).toBe(ID);
  });

  it('otro QR no es un Carnet: el de un sello, el de alta, otra web, basura', () => {
    for (const text of [
      `${ORIGIN}/sello?e=boia-halloween-2026&c=7F3A9C21B04E`,
      signupUrl(ORIGIN),
      `${ORIGIN}/carnet`,
      `${ORIGIN}/carnet/a/b`,
      `${ORIGIN}/carnet/${encodeURIComponent('<script>')}`,
      'javascript:alert(1)//carnet/x',
      'https://example.com/carta?mesa=4',
      'hola',
    ]) {
      expect(parseCarnetQr(text), text).toBeNull();
    }
  });

  it('el QR de alta abre «Crear carnet» en /carnet y no es un sello', async () => {
    const url = signupUrl(ORIGIN);
    expect(url).toBe(`${ORIGIN}/carnet?crear=1`);
    expect(await decodeFrame(qrFrame(url))).toBe(url);
    expect(wantsCreate(new URL(url).search)).toBe(true);
    expect(wantsCreate('')).toBe(false);
    expect(wantsCreate('?crear=0')).toBe(false);
    expect(parseSelloUrl(url)).toBeNull();
  });
});
