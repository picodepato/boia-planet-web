import { expect, type Page } from '@playwright/test';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { ADMIN_CARNET_LABEL, DEMO_ADMIN_SESSION_KEY } from '../../lib/admin/demo-auth';
import { FUENTE_EMOJI } from './fuente-emoji';

/**
 * Ayudas de las capturas de la presentación (plan 018, `pnpm deck:capturas`).
 * Un spec de parte (`NN-slug.deck.ts`) abre una pantalla, la deja como debe
 * verse y llama a `shot(page, 'NN', 'nombre')`, que guarda
 * `docs/presentacion/capturas/NN-slug/nombre.jpg`. Para el mar 3D sirven
 * `openMar`, `steerTo` y `sheetIs` de `../mar-helpers` y los parámetros de
 * `app/mar/deep-link.ts`.
 */

const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url));
const PARTES = join(RAIZ, 'docs', 'presentacion', 'partes');
const CAPTURAS = join(RAIZ, 'docs', 'presentacion', 'capturas');

/** La carpeta de capturas de la parte NN: se llama como su archivo (`02-landing`). */
export function carpetaDe(parte: string): string {
  if (!/^\d\d$/.test(parte)) throw new Error(`parte «${parte}»: dos cifras, como '02'`);
  const archivo = readdirSync(PARTES).find((f) => f.startsWith(`${parte}-`) && f.endsWith('.ts'));
  if (!archivo) throw new Error(`no hay docs/presentacion/partes/${parte}-*.ts`);
  return join(CAPTURAS, archivo.replace(/\.ts$/, ''));
}

/** Espera dos fotogramas del navegador. */
const dosFotogramas = (page: Page) =>
  page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );

const URL_EMOJI = '/__deck/noto-color-emoji.ttf';
const conRutaEmoji = new WeakSet<Page>();

/**
 * Noto Color Emoji en la página (T209): Windows 10 no tiene los emoji nuevos
 * (🪪). Se sirve la fuente que descarga `fuente-emoji.ts` y se añade, sólo
 * para los emoji (`unicode-range`), a cada familia de fuentes de la página
 * (las de next/font): el texto se ve igual y los emoji salen pintados. Se
 * rehace en cada foto por si la página ha navegado o tiene fuentes nuevas.
 */
async function ponerEmoji(page: Page): Promise<void> {
  if (!conRutaEmoji.has(page)) {
    conRutaEmoji.add(page);
    await page.route(`**${URL_EMOJI}`, (route) =>
      route.fulfill({ path: FUENTE_EMOJI, contentType: 'font/ttf' }),
    );
  }
  await page.evaluate(async (url) => {
    const rango = 'U+200D, U+20E3, U+FE0F, U+1F000-1FAFF, U+E0020-E007F';
    const limpia = (f: string) => f.trim().replace(/^["']|["']$/g, '');
    const familias = new Set<string>(['DeckEmoji']);
    document.fonts.forEach((f) => {
      familias.add(limpia(f.family));
    });
    const css = [...familias]
      .map(
        (f) =>
          `@font-face{font-family:"${f}";src:url("${url}") format("truetype");` +
          'font-weight:1 1000;font-stretch:50% 200%;font-style:normal;font-display:block;' +
          `unicode-range:${rango};}`,
      )
      .join('\n');
    let estilo = document.getElementById('deck-emoji');
    if (!estilo) {
      estilo = document.createElement('style');
      estilo.id = 'deck-emoji';
      document.head.appendChild(estilo);
    }
    if (estilo.textContent !== css) estilo.textContent = css;
    await Promise.all(
      [...familias].map((f) => document.fonts.load(`20px "${f}"`, '\u{1FAAA}').catch(() => [])),
    );
  }, URL_EMOJI);
}

/**
 * La pantalla lista para la foto: emoji nuevos (`ponerEmoji`), fuentes cargadas, sin pantalla de carga del
 * mar, imágenes visibles terminadas, los canvas con tamaño y un respiro para
 * que el 3D pinte.
 */
export async function listo(page: Page, { respiro = 600 } = {}): Promise<void> {
  await ponerEmoji(page);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 45_000 });
  await page
    .waitForFunction(
      () =>
        [...document.images]
          .filter((img) => {
            const b = img.getBoundingClientRect();
            return b.width > 0 && b.bottom > 0 && b.top < window.innerHeight;
          })
          .every((img) => img.complete),
      null,
      { timeout: 15_000 },
    )
    .catch(() => undefined);
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('canvas')].every((c) => {
        const b = c.getBoundingClientRect();
        return b.width === 0 || (c.width > 0 && c.height > 0);
      }),
    null,
    { timeout: 15_000 },
  );
  await dosFotogramas(page);
  await page.waitForTimeout(respiro);
}

/** Desviación típica de la luz (0–255) de la pantalla: casi 0 es un color liso. */
async function contraste(page: Page): Promise<number> {
  const png = PNG.sync.read(await page.screenshot({ type: 'png', scale: 'css' }));
  let suma = 0;
  let suma2 = 0;
  let n = 0;
  for (let i = 0; i < png.data.length; i += 16) {
    const l = 0.299 * png.data[i]! + 0.587 * png.data[i + 1]! + 0.114 * png.data[i + 2]!;
    suma += l;
    suma2 += l * l;
    n++;
  }
  const media = suma / n;
  return Math.sqrt(Math.max(0, suma2 / n - media * media));
}

export interface OpcionesShot {
  /** La página entera en vez de la pantalla (para secciones largas). */
  fullPage?: boolean;
  /** Milisegundos de espera extra antes de la foto (3D, animaciones). */
  respiro?: number;
  /** Una captura casi vacía (de un solo color) falla salvo con esto. */
  permitirVacia?: boolean;
}

/**
 * Guarda la captura `nombre` de la parte `parte` en JPEG comprimido. Falla
 * si sale casi vacía (pantalla en blanco o negra, 3D sin pintar).
 */
export async function shot(
  page: Page,
  parte: string,
  nombre: string,
  { fullPage = false, respiro, permitirVacia = false }: OpcionesShot = {},
): Promise<string> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(nombre))
    throw new Error(`captura «${nombre}»: minúsculas, cifras y guiones, sin extensión`);
  const carpeta = carpetaDe(parte);
  await listo(page, respiro === undefined ? {} : { respiro });
  if (!permitirVacia) {
    const variacion = await contraste(page);
    if (variacion < 6)
      throw new Error(
        `captura «${nombre}» casi vacía (desviación de luz ${variacion.toFixed(1)}): ¿pantalla de carga o 3D sin pintar?`,
      );
  }
  const jpeg = await page.screenshot({ type: 'jpeg', quality: 72, fullPage, caret: 'hide' });
  mkdirSync(carpeta, { recursive: true });
  const ruta = join(carpeta, `${nombre}.jpg`);
  writeFileSync(ruta, jpeg);
  return ruta;
}

/**
 * Entra como el Admin de la demo (Carnet 000) en el proyecto móvil; el
 * proyecto `escritorio` ya entra con la sesión puesta.
 */
export async function comoAdmin(page: Page): Promise<void> {
  await page.addInitScript(
    ([clave, carnet]) => {
      localStorage.setItem(clave, JSON.stringify({ carnet, at: Date.now() }));
    },
    [DEMO_ADMIN_SESSION_KEY, ADMIN_CARNET_LABEL] as const,
  );
}
