#!/usr/bin/env node
/**
 * Copia los textos de docs/propuestas/textos-zonas.md (T38, `muestra`) al
 * catálogo i18n, una clave por fila de sus tablas (`| \`clave\` | Texto | Nota |`),
 * en dos archivos:
 * - `lib/i18n/es-zonas-web.ts`: las claves que usa la web pública en el
 *   navegador (las que nombran app/(landing) salvo sus page/layout, que son de
 *   servidor, lib/landing y lib/ticketing, y las que sustituyen a una de
 *   es-web.ts). Viajan al navegador en la landing.
 * - `lib/i18n/es-zonas-eventos.ts`: las que sólo usa lib/landing/eventos-copy.ts
 *   (ficha de evento y «Fotos y eventos»), que no viajan en la home.
 * - `lib/i18n/es-zonas.ts`: el resto (el 2D, /mar, el Admin…).
 * El documento manda: si se cambia un texto allí, o la web empieza a usar otra
 * clave, se vuelve a correr esto (`pnpm --filter @boia/web i18n:zonas`).
 * `lib/i18n/zonas.test.ts` comprueba que el catálogo y el documento coinciden.
 *
 * Uso: node scripts/i18n-zonas.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const ZONAS_MD = join(here, '../../../docs/propuestas/textos-zonas.md');
const WEB = join(here, '..');
const OUT = join(WEB, 'lib/i18n/es-zonas.ts');
const OUT_WEB = join(WEB, 'lib/i18n/es-zonas-web.ts');
const OUT_EVENTOS = join(WEB, 'lib/i18n/es-zonas-eventos.ts');
/**
 * Lo que sólo usa la ficha de evento y «Fotos y eventos» (eventos-copy.ts):
 * otra parte del catálogo, para que no viaje en la home.
 */
const EVENTOS_SOURCE = 'lib/landing/eventos-copy.ts';
/** Lo que se pinta en la web pública (y puede ir al navegador en la landing). */
const WEB_SOURCES = ['app/(landing)', 'lib/landing', 'lib/ticketing'];

/** Cadenas con forma de clave (`'a.b'`) en los fuentes de la web pública y en es-web.ts. */
function keysIn(text) {
  return new Set([...text.matchAll(/'([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+)'/g)].map((m) => m[1]));
}

function webKeys() {
  const found = new Set();
  const scan = (text) => {
    for (const m of text.matchAll(/'([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+)'/g)) found.add(m[1]);
  };
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      // page.tsx y layout.tsx son componentes de servidor: usan el catálogo
      // entero (`lib/i18n`) y no viajan al navegador.
      else if (
        /\.tsx?$/.test(e.name) &&
        !/\.test\.|^(page|layout)\.tsx$/.test(e.name) &&
        p !== join(WEB, EVENTOS_SOURCE)
      )
        scan(readFileSync(p, 'utf8'));
    }
  };
  for (const d of WEB_SOURCES) walk(join(WEB, d));
  scan(readFileSync(join(WEB, 'lib/i18n/es-web.ts'), 'utf8'));
  return found;
}

/** Filas `clave → texto` de las tablas del documento, en su orden. */
export function parseZonas(md) {
  const rows = [];
  for (const line of md.split('\n')) {
    if (!line.startsWith('| `')) continue;
    const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split(' | ');
    if (cells.length !== 3) throw new Error(`Fila con ${cells.length} celdas: ${line}`);
    const key = cells[0].trim().replace(/^`|`$/g, '');
    rows.push({ key, text: cells[1].trim() });
  }
  return rows;
}

async function main() {
  const rows = parseZonas(readFileSync(ZONAS_MD, 'utf8'));
  const seen = new Set();
  for (const { key } of rows) {
    if (seen.has(key)) throw new Error(`Clave repetida: ${key}`);
    seen.add(key);
  }
  const web = webKeys();
  const eventos = keysIn(readFileSync(join(WEB, EVENTOS_SOURCE), 'utf8'));
  const inWeb = rows.filter((r) => web.has(r.key));
  const inEventos = rows.filter((r) => !web.has(r.key) && eventos.has(r.key));
  const rest = rows.filter((r) => !web.has(r.key) && !eventos.has(r.key));
  // Con el mismo formato que el resto del repo (prettier de la raíz).
  const prettier = await import('prettier');
  const write = async (file, name, list, what) => {
    const body = list.map(({ key, text }) => `  ${JSON.stringify(key)}: ${JSON.stringify(text)},`);
    const source = `/**
 * GENERADO por scripts/i18n-zonas.mjs desde docs/propuestas/textos-zonas.md
 * (T38, \`muestra\`): ${what}. No se edita a mano: se cambia el documento y se
 * vuelve a generar. ${list.length} claves.
 */
export const ${name} = {
${body.join('\n')}
} as const;
`;
    const options = (await prettier.resolveConfig(file)) ?? {};
    writeFileSync(file, await prettier.format(source, { ...options, filepath: file }));
  };
  await write(OUT_WEB, 'esZonasWeb', inWeb, 'las claves que usa la web pública');
  await write(OUT_EVENTOS, 'esZonasEventos', inEventos, 'las de la ficha de evento y las fotos');
  await write(OUT, 'esZonas', rest, 'las del resto (el 2D, /mar, el Admin…)');
  console.log(
    `es-zonas-web.ts: ${inWeb.length} · es-zonas-eventos.ts: ${inEventos.length} · es-zonas.ts: ${rest.length} claves`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
