#!/usr/bin/env node
/**
 * Imágenes para compartir (plan 030 T286): lo que enseñan WhatsApp,
 * Instagram o X al pegar un enlace. 1200 × 630 PNG, archivos estáticos en
 * `public/og/` (nada se genera al atender una petición: Cloudflare Workers no
 * tiene disco ni lienzo, y así los dos hosts sirven lo mismo):
 *
 *   - og/planeta.png: «BOIA» en píxel naranja arriba, el planeta del hero
 *     con dos barcos, cielo de estrellas y «BOIA.PLANET · Alicante». La
 *     palabra y el planeta caben en el cuadrado central de 630 (WhatsApp
 *     recorta así). La usan la home, /mar y las demás páginas.
 *   - og/eventos/<slug>.png: una por evento público, con su nombre en grande,
 *     la fecha (Europe/Madrid) en una entrada y el planeta a la derecha.
 *
 * Composición aprobada por Álvaro (2026-10-14, ejemplos de Codex). Las piezas
 * (planeta, barcos, glifos de las fuentes) salen del arte real con
 * `scripts/og-capture.mjs` y están en `scripts/og/`; esto sólo compone, en
 * Node puro (pngjs), así que corre en el build de los dos hosts: un evento
 * nuevo tiene su imagen al construir. Determinista: con las mismas entradas
 * deja los mismos bytes y no reescribe lo que no cambia.
 *
 * Uso (desde apps/web): node scripts/og-images.mjs
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pngjs from 'pngjs';

const { PNG } = pngjs;

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = join(WEB, 'scripts/og');
export const OG_DIR = join(WEB, 'public/og');

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/** Colores de la landing. */
const ORANGE = [232, 84, 42];
const SHADOW = [122, 34, 16];
const INK = [22, 12, 20];
const WHITE = [242, 239, 233];
const SKY = [6, 13, 28];
const SKY_CENTER = [9, 18, 38];

// ---------------------------------------------------------------------------
// Fecha

/** «SÁB 31 OCT»: día de la semana, día y mes en la zona del evento. */
export function ogDateLabel(startsAt, timeZone = 'Europe/Madrid') {
  const d = new Date(startsAt);
  const part = (opts) =>
    new Intl.DateTimeFormat('es-ES', { timeZone, ...opts }).format(d).replace(/\.$/, '');
  return `${part({ weekday: 'short' })} ${part({ day: 'numeric' })} ${part({ month: 'short' })}`.toLocaleUpperCase(
    'es-ES',
  );
}

// ---------------------------------------------------------------------------
// Lienzo RGBA (el fondo siempre es opaco: «over» con alfa directo)

function canvas(w, h) {
  return { width: w, height: h, data: Buffer.alloc(w * h * 4) };
}

function readPng(file) {
  return PNG.sync.read(readFileSync(file));
}

/** Reduce una imagen RGBA por promedio de área (alfa premultiplicado). */
function resize(src, w, h) {
  const out = canvas(w, h);
  const sx = src.width / w;
  const sy = src.height / h;
  for (let y = 0; y < h; y++) {
    const y0 = y * sy;
    const y1 = y0 + sy;
    for (let x = 0; x < w; x++) {
      const x0 = x * sx;
      const x1 = x0 + sx;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let area = 0;
      for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy++) {
        const wy = Math.min(y1, yy + 1) - Math.max(y0, yy);
        for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++) {
          const wx = Math.min(x1, xx + 1) - Math.max(x0, xx);
          const k = wx * wy;
          const i = (Math.min(yy, src.height - 1) * src.width + Math.min(xx, src.width - 1)) * 4;
          const al = (src.data[i + 3] / 255) * k;
          r += src.data[i] * al;
          g += src.data[i + 1] * al;
          b += src.data[i + 2] * al;
          a += al;
          area += k;
        }
      }
      const o = (y * w + x) * 4;
      if (a > 0) {
        out.data[o] = Math.round(r / a);
        out.data[o + 1] = Math.round(g / a);
        out.data[o + 2] = Math.round(b / a);
      }
      out.data[o + 3] = Math.round((a / area) * 255);
    }
  }
  return out;
}

/** Pega `src` con su esquina arriba-izquierda en (left, top). */
function draw(dst, src, left, top) {
  for (let y = 0; y < src.height; y++) {
    const dy = top + y;
    if (dy < 0 || dy >= dst.height) continue;
    for (let x = 0; x < src.width; x++) {
      const dx = left + x;
      if (dx < 0 || dx >= dst.width) continue;
      const s = (y * src.width + x) * 4;
      const a = src.data[s + 3] / 255;
      if (a === 0) continue;
      const d = (dy * dst.width + dx) * 4;
      for (let c = 0; c < 3; c++) {
        dst.data[d + c] = Math.round(src.data[s + c] * a + dst.data[d + c] * (1 - a));
      }
      dst.data[d + 3] = 255;
    }
  }
}

/** Pega una pieza escalada a `width` de ancho, centrada en (cx, cy). */
function placeCentered(dst, src, width, cx, cy) {
  const height = Math.round((src.height * width) / src.width);
  draw(dst, resize(src, width, height), Math.round(cx - width / 2), Math.round(cy - height / 2));
}

function rect(dst, x0, y0, x1, y1, color, alpha = 1) {
  for (let y = Math.max(0, y0); y < Math.min(dst.height, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(dst.width, x1); x++) {
      const d = (y * dst.width + x) * 4;
      for (let c = 0; c < 3; c++) {
        dst.data[d + c] = Math.round(color[c] * alpha + dst.data[d + c] * (1 - alpha));
      }
      dst.data[d + 3] = 255;
    }
  }
}

/** Generador pseudoaleatorio fijo (mulberry32): las estrellas no cambian entre builds. */
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cielo azul noche con un poco más de luz en `focus` y estrellas. */
function sky(focusX, focusY, seed) {
  const img = canvas(OG_WIDTH, OG_HEIGHT);
  const reach = Math.hypot(OG_WIDTH, OG_HEIGHT) * 0.55;
  for (let y = 0; y < OG_HEIGHT; y++) {
    for (let x = 0; x < OG_WIDTH; x++) {
      const t = Math.max(0, 1 - Math.hypot(x - focusX, y - focusY) / reach);
      const d = (y * OG_WIDTH + x) * 4;
      for (let c = 0; c < 3; c++)
        img.data[d + c] = Math.round(SKY[c] + (SKY_CENTER[c] - SKY[c]) * t);
      img.data[d + 3] = 255;
    }
  }
  const rnd = random(seed);
  for (let i = 0; i < 220; i++) {
    const x = Math.floor(rnd() * OG_WIDTH);
    const y = Math.floor(rnd() * OG_HEIGHT);
    rect(img, x, y, x + 1, y + 1, WHITE, 0.15 + rnd() * 0.45);
  }
  // Unos destellos en cruz, como en el cielo del hero.
  for (let i = 0; i < 7; i++) {
    const x = Math.floor(rnd() * OG_WIDTH);
    const y = Math.floor(rnd() * OG_HEIGHT);
    rect(img, x - 3, y, x + 4, y + 1, WHITE, 0.55);
    rect(img, x, y - 3, x + 1, y + 4, WHITE, 0.55);
  }
  return img;
}

// ---------------------------------------------------------------------------
// Texto de píxel (glifos de scripts/og/glifos.json)

let GLYPHS = null;
function font(id) {
  GLYPHS ??= JSON.parse(readFileSync(join(SOURCES, 'glifos.json'), 'utf8'));
  return GLYPHS[id];
}

const glyphOf = (f, ch) => f.glyphs[ch] ?? f.glyphs['?'];

/** Ancho de `text` en píxeles con el factor `k`. */
function textWidth(fontId, text, k) {
  const f = font(fontId);
  return [...text].reduce((w, ch) => w + glyphOf(f, ch).a, 0) * k;
}

/** Escribe `text` con la línea base en `baseline`, empezando en `left`. */
function text(dst, fontId, value, left, baseline, k, color, shadow = null) {
  const f = font(fontId);
  const paint = (ox, oy, col) => {
    let pen = left + ox;
    for (const ch of value) {
      const g = glyphOf(f, ch);
      g.r.forEach((row, ry) => {
        const y = baseline + oy + (ry - f.above) * k;
        for (let rx = 0; rx < row.length; rx++) {
          if (row[rx] !== '#') continue;
          const x = pen + (g.x + rx) * k;
          rect(dst, x, y, x + k, y + k, col);
        }
      });
      pen += g.a * k;
    }
  };
  if (shadow) paint(shadow.dx, shadow.dy, shadow.color);
  paint(0, 0, color);
}

/** Altura de mayúscula de Upheaval (filas de la rejilla). */
const CAP = 10;

/**
 * Las mismas `n` líneas, con los cortes donde la más larga es más corta
 * («HALLOWEEN / IN THE CLUB» y no «HALLOWEEN IN / THE CLUB»).
 */
function balance(words, n, k) {
  let best = null;
  let bestWidth = Infinity;
  const walk = (start, lines) => {
    if (lines.length === n - 1) {
      const all = [...lines, words.slice(start).join(' ')];
      const w = Math.max(...all.map((l) => textWidth('titulo', l, k)));
      if (w < bestWidth) [best, bestWidth] = [all, w];
      return;
    }
    for (let end = start + 1; end <= words.length - (n - 1 - lines.length); end++) {
      walk(end, [...lines, words.slice(start, end).join(' ')]);
    }
  };
  walk(0, []);
  return best;
}

/**
 * Parte el nombre en líneas para `maxWidth` con el mayor factor que quepa en
 * `maxHeight` (las letras de píxel sólo escalan por enteros).
 */
export function fitTitle(name, maxWidth, maxHeight, { maxK = 8, minK = 2, lineGap = 9 } = {}) {
  const words = name.toLocaleUpperCase('es-ES').split(/\s+/).filter(Boolean);
  for (let k = maxK; k >= minK; k--) {
    const lines = [];
    for (const word of words) {
      const last = lines.at(-1);
      if (last !== undefined && textWidth('titulo', `${last} ${word}`, k) <= maxWidth) {
        lines[lines.length - 1] = `${last} ${word}`;
      } else lines.push(word);
    }
    const height = lines.length * CAP * k + (lines.length - 1) * lineGap * k;
    if (height <= maxHeight && lines.every((l) => textWidth('titulo', l, k) <= maxWidth)) {
      return { k, lines: balance(words, lines.length, k), lineHeight: (CAP + lineGap) * k, height };
    }
  }
  // Una palabra que no cabe ni con el factor mínimo: se corta por letras.
  const k = minK;
  const lines = [];
  for (const ch of words.join(' ')) {
    const last = lines.at(-1);
    if (last !== undefined && textWidth('titulo', last + ch, k) <= maxWidth) {
      lines[lines.length - 1] = last + ch;
    } else lines.push(ch.trim());
  }
  return { k, lines, lineHeight: (CAP + lineGap) * k, height: lines.length * (CAP + lineGap) * k };
}

const shadowOf = (k) => ({ dx: Math.ceil(k / 2), dy: Math.ceil(k / 2), color: SHADOW });

// ---------------------------------------------------------------------------
// Composiciones

let PIECES = null;
function pieces() {
  PIECES ??= {
    planet: readPng(join(SOURCES, 'planeta.png')),
    tug: readPng(join(SOURCES, 'barco-low-poly.png')),
    after: readPng(join(SOURCES, 'barco-after.png')),
  };
  return PIECES;
}

/** Diámetro del recorte del planeta para un cuerpo de `body` px (el halo, alrededor). */
const PLANET_CROP = 1.16;

export function composeHome() {
  const { planet, tug, after } = pieces();
  const img = sky(600, 380, 286);
  placeCentered(img, planet, Math.round(370 * PLANET_CROP), 600, 372);
  placeCentered(img, tug, 92, 372, 312);
  placeCentered(img, after, 86, 834, 478);
  const k = 11;
  const word = 'BOIA';
  text(
    img,
    'titulo',
    word,
    Math.round(600 - textWidth('titulo', word, k) / 2),
    40 + CAP * k,
    k,
    ORANGE,
    shadowOf(k),
  );
  const foot = 'BOIA.PLANET · Alicante';
  text(img, 'texto', foot, Math.round(600 - textWidth('texto', foot, 2) / 2), 604, 2, WHITE);
  return img;
}

/** Entrada con muescas de píxel, línea de corte y código de barras. */
function ticket(img, x0, y0, x1, y1) {
  const step = 14;
  rect(img, x0 + step, y0, x1 - step, y1, ORANGE);
  rect(img, x0, y0 + 16, x0 + step, y1 - 16, ORANGE);
  rect(img, x1 - step, y0 + 16, x1, y1 - 16, ORANGE);
  const cut = x1 - 60;
  for (let y = y0 + 12; y < y1 - 12; y += 14) rect(img, cut, y, cut + 4, y + 8, INK);
  const bars = [2, 1, 2, 2, 1, 2, 1, 1, 2];
  let x = cut + 20;
  for (const w of bars) {
    rect(img, x, y0 + 40, x + w, y1 - 40, INK);
    x += w + 2;
  }
  return cut;
}

export function composeEvent({ name, startsAt, timeZone }) {
  const { planet, tug, after } = pieces();
  const img = sky(990, 345, 2860);
  placeCentered(img, planet, Math.round(300 * PLANET_CROP), 990, 345);
  placeCentered(img, tug, 50, 845, 182);
  placeCentered(img, after, 64, 1054, 506);

  const left = 64;
  const top = 70;
  const fit = fitTitle(name, 700, 280);
  const startY = top + Math.round((280 - fit.height) / 2);
  fit.lines.forEach((line, i) => {
    text(
      img,
      'titulo',
      line,
      left,
      startY + i * fit.lineHeight + CAP * fit.k,
      fit.k,
      ORANGE,
      shadowOf(fit.k),
    );
  });

  const [tx0, ty0, tx1, ty1] = [left, 382, 766, 502];
  const cut = ticket(img, tx0, ty0, tx1, ty1);
  const label = ogDateLabel(startsAt, timeZone);
  let k = 4;
  while (k > 2 && textWidth('titulo', label, k) > cut - (tx0 + 36) - 16) k--;
  text(img, 'titulo', label, tx0 + 36, ty0 + Math.round((ty1 - ty0 + CAP * k) / 2), k, INK);

  text(img, 'texto', 'BOIA.PLANET', left, 572, 2, WHITE);
  return img;
}

// ---------------------------------------------------------------------------
// Salida

export const OG_SITE_FILE = 'planeta.png';

/** Los eventos públicos de la muestra (los mismos que tienen ficha). */
export async function ogEvents() {
  await import(pathToFileURL(join(WEB, '../../packages/world/scripts/ts-resolve.mjs')).href);
  const { SAMPLE_EVENTS } = await import(
    pathToFileURL(join(WEB, '../../packages/store/src/sample/content.ts')).href
  );
  return SAMPLE_EVENTS.filter((e) => e.state !== 'draft');
}

export function encode(img) {
  const png = new PNG({ width: img.width, height: img.height, colorType: 2 });
  // RGB sin alfa: el fondo es opaco y pesa menos.
  for (let i = 0, j = 0; i < img.data.length; i += 4, j += 4) {
    png.data[j] = img.data[i];
    png.data[j + 1] = img.data[i + 1];
    png.data[j + 2] = img.data[i + 2];
    png.data[j + 3] = 255;
  }
  return PNG.sync.write(png, { colorType: 2, deflateLevel: 9 });
}

/** Escribe sólo si cambia (el build no ensucia el repositorio). */
function save(file, img) {
  const bytes = encode(img);
  if (existsSync(file) && readFileSync(file).equals(bytes)) return false;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, bytes);
  return true;
}

async function main() {
  const events = await ogEvents();
  const written = [];
  if (save(join(OG_DIR, OG_SITE_FILE), composeHome())) written.push(OG_SITE_FILE);
  const eventDir = join(OG_DIR, 'eventos');
  const keep = new Set();
  for (const e of events) {
    const file = `${e.slug}.png`;
    keep.add(file);
    if (save(join(eventDir, file), composeEvent(e))) written.push(`eventos/${file}`);
  }
  // Las de eventos que ya no existen, fuera.
  for (const f of existsSync(eventDir) ? readdirSync(eventDir) : []) {
    if (!keep.has(f)) rmSync(join(eventDir, f));
  }
  console.log(
    `og-images: ${1 + events.length} imágenes en public/og/` +
      (written.length ? ` (nuevas o cambiadas: ${written.join(', ')})` : ' (sin cambios)'),
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
