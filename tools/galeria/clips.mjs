#!/usr/bin/env node
/**
 * Los clips de muestra de la Galería (plan 019 T216, decisión 8: «el agente
 * añade 2–3 clips de muestra hechos con arte del proyecto»). `muestra`.
 *
 * Cada clip se dibuja en un <canvas> del Chromium de Playwright con arte de
 * art/ y se graba con MediaRecorder en MP4 (H.264, sin audio); su póster es
 * un fotograma en WebP. Salen en art/galeria/ y la web los sirve por
 * /api/art/galeria/… (SAMPLE_PHOTOS de packages/store los nombra).
 *
 *   - boia-baila: la boia del tutorial (art/boia-tutorial, 12 fotogramas)
 *     flotando sobre olas de píxel. 480 × 480, 4 s.
 *   - puerto-dia-noche: el puerto del hero (art/landing/hero-still*), de día
 *     a noche con un zoom lento. 640 × 400, 5 s.
 *   - barco-fiesta: el barco de fiesta (art/barco/fiesta) dando la vuelta
 *     con sus 8 direcciones. 360 × 640, 4 s.
 *
 * Uso (desde la raíz): node tools/galeria/clips.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const ART = join(ROOT, 'art');
const OUT = join(ART, 'galeria');
const require = createRequire(join(ROOT, 'apps/web/package.json'));
const { chromium } = require('@playwright/test');

const dataUrl = (rel) => {
  const ext = rel.endsWith('.webp') ? 'webp' : 'png';
  return `data:image/${ext};base64,${readFileSync(join(ART, rel)).toString('base64')}`;
};

const CLIPS = [
  {
    id: 'boia-baila',
    width: 480,
    height: 480,
    seconds: 4,
    images: Array.from({ length: 12 }, (_, i) => dataUrl(`boia-tutorial/idle_${i}.png`)),
    draw: `(g, t, img, W, H) => {
      // Cielo de atardecer en bandas (de píxel) y mar con olas.
      const bands = ['#36278a', '#5a2f8f', '#a33a7a', '#ec4f24', '#ff8a3d'];
      bands.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * H * 0.11, W, H * 0.11 + 1); });
      g.fillStyle = '#12233f';
      g.fillRect(0, H * 0.55, W, H);
      g.fillStyle = '#ffd36b';
      g.fillRect(W * 0.62, H * 0.18, 64, 64);
      for (let row = 0; row < 6; row++) {
        g.fillStyle = row % 2 ? '#1d3a66' : '#274c7d';
        const y = H * 0.58 + row * 30;
        for (let x = -40; x < W + 40; x += 40) {
          const dx = ((t * (40 + row * 12)) % 40);
          g.fillRect(x + (row % 2 ? dx : -dx), y + Math.sin(t * 3 + x) * 2, 24, 6);
        }
      }
      const f = img[Math.floor(t * 8) % img.length];
      const bob = Math.sin(t * Math.PI * 1.5) * 10;
      g.imageSmoothingEnabled = false;
      g.drawImage(f, W / 2 - 160, H * 0.3 + bob, 320, 320);
    }`,
  },
  {
    id: 'puerto-dia-noche',
    width: 640,
    height: 400,
    seconds: 5,
    images: [dataUrl('landing/hero-still-1600.webp'), dataUrl('landing/hero-still-noche-1600.webp')],
    draw: `(g, t, img, W, H, T) => {
      const k = t / T;
      const zoom = 1 + k * 0.18;
      const sw = 1600 / zoom, sh = 1000 / zoom;
      const sx = (1600 - sw) * 0.65, sy = (1000 - sh) * 0.4;
      g.globalAlpha = 1;
      g.drawImage(img[0], sx, sy, sw, sh, 0, 0, W, H);
      g.globalAlpha = Math.min(1, Math.max(0, (k - 0.3) / 0.4));
      g.drawImage(img[1], sx, sy, sw, sh, 0, 0, W, H);
      g.globalAlpha = 1;
    }`,
  },
  {
    id: 'barco-fiesta',
    width: 360,
    height: 640,
    seconds: 4,
    images: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].map((d) => dataUrl(`barco/fiesta/${d}.png`)),
    draw: `(g, t, img, W, H) => {
      g.fillStyle = '#ec4f24';
      g.fillRect(0, 0, W, H);
      // Trama de píxel y focos que giran.
      g.fillStyle = 'rgba(0,0,0,0.14)';
      for (let y = 0; y < H; y += 8) for (let x = (y / 8) % 2 ? 0 : 4; x < W; x += 8) g.fillRect(x, y, 4, 4);
      for (let i = 0; i < 3; i++) {
        const a = t * 1.6 + i * 2.1;
        g.fillStyle = ['rgba(255,211,107,0.35)', 'rgba(54,39,138,0.35)', 'rgba(255,255,255,0.25)'][i];
        g.beginPath();
        g.moveTo(W / 2, H * 0.08);
        g.lineTo(W / 2 + Math.cos(a) * W, H * 0.08 + H);
        g.lineTo(W / 2 + Math.cos(a + 0.25) * W, H * 0.08 + H);
        g.fill();
      }
      g.fillStyle = '#12233f';
      g.fillRect(0, H * 0.68, W, H);
      const f = img[Math.floor(t * 4) % img.length];
      g.imageSmoothingEnabled = false;
      g.drawImage(f, W / 2 - 170, H * 0.36 + Math.sin(t * 4) * 6, 340, 340);
    }`,
  },
];

async function record(page, clip) {
  return page.evaluate(
    async ({ width, height, seconds, images, draw }) => {
      const loaded = await Promise.all(
        images.map(
          (src) =>
            new Promise((ok, ko) => {
              const i = new Image();
              i.onload = () => ok(i);
              i.onerror = ko;
              i.src = src;
            }),
        ),
      );
      const paint = (0, eval)(draw);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      document.body.append(canvas);
      const g = canvas.getContext('2d');
      // El póster: el fotograma de 0,5 s.
      paint(g, 0.5, loaded, width, height, seconds);
      const poster = await new Promise((ok) => canvas.toBlob(ok, 'image/webp', 0.82));
      const stream = canvas.captureStream(30);
      const rec = new MediaRecorder(stream, {
        mimeType: 'video/mp4;codecs=avc1.42E01E',
        videoBitsPerSecond: 900_000,
      });
      const chunks = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const stopped = new Promise((ok) => (rec.onstop = ok));
      const start = performance.now();
      rec.start();
      await new Promise((done) => {
        const frame = () => {
          const t = (performance.now() - start) / 1000;
          if (t >= seconds) return done();
          paint(g, t, loaded, width, height, seconds);
          requestAnimationFrame(frame);
        };
        frame();
      });
      rec.stop();
      await stopped;
      const b64 = async (blob) => {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let s = '';
        for (let i = 0; i < bytes.length; i += 0x8000)
          s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return btoa(s);
      };
      return { video: await b64(new Blob(chunks, { type: 'video/mp4' })), poster: await b64(poster) };
    },
    clip,
  );
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent('<!doctype html><body style="margin:0;background:#000"></body>');
  for (const clip of CLIPS) {
    const { video, poster } = await record(page, clip);
    writeFileSync(join(OUT, `${clip.id}.mp4`), Buffer.from(video, 'base64'));
    writeFileSync(join(OUT, `${clip.id}.webp`), Buffer.from(poster, 'base64'));
    console.log(`${clip.id}: ${clip.width} × ${clip.height}, ${clip.seconds} s`);
  }
} finally {
  await browser.close();
}
