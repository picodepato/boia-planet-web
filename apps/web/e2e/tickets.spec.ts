import { canBuy } from '@boia/contracts';
import { SAMPLE_ACHIEVEMENTS, SAMPLE_EVENTS } from '@boia/store';
import { WORLD_REGISTRY } from '@boia/world';
import { expect, test } from '@playwright/test';
import { SAMPLE_CONTENT } from '../lib/landing/sample-content';
import { CHECKOUT_COPY } from '../lib/ticketing/copy';
import { TICKET_TRIGGER } from '../lib/ticketing/sandbox';
import { marSheet, openMar } from './mar-helpers';

/**
 * Compra de prueba (T25, D-20, REQ-COM-035), sin ticketera ni servidor:
 * se compra un evento desde el panel de Tickets de la landing y el de la isla
 * desde su ficha en el mar 3D; los dos sellos aparecen en Mi Carnet. Corre en
 * móvil 360×640 y en escritorio.
 */

// El evento de la isla (el de la isla de la demo) y otro a la venta sin isla.
const islandEvent = SAMPLE_CONTENT.events.find((e) => canBuy(e) && e.islandId)!;
const landingEvent = SAMPLE_CONTENT.events.find((e) => canBuy(e) && !e.islandId)!;
// Su isla en el mundo por defecto (Arcilla desde T20).
const islandPlace = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config.objects.find((o) =>
  o.behaviors.some(
    (b) =>
      b.type === 'content' &&
      (b.params as { target?: string }).target === 'event' &&
      (b.params as { ref?: string }).ref === islandEvent.id,
  ),
);
// Mi Carnet lee los nombres del repositorio.
const storeName = (id: string) => SAMPLE_EVENTS.find((e) => e.id === id)!.name;
const ticketAchievement = SAMPLE_ACHIEVEMENTS.find((a) => a.trigger === TICKET_TRIGGER)!;
// En la landing el checkout y el repositorio se cargan al pulsar.
const CHECKOUT_LOAD = 20_000;

test('landing → compra de prueba → Mi Carnet; isla → compra de prueba → los dos sellos', async ({
  page,
}, info) => {
  test.setTimeout(150_000);
  expect(islandEvent, 'hay un evento a la venta con isla').toBeDefined();
  expect(landingEvent, 'hay otro evento a la venta').toBeDefined();

  // Landing → Tickets → «Comprar entradas». Con un parámetro, sin cinemática (D-21).
  await page.goto('/?intro=0');
  await page.locator('.hero').getByRole('link', { name: 'Tickets', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Elige tu evento' });
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: CHECKOUT_COPY.buyAria(landingEvent.name) }).click();

  // El checkout se rotula como prueba y enseña evento, precio y total.
  const checkout = page.getByTestId('checkout');
  // Sin Carnet, la compra pregunta antes (T66): se sigue sin él.
  await checkout.getByTestId('checkout-sin-carnet').click({ timeout: CHECKOUT_LOAD });
  await expect(checkout.getByTestId('checkout-confirmar')).toBeVisible();
  await expect(checkout.getByTestId('checkout-prueba')).toHaveText(CHECKOUT_COPY.kicker);
  await expect(checkout.getByTestId('checkout-evento')).toHaveText(landingEvent.name);
  await expect(checkout.getByTestId('checkout-aviso')).toContainText('este navegador');
  await expect(checkout.getByTestId('checkout-total')).toContainText('€');
  await expect(checkout.getByTestId('checkout-sin-descuento')).toBeVisible();
  await checkout.getByTestId('checkout-confirmar').click();
  const result = checkout.getByTestId('checkout-resultado');
  await expect(result).toContainText(CHECKOUT_COPY.stamp.granted);
  await expect(checkout.getByTestId('checkout-logro')).toContainText(ticketAchievement.title);

  // «Ver Mi Carnet»: el mar abre en Mi Carnet (T55); al crearlo, el sello ya está.
  await expect(checkout.getByTestId('checkout-carnet')).toHaveAttribute(
    'href',
    /^\/mar\?menu=carnet/,
  );
  await checkout.getByTestId('checkout-carnet').click();
  await expect(page).toHaveURL(/\/mar/);
  const carnet = page.getByTestId('mar-carnet');
  await expect(carnet).toBeVisible({ timeout: 30_000 });
  await carnet.getByTestId('carnet-crear').click();
  await carnet.getByTestId('carnet-apodo-input').fill(`Compradora ${info.project.name}`);
  await carnet.getByTestId('carnet-guardar').click();
  const stamps = carnet.getByTestId('carnet-sellos');
  await expect(stamps).toContainText(storeName(landingEvent.id));
  await expect(stamps).not.toContainText(storeName(islandEvent.id));
  await carnet.getByTestId('mar-carnet-cerrar').click();
  await expect(carnet).toBeHidden();

  // El mar navega hasta la isla del evento (`?evento=`, con «Saltar»): su ficha ofrece la compra.
  expect(islandPlace, `la isla de ${islandEvent.id} está en el mundo`).toBeDefined();
  await openMar(page, `?evento=${islandEvent.id}`);
  await page
    .getByTestId('mar-entradas-saltar')
    .click({ timeout: 5_000 })
    .catch(() => {});
  const sheet = marSheet(page);
  await expect(sheet).toHaveAttribute('data-lugar', islandPlace!.identity.id, { timeout: 30_000 });
  await sheet.getByTestId('mar-comprar').first().click();

  await expect(checkout.getByTestId('checkout-confirmar')).toBeVisible({ timeout: CHECKOUT_LOAD });
  await expect(checkout.getByTestId('checkout-prueba')).toBeVisible();
  await expect(checkout.getByTestId('checkout-evento')).toHaveText(storeName(islandEvent.id));
  await checkout.getByTestId('checkout-confirmar').click();
  await expect(checkout.getByTestId('checkout-resultado')).toContainText(
    CHECKOUT_COPY.stamp.granted,
  );
  // El logro de la entrada ya estaba: no se repite.
  await expect(checkout.getByTestId('checkout-logro')).toHaveCount(0);

  await checkout.getByTestId('checkout-carnet').click();
  await expect(checkout).toBeHidden();
  const sellos = page.getByTestId('mar-carnet').getByTestId('carnet-sellos');
  await expect(sellos).toContainText(storeName(landingEvent.id));
  await expect(sellos).toContainText(storeName(islandEvent.id));
  await expect(sellos.locator('li')).toHaveCount(2);
});
