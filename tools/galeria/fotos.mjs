#!/usr/bin/env node
/**
 * Las fotos de muestra de la Galería (plan 020 T234, decisión 8: el collage
 * tiene que verse con tamaños y formas distintos). `muestra`: no son fotos
 * de fiestas, son composiciones con arte del proyecto (art/), cada una con
 * su forma (apaisada, cuadrada, alta), para que el collage se lea como tal
 * hasta que el Admin suba las de verdad.
 *
 * Se dibujan en un <canvas> del Chromium de Playwright (como clips.mjs) y
 * salen en art/galeria/<id>.webp; SAMPLE_PHOTOS de packages/store las nombra
 * con el mismo tamaño (FOTOS de aquí abajo y SAMPLE_STILLS de allí van a la par).
 *
 * Uso (desde la raíz): node tools/galeria/fotos.mjs
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
  const ext = rel.endsWith('.webp') ? 'webp' : rel.endsWith('.jpg') ? 'jpeg' : 'png';
  return `data:image/${ext};base64,${readFileSync(join(ART, rel)).toString('base64')}`;
};

/** Fondos comunes: atardecer en bandas, noche, trama de píxel. */
const HELPERS = `
  const sunset = (g, W, H, sea = 0.62) => {
    const bands = ['#36278a', '#5a2f8f', '#a33a7a', '#ec4f24', '#ff8a3d'];
    bands.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * H * sea / 5, W, H * sea / 5 + 1); });
    g.fillStyle = '#12233f';
    g.fillRect(0, H * sea, W, H);
    for (let row = 0; row < 8; row++) {
      g.fillStyle = row % 2 ? '#1d3a66' : '#274c7d';
      const y = H * sea + 10 + row * 26;
      for (let x = (row % 2) * 20 - 20; x < W; x += 48) g.fillRect(x, y, 26, 6);
    }
  };
  const night = (g, W, H) => {
    g.fillStyle = '#0b1230';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffd36b';
    for (let i = 0; i < 70; i++) {
      const x = (i * 97) % W, y = (i * 53) % (H * 0.55);
      g.fillRect(x, y, i % 3 ? 3 : 5, i % 3 ? 3 : 5);
    }
    g.fillStyle = '#12233f';
    g.fillRect(0, H * 0.66, W, H);
  };
  const pixels = (g, W, H, color = 'rgba(0,0,0,0.14)') => {
    g.fillStyle = color;
    for (let y = 0; y < H; y += 10) for (let x = (y / 10) % 2 ? 0 : 5; x < W; x += 10) g.fillRect(x, y, 5, 5);
  };
  const sprite = (g, img, cx, cy, w) => {
    const h = (w * img.height) / img.width;
    g.imageSmoothingEnabled = false;
    g.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    g.imageSmoothingEnabled = true;
  };
  const cover = (g, img, W, H, fx = 0.5, fy = 0.5, zoom = 1) => {
    const s = Math.max(W / img.width, H / img.height) * zoom;
    const sw = W / s, sh = H / s;
    g.drawImage(img, (img.width - sw) * fx, (img.height - sh) * fy, sw, sh, 0, 0, W, H);
  };
`;

/** id, tamaño (px) y cómo se dibuja. El tamaño es también su forma en el collage. */
export const FOTOS = [
  {
    id: 'foto-1',
    width: 1200,
    height: 800,
    images: ['landing/hero-still-1600.webp'],
    draw: `(g, img, W, H) => cover(g, img[0], W, H, 0.55, 0.45, 1.05)`,
  },
  {
    id: 'foto-2',
    width: 640,
    height: 800,
    images: ['marca/boia-mascota.jpg'],
    draw: `(g, img, W, H) => {
      g.fillStyle = '#ec4f24'; g.fillRect(0, 0, W, H); pixels(g, W, H);
      g.drawImage(img[0], W * 0.08, H * 0.16, W * 0.84, W * 0.84);
    }`,
  },
  {
    id: 'foto-3',
    width: 800,
    height: 800,
    images: ['mundos/arcilla/faro/faro.png'],
    draw: `(g, img, W, H) => { sunset(g, W, H, 0.6); sprite(g, img[0], W * 0.5, H * 0.56, W * 0.86); }`,
  },
  {
    id: 'foto-4',
    width: 1280,
    height: 720,
    images: ['landing/hero-still-noche-1600.webp'],
    draw: `(g, img, W, H) => cover(g, img[0], W, H, 0.4, 0.5, 1.1)`,
  },
  {
    id: 'foto-5',
    width: 600,
    height: 900,
    images: ['barco/fiesta/S.png'],
    draw: `(g, img, W, H) => {
      night(g, W, H);
      for (let i = 0; i < 3; i++) {
        g.fillStyle = ['rgba(255,211,107,0.3)', 'rgba(236,79,36,0.35)', 'rgba(255,255,255,0.2)'][i];
        g.beginPath(); g.moveTo(W / 2, H * 0.1);
        g.lineTo(W * (0.1 + i * 0.4), H); g.lineTo(W * (0.22 + i * 0.4), H); g.fill();
      }
      sprite(g, img[0], W * 0.5, H * 0.62, W * 0.95);
    }`,
  },
  {
    id: 'foto-6',
    width: 960,
    height: 720,
    images: ['mundos/arcilla/delfin/delfin_salto_3.png', 'mundos/arcilla/delfin/delfin_salto_5.png'],
    draw: `(g, img, W, H) => {
      sunset(g, W, H, 0.58);
      sprite(g, img[0], W * 0.36, H * 0.48, W * 0.42);
      sprite(g, img[1], W * 0.74, H * 0.62, W * 0.26);
    }`,
  },
  {
    id: 'foto-7',
    width: 720,
    height: 960,
    images: ['boia-tutorial/idle_0.png'],
    draw: `(g, img, W, H) => {
      sunset(g, W, H, 0.6);
      g.fillStyle = '#ffd36b'; g.fillRect(W * 0.62, H * 0.1, 84, 84);
      sprite(g, img[0], W * 0.5, H * 0.6, W * 0.9);
    }`,
  },
  {
    id: 'foto-8',
    width: 1000,
    height: 800,
    images: ['mundos/arcilla/allday/recuerdo.png'],
    draw: `(g, img, W, H) => {
      g.fillStyle = '#274c7d'; g.fillRect(0, 0, W, H); pixels(g, W, H, 'rgba(255,255,255,0.08)');
      sprite(g, img[0], W * 0.5, H * 0.52, W * 0.94);
    }`,
  },
  {
    id: 'foto-cala-1',
    width: 720,
    height: 960,
    images: ['mundos/arcilla/cala/cala.png'],
    draw: `(g, img, W, H) => { sunset(g, W, H, 0.5); sprite(g, img[0], W * 0.5, H * 0.66, W * 1.1); }`,
  },
  {
    id: 'foto-cala-2',
    width: 800,
    height: 800,
    images: ['landing/hero-still-1600.webp'],
    draw: `(g, img, W, H) => cover(g, img[0], W, H, 0.2, 0.7, 1.6)`,
  },
  {
    id: 'foto-cala-3',
    width: 1280,
    height: 800,
    images: ['landing/hero-still-noche-1600.webp'],
    draw: `(g, img, W, H) => cover(g, img[0], W, H, 0.85, 0.3, 1.4)`,
  },
  // Fotos de Hernán (plan 023 T250), `muestra` hasta que Álvaro dé el visto
  // bueno de derechos (galeria-4 es una portada de álbum ajena). Las fuentes
  // están en art/galeria-fuentes/, tal cual llegaron.
  {
    id: 'galeria-1',
    width: 1200,
    height: 675,
    images: ['galeria-fuentes/galeria-1.webp'],
    draw: `(g, img, W, H) => cover(g, img[0], W, H)`,
  },
  {
    id: 'galeria-2',
    width: 1200,
    height: 675,
    images: ['galeria-fuentes/galeria-2.webp'],
    draw: `(g, img, W, H) => cover(g, img[0], W, H)`,
  },
  {
    // Recorte de 60 px por la izquierda: quita el icono redondo de Google
    // Lens de la esquina inferior izquierda (ocupa unos 40 px).
    id: 'galeria-3',
    width: 800,
    height: 1321,
    images: ['galeria-fuentes/galeria-3.webp'],
    draw: `(g, img, W, H) => g.drawImage(img[0], 60, 0, img[0].width - 60, img[0].height, 0, 0, W, H)`,
  },
  {
    id: 'galeria-4',
    width: 1000,
    height: 965,
    images: ['galeria-fuentes/galeria-4.webp'],
    draw: `(g, img, W, H) => cover(g, img[0], W, H)`,
  },
];

async function paint(page, foto) {
  return page.evaluate(
    async ({ width, height, images, draw, helpers }) => {
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
      const fn = (0, eval)(`(() => { ${helpers}; return ${draw}; })()`);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const g = canvas.getContext('2d');
      fn(g, loaded, width, height);
      const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/webp', 0.8));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000)
        s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(s);
    },
    { ...foto, images: foto.images.map(dataUrl), helpers: HELPERS },
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><body style="margin:0;background:#000"></body>');
    for (const foto of FOTOS) {
      const b64 = await paint(page, foto);
      const buf = Buffer.from(b64, 'base64');
      writeFileSync(join(OUT, `${foto.id}.webp`), buf);
      console.log(`${foto.id}: ${foto.width} × ${foto.height}, ${(buf.length / 1024).toFixed(0)} kB`);
    }
  } finally {
    await browser.close();
  }
}
