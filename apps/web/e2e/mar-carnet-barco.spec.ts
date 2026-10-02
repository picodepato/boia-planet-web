import { CARNET_SHIP, SAMPLE_ACHIEVEMENTS, SAMPLE_COSMETICS } from '@boia/store';
import { expect, test } from '@playwright/test';
import { CARNET_CREATE_HREF } from '../lib/landing/access';

/**
 * El premio del Carnet BOIA (decisión 2026-10-02, T72): crear el Carnet en
 * el mar 3D da al momento sus puntos y su barco, sin pasar por «Reclamar».
 * En Barco, el barco del Carnet ya es suyo y se puede llevar; en Logros, el
 * logro sale reclamado.
 */

test.describe.configure({ timeout: 120_000 });

const carnet = SAMPLE_ACHIEVEMENTS.find((a) => a.trigger === 'create_carnet')!;
const ship = SAMPLE_COSMETICS.find((c) => c.id === CARNET_SHIP)!;
const STYLE = ship.assetKey!;

test('crear el Carnet en /mar da su barco y sus puntos al momento', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(CARNET_CREATE_HREF);
  await expect(page.getByTestId('mar-canvas')).toBeVisible();
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 30_000 });
  const root = page.locator('main.mar');

  // Antes del Carnet, el barco está bloqueado.
  const sheet = page.getByTestId('mar-carnet');
  await expect(sheet).toBeVisible({ timeout: 20_000 });
  await sheet.getByTestId('mar-carnet-cerrar').click();
  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-barco').click();
  const shop = page.getByTestId('mar-tienda').getByTestId('barco');
  await expect(shop.getByTestId(`barco-estilo-${STYLE}`)).toHaveAttribute('data-bloqueado', 'si');
  await page.getByTestId('mar-tienda-cerrar').click();

  // Crea el Carnet.
  await page.getByTestId('mar-enlace-carnet').click();
  await sheet.getByTestId('carnet-crear').click();
  await sheet.getByTestId('carnet-apodo-input').fill(`Con barco ${info.project.name}`);
  await sheet.getByTestId('carnet-guardar').click();
  await expect(sheet.getByTestId('carnet-mio')).toBeVisible();
  await sheet.getByTestId('mar-carnet-cerrar').click();
  await expect(sheet).toBeHidden();

  // En Barco: ya es suyo, con los puntos del Carnet, y se lo pone.
  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-barco').click();
  const style = shop.getByTestId(`barco-estilo-${STYLE}`);
  await expect(style).not.toHaveAttribute('data-bloqueado', 'si');
  await expect(shop.getByTestId('barco-saldo')).toHaveAttribute(
    'data-points',
    String(carnet.points),
  );
  await style.click();
  await expect(root).toHaveAttribute('data-ship-style', STYLE);
  await page.getByTestId('mar-tienda-cerrar').click();

  // En Logros, el del Carnet sale ya reclamado.
  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-menu-logros').click();
  const panel = page.getByTestId('mar-logros-panel');
  await expect(panel.getByTestId(`logro-${carnet.id}`)).toHaveAttribute('data-estado', 'claimed');
  expect(errors).toEqual([]);
});
