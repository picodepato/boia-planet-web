import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { t } from '../lib/i18n';
import { ZARPAR_HREF } from '../lib/intro/zarpar';
import { SAMPLE_CONTENT } from '../lib/landing/sample-content';
import { lowContrast, measureContrast } from './contrast';

/**
 * The landing as one continuous scroll (plan 007 T79; T77's approved design,
 * docs/propuestas/2026-10-03-landing-scroll.md). `/` plays the appearance and
 * rests with «Zarpar» and the scroll hint (since 2026-10-08, decision 4, the
 * hero has no «Entradas»: it is in the header, past the hero); the scroll position
 * drives the three.js scene (the dive to the sea by the port, then the sea
 * into the night) under the content bands; reduced motion gets the static
 * version (T78's still, no WebGL). Read from `window.__boiaIntro.scroll` and
 * `.hero[data-scroll-phase]`. Runs at 375×812 (mobile project) and 1280×800
 * (desktop project).
 *
 * Accessibility and the whole flow (plan 007 T81, T77 §10): axe reports no
 * violation at all (any impact) at rest, after the dive and at the footer,
 * with and without the Tickets panel; the text over the scene keeps WCAG AA
 * contrast measured on the pixels (`contrast.ts`), on the live scene, the
 * still and the night; the skip link, «Zarpar» and the hint are
 * reached by keyboard in that order with the white ring; Escape and Back
 * close the panel; reduced motion moves nothing by itself; Back from /mar,
 * no WebGL and a slow scene keep the flow.
 *
 * With RECORD_T79=1 it leaves the screenshots in docs/informes/img/
 * (p007-t79-{reposo,zambullida,mar,noche,estatica}-{mobile,desktop}.png);
 * with RECORD_T81=1, p007-t81-{reposo,bloques,pie,reducido}-{mobile,desktop}.png.
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

async function snap(page: Page, name: string, task: 'T79' | 'T81' = 'T79') {
  if (!process.env[`RECORD_${task}`]) return;
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({
    path: path.join(OUT, `p007-${task.toLowerCase()}-${name}-${test.info().project.name}.png`),
    scale: 'css',
  });
}

const hero = (page: Page) => page.locator('.hero');
const zarpar = (page: Page) => hero(page).getByRole('link', { name: 'Zarpar', exact: true });
/** The hero's old «Entradas»: gone since decision 4 (2026-10-08). */
const entradas = (page: Page) =>
  hero(page).getByRole('link', { name: t('hero.tickets'), exact: true });
const headerEntradas = (page: Page) =>
  page.locator('.site-header').getByRole('link', { name: t('nav.tickets'), exact: true });
const hint = (page: Page) => hero(page).getByRole('button', { name: t('hero.scrollHint') });
const skipLink = (page: Page) =>
  page.getByRole('link', { name: t('nav.skipToContent'), exact: true });
const ticketsPanel = (page: Page) => page.getByRole('dialog', { name: t('tickets.heading') });
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

/**
 * A real pointer click at the centre of `el`, as a visitor makes it.
 * Playwright's `click()` first scrolls the target "into view", and on the
 * sticky hero UI and the fixed header Chrome scrolls the page for that: the
 * scene would dive and the page would not be where the visitor left it.
 */
async function tap(page: Page, el: Locator) {
  await expect(el).toBeVisible();
  await expect(el).toBeInViewport();
  const b = (await el.boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
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

test('«Zarpar», sin «Entradas», en el primer pintado; reposo; un viewport de scroll es el mar y volver lo deshace; sin saltos de maquetación', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-entry', 'intro');
  // First paint: «Zarpar» on screen, while the appearance has not finished.
  await expect(zarpar(page)).toBeVisible();
  await expect(entradas(page)).toHaveCount(0);
  await onScreen(page, 'Zarpar', await zarpar(page).boundingBox());
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

  // Back to the top: the rest again, the header waits, one scene all along.
  await scrollTo(page, 0, 'rest');
  await expect(zarpar(page)).toBeVisible();
  await expect(entradas(page)).toHaveCount(0);
  await expect(page.locator('.hero__hint')).toBeVisible();
  await expect(page.locator('.site-header__inner')).toBeHidden();
  const d = (await page.evaluate(() => window.__boiaIntro))!;
  expect(d.scenesCreated).toBe(1);
  expect(d.history).toEqual(['waiting', 'appearing', 'paused']);
  expect(await landingViews(page), 'una vez, también al volver').toEqual(['played']);
});

test('«Zarpar» lleva a /mar (D-24)', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__boiaIntro?.phase === 'paused', null, {
    timeout: 30_000,
  });
  await expect(zarpar(page)).toHaveAttribute('href', ZARPAR_HREF);
  await tap(page, zarpar(page));
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
    await expect(entradas(page)).toHaveCount(0);
    await snap(page, 'estatica');
    expect(await cls(page)).toBeLessThan(0.05);
  });
});

// ---------- Accessibility and the whole flow (plan 007 T81) ----------

/** Every axe violation, of any impact (T81: none at all). */
async function axeViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.map(
    (v) => `${v.impact} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
  );
}

/** No violation, and every run of text on screen at WCAG AA over what is behind it. */
async function accessibleHere(page: Page, where: string) {
  // The CSS transitions of what just came in (header, bands) end first.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
  );
  expect(await axeViolations(page), `axe: ${where}`).toEqual([]);
  const runs = await measureContrast(page);
  expect(runs.length, `texto medido: ${where}`).toBeGreaterThan(0);
  expect(lowContrast(runs), `contraste: ${where}`).toEqual([]);
}

/** Focused, on screen, with the one ring of T77 §10 (white, dark halo). */
async function ringed(el: Locator, name: string) {
  await expect(el, `${name} tiene el foco`).toBeFocused();
  await expect(el, `${name} en pantalla`).toBeInViewport();
  const ring = await el.evaluate((e) => {
    const c = getComputedStyle(e);
    return {
      visible: e.matches(':focus-visible'),
      style: c.outlineStyle,
      width: c.outlineWidth,
      color: c.outlineColor,
      halo: c.boxShadow,
      // T214: the white sheet below the hero inverts the ring (black, white halo).
      paper: !!e.closest('#contenido > .section, .site-footer'),
    };
  });
  expect(ring, `${name}: anillo de foco`).toMatchObject({
    visible: true,
    style: 'solid',
    width: '3px',
    color: ring.paper ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)',
  });
  expect(ring.halo, `${name}: halo`).toContain(ring.paper ? 'rgb(255, 255, 255)' : 'rgb(5, 8, 15)');
}

const restAfterAppearance = (page: Page) =>
  page.waitForFunction(() => window.__boiaIntro?.phase === 'paused', null, { timeout: 30_000 });

/** Scroll position (px), read now. */
const pageY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));

/** No WebGL: `getContext('webgl*')` gives nothing. */
const withoutWebGL = (page: Page) =>
  page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (/webgl/i.test(type)) return null;
      return (original as (...a: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });

/** Serves the JS chunks; the scene's (three.js and the planet) goes through `withScene`. */
async function onSceneChunk(page: Page, withScene: (route: Route, body: string) => Promise<void>) {
  const hits: string[] = [];
  await page.route(/\/_next\/static\/chunks\/.*\.js$/, async (route) => {
    const res = await route.fetch();
    const body = await res.text();
    if (body.includes('boia-intro-scene')) {
      hits.push(route.request().url());
      return withScene(route, body);
    }
    return route.fulfill({ response: res, body });
  });
  return hits;
}

const firstBandHeading = (page: Page) =>
  page.locator('main > .section').first().getByRole('heading').first();

test('accesibilidad: axe sin violaciones y contraste AA en reposo, tras la zambullida, de noche y en el pie, con y sin el panel; Escape y Atrás cierran el panel', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await restAfterAppearance(page);
  await page.waitForTimeout(600);

  // The scene is decoration: hidden from assistive tech, never focusable.
  const canvas = page.locator('canvas[data-scene="boia-intro-scene"]');
  await expect(canvas).toHaveAttribute('aria-hidden', 'true');
  await expect(canvas).toHaveAttribute('role', 'presentation');
  await expect(page.locator('.hero__scene')).toHaveAttribute('aria-hidden', 'true');
  for (const img of await page.locator('.hero__still-img').all())
    await expect(img).toHaveAttribute('alt', '');
  await expect(hint(page), 'la pista tiene texto').toHaveText(t('hero.scrollHint'));
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

  // At rest (the live scene, «Zarpar» focused as the appearance ends).
  await accessibleHere(page, 'reposo');
  await snap(page, 'reposo', 'T81');

  // After the dive: the sea by the port and the first band.
  const H = page.viewportSize()!.height;
  await scrollTo(page, H, 'sea');
  await page.waitForTimeout(800);
  await expect(
    page.getByRole('heading', { level: 1 }),
    'el h1 sigue tras la zambullida',
  ).toHaveCount(1);
  await accessibleHere(page, 'tras la zambullida');
  await scrollTo(page, H * 1.6);
  await page.waitForTimeout(800);
  await snap(page, 'bloques', 'T81');
  await accessibleHere(page, 'bandas');
  // The panel from the header; Back closes it where the visitor was.
  const before = await pageY(page);
  await tap(page, headerEntradas(page));
  await expect(ticketsPanel(page)).toBeVisible();
  await page.waitForTimeout(300);
  await accessibleHere(page, 'bandas con el panel');
  await page.goBack();
  await expect(ticketsPanel(page)).toBeHidden();
  expect(new URL(page.url()).hash).toBe('');
  await expect(page).toHaveURL(/\/$/);
  expect(Math.abs((await pageY(page)) - before), 'Atrás no mueve la página').toBeLessThanOrEqual(2);
  await expect(headerEntradas(page)).toBeFocused();

  // The night, at the photos.
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
  await page.waitForTimeout(800);
  await accessibleHere(page, 'noche');

  // The footer, with and without the panel (closed with its button).
  await scrollTo(page, await page.evaluate(() => document.body.scrollHeight));
  await page.waitForTimeout(800);
  await accessibleHere(page, 'pie');
  await snap(page, 'pie', 'T81');
  await tap(page, headerEntradas(page));
  await expect(ticketsPanel(page)).toBeVisible();
  await page.waitForTimeout(300);
  await accessibleHere(page, 'pie con el panel');
  await tap(page, ticketsPanel(page).getByRole('link', { name: t('tickets.close') }));
  await expect(ticketsPanel(page)).toBeHidden();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
});

test('teclado: salto al contenido → «Zarpar» → la pista, con el anillo de foco; la pista baja al mar y el Tab sigue por las bandas', async ({
  page,
}) => {
  await page.goto('/');
  await restAfterAppearance(page);
  // The rest gives «Zarpar» the focus (Enter sails); before it, the skip link.
  await expect(zarpar(page)).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await ringed(skipLink(page), 'Saltar al contenido');
  await page.keyboard.press('Tab');
  await ringed(zarpar(page), 'Zarpar');
  await page.keyboard.press('Tab');
  await ringed(hint(page), 'la pista');
  expect(await pageY(page), 'nada se ha movido aún').toBe(0);

  // The hint goes one screen down: the sea, and the scene follows.
  const H = page.viewportSize()!.height;
  await page.keyboard.press('Enter');
  await expect.poll(() => pageY(page), { timeout: 10_000 }).toBeGreaterThanOrEqual(H - 2);
  await page.waitForFunction(() => window.__boiaIntro?.scroll.phase === 'sea', null, {
    timeout: 20_000,
  });
  // Tab goes on into the bands (the hero UI is gone), on screen and ringed.
  await page.keyboard.press('Tab');
  const next = page.locator(':focus');
  expect(
    await next.evaluate((e) => !e.closest('.hero') && !!e.closest('#contenido > .section')),
    'el foco pasa a las bandas',
  ).toBe(true);
  await ringed(next, 'el primer enlace de las bandas');

  // The skip link of a direct visit: Tab, Enter → the content; then «Zarpar».
  await page.goto('/?intro=0');
  await page.waitForFunction(() => window.__boiaIntro?.phase === 'paused');
  await page.keyboard.press('Tab');
  await ringed(skipLink(page), 'Saltar al contenido (visita directa)');
  await page.keyboard.press('Enter');
  await expect(page.locator('#contenido')).toBeFocused();
  await page.keyboard.press('Tab');
  await ringed(zarpar(page), 'Zarpar tras saltar');
});

test('Atrás desde /mar: la landing en reposo, sin la aparición, y el scroll sigue llevando la escena', async ({
  page,
}) => {
  await page.goto('/');
  await restAfterAppearance(page);
  await tap(page, zarpar(page));
  await expect(page).toHaveURL(/\/mar(\?|$)/, { timeout: 30_000 });
  // On /mar (its loading screen gone), then Back.
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 45_000 });
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await page.waitForFunction(
    () => window.__boiaIntro?.mode === 'direct' && window.__boiaIntro.phase === 'paused',
    null,
    { timeout: 30_000 },
  );
  expect((await page.evaluate(() => window.__boiaIntro))!.history).toEqual(['paused']);
  await page.waitForTimeout(500);
  expect(await pageY(page), 'arriba del todo').toBe(0);
  expect(await scrollPhase(page)).toBe('rest');
  await expect(zarpar(page)).toBeVisible();
  await expect(entradas(page)).toHaveCount(0);
  await scrollTo(page, page.viewportSize()!.height, 'sea');
  await expect(firstBandHeading(page)).toBeInViewport();
});

test('sin WebGL: la versión estática, el scroll baja por las bandas y axe no encuentra nada', async ({
  page,
}) => {
  await withoutWebGL(page);
  await page.goto('/');
  await page.waitForFunction(() => window.__boiaIntro?.fallback === true, null, {
    timeout: 15_000,
  });
  await expect(page.locator('html')).toHaveAttribute('data-hero', 'still');
  await page.waitForFunction(() => window.__boiaIntro?.phase === 'paused');
  await expect(page.locator('canvas[data-scene]')).toHaveCount(0);
  await expect(page.locator('.hero__still-img').first()).toBeVisible();
  await expect(zarpar(page)).toBeVisible();
  await expect(entradas(page)).toHaveCount(0);
  expect(await axeViolations(page)).toEqual([]);
  await scrollTo(page, page.viewportSize()!.height);
  await expect(firstBandHeading(page)).toBeInViewport();
  await expect(page.locator('canvas[data-scene]')).toHaveCount(0);
  expect(await cls(page)).toBeLessThan(0.05);
});

test('escena lenta: «Zarpar» a mano mientras carga; después, el reposo y el scroll', async ({
  page,
}) => {
  const DELAY = 4000;
  const hits = await onSceneChunk(page, async (route, body) => {
    await new Promise((r) => setTimeout(r, DELAY));
    await route
      .fulfill({ status: 200, contentType: 'application/javascript', body })
      .catch(() => {});
  });
  await page.goto('/');
  await expect(page.locator('.intro-loading')).toBeVisible();
  await expect(zarpar(page)).toBeVisible();
  await expect(entradas(page)).toHaveCount(0);
  expect((await page.evaluate(() => window.__boiaIntro))!.phase).toBe('waiting');
  await restAfterAppearance(page);
  expect(hits.length, 'se retrasó el bundle de la escena').toBeGreaterThan(0);
  expect((await page.evaluate(() => window.__boiaIntro))!.fallback).toBe(false);
  await scrollTo(page, page.viewportSize()!.height, 'sea');
  await scrollTo(page, 0, 'rest');
  expect(await cls(page)).toBeLessThan(0.05);
});

test.describe('movimiento reducido (T81)', () => {
  test.use({ reducedMotion: 'reduce' });

  test('nada se mueve solo: sin animaciones ni rotación, la pista baja sin animar; axe y contraste sobre el still', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-hero', 'still');
    await page.waitForFunction(() => window.__boiaIntro?.phase === 'paused');
    const still = page.locator('.hero__still-img').first();
    await expect
      .poll(() => still.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
      .toBeGreaterThan(0);
    await page.waitForTimeout(1000);
    // Nothing runs: no pulse, no breathing hint, no scene, no camera.
    expect(
      await page.evaluate(() =>
        document
          .getAnimations()
          .filter((a) => a.playState === 'running')
          .map((a) => (a instanceof CSSAnimation ? a.animationName : a.constructor.name)),
      ),
      'animaciones en marcha',
    ).toEqual([]);
    await expect(page.locator('canvas[data-scene]')).toHaveCount(0);
    expect((await page.evaluate(() => window.__boiaIntro))!.scenesCreated).toBe(0);
    await accessibleHere(page, 'reposo estático');
    await snap(page, 'reducido', 'T81');

    // The hint jumps one screen at once (no smooth scroll).
    const H = page.viewportSize()!.height;
    await tap(page, hint(page));
    expect(Math.abs((await pageY(page)) - H), 'sin animar el scroll').toBeLessThanOrEqual(2);
    await accessibleHere(page, 'bandas, estático');

    // The artists do not rotate by themselves: paused, and the button resumes.
    const artists = SAMPLE_CONTENT.blocks.find((b) => b.type === 'artists');
    const rotationMs = artists?.type === 'artists' ? artists.rotationMs : 0;
    expect(rotationMs, 'la muestra rota a los artistas').toBeGreaterThan(0);
    const toggle = page.locator('#artistas').getByRole('button', { name: t('artists.resume') });
    await toggle.scrollIntoViewIfNeeded();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    const trio = page.getByTestId('artist-trio');
    const first = await trio.innerText();
    await page.waitForTimeout(rotationMs + 1000);
    expect(await trio.innerText(), 'la rotación espera').toBe(first);

    await scrollTo(page, await page.evaluate(() => document.body.scrollHeight));
    await page.waitForTimeout(300);
    await accessibleHere(page, 'pie, estático');
    await expect(page.locator('canvas[data-scene]')).toHaveCount(0);
  });
});
