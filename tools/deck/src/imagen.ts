import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MARCA } from './rutas.ts';

/** Ancho y alto en píxeles de un JPEG, leídos de su cabecera SOF. */
export function medidasJpeg(buf: Buffer): { w: number; h: number } {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error('no es un JPEG');
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marca = buf[i + 1]!;
    const largo = buf.readUInt16BE(i + 2);
    const esSof = marca >= 0xc0 && marca <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marca);
    if (esSof) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + largo;
  }
  throw new Error('JPEG sin cabecera de tamaño');
}

export interface Imagen {
  /** «image/png;base64,…», lo que pide `addImage({ data })`. */
  data: string;
  w: number;
  h: number;
}

/** Un JPEG del disco, con sus medidas para no deformarlo. */
export function jpeg(ruta: string): Imagen {
  const buf = readFileSync(ruta);
  return { data: `image/jpeg;base64,${buf.toString('base64')}`, ...medidasJpeg(buf) };
}

const cache = new Map<string, Imagen>();

/**
 * Un logo de `art/marca/` (SVG) pasado a PNG transparente: PowerPoint y
 * LibreOffice lo pintan igual, y el SVG sigue siendo la única fuente.
 */
export async function marca(
  nombre: 'boia-wordmark' | 'boia-mascota',
  ancho = 1600,
): Promise<Imagen> {
  const clave = `${nombre}@${ancho}`;
  const hecha = cache.get(clave);
  if (hecha) return hecha;
  const img = await loadImage(readFileSync(join(MARCA, `${nombre}.svg`)));
  const w = ancho;
  const h = Math.round((ancho * img.height) / img.width);
  const lienzo = createCanvas(w, h);
  lienzo.getContext('2d').drawImage(img, 0, 0, w, h);
  const imagen = {
    data: `image/png;base64,${lienzo.toBuffer('image/png').toString('base64')}`,
    w,
    h,
  };
  cache.set(clave, imagen);
  return imagen;
}
