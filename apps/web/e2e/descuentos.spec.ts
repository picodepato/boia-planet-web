import { SAMPLE_DISCOUNTS } from '@boia/store';
import { WORLD_REGISTRY, type WorldObject } from '@boia/world';
import { expect, test, type Page } from '@playwright/test';
import { SAMPLE_CONTENT } from '../lib/landing/sample-content';
import { mar, marSheet, openMar, sheetIs, steerTo } from './mar-helpers';

/**
 * Descuentos que llevan a su isla (T43, D-23 puntos 5 y 6, REQ-COM-036) en el
 * mar 3D (desde T62, D-25): el náufrago da su código, «Ir a la isla» lleva el
 * barco solo hasta la isla del evento, allí la compra de
 * prueba lo aplica y la compra queda medida; tomar el timón cancela el viaje.
 * Los datos salen del mapa y de la muestra, nada escrito a mano.
 */

test.describe.configure({ timeout: 120_000 });

const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId);
const castaway = world.config.objects.find((o) => o.identity.category === 'naufrago')!;
const rewardRef = (o: WorldObject) =>
  o.behaviors.flatMap((b) =>
    b.type === 'reward' && b.params.kind === 'discount' && b.params.ref ? [b.params.ref] : [],
  )[0];
const discount = SAMPLE_DISCOUNTS.find((d) => d.id === rewardRef(castaway))!;
const event = SAMPLE_CONTENT.events.find((e) => e.id === discount.eventId)!;

const analytics = (page: Page) =>
  page.evaluate(() =>
    (window.__boiaAnalytics ?? []).map((e) => ({ event: e.event, ...e.properties })),
  );

/** Junto al náufrago, hasta que da su código. */
async function findCode(page: Page) {
  await openMar(page, `?cerca=${castaway.identity.id}`);
  await steerTo(page, castaway.identity.id, sheetIs(page, 'discount'));
  const sheet = marSheet(page);
  await expect(sheet).toHaveAttribute('data-tipo', 'discount');
  await expect(sheet).toContainText(discount.code);
  return sheet;
}

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

test('el náufrago da su código, «Ir a la isla» lleva el barco y la compra lo aplica y se mide', async ({
  page,
}) => {
  expect(discount, 'el náufrago esconde un código de la muestra').toBeDefined();
  expect(event?.islandId, 'el código es de un evento con isla').toBeTruthy();
  const sheet = await findCode(page);

  await sheet.getByTestId('descuento-ir-isla').click();
  const trip = page.getByTestId('mar-viaje');
  await expect(trip).toHaveAttribute('data-lugar', event.islandId!);
  await expect(page.getByTestId('mar-entradas-saltar')).toBeVisible();
  // Llega solo (el viaje en turbo tarda unos segundos) y abre la ficha del evento.
  await expect(sheet).toHaveAttribute('data-tipo', 'event', { timeout: 45_000 });
  await expect(sheet).toHaveAttribute('data-lugar', event.islandId!);
  await expect(sheet.getByRole('heading', { name: event.name })).toBeVisible();

  await sheet.getByTestId('mar-ficha-mas').click();
  await expect(sheet.getByTestId('banner-descuento-codigo')).toHaveText(discount.code);
  await sheet.getByTestId('mar-comprar').first().click();
  const checkout = page.getByTestId('checkout');
  await expect(checkout.getByTestId('checkout-evento')).toHaveText(event.name);
  await expect(checkout.getByTestId('checkout-descuento')).toHaveAttribute(
    'data-discount-id',
    discount.id,
  );
  await checkout.getByTestId('checkout-confirmar').click();
  await expect(checkout.getByTestId('checkout-resultado')).toBeVisible();

  // El embudo: clic de compra en la isla y compra confirmada con el código.
  const events = await analytics(page);
  expect(events).toContainEqual(
    expect.objectContaining({ event: 'ticket_click_out', eventId: event.id, source: 'island' }),
  );
  expect(events).toContainEqual(
    expect.objectContaining({
      event: 'purchase_confirmed',
      eventId: event.id,
      provider: 'sandbox',
      source: 'world',
      discountId: discount.id,
    }),
  );
});

test('tomar el timón cancela el viaje a la isla', async ({ page }) => {
  const sheet = await findCode(page);
  await sheet.getByTestId('descuento-ir-isla').click();
  const trip = page.getByTestId('mar-viaje');
  await expect(trip).toHaveAttribute('data-lugar', event.islandId!);
  const before = await mar(page).getAttribute('data-barco');
  await page.keyboard.down('ArrowLeft');
  await expect(trip).not.toHaveAttribute('data-lugar', /.+/, { timeout: 10_000 });
  await page.keyboard.up('ArrowLeft');
  expect(await mar(page).getAttribute('data-barco')).not.toBe(before);
});

test('Admin › Descuentos: crear un código lo deja en la auditoría', async ({ page }) => {
  await page.goto('/admin');
  await page.getByTestId('admin-nav-descuentos').click();
  const form = page.getByTestId('descuento-nuevo');
  await form.getByTestId('descuento-nuevo-codigo').fill('E2ET43');
  await form.getByTestId('descuento-nuevo-texto').fill('-5 % de prueba e2e');
  await form.getByTestId('descuento-nuevo-destino').selectOption(event.id);
  await form.getByTestId('descuento-nuevo-valor').fill('5');
  await form.getByTestId('descuento-nuevo-escondite').selectOption({ index: 1 });
  await form.getByTestId('descuento-nuevo-crear').click();
  await expect(form.getByTestId('admin-ok')).toBeVisible();
  const row = page.getByTestId('descuento-dto-e2et43');
  await expect(row).toContainText('E2ET43');
  await row.getByTestId('descuento-dto-e2et43-caducar').click();
  await expect(page.getByTestId('descuento-dto-e2et43')).toHaveAttribute('data-estado', 'expired');

  await page.getByTestId('admin-nav-auditoria').click();
  const audit = page.getByTestId('auditoria');
  await expect(audit).toContainText('Descuentos · upsert · dto-e2et43 · nuevo descuento');
  await expect(audit).toContainText('Descuentos · upsert · dto-e2et43 · caducar');
});
