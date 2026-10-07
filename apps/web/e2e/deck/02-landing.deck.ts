import { expect, test, type Page } from '@playwright/test';
import { openHeroTickets, pastHero, tap } from '../hero-helpers';
import { shot } from './deck-helpers';

/**
 * Capturas de la parte 2 (landing, plan 018 T204–T205): el hero, el panel de
 * Entradas y la taquilla, la versión quieta, cada banda de la landing, el
 * pie y el menú de la cabecera. Móvil 390×844, contenido `muestra`.
 */

/** El hero en reposo con el planeta 3D: la aparición terminada y el título 3D puesto. */
async function heroEnReposo(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => window.__boiaIntro?.phase === 'paused', null, {
    timeout: 60_000,
  });
  await expect(page.locator('html')).not.toHaveAttribute('data-intro', /.*/);
  await expect(page.locator('.hero__wordmark')).toHaveAttribute('data-title', '3d', {
    timeout: 20_000,
  });
}

/**
 * La landing sin la aparición (`?intro=0`), bajada hasta que `selector`
 * queda arriba, bajo la cabecera fija. La escena del mar sigue al scroll:
 * el respiro de `shot` la deja pintar.
 */
async function bajarA(page: Page, selector: string) {
  await page.goto('/?intro=0');
  await page.waitForFunction(() => window.__boiaIntro?.phase === 'paused', null, {
    timeout: 60_000,
  });
  const el = page.locator(selector).first();
  await expect(el).toBeAttached();
  await page.evaluate((sel) => {
    const target = document.querySelector(sel)!;
    const header = document.querySelector('.site-header__inner');
    const alto = header ? header.getBoundingClientRect().height : 0;
    const top = target.getBoundingClientRect().top + window.scrollY - alto - 12;
    window.scrollTo({ top, behavior: 'instant' });
  }, selector);
  await expect(el).toBeInViewport();
}

test('hero', async ({ page }) => {
  await heroEnReposo(page);
  await shot(page, '02', 'hero', { respiro: 1500 });
});

test('hero-entradas', async ({ page }) => {
  await heroEnReposo(page);
  await openHeroTickets(page);
  await shot(page, '02', 'hero-entradas', { respiro: 800 });
});

test('taquilla', async ({ page }) => {
  await heroEnReposo(page);
  const panel = await openHeroTickets(page);
  await panel.getByTestId('comprar-halloween-2026').click();
  await expect(page.getByTestId('box-office')).toBeVisible();
  await shot(page, '02', 'taquilla', { respiro: 800 });
});

test.describe('movimiento reducido', () => {
  test.use({ reducedMotion: 'reduce' });

  test('hero-quieto', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-hero', 'still');
    await page.waitForFunction(() => window.__boiaIntro?.phase === 'paused');
    const still = page.locator('.hero__still-img').first();
    await expect(still).toBeVisible();
    await expect
      .poll(() => still.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
      .toBeGreaterThan(0);
    await shot(page, '02', 'hero-quieto', { respiro: 1000 });
  });
});

test('proximo-evento', async ({ page }) => {
  await bajarA(page, '#priority-title');
  await shot(page, '02', 'proximo-evento', { respiro: 1500 });
});

test('eventos', async ({ page }) => {
  await bajarA(page, '#upcoming-title');
  await shot(page, '02', 'eventos', { respiro: 1500 });
});

test('fotos', async ({ page }) => {
  await bajarA(page, '#photos-title');
  await shot(page, '02', 'fotos', { respiro: 1500 });
});

test('artistas', async ({ page }) => {
  await bajarA(page, '#artists-title');
  await shot(page, '02', 'artistas', { respiro: 1500 });
});

test('tienda', async ({ page }) => {
  await bajarA(page, '#store-title');
  await shot(page, '02', 'tienda', { respiro: 1500 });
});

test('filosofia', async ({ page }) => {
  await bajarA(page, '#contact-title');
  await shot(page, '02', 'filosofia', { respiro: 1500 });
});

test('pie', async ({ page }) => {
  await bajarA(page, '.site-footer');
  await shot(page, '02', 'pie', { respiro: 1500 });
});

test('menu', async ({ page }) => {
  await page.goto('/?intro=0');
  await page.waitForFunction(() => window.__boiaIntro?.phase === 'paused', null, {
    timeout: 60_000,
  });
  await pastHero(page);
  await tap(page, page.locator('.site-header__menu > summary'));
  await expect(page.locator('.site-header__menu-list')).toBeVisible();
  await shot(page, '02', 'menu', { respiro: 1200 });
});
