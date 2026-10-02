#!/usr/bin/env node
/**
 * Presupuesto de la ruta crítica de la landing: 192 kB gzip (T14, T29), muy por
 * debajo del de REQ-ARQ-014 (1 MB comprimido para la home crítica).
 * Lee el HTML prerenderizado de `/` tras `next build`, suma el HTML y cada
 * script, hoja de estilos, fuente o imagen que referencia desde /_next/static,
 * todo comprimido con gzip, e imprime el total. Sale con 1 si se pasa.
 *
 * Uso: node scripts/landing-budget.mjs [--json]
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const BUDGET = 192 * 1024;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = join(root, '.next/server/app/index.html');

if (!existsSync(htmlPath)) {
  console.error(`landing-budget: no existe ${htmlPath}; ¿se corrió next build y / es estática?`);
  process.exit(1);
}

const gz = (buf) => gzipSync(buf, { level: 9 }).length;
const html = readFileSync(htmlPath);
// Etiquetas <script>/<link> y, además, los chunks que el runtime de React
// Server Components carga desde el payload inline ("static/chunks/…").
const refs = new Set(
  [
    ...html
      .toString('utf8')
      .matchAll(/(?:\/_next\/)?(static\/(?:chunks|css|media)\/[^"'\\\s?#]+)/g),
  ].map((m) => `/_next/${m[1]}`),
);

// Fuentes precargadas (T74): next/font marca con `.p.` las que precarga, y en
// Linux (Vercel) añade su <link rel="preload">. En Windows no lo añade (su
// plugin busca la ruta del cargador con «/»), así que se toman de las hojas de
// estilo de la ruta para que el total sea el mismo en las dos máquinas.
for (const ref of [...refs].filter((r) => r.endsWith('.css'))) {
  const file = join(root, '.next', ref.replace(/^\/_next\//, ''));
  if (!existsSync(file)) continue;
  const css = readFileSync(file, 'utf8');
  for (const m of css.matchAll(/\/_next\/(static\/media\/[^)"'\s]+\.p\.woff2)/g)) {
    refs.add(`/_next/${m[1]}`);
  }
}

const rows = [{ file: '/ (HTML)', raw: html.length, gzip: gz(html) }];
for (const ref of [...refs].sort()) {
  const file = join(root, '.next', ref.replace(/^\/_next\//, ''));
  if (!existsSync(file)) {
    console.error(`landing-budget: el HTML referencia ${ref} y no está en .next/`);
    process.exit(1);
  }
  const buf = readFileSync(file);
  rows.push({ file: ref, raw: buf.length, gzip: gz(buf) });
}

const total = rows.reduce((s, r) => s + r.gzip, 0);
const kb = (n) => `${(n / 1024).toFixed(1)} kB`;

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ totalGzip: total, budget: BUDGET, files: rows }, null, 2));
} else {
  console.log('\nRuta crítica de la landing (gzip):');
  for (const r of rows) console.log(`  ${kb(r.gzip).padStart(9)}  ${r.file}`);
  console.log(`  ${'-'.repeat(9)}`);
  console.log(
    `  ${kb(total).padStart(9)}  total, ${rows.length} archivos · presupuesto ${kb(BUDGET)} · ${
      total <= BUDGET ? 'OK' : 'EXCEDIDO'
    }\n`,
  );
}

process.exit(total <= BUDGET ? 0 : 1);
