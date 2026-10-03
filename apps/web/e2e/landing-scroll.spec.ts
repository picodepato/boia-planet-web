import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZARPAR_HREF } from '../lib/intro/zarpar';

/**
 * The landing as one continuous scroll (plan 007 T79; T77's approved design,
 * docs/propuestas/2026-10-03-landing-scroll.md). `/` plays the appearance and
 * rests with «Zarpar», «Entradas» and the scroll hint; the scroll position
 * drives the three.js scene (the dive to the sea by the port, then the sea
 * into the night) under the content bands; reduced motion gets the static
 * version (T78's still, no WebGL). Read from `window.__boiaIntro.scroll` and
 * `.hero[data-scroll-phase]`. Runs at 375×812 (mobile project) and 1280×800
 * (desktop project).
 *
 * With RECORD_T79=1 it leaves the screenshots in docs/informes/img/
 * (p007-t79-{reposo,zambullida,mar,noche,estatica}-{mobile,desktop}.png).
 */

test.describe.configure({ timeout: 120_000 });

const SIZES = { mobile: { width: 375, height: 812 }, desktop: { width: 1280, height: 800 } };
const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../docs/informes/img',
);

test.beforeEach(async ({ page }, info) => {
  await page.setViewportSize(SIZES[info.project.name as keyof typeof SIZES] ?? SIZES.desktop);
  // Cumulative layout shift from the first paint on (PerformanceObserver).
  await page.addInitScript(() => {
    const w = window as Window & { __cls?: number };
    w.__cls = 0;
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as (PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
        })[]) {
          if (!e.hadRecentInput) w.__cls! += e.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {
      /* sin la API, sin medida */
    }
  });
});

async function snap(page: Page, name: string) {
  if (!process.env.RECORD_T79) return;
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({
    path: path.join(OUT, `p007-t79-${name}-${test.info().project.name}.png`),
    scale: 'css',
  });
}

const hero = (page: Page) => page.locator('.hero');
const zarpar = (page: Page) => hero(page).getByRole('link', { name: 'Zarpar', exact: true });
const entradas = (page: Page) => hero(page).getByRole('link', { name: 'Entradas', exact: true });
const scrollPhase = (page: Page) => page.evaluate(() => window.__boiaIntro?.scroll.phase ?? null);
const cls = (page: Page) => page.evaluate(() => (window as Window & { __cls?: number }).__cls ?? 0);
const landingViews = (page: Page) =>
  page.evaluate(() =>
    (window.__boiaAnalytics ?? [])
      .filter((e) => e.event === 'landing_view')
      .map((e) => e.properties.intro),
  );

/** Scroll to `y` px and wait until the scene (smoothed) reports `phase`. */
async function scrollTo(page: Page, y: number, phase?: 'rest' | 'dive' | 'sea') {
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
  if (phase) {
    await page.waitForFunction((p) => window.__boiaIntro?.scroll.phase === p, phase, {
      timeout: 20_000,
    });
    await expect(hero(page)).toHaveAttribute('data-scroll-phase', phase);
  }
}

/** Fully inside the viewport, without scrolling. */
async function onScreen(
  page: Page,
  name: string,
  box: { x: number; y: number; width: number; height: number } | null,
) {
  const vp = page.viewportSize()!;
  expect(box, name).not.toBeNull();
  expect(box!.y, `${name} empieza en pantalla`).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height, `${name} acaba sobre el pliegue`).toBeLessThanOrEqual(vp.height);
}

test('«Entradas» y «Zarpar» en el primer pintado; reposo; un viewport de scroll es el mar y volver lo deshace; sin saltos de maquetación', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-entry', 'intro');
  // First paint: both pills on screen, while the appearance has not finished.
  await expect(zarpar(page)).toBeVisible();
  await expect(entradas(page)).toBeVisible();
  await onScreen(page, 'Zarpar', await zarpar(page).boundingBox());
  await onScreen(page, 'Entradas', await entradas(page).boundingBox());
  expect(await zarpar(page).getAttribute('href')).toBe(ZARPAR_HREF);

  // After the appearance: the rest.
  await page.waitForFunction(() => window.__boiaIntro?.phase === 'paused', null, {
    timeout: 30_000,
  });
  expect(await scrollPhase(page)).toBe('rest');
  await expect(hero(page)).toHaveAttribute('data-scroll-phase', 'rest');
  // Nothing widens the page (a phone would zoom out).
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    page.viewportSize()!.width,
  );
  expect(await page.evaluate(() => window.__boiaIntro!.history)).toEqual([
    'waiting',
    'appearing',
    'paused',
  ]);
  await expect(page.locator('.hero__hint')).toBeVisible();
  await expect(page.locator('.site-header__inner'), 'la cabecera espera al mar').toBeHidden();
  await expect(page.locator('canvas[data-scene="boia-intro-scene"]')).toHaveCount(1);
  await page.waitForTimeout(800);
  await snap(page, 'reposo');
  expect(await landingViews(page), 'la vista de la landing cuenta al pasar el hero').toEqual([]);

  const H = page.viewportSize()!.height;
  // Mid-dive: the hero UI is gone.
  await scrollTo(page, H * 0.5, 'dive');
  await expect(zarpar(page)).toBeHidden();
  await page.waitForTimeout(600);
  await snap(page, 'zambullida');

  // One viewport down: the sea by the port, the first band on screen.
  await scrollTo(page, H, 'sea');
  const band = page.locator('main > .section').first();
  const box = (await band.boundingBox())!;
  expect(box.y, 'la primera banda sube del mar').toBeLessThan(H);
  expect(box.y + box.height).toBeGreaterThan(0);
  await expect(band.getByRole('heading').first()).toBeInViewport();
  await expect(page.locator('.site-header__inner')).toBeVisible();
  await expect.poll(() => landingViews(page)).toEqual(['played']);
  await page.waitForFunction(() => (window.__boiaIntro?.props ?? 0) > 0, null, { timeout: 20_000 });
  await page.waitForTimeout(1200);
  await snap(page, 'mar');

  // Back up: the rest again, «Zarpar» on screen.
  await scrollTo(page, 0, 'rest');
  await expect(zarpar(page)).toBeVisible();

  // Scripted scroll to the photos (night) and the footer.
  for (let y = 0; y < H * 4; y += H / 3) await scrollTo(page, y);
  await page.evaluate(() => {
    const f = document.getElementById('fotos')!;
    window.scrollTo({
      top: f.getBoundingClientRect().top + scrollY - innerHeight * 0.35,
      behavior: 'instant',
    });
  });
  await page.waitForFunction(() => (window.__boiaIntro?.scroll.light ?? 0) >= 0.99, null, {
    timeout: 20_000,
  });
  await page.waitForTimeout(1200);
  await snap(page, 'noche');
  await scrollTo(page, await page.evaluate(() => document.body.scrollHeight));
  expect(await landingViews(page), 'una vez').toEqual(['played']);
  expect(await cls(page), 'CLS de la carga y del scroll').toBeLessThan(0.05);
});

test('«Zarpar» lleva a /mar (D-24)', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__boiaIntro?.phase === 'paused', null, {
    timeout: 30_000,
  });
  await expect(zarpar(page)).toHaveAttribute('href', ZARPAR_HREF);
  await zarpar(page).click();
  await expect(page).toHaveURL(/\/mar(\?|$)/, { timeout: 30_000 });
});

test('`/#tickets` y `/?intro=0` abren en reposo, sin la aparición', async ({ page }) => {
  await page.goto('/#tickets');
  await expect(page.locator('html')).toHaveAttribute('data-entry', 'direct');
  await expect(page.getByRole('dialog', { name: 'Elige tu evento' })).toBeVisible();
  await page.waitForFunction(() => window.__boiaIntro?.phase === 'paused');
  expect(await page.evaluate(() => window.__boiaIntro!.history)).toEqual(['paused']);
  expect(await scrollPhase(page)).toBe('rest');

  await page.goto('/?intro=0');
  await expect(page.locator('html')).toHaveAttribute('data-entry', 'direct');
  await expect(page.locator('html')).not.toHaveAttribute('data-intro', /.*/);
  await page.waitForFunction(() => window.__boiaIntro?.phase === 'paused');
  const d = (await page.evaluate(() => window.__boiaIntro))!;
  expect(d.history).toEqual(['paused']);
  expect(d.outcome).toBe('none');
  expect(d.scroll.phase).toBe('rest');
  await expect(zarpar(page)).toBeVisible();
  await expect(page.locator('.hero__wordmark')).toBeVisible();
  expect(await cls(page)).toBeLessThan(0.05);
});

test('el pie lleva el logo de BOIA; Spotify son enlaces sin nada cargado de Spotify', async ({
  page,
}) => {
  const hosts: string[] = [];
  page.on('request', (r) => hosts.push(new URL(r.url()).hostname));
  await page.goto('/?intro=0');
  await page.waitForFunction(() => window.__boiaIntro?.phase === 'paused');
  await scrollTo(page, await page.evaluate(() => document.body.scrollHeight));
  const logo = page.locator('.site-footer').getByRole('img', { name: 'BOIA', exact: true });
  await expect(logo).toBeVisible();
  expect((await logo.boundingBox())!.width, 'grande').toBeGreaterThan(
    page.viewportSize()!.width * 0.5,
  );

  const listen = page.locator('#artistas a[href*="spotify"]').first();
  await expect(listen).toHaveAttribute('target', '_blank');
  expect(await listen.getAttribute('rel')).toContain('noopener');
  for (const a of await page.locator('a[href*="spotify"]').all()) {
    await expect(a).toHaveAttribute('target', '_blank');
    expect(await a.getAttribute('rel')).toContain('noopener');
  }
  expect(await page.locator('#artistas .artist-card__spotify').count()).toBeGreaterThan(0);
  await page.waitForTimeout(500);
  expect(hosts.filter((h) => /spotify|scdn\.co/i.test(h))).toEqual([]);
});

test.describe('movimiento reducido', () => {
  test.use({ reducedMotion: 'reduce' });

  test('la versión estática: sin WebGL, con el still, la misma maquetación', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-hero', 'still');
    await page.waitForFunction(() => window.__boiaIntro?.phase === 'paused');
    const still = page.locator('.hero__still-img').first();
    await expect(still).toBeVisible();
    await expect
      .poll(() => still.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
      .toBeGreaterThan(0);
    await page.waitForTimeout(1000);
    await expect(page.locator('canvas[data-scene]')).toHaveCount(0);
    const d = (await page.evaluate(() => window.__boiaIntro))!;
    expect(d.fallback).toBe(true);
    expect(d.scenesCreated).toBe(0);
    await expect(zarpar(page)).toBeVisible();
    await expect(entradas(page)).toBeVisible();
    await onScreen(page, 'Entradas', await entradas(page).boundingBox());
    await snap(page, 'estatica');
    expect(await cls(page)).toBeLessThan(0.05);
  });
});
