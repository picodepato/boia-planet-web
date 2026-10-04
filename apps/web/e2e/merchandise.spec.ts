import path from 'node:path';
import { expect, test } from '@playwright/test';
import { MERCHANDISE_NOTICE, MERCHANDISE_PRODUCTS } from '../lib/merchandise/catalog';

test('landing and internal shop show the same sample merchandise and in-person notice', async ({
  page,
}, info) => {
  await page.goto('/?intro=0#tienda');
  const store = page.locator('#tienda');
  await expect(store).toContainText(MERCHANDISE_NOTICE);
  await expect(store.locator('img')).toHaveCount(3);
  for (const product of MERCHANDISE_PRODUCTS) {
    const img = store.getByRole('img', { name: product.alt });
    await expect(img).toHaveAttribute('src', product.image);
    await expect(img).toHaveAttribute('loading', 'lazy');
  }
  const open = page.getByTestId('merchandise-open');
  await expect(open).not.toHaveAttribute('target');
  await open.click();
  await expect(page).toHaveURL(/\/tienda$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tienda BOIA');
  await expect(page.getByTestId('merchandise-catalog')).toContainText('Fotos y diseños de muestra');
  await expect(page.locator('.merchandise__badge')).toHaveCount(3);
  for (const product of MERCHANDISE_PRODUCTS) {
    const img = page.getByRole('img', { name: product.alt });
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(() => img.evaluate((node) => (node as HTMLImageElement).naturalWidth))
      .toBe(800);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.resolve(`node_modules/t103-preview/shop-${info.project.name}.png`),
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByTestId('merchandise-back').click();
  await expect(page).toHaveURL(/intro=0#tienda$/);
});

test('Ibiza opens the same internal shop and offers a return to sailing', async ({ page }) => {
  await page.goto('/mar?ir=tienda');
  await expect(page.getByTestId('mar-canvas')).toBeVisible();
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 30000 });
  await page.getByTestId('mar-entradas-saltar').click();
  const open = page.getByTestId('mar-merchandise-open');
  await expect(open).toBeVisible({ timeout: 30000 });
  await expect(open).toHaveAttribute('href', '/tienda?from=mar');
  await expect(open).not.toHaveAttribute('target');
  await expect(page.getByTestId('mar-ficha')).toContainText(MERCHANDISE_NOTICE);
  await open.click();
  await expect(page).toHaveURL(/\/tienda\?from=mar$/);
  await expect(page.getByTestId('merchandise-back')).toHaveText('Volver al mar');
  await page.getByTestId('merchandise-back').click();
  await expect(page.getByTestId('mar-canvas')).toBeVisible();
});

test('shop is available without JavaScript or a Carnet', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/tienda');
  await expect(page.getByRole('heading', { name: 'Tienda BOIA', exact: true })).toBeVisible();
  await expect(page.locator('.merchandise-notice')).toHaveText(MERCHANDISE_NOTICE);
  await expect(page.locator('.merchandise__grid img')).toHaveCount(3);
  await expect(page.locator('form, button')).toHaveCount(0);
  await context.close();
});
