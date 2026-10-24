#!/usr/bin/env node
/**
 * Las fotos reales de la Galería (plan 048 T328): de los PNG/JPG que manda
 * Álvaro a WebP, con los mismos ajustes que la subida del Admin
 * (`apps/web/lib/admin/photo-upload.ts`): lado largo ≤ 1600 px, calidad
 * 0,82, sin metadatos. Se dibujan en un <canvas> del Chromium de Playwright
 * (el mismo codificador WebP que usa el navegador al subir).
 *
 * Salen en apps/web/public/contenido/galeria/<id>.webp; REAL_PHOTOS de
 * packages/store (sample/content.ts) las nombra con su tamaño. Las fuentes
 * no van al repositorio.
 *
 * Las fotos de muestra de antes (foto-1..8, foto-cala-1..3, dibujadas con arte
 * del proyecto) ya no existen: este script ya no las crea.
 *
 * Uso (desde la raíz): node tools/galeria/fotos.mjs <carpeta de las fuentes>
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
export const OUT = join(ROOT, 'apps/web/public/contenido/galeria');
const MAX_SIDE = 1600;
const QUALITY = 0.82;

/** id y archivo de origen; el orden es el de la portada. */
export const FOTOS = [
  { id: 'galeria-dj-cabina-humo-neon', file: 'DJ en cabina entre humo neón.png' },
  { id: 'galeria-dj-neones-humo', file: 'DJ entre neones y humo.png' },
  { id: 'galeria-djs-cantando-palmeras', file: 'DJs cantando entre luces neón y palmeras.png' },
  { id: 'galeria-fiesta-nocturna-humo', file: 'Fiesta nocturna entre luces y humo.png' },
  { id: 'galeria-grafiti-valla', file: 'Grafiti nocturno junto a la valla iluminada.png' },
  { id: 'galeria-mezcla-allen-heath', file: 'Mezcla nocturna con Allen & Heath.png' },
  { id: 'galeria-pista-baile-humo', file: 'Pista de baile entre luces y humo.png' },
];

async function encode(page, dataUrl) {
  return page.evaluate(
    async ({ src, max, quality }) => {
      const img = await new Promise((ok, ko) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = ko;
        i.src = src;
      });
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * k);
      canvas.height = Math.round(img.height * k);
      const g = canvas.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/webp', quality));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000)
        s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return { b64: btoa(s), width: canvas.width, height: canvas.height };
    },
    { src: dataUrl, max: MAX_SIDE, quality: QUALITY },
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const from = process.argv[2];
  if (!from) {
    console.error('Uso: node tools/galeria/fotos.mjs <carpeta de las fuentes>');
    process.exit(1);
  }
  const require = createRequire(join(ROOT, 'apps/web/package.json'));
  const { chromium } = require('@playwright/test');
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><body style="margin:0;background:#000"></body>');
    for (const foto of FOTOS) {
      const raw = readFileSync(join(from, foto.file));
      const mime = /\.jpe?g$/i.test(foto.file) ? 'jpeg' : 'png';
      const out = await encode(page, `data:image/${mime};base64,${raw.toString('base64')}`);
      const buf = Buffer.from(out.b64, 'base64');
      writeFileSync(join(OUT, `${foto.id}.webp`), buf);
      console.log(`${foto.id}: ${out.width} × ${out.height}, ${(buf.length / 1024).toFixed(0)} kB`);
    }
  } finally {
    await browser.close();
  }
}
