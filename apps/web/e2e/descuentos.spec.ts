import { SAMPLE_DISCOUNTS } from '@boia/store';
import { WORLD_REGISTRY, type WorldObject } from '@boia/world';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAMPLE_CONTENT } from '../lib/landing/sample-content';

/**
 * Descuentos que llevan a su isla (T43, D-23 puntos 5 y 6, REQ-COM-036) en
 * /juego: el náufrago da su código, «Ir a la isla» lleva el barco solo hasta
 * la isla del evento, allí se ve «Tienes un código de descuento para este
 * evento» y la compra de prueba lo aplica; después, «Mis códigos» lo marca
 * usado. Los datos salen del mapa y de la muestra, nada escrito a mano.
 * La parte de /mar espera a que el plan 003 deje /mar (ver el informe).
 *
 * Con RECORD_T43=1 deja en docs/informes/img/ p004-t43-ir-a-la-isla.png y
 * p004-t43-banner-descuento.png (sólo en el proyecto móvil).
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

const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../docs/informes/img',
);
const recording = () => test.info().project.name === 'mobile' && !!process.env.RECORD_T43;

async function snap(page: Page, name: string) {
  if (!recording()) return;
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, name) });
}

async function sailFrom(page: Page, near: string) {
  await page.goto(`/juego?cerca=${near}`);
  await expect(page.getByTestId('hud')).toContainText(/\d+ fps/, { timeout: 30_000 });
  await page
    .locator('canvas:visible')
    .first()
    .focus()
    .catch(() => {});
}

async function sailNorthUntil(page: Page, until: () => Promise<void>) {
  await page.keyboard.down('ArrowUp');
  try {
    await until();
  } finally {
    await page.keyboard.up('ArrowUp');
  }
}

const analytics = (page: Page) =>
  page.evaluate(() =>
    (window.__boiaAnalytics ?? []).map((e) => ({ event: e.event, ...e.properties })),
  );

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

test('el náufrago da su código, «Ir a la isla» lleva el barco y la compra lo aplica', async ({
  page,
}) => {
  expect(discount, 'el náufrago esconde un código de la muestra').toBeDefined();
  expect(event?.islandId, 'el código es de un evento con isla').toBeTruthy();

  await sailFrom(page, castaway.identity.id);
  const found = page.getByTestId('panel-descuento');
  await sailNorthUntil(page, () => expect(found).toBeVisible({ timeout: 20_000 }));
  await expect(found.getByTestId('descuento-codigo')).toHaveText(discount.code);
  await expect(found.getByTestId('descuento-estado')).toHaveText('Activo');

  // «Ir a la isla»: el barco navega solo (se puede saltar) hasta la isla del evento.
  await found.getByTestId('descuento-ir-isla').click();
  await expect(found).toBeHidden();
  const trip = page.getByTestId('rumbo');
  await expect(trip).toBeVisible();
  await expect(trip).toHaveAttribute('data-lugar', event.islandId!);
  await page.waitForTimeout(1200);
  await snap(page, 'p004-t43-ir-a-la-isla.png');

  const panel = page.getByTestId('panel-evento');
  await expect(panel).toBeVisible({ timeout: 30_000 });
  await expect(trip).toBeHidden();
  await expect(panel.getByRole('heading', { name: event.name })).toBeVisible();

  // El aviso, con el código y el ahorro, junto a la compra.
  const banner = panel.getByTestId('banner-descuento');
  await expect(banner).toContainText('Tienes un código de descuento para este evento');
  await expect(banner.getByTestId('banner-descuento-codigo')).toHaveText(discount.code);
  await expect(banner.getByTestId('banner-descuento-ahorro')).toContainText('€');
  await page.waitForTimeout(500);
  await snap(page, 'p004-t43-banner-descuento.png');

  // Comprar: el checkout de prueba lo aplica.
  await panel.getByTestId('panel-evento-comprar').click();
  const checkout = page.getByTestId('checkout');
  await expect(checkout.getByTestId('checkout-evento')).toHaveText(event.name);
  await expect(checkout.getByTestId('banner-descuento-codigo')).toHaveText(discount.code);
  await expect(checkout.getByTestId('checkout-descuento')).toHaveAttribute(
    'data-discount-id',
    discount.id,
  );
  await checkout.getByTestId('checkout-confirmar').click();
  await expect(checkout.getByTestId('checkout-resultado')).toBeVisible();
  await checkout.getByTestId('checkout-cerrar').click();
  await expect(checkout).toBeHidden();

  // «Mis códigos»: ya usado, y sin «Ir a la isla».
  await page.getByTestId('menu-ancla').click();
  const menu = page.getByTestId('menu');
  await menu.getByRole('tab', { name: 'Mis códigos', exact: true }).click();
  const card = menu.getByTestId(`descuento-${discount.id}`);
  await expect(card.getByTestId('descuento-estado')).toHaveText('Usado');
  await expect(card.getByTestId('descuento-ir-isla')).toHaveCount(0);

  // El embudo: código encontrado, clic de compra en la isla y compra confirmada.
  const events = await analytics(page);
  expect(events).toContainEqual(
    expect.objectContaining({ event: 'discount_found', discountId: discount.id }),
  );
  expect(events).toContainEqual(
    expect.objectContaining({ event: 'ticket_click_out', eventId: event.id, source: 'island' }),
  );
  expect(events).toContainEqual(
    expect.objectContaining({
      event: 'purchase_confirmed',
      eventId: event.id,
      provider: 'sandbox',
      discountId: discount.id,
    }),
  );
});

test('«Saltar» llega de un salto; tomar el timón cancela el viaje', async ({ page }) => {
  await sailFrom(page, castaway.identity.id);
  const found = page.getByTestId('panel-descuento');
  await sailNorthUntil(page, () => expect(found).toBeVisible({ timeout: 20_000 }));
  await found.getByTestId('descuento-ir-isla').click();
  const trip = page.getByTestId('rumbo');
  await expect(trip).toBeVisible();
  // Tomar el timón: el viaje se cancela y el barco es tuyo otra vez.
  await page.keyboard.press('ArrowLeft');
  await expect(trip).toBeHidden();

  // Desde «Mis códigos», otra vez; ahora «Saltar».
  await page.getByTestId('menu-ancla').click();
  const menu = page.getByTestId('menu');
  await menu.getByRole('tab', { name: 'Mis códigos', exact: true }).click();
  await menu.getByTestId(`descuento-${discount.id}`).getByTestId('descuento-ir-isla').click();
  await expect(menu).toBeHidden();
  await expect(trip).toBeVisible();
  await trip.getByTestId('rumbo-saltar').click();
  await expect(trip).toBeHidden();
  await expect(page.getByTestId('panel-evento')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('panel-evento').getByTestId('banner-descuento')).toBeVisible();
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
