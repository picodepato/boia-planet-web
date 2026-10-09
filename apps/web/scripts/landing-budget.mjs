#!/usr/bin/env node
/**
 * Presupuesto de la ruta crítica de la landing: 200 kB gzip (T14, T29; Hernán
 * lo subió de 192 a 200 kB el 2026-10-03, plan 007), muy por
 * debajo del de REQ-ARQ-014 (1 MB comprimido para la home crítica).
 * Lee el HTML prerenderizado de `/` tras `next build`, suma el HTML y cada
 * script, hoja de estilos, fuente o imagen que referencia desde /_next/static,
 * todo comprimido con gzip, e imprime el total. Sale con 1 si se pasa.
 *
 * Report (plan 022 T238): the total by kind (HTML, JS, CSS, media), the share
 * of the `noModule` polyfills (counted, though modern browsers never fetch
 * them) and, with `--baseline <file>` (a `--json` output saved before a
 * change), the before → after of each kind. The cap and the total count as
 * before.
 *
 * Uso: node scripts/landing-budget.mjs [--json] [--baseline <archivo.json>]
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const BUDGET = 200 * 1024;
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

// Fuentes precargadas (T74; desde T213 la de títulos es un TTF): next/font
// marca con `.p.` las que precarga, y en
// Linux (Vercel) añade su <link rel="preload">. En Windows no lo añade (su
// plugin busca la ruta del cargador con «/»), así que se toman de las hojas de
// estilo de la ruta para que el total sea el mismo en las dos máquinas.
for (const ref of [...refs].filter((r) => r.endsWith('.css'))) {
  const file = join(root, '.next', ref.replace(/^\/_next\//, ''));
  if (!existsSync(file)) continue;
  const css = readFileSync(file, 'utf8');
  for (const m of css.matchAll(/\/_next\/(static\/media\/[^)"'\s]+\.p\.(?:woff2|ttf))/g)) {
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

/** HTML, JS, CSS or media: what a before/after compares (file names carry hashes). */
const KINDS = ['html', 'js', 'css', 'media'];
const kindOf = (file) =>
  file.startsWith('/ ')
    ? 'html'
    : file.endsWith('.js')
      ? 'js'
      : file.endsWith('.css')
        ? 'css'
        : 'media';
const sumByKind = (files) => {
  const out = { html: 0, js: 0, css: 0, media: 0 };
  for (const r of files) out[kindOf(r.file)] += r.gzip;
  return out;
};
const byKind = sumByKind(rows);

// Scripts the HTML loads with `noModule`: counted, but only old browsers fetch them.
const noModule = new Set(
  [...html.toString('utf8').matchAll(/<script[^>]*\ssrc="([^"]+)"[^>]*\snoModule[^>]*>/gi)].map(
    (m) => m[1],
  ),
);
const noModuleGzip = rows.filter((r) => noModule.has(r.file)).reduce((s, r) => s + r.gzip, 0);

// --baseline <file>: a `--json` output saved before a change.
const at = process.argv.indexOf('--baseline');
const baselinePath = at > 0 ? process.argv[at + 1] : undefined;
let baseline = null;
if (baselinePath) {
  if (!existsSync(baselinePath)) {
    console.error(`landing-budget: no existe la referencia ${baselinePath}`);
    process.exit(1);
  }
  const b = JSON.parse(readFileSync(baselinePath, 'utf8'));
  baseline = { total: b.totalGzip, byKind: b.byKind ?? sumByKind(b.files) };
}

if (process.argv.includes('--json')) {
  const out = { totalGzip: total, budget: BUDGET, byKind, noModuleGzip, files: rows };
  console.log(JSON.stringify(out, null, 2));
} else {
  console.log('\nRuta crítica de la landing (gzip):');
  for (const r of rows) console.log(`  ${kb(r.gzip).padStart(9)}  ${r.file}`);
  console.log(`  ${'-'.repeat(9)}`);
  console.log(
    `  ${kb(total).padStart(9)}  total, ${rows.length} archivos · presupuesto ${kb(BUDGET)} · ${
      total <= BUDGET ? 'OK' : 'EXCEDIDO'
    }`,
  );
  const kinds = KINDS.map((k) => `${k === 'media' ? k : k.toUpperCase()} ${kb(byKind[k])}`);
  console.log(`  por tipo: ${kinds.join(' · ')}`);
  console.log(
    `  de ellos, ${kb(noModuleGzip)} son polyfills «noModule» (sólo los descargan navegadores antiguos)`,
  );
  if (baseline) {
    const delta = (a, b) => `${b <= a ? '−' : '+'}${kb(Math.abs(b - a))}`;
    const line = (label, a, b) =>
      console.log(
        `    ${label.padEnd(5)} ${kb(a).padStart(9)} → ${kb(b).padStart(9)}  (${delta(a, b)})`,
      );
    console.log(`  antes → ahora (${baselinePath}):`);
    for (const k of KINDS) line(k === 'media' ? k : k.toUpperCase(), baseline.byKind[k], byKind[k]);
    line('total', baseline.total, total);
  }
  console.log('');
}

process.exit(total <= BUDGET ? 0 : 1);
