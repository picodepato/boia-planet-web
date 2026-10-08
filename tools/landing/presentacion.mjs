#!/usr/bin/env node
/**
 * The sample video of the landing's presentation (plan 021 T235): the clip
 * that plays in the small window after the hero and opens to full screen.
 * `muestra`: Hernán swaps it for the real one by changing
 * `PRESENTATION_VIDEO` in apps/web/lib/landing/hero-media.ts.
 *
 * Built like the Galería's clips (tools/galeria/clips.mjs): drawn on a
 * <canvas> in Playwright's Chromium with the project's own art (the gallery
 * photos, the party boat, the boia, the port at golden hour and at night) and
 * recorded with MediaRecorder as MP4 (H.264, no audio). No downloads.
 * 1280 × 720, 8 s, 30 fps: eight one-second shots cut on a 120 bpm beat, with
 * a light pulse on every beat and the last shot matching the first, so the
 * loop has no seam. The poster is the first frame, as WebP.
 *
 * Out: art/landing/presentacion-muestra.mp4 and .webp (served by /api/art).
 * Usage (from the root): node tools/landing/presentacion.mjs
 */
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const ART = join(ROOT, 'art');
const OUT = join(ART, 'landing');
const require = createRequire(join(ROOT, 'apps/web/package.json'));
const { chromium } = require('@playwright/test');

const dataUrl = (rel) => {
  const ext = rel.endsWith('.webp') ? 'webp' : 'png';
  return `data:image/${ext};base64,${readFileSync(join(ART, rel)).toString('base64')}`;
};

const W = 1280;
const H = 720;
const SECONDS = 8;
const FPS = 30;

/** The images, by name (the draw function reads them from `img`). */
const IMAGES = {
  stage: 'galeria/foto-8.webp',
  golden: 'galeria/foto-1.webp',
  boia: 'galeria/foto-2.webp',
  night: 'galeria/foto-cala-3.webp',
  boat: 'galeria/foto-5.webp',
  port: 'landing/hero-still-1600.webp',
  portNight: 'landing/hero-still-noche-1600.webp',
  lighthouse: 'galeria/foto-3.webp',
  ...Object.fromEntries(
    ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].map((d) => [`fiesta${d}`, `barco/fiesta/${d}.png`]),
  ),
};

/**
 * One frame at time `t` (s). Eight shots of one second; each one a slow push
 * or drift over an image (cover-fitted), the beat (every 0.5 s) a short
 * light pulse and a 3 % punch-in, a warm vignette over everything.
 */
const DRAW = `(g, t, img, W, H, T) => {
  const beat = 0.5;
  const sinceBeat = t % beat;
  const pulse = Math.exp(-sinceBeat * 9);
  const cover = (im, zoom, fx, fy) => {
    const s = Math.max(W / im.width, H / im.height) * zoom;
    const w = im.width * s, h = im.height * s;
    g.drawImage(im, (W - w) * fx, (H - h) * fy, w, h);
  };
  const shot = Math.min(7, Math.floor(t));
  const k = t - shot;
  const punch = 1 + 0.03 * pulse;
  g.save();
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  switch (shot) {
    case 0: cover(img.stage, (1.05 + k * 0.08) * punch, 0.5, 0.45); break;
    case 1: {
      // The party boat turning, with the lights sweeping.
      g.fillStyle = '#ec4f24';
      g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(0,0,0,0.16)';
      for (let y = 0; y < H; y += 10) for (let x = (y / 10) % 2 ? 0 : 5; x < W; x += 10) g.fillRect(x, y, 5, 5);
      for (let i = 0; i < 4; i++) {
        const a = t * 2.2 + i * 1.6;
        g.fillStyle = ['rgba(255,211,107,0.40)', 'rgba(54,39,138,0.40)', 'rgba(255,255,255,0.28)', 'rgba(255,138,61,0.35)'][i];
        g.beginPath();
        g.moveTo(W / 2, -20);
        g.lineTo(W / 2 + Math.cos(a) * W * 1.2, H + 40);
        g.lineTo(W / 2 + Math.cos(a + 0.22) * W * 1.2, H + 40);
        g.fill();
      }
      g.fillStyle = '#12233f';
      g.fillRect(0, H * 0.72, W, H);
      const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
      const f = img['fiesta' + dirs[Math.floor(t * 8) % 8]];
      g.imageSmoothingEnabled = false;
      const size = 520 * punch;
      g.drawImage(f, W / 2 - size / 2, H * 0.2 + Math.sin(t * 6) * 8, size, size);
      g.imageSmoothingEnabled = true;
      break;
    }
    case 2: cover(img.golden, (1.25 - k * 0.12) * punch, 0.35 + k * 0.2, 0.5); break;
    case 3: {
      g.fillStyle = '#ec4f24';
      g.fillRect(0, 0, W, H);
      const s = (0.9 + 0.12 * pulse) * H / img.boia.height;
      const w = img.boia.width * s, h = img.boia.height * s;
      g.translate(W / 2, H / 2);
      g.rotate(Math.sin(t * Math.PI * 2) * 0.05);
      g.drawImage(img.boia, -w / 2, -h / 2, w, h);
      break;
    }
    case 4: cover(img.night, (1.1 + k * 0.1) * punch, 0.5, 0.5); break;
    case 5: cover(img.boat, (1.0 + k * 0.15) * punch, 0.5, 0.3 + k * 0.3); break;
    case 6: {
      cover(img.port, (1.15 + k * 0.1) * punch, 0.62, 0.42);
      g.globalAlpha = Math.min(1, k * 1.6);
      cover(img.portNight, (1.15 + k * 0.1) * punch, 0.62, 0.42);
      g.globalAlpha = 1;
      break;
    }
    default: {
      // Back to the stage, ending on the first frame: a seamless loop.
      cover(img.lighthouse, 1.1 * punch, 0.5, 0.5);
      g.globalAlpha = Math.min(1, Math.max(0, (k - 0.35) / 0.5));
      cover(img.stage, 1.05 + Math.max(0, 1 - k) * 0.06, 0.5, 0.45);
      g.globalAlpha = 1;
    }
  }
  g.restore();
  // The beat: a warm flash and a cut flash on every shot change.
  g.fillStyle = 'rgba(255,170,90,' + (0.18 * pulse).toFixed(3) + ')';
  g.fillRect(0, 0, W, H);
  if (k < 0.06 && shot > 0) {
    g.fillStyle = 'rgba(255,255,255,' + (0.5 * (1 - k / 0.06)).toFixed(3) + ')';
    g.fillRect(0, 0, W, H);
  }
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
}`;

async function record(page) {
  return page.evaluate(
    async ({ width, height, seconds, fps, images, draw }) => {
      const entries = await Promise.all(
        Object.entries(images).map(
          ([name, src]) =>
            new Promise((ok, ko) => {
              const i = new Image();
              i.onload = () => ok([name, i]);
              i.onerror = ko;
              i.src = src;
            }),
        ),
      );
      const loaded = Object.fromEntries(entries);
      const paint = (0, eval)(draw);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      document.body.append(canvas);
      const g = canvas.getContext('2d');
      paint(g, 0, loaded, width, height, seconds);
      const poster = await new Promise((ok) => canvas.toBlob(ok, 'image/webp', 0.8));
      const stream = canvas.captureStream(fps);
      const rec = new MediaRecorder(stream, {
        mimeType: 'video/mp4;codecs=avc1.42E01F',
        videoBitsPerSecond: 1_500_000,
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
    {
      width: W,
      height: H,
      seconds: SECONDS,
      fps: FPS,
      images: Object.fromEntries(Object.entries(IMAGES).map(([k, rel]) => [k, dataUrl(rel)])),
      draw: DRAW,
    },
  );
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent('<!doctype html><body style="margin:0;background:#000"></body>');
  const { video, poster } = await record(page);
  const mp4 = join(OUT, 'presentacion-muestra.mp4');
  writeFileSync(mp4, Buffer.from(video, 'base64'));
  writeFileSync(join(OUT, 'presentacion-muestra.webp'), Buffer.from(poster, 'base64'));
  console.log(`presentacion-muestra: ${W} × ${H}, ${SECONDS} s, ${statSync(mp4).size} bytes`);
} finally {
  await browser.close();
}
