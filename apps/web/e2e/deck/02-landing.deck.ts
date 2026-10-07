import { expect, test, type Page } from '@playwright/test';
import { openHeroTickets } from '../hero-helpers';
import { shot } from './deck-helpers';

/**
 * Capturas de la parte 2 (landing). T204 deja las del hero como ejemplo;
 * T205 añade las demás secciones.
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

test('hero', async ({ page }) => {
  await heroEnReposo(page);
  await shot(page, '02', 'hero', { respiro: 1500 });
});

test('hero-entradas', async ({ page }) => {
  await heroEnReposo(page);
  await openHeroTickets(page);
  await shot(page, '02', 'hero-entradas', { respiro: 800 });
});
