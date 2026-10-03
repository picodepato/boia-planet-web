import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eventHref } from '../lib/landing/eventos';
import { SAMPLE_CONTENT } from '../lib/landing/sample-content';
import { openMar } from './mar-helpers';

/**
 * Tipografías de toda la web (plan 006 T74): los títulos con la display
 * (`--font-display`, la parecida a Druk Wide Medium) y el texto con Inter
 * (`--font-text`), ambas de lib/fonts.ts. Se comprueba la familia calculada
 * del h1 de la landing, del título de una hoja de /mar y del texto, que las
 * dos fuentes cargan (document.fonts) y que ningún título desborda el ancho
 * en las páginas de la web.
 *
 * Con RECORD_T74=1 deja capturas en docs/informes/img/ p006-t74-*.png.
 */

test.describe.configure({ timeout: 120_000 });

const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../docs/informes/img',
);

async function snap(page: Page, name: string) {
  if (!process.env.RECORD_T74) return;
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({
    path: path.join(OUT, `p006-t74-${name}-${test.info().project.name}.png`),
  });
}

/** La primera familia de una variable de fuente de <html> (la que define lib/fonts.ts). */
async function familyOf(page: Page, variable: '--font-display' | '--font-text'): Promise<string> {
  const value = await page.evaluate(
    (v) => getComputedStyle(document.documentElement).getPropertyValue(v),
    variable,
  );
  const first = value
    .split(',')[0]!
    .trim()
    .replace(/^['"]|['"]$/g, '');
  expect(first, `${variable} en <html>`).not.toBe('');
  return first;
}

async function firstFamily(el: Locator): Promise<string> {
  return el.evaluate((node) =>
    getComputedStyle(node)
      .fontFamily.split(',')[0]!
      .trim()
      .replace(/^['"]|['"]$/g, ''),
  );
}

/** Las caras de esa familia que el documento ya cargó. */
async function loadedFaces(page: Page, family: string): Promise<number> {
  return page.evaluate(async (fam) => {
    await document.fonts.ready;
    return [...document.fonts].filter(
      (f) => f.family.replace(/^['"]|['"]$/g, '') === fam && f.status === 'loaded',
    ).length;
  }, family);
}

async function expectFonts(page: Page, title: Locator, body: Locator) {
  const display = await familyOf(page, '--font-display');
  const text = await familyOf(page, '--font-text');
  expect(display).not.toBe(text);
  expect(await firstFamily(title)).toBe(display);
  expect(await firstFamily(body)).toBe(text);
  await expect.poll(() => loadedFaces(page, display), { timeout: 15_000 }).toBeGreaterThan(0);
  await expect.poll(() => loadedFaces(page, text), { timeout: 15_000 }).toBeGreaterThan(0);
}

/** Ningún título se sale de la ventana ni de su caja por la anchura de la display. */
async function expectTitlesFit(page: Page) {
  const over = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('h1, h2, h3')]
      .filter((h) => h.offsetParent !== null && getComputedStyle(h).overflow === 'visible')
      .filter((h) => {
        const r = h.getBoundingClientRect();
        return r.right > window.innerWidth + 1 || h.scrollWidth > h.clientWidth + 1;
      })
      .map((h) => h.textContent?.trim()),
  );
  expect(over).toEqual([]);
}

test('landing: el h1 con la display, el texto con Inter, y las dos cargan', async ({ page }) => {
  await page.goto('/?intro=0');
  const h1 = page.locator('h1').first();
  await expect(h1).toBeVisible();
  await expectFonts(page, h1, page.locator('body'));
  // El texto de verdad, no sólo <body>: los rótulos de esquina del hero
  // (plan 007: el primer <p> del hero es ahora «BOIA», con la display).
  const p = page.locator('.hero .hero__corner').first();
  await expect(p).toBeVisible();
  expect(await firstFamily(p)).toBe(await familyOf(page, '--font-text'));
  expect(await firstFamily(page.locator('.hero__wordmark'))).toBe(
    await familyOf(page, '--font-display'),
  );
  await expectTitlesFit(page);
  await snap(page, 'landing');
});

test('/mar: el título de la hoja con la display y su texto con Inter', async ({ page }) => {
  const errors = await openMar(page, '?menu=bienvenida');
  await page.getByTestId('mar-bienvenida-entradas').click();
  const sheet = page.getByTestId('mar-entradas-panel');
  await expect(sheet).toBeVisible();
  const title = sheet.locator('h2').first();
  await expect(title).toBeVisible();
  const body = sheet.locator('p, li').first();
  await expectFonts(page, title, body);
  expect(await firstFamily(page.locator('main.mar'))).toBe(await familyOf(page, '--font-text'));
  await expectTitlesFit(page);
  await snap(page, 'mar-hoja');
  expect(errors).toEqual([]);
});

const PAGES = [
  { name: 'evento', url: eventHref(SAMPLE_CONTENT.events[0]!.slug) },
  { name: 'fotos', url: '/fotos' },
  { name: 'artistas', url: '/artistas' },
  { name: 'legal', url: '/legal/privacidad' },
  { name: 'carnet', url: '/carnet' },
  { name: 'admin', url: '/admin' },
] as const;

for (const { name, url } of PAGES) {
  test(`${name}: títulos con la display, texto con Inter, sin desbordes`, async ({ page }) => {
    await page.goto(url);
    const title = page.locator('h1, h2').first();
    await expect(title).toBeVisible();
    await expectFonts(page, title, page.locator('body'));
    await expectTitlesFit(page);
    await snap(page, name);
  });
}
