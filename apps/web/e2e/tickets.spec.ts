import { SAMPLE_ACHIEVEMENTS, SAMPLE_EVENTS } from '@boia/store';
import { WORLD_REGISTRY } from '@boia/world';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { t } from '../lib/i18n/web';
import { CARNET_CREATE_HREF } from '../lib/landing/access';
import { CHECKOUT_COPY } from '../lib/ticketing/copy';
import { TICKET_TRIGGER } from '../lib/ticketing/sandbox';
import { openTickets } from './hero-helpers';
import { marSheet, openMar } from './mar-helpers';
import { BOX_OFFICE_EVENTS, ONLINE_EVENT } from './online-event';

/**
 * Compra de prueba (T25, D-20, REQ-COM-035), sin ticketera ni servidor:
 * se compra el evento con checkout online desde el panel de Tickets de la
 * landing y otra vez desde su isla en el mar 3D; el sello sale una sola vez
 * en Mi Carnet. Halloween y SONIDO se venden sólo en taquilla (plan 017
 * T199, decisión 8): su «Comprar entradas» da el aviso y el Carnet, sin
 * checkout. Corre en móvil 360×640 y en escritorio.
 */

// Desde T199 sólo un evento de la muestra tiene checkout online.
const islandEvent = ONLINE_EVENT;
const landingEvent = ONLINE_EVENT;
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

test('landing → compra de prueba → Mi Carnet; isla → compra de prueba → un solo sello', async ({
  page,
}, info) => {
  test.setTimeout(150_000);
  expect(islandEvent, 'hay un evento a la venta con isla').toBeDefined();
  expect(landingEvent, 'hay un evento con checkout online').toBeDefined();

  // Landing → Tickets → «Comprar entradas». Con un parámetro, sin cinemática (D-21).
  await page.goto('/?intro=0');
  await openTickets(page);
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
  await expect(stamps.locator('li')).toHaveCount(1);
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
    CHECKOUT_COPY.stamp.already_stamped,
  );
  // El logro de la entrada ya estaba: no se repite.
  await expect(checkout.getByTestId('checkout-logro')).toHaveCount(0);

  await checkout.getByTestId('checkout-carnet').click();
  await expect(checkout).toBeHidden();
  const sellos = page.getByTestId('mar-carnet').getByTestId('carnet-sellos');
  await expect(sellos).toContainText(storeName(landingEvent.id));
  await expect(sellos).toContainText(storeName(islandEvent.id));
  await expect(sellos.locator('li')).toHaveCount(1);
});

// Capturas para Hernán (T199): `T199_SHOTS=<carpeta>`.
async function shot(page: Page, name: string, project: string) {
  const dir = process.env.T199_SHOTS;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}-${project}.png`) });
}

test('Halloween y SONIDO: taquilla con el descuento del Carnet, en la landing y en su isla', async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  expect(BOX_OFFICE_EVENTS.length, 'hay eventos de taquilla').toBeGreaterThan(0);
  const message = t('ticketing.boxOffice.message', { euros: '2' });

  await page.goto('/?intro=0');
  await openTickets(page);
  const panel = page.getByRole('dialog', { name: 'Elige tu evento' });
  await expect(panel).toBeVisible();
  for (const e of BOX_OFFICE_EVENTS) {
    await panel.getByTestId(`comprar-${e.id}`).click();
    const box = page.getByTestId('box-office');
    await expect(box).toBeVisible();
    await expect(box.getByRole('heading')).toHaveText(e.name);
    await expect(box.getByTestId('box-office-message')).toContainText(message);
    await expect(box.getByTestId('box-office-message')).toContainText(
      `${t('ticketing.boxOffice.invite')} ${t('ticketing.boxOffice.carnet')}`,
    );
    await expect(box.getByTestId('box-office-carnet')).toHaveAttribute('href', CARNET_CREATE_HREF);
    await expect(page.getByTestId('checkout')).toHaveCount(0);
    await shot(page, `taquilla-landing-${e.id}`, info.project.name);
    await box.getByTestId('box-office-close').click();
    await expect(box).toHaveCount(0);
  }
  // El evento online sigue con su checkout.
  await panel.getByTestId(`comprar-${ONLINE_EVENT.id}`).click();
  await expect(page.getByTestId('checkout')).toBeVisible({ timeout: CHECKOUT_LOAD });
  await expect(page.getByTestId('box-office')).toHaveCount(0);

  // En el mar: la ficha de la isla de Halloween da el mismo aviso y su botón abre Mi Carnet.
  const [halloween] = BOX_OFFICE_EVENTS;
  await openMar(page, `?evento=${halloween!.id}`);
  await page
    .getByTestId('mar-entradas-saltar')
    .click({ timeout: 5_000 })
    .catch(() => {});
  const sheet = marSheet(page);
  await expect(sheet).toHaveAttribute('data-lugar', halloween!.islandId!, { timeout: 30_000 });
  await sheet.getByTestId('mar-comprar').first().click();
  const box = page.getByTestId('box-office');
  await expect(box.getByTestId('box-office-message')).toContainText(message);
  await expect(page.getByTestId('checkout-confirmar')).toHaveCount(0);
  await shot(page, `taquilla-mar-${halloween!.id}`, info.project.name);
  await box.getByTestId('box-office-carnet').click();
  await expect(box).toHaveCount(0);
  await expect(page.getByTestId('mar-carnet')).toBeVisible();
});
