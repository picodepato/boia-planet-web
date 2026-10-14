#!/usr/bin/env node
/**
 * Las piezas de las imágenes para compartir (plan 030 T286), sacadas del arte
 * real de la web. Se corre a mano cuando cambie el planeta, un barco o una
 * fuente; lo que deja va al repositorio (`scripts/og/`) y el build sólo lo
 * compone (`scripts/og-images.mjs`, sin navegador):
 *
 *   - planeta.png: el planeta 3D del hero de la landing en su pose de reposo,
 *     capturado de la escena de verdad (Chromium de Playwright con GPU) y
 *     recortado en círculo con su halo. Necesita la web en marcha
 *     (`pnpm dev`) y una GPU: sin WebGL la landing cae a la foto fija.
 *   - barco-low-poly.png y barco-after.png: los barcos de `art/barco/3d/`
 *     (el remolcador rojo y el barco del After) pintados con three.js.
 *   - glifos.json: los glifos de Upheaval (títulos) y 8-bit Operator+
 *     negrita (texto) como mapas de píxeles en su rejilla nativa. Las dos son
 *     de píxel: con un factor entero se dibujan nítidas sin rasterizar la
 *     fuente en el build. Las fuentes no se tocan (la de Upheaval no deja
 *     alterar el archivo): esto es una impresión de sus glifos.
 *
 * Uso (desde apps/web): node scripts/og-capture.mjs [--url http://localhost:3000]
 *   [--solo planeta|barcos|glifos]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(WEB, '../..');
export const OG_SOURCES = join(WEB, 'scripts/og');

/**
 * Fuentes de píxel: `unit` es el lado de un píxel de su rejilla en unidades
 * de la fuente (1000 / 50 = 20 píxeles por eme en Upheaval; 1152 / 100 en
 * 8-bit Operator+), `above`/`below` las filas sobre y bajo la línea base.
 */
const FONTS = [
  { id: 'titulo', file: 'public/fonts/upheavtt.ttf', upem: 1000, unit: 50, above: 16, below: 4 },
  {
    id: 'texto',
    file: 'public/fonts/8bit-operator-plus-bold.woff2',
    upem: 1152,
    unit: 100,
    above: 14,
    below: 4,
  },
];

/** Los caracteres que se imprimen: ASCII y Latin-1 (nombres y fechas en español). */
const CHARS = [...Array.from({ length: 0x7f - 0x20 }, (_, i) => 0x20 + i)]
  .concat(Array.from({ length: 0x100 - 0xa1 }, (_, i) => 0xa1 + i))
  .map((c) => String.fromCharCode(c))
  .join('');

/** Los barcos y desde dónde se miran (proa a +X en los glb). */
const BOATS = [
  { id: 'low-poly', view: [-0.55, 0.42, 1] },
  { id: 'after', view: [0.75, 0.5, 1] },
];

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const URL_LANDING = argOf('--url', 'http://localhost:3000');
const SOLO = argOf('--solo', null);
const wants = (what) => !SOLO || SOLO === what;

const PAGE = `<!doctype html><html><head><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script></head><body style="margin:0;background:transparent"></body></html>`;

/** Una página en blanco que sirve three.js, `art/` y las fuentes desde el repositorio. */
async function localPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
  await page.route('http://og.local/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/') return route.fulfill({ contentType: 'text/html', body: PAGE });
    const file = path.startsWith('/three/')
      ? join(WEB, 'node_modules/three', path.slice('/three/'.length))
      : path.startsWith('/fonts/')
        ? join(WEB, 'public', path)
        : join(ROOT, path);
    const type = file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream';
    return route.fulfill({ contentType: type, body: readFileSync(file) });
  });
  await page.goto('http://og.local/');
  return page;
}

const fromDataUrl = (url) => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');

async function captureGlyphs(browser) {
  const page = await localPage(browser);
  const out = await page.evaluate(
    async ({ fonts, chars }) => {
      const S = 8; // píxeles de pantalla por píxel de la rejilla
      const result = {};
      for (const f of fonts) {
        const face = new FontFace(`og-${f.id}`, `url(/${f.file.replace('public/', '')})`);
        await face.load();
        document.fonts.add(face);
        const size = (f.upem / f.unit) * S;
        const rows = f.above + f.below;
        const canvas = document.createElement('canvas');
        const g = canvas.getContext('2d', { willReadFrequently: true });
        const glyphs = {};
        for (const ch of chars) {
          g.font = `${size}px og-${f.id}`;
          const advance = Math.round(g.measureText(ch).width / S);
          const pad = 4;
          const cols = advance + 2 * pad;
          canvas.width = cols * S;
          canvas.height = rows * S;
          g.font = `${size}px og-${f.id}`;
          g.fillStyle = '#000';
          g.textBaseline = 'alphabetic';
          g.fillText(ch, pad * S, f.above * S);
          const data = g.getImageData(0, 0, canvas.width, canvas.height).data;
          const bitmap = [];
          let minX = Infinity;
          let maxX = -Infinity;
          for (let y = 0; y < rows; y++) {
            let row = '';
            for (let x = 0; x < cols; x++) {
              const i = ((y * S + S / 2) * canvas.width + (x * S + S / 2)) * 4 + 3;
              const on = data[i] > 127;
              row += on ? '#' : '.';
              if (on) {
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
              }
            }
            bitmap.push(row);
          }
          // Sólo la tinta, con su desplazamiento desde el origen del glifo.
          const empty = minX === Infinity;
          const x0 = empty ? 0 : minX;
          const x1 = empty ? -1 : maxX;
          glyphs[ch] = {
            a: advance,
            x: x0 - pad,
            r: bitmap.map((r) => r.slice(x0, x1 + 1)),
          };
        }
        result[f.id] = { above: f.above, below: f.below, glyphs };
      }
      return result;
    },
    { fonts: FONTS, chars: CHARS },
  );
  await page.close();
  writeFileSync(join(OG_SOURCES, 'glifos.json'), `${JSON.stringify(out)}\n`);
  console.log('og-capture: scripts/og/glifos.json');
}

async function captureBoats(browser) {
  const page = await localPage(browser);
  for (const boat of BOATS) {
    const url = await page.evaluate(async ({ id, view }) => {
      const THREE = await import('three');
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const SIZE = 512;
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
      });
      renderer.setSize(SIZE, SIZE);
      renderer.setClearColor(0x000000, 0);
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xffffff, 0x2a3550, 2.2));
      const sun = new THREE.DirectionalLight(0xffffff, 2);
      sun.position.set(3, 5, 4);
      scene.add(sun);
      const gltf = await new GLTFLoader().loadAsync(`/art/barco/3d/${id}.glb`);
      scene.add(gltf.scene);
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const center = box.getCenter(new THREE.Vector3());
      const radius = box.getSize(new THREE.Vector3()).length() / 2;
      const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
      const dir = new THREE.Vector3(...view).normalize();
      camera.position.copy(center).add(dir.multiplyScalar(radius / Math.sin((14 * Math.PI) / 180)));
      camera.lookAt(center);
      renderer.render(scene, camera);
      // Recorte a la tinta.
      const src = renderer.domElement;
      const c2 = document.createElement('canvas');
      c2.width = SIZE;
      c2.height = SIZE;
      const g = c2.getContext('2d');
      g.drawImage(src, 0, 0);
      const d = g.getImageData(0, 0, SIZE, SIZE).data;
      let [x0, y0, x1, y1] = [SIZE, SIZE, -1, -1];
      for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++)
          if (d[(y * SIZE + x) * 4 + 3] > 8) {
            x0 = Math.min(x0, x);
            y0 = Math.min(y0, y);
            x1 = Math.max(x1, x);
            y1 = Math.max(y1, y);
          }
      const out = document.createElement('canvas');
      out.width = x1 - x0 + 1;
      out.height = y1 - y0 + 1;
      out.getContext('2d').drawImage(c2, -x0, -y0);
      renderer.dispose();
      return out.toDataURL('image/png');
    }, boat);
    writeFileSync(join(OG_SOURCES, `barco-${boat.id}.png`), fromDataUrl(url));
    console.log(`og-capture: scripts/og/barco-${boat.id}.png`);
  }
  await page.close();
}

/** Lado del recorte del planeta, en múltiplos de su radio (el halo cabe). */
const PLANET_CROP = 1.16;

async function capturePlanet(browser) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto(`${URL_LANDING}/`, { waitUntil: 'load', timeout: 180_000 });
  await page.waitForFunction(() => window.__boiaIntro?.restAtMs != null, null, {
    timeout: 120_000,
  });
  const diag = await page.evaluate(() => window.__boiaIntro);
  if (diag.fallback || !diag.pose) {
    throw new Error('og-capture: la landing no pintó la escena 3D (¿sin GPU?); no hay planeta');
  }
  // Sólo el lienzo de la escena: fuera el título, los botones y la cabecera.
  await page.addStyleTag({
    content:
      'body * { visibility: hidden !important; } .hero__canvas { visibility: visible !important; }',
  });
  await page.waitForTimeout(1500);
  const pose = await page.evaluate(() => window.__boiaIntro.pose);
  const half = Math.round(pose.radius * PLANET_CROP);
  const shot = await page.screenshot({
    clip: { x: pose.x - half, y: pose.y - half, width: 2 * half, height: 2 * half },
    omitBackground: true,
  });
  // Máscara circular con borde suave: el halo se funde con el fondo de la imagen.
  const url = await page.evaluate(
    async ({ b64, inner, outer }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const r = c.width / 2;
      g.globalCompositeOperation = 'destination-in';
      const grad = g.createRadialGradient(r, r, r * inner, r, r, r * outer);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, c.width, c.height);
      return c.toDataURL('image/png');
    },
    { b64: shot.toString('base64'), inner: 0.9, outer: 1 },
  );
  await page.close();
  writeFileSync(join(OG_SOURCES, 'planeta.png'), fromDataUrl(url));
  console.log(`og-capture: scripts/og/planeta.png (${2 * half} px, radio ${pose.radius})`);
}

mkdirSync(OG_SOURCES, { recursive: true });
const browser = await chromium.launch({
  // Con ventana y la GPU de verdad: el hero mide los fotogramas y, si va lento
  // (SwiftShader), se queda en la foto fija.
  headless: false,
  args: ['--enable-gpu', '--ignore-gpu-blocklist'],
});
try {
  if (wants('glifos')) await captureGlyphs(browser);
  if (wants('barcos')) await captureBoats(browser);
  if (wants('planeta')) await capturePlanet(browser);
} finally {
  await browser.close();
}
