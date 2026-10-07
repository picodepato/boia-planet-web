import { expect, test, type Page } from '@playwright/test';
import { shot } from './deck-helpers';

/**
 * Capturas de la parte 3 (páginas): la ficha de un evento, la taquilla de
 * Halloween, actividades y recuerdos, todos los artistas, el enlace de
 * artistas, «Fotos y eventos», la tienda y una página legal. Todas en móvil,
 * con el contenido de muestra de hoy.
 */

/** Sube el elemento al principio de la pantalla, con un margen arriba. */
async function alPrincipio(page: Page, selector: string, margen = 16) {
  await page.locator(selector).first().evaluate((el, m) => {
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - m);
  }, margen);
}

test('evento', async ({ page }) => {
  await page.goto('/eventos/halloween-2026');
  await expect(page.getByTestId('evento-ficha')).toBeVisible();
  await shot(page, '03', 'evento');
});

test('evento-taquilla', async ({ page }) => {
  await page.goto('/eventos/halloween-2026');
  const ficha = page.getByTestId('evento-ficha');
  await expect(ficha).toBeVisible();
  await ficha.getByTestId('comprar-halloween-2026').click();
  await expect(page.getByTestId('box-office')).toBeVisible();
  await shot(page, '03', 'evento-taquilla', { respiro: 800 });
});

test('evento-actividades', async ({ page }) => {
  await page.goto('/eventos/sonido-2026');
  await expect(page.getByTestId('evento-ficha')).toBeVisible();
  await alPrincipio(page, '.event-page__main');
  await shot(page, '03', 'evento-actividades');
});

test('evento-recuerdos', async ({ page }) => {
  await page.goto('/eventos/all-day-boia-2026');
  await expect(page.getByTestId('evento-recuerdos')).toBeVisible();
  await alPrincipio(page, '.event-page__main');
  await shot(page, '03', 'evento-recuerdos');
});

test('artistas', async ({ page }) => {
  await page.goto('/artistas');
  await expect(page.locator('#artistas-title')).toBeVisible();
  await shot(page, '03', 'artistas');
});

test('artista-enlace', async ({ page }) => {
  await page.goto('/artista/muestra-presentacion');
  await expect(page).toHaveURL(/\/mar/, { timeout: 60_000 });
  await expect(page.getByTestId('mar-carnet')).toBeVisible({ timeout: 60_000 });
  if (!(await page.getByTestId('carnet-form').isVisible())) {
    await page.getByTestId('carnet-crear').click();
  }
  await expect(page.getByTestId('carnet-aviso-artista')).toBeVisible();
  await shot(page, '03', 'artista-enlace', { respiro: 1200 });
});

test('fotos', async ({ page }) => {
  await page.goto('/fotos');
  await expect(page.locator('#fotos-title')).toBeVisible();
  await shot(page, '03', 'fotos');
});

test('tienda', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tienda');
  await expect(page.getByTestId('merchandise-catalog')).toBeVisible();
  await shot(page, '03', 'tienda');
});

test('tienda-comprar', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tienda');
  const buy = page.getByTestId('merchandise-buy').first();
  await buy.locator('summary').click();
  await expect(buy.getByTestId('merchandise-buy-message')).toBeVisible();
  await alPrincipio(page, '.merchandise__card');
  await shot(page, '03', 'tienda-comprar');
});

test('legal', async ({ page }) => {
  await page.goto('/legal/aviso-legal');
  await expect(page.getByTestId('legal-muestra')).toBeVisible();
  await shot(page, '03', 'legal');
});
