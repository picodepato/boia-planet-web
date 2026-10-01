import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { t } from '../lib/i18n';

/**
 * El HUD de /mar en el móvil (T53, REQ-PRO-009 «Más mundo, menos HUD»): una
 * barra fina abajo con Mapa, Logros, «Entradas» destacada, Carnet y Menú;
 * arriba sólo el minimapa y los saldos; la ficha de una isla es una tarjeta
 * pequeña abajo (≤ 30 % de la pantalla) que se despliega al tocarla; y los
 * avisos son chips pequeños arriba que se van solos.
 *
 * Con RECORD_T53=1 deja capturas en docs/informes/img/ p005-t53-*.png.
 */

const VIEW = { width: 375, height: 812 };
test.use({ viewport: VIEW });
test.describe.configure({ timeout: 90_000 });

const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../docs/informes/img',
);

async function snap(page: Page, name: string) {
  if (test.info().project.name !== 'mobile' || !process.env.RECORD_T53) return;
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, name) });
}

async function openMar(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/mar');
  await expect(page.getByTestId('mar-canvas')).toBeVisible();
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 30_000 });
  return errors;
}

/** Entero en pantalla y encima de todo en su centro (nada lo tapa). */
async function expectOnTop(el: Locator) {
  await expect(el).toBeVisible();
  await expect(el).toBeInViewport({ ratio: 1 });
  const onTop = await el.evaluate((node) => {
    const r = node.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && node.contains(hit);
  });
  expect(onTop, 'nada lo tapa').toBe(true);
}

const box = async (el: Locator) => (await el.boundingBox())!;

test('la barra de abajo: Mapa, Logros, «Entradas», Carnet y Menú; arriba, minimapa y saldos', async ({
  page,
}) => {
  const errors = await openMar(page);
  const bar = page.getByTestId('mar-barra');
  await expect(bar).toBeVisible();
  const mapa = bar.getByTestId('mar-barra-mapa');
  const logros = bar.getByTestId('mar-logros');
  const tickets = bar.getByTestId('mar-entradas');
  const carnet = bar.getByTestId('mar-barra-carnet');
  const menu = bar.getByTestId('mar-barra-menu');
  await expect(mapa).toContainText(t('mar.client.barraMapa'));
  await expect(logros).toContainText(t('mar.client.logros'));
  await expect(tickets).toContainText(t('hud.tickets'));
  await expect(carnet).toContainText(t('mar.client.barraCarnet'));
  await expect(menu).toContainText(t('mar.client.menu'));
  for (const el of [mapa, logros, tickets, carnet, menu]) await expectOnTop(el);

  // Fina y pegada abajo, con los cinco en una fila y «Entradas» en el centro.
  const b = await box(bar);
  expect(b.height).toBeLessThanOrEqual(VIEW.height * 0.1);
  expect(b.y + b.height).toBeGreaterThan(VIEW.height - 40);
  const xs = await Promise.all([mapa, logros, tickets, carnet, menu].map(box));
  for (let i = 1; i < xs.length; i++) expect(xs[i]!.x).toBeGreaterThan(xs[i - 1]!.x);
  const mid = xs[2]!.x + xs[2]!.width / 2;
  expect(Math.abs(mid - VIEW.width / 2)).toBeLessThan(VIEW.width * 0.06);
  // Mi Carnet se abre dentro del mar (T55), no en otra página.
  await expect(carnet).toHaveAttribute('aria-haspopup', 'dialog');

  // Arriba sólo el minimapa y los saldos, en la franja de arriba.
  const top = await box(page.locator('.mar-top'));
  expect(top.y + top.height).toBeLessThan(VIEW.height * 0.15);
  await expect(page.locator('.mar-top').getByTestId('mar-minimapa')).toBeVisible();
  await expect(page.locator('.mar-top').getByTestId('mar-saldos')).toBeVisible();
  await expect(page.locator('.mar-top button, .mar-top a')).toHaveCount(1);
  await snap(page, 'p005-t53-hud.png');

  // Mapa abre y cierra el mapa grande; Menú abre el menú encima de la barra.
  await mapa.click();
  await expect(mapa).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('mar-minimapa')).toHaveAttribute('aria-pressed', 'true');
  await mapa.click();
  await expect(mapa).toHaveAttribute('aria-pressed', 'false');
  await menu.click();
  const panel = page.getByTestId('mar-menu');
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId('mar-mis-codigos')).toBeVisible();
  expect((await box(panel)).y + (await box(panel)).height).toBeLessThanOrEqual(b.y);
  await expectOnTop(tickets);
  await menu.click();
  await expect(panel).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('la ficha de una isla: una tarjeta pequeña abajo que se despliega al tocarla', async ({
  page,
}) => {
  const errors = await openMar(page);
  await page.getByTestId('mar-barra-mapa').click();
  await page.locator('[data-pin="allday"]').dispatchEvent('click');
  const sheet = page.getByTestId('mar-ficha');
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveAttribute('data-expandida', 'no');
  // Lo esencial y un solo botón; la barra sigue a la vista, debajo.
  await expect(sheet.getByTestId('mar-rumbo')).toBeVisible();
  await expect(sheet.getByTestId('mar-volar')).toHaveCount(0);
  const small = await box(sheet);
  expect(small.height).toBeLessThanOrEqual(VIEW.height * 0.3);
  expect(small.y + small.height).toBeLessThanOrEqual((await box(page.getByTestId('mar-barra'))).y);
  await expectOnTop(page.getByTestId('mar-entradas'));
  await snap(page, 'p005-t53-ficha.png');

  // Tocar la tarjeta (no su botón) la despliega entera.
  await sheet.locator('.mar-sheet__title').click();
  await expect(sheet).toHaveAttribute('data-expandida', 'si');
  await expect(sheet.getByTestId('mar-volar')).toBeVisible();
  await expect.poll(async () => (await box(sheet)).height).toBeGreaterThan(small.height);
  await expectOnTop(page.getByTestId('mar-entradas'));
  await snap(page, 'p005-t53-ficha-desplegada.png');

  // Y vuelve a recogerse.
  await sheet.getByTestId('mar-ficha-mas').click();
  await expect(sheet).toHaveAttribute('data-expandida', 'no');
  await expect(sheet.getByTestId('mar-volar')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('los avisos son chips pequeños arriba que se van solos', async ({ page }) => {
  // Con movimiento reducido «Entradas» abre la compra directa: una compra da avisos.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = await openMar(page);
  await page.getByTestId('mar-entradas').click();
  const checkout = page.getByTestId('checkout');
  await checkout.getByTestId('checkout-confirmar').click();
  await expect(checkout.getByTestId('checkout-resultado')).toBeVisible();
  await checkout.getByTestId('checkout-cerrar').click();
  await expect(checkout).toBeHidden();

  const chip = page.getByTestId('mar-aviso').first();
  await expect(chip).toBeVisible();
  await snap(page, 'p005-t53-aviso.png');
  const c = await box(chip);
  expect(c.height).toBeLessThanOrEqual(56);
  expect(c.y + c.height).toBeLessThan(VIEW.height * 0.15);
  // No pisa el minimapa ni los saldos.
  for (const other of [page.getByTestId('mar-minimapa'), page.getByTestId('mar-saldos')]) {
    const o = await box(other);
    const apart =
      c.x + c.width <= o.x ||
      o.x + o.width <= c.x ||
      c.y + c.height <= o.y ||
      o.y + o.height <= c.y;
    expect(apart, 'el chip no pisa el HUD de arriba').toBe(true);
  }
  // Sin tocarlo, se va solo (con su tiempo de lectura, D-22).
  await expect(page.getByTestId('mar-aviso')).toHaveCount(0, { timeout: 45_000 });
  expect(errors).toEqual([]);
});
