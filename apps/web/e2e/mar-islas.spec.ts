import { TICKET_EVENT_ISLANDS } from '@boia/store';
import { HALLOWEEN_PLACE_ID, WORLD_REGISTRY } from '@boia/world';
import { expect, test } from '@playwright/test';
import { t } from '../lib/i18n';
import { SAMPLE_CONTENT } from '../lib/landing/sample-content';
import { mar, marSheet, openMar } from './mar-helpers';

/**
 * Las islas y los eventos con entradas del 2026-10-02 en /mar (T67): «Entradas»
 * enseña exactamente los tres eventos (HALLOWEEN IN THE CLUB, ALL DAY BOIA y
 * BOIA Nochevieja; nombres de la reunión del 2026-10-08, T219), cada uno con
 * su isla, y `/mar?ir=halloween` sale navegando a su isla y abre su evento. Que la entrega de la Fiestera nombra
 * la Isla de Nochevieja lo prueba mar-fiestera.spec.ts. Corre en móvil y en
 * escritorio.
 */

test.describe.configure({ timeout: 120_000 });

const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config;
/** Los tres eventos a la venta de la muestra, en el orden del contenido. */
const ticketEvents = SAMPLE_CONTENT.events.filter((e) => e.id in TICKET_EVENT_ISLANDS);
const halloween = world.objects.find((o) => o.identity.id === HALLOWEEN_PLACE_ID)!;
const halloweenEvent = ticketEvents.find((e) => e.islandId === HALLOWEEN_PLACE_ID)!;

test('«Entradas» en el mar enseña exactamente los tres eventos, cada uno con su isla', async ({
  page,
}) => {
  expect(ticketEvents).toHaveLength(3);
  const errors = await openMar(page);
  await page.getByTestId('mar-entradas').click();
  const panel = page.getByTestId('mar-entradas-panel');
  await expect(panel).toBeVisible();
  const cards = panel.locator('article.mar-entrada');
  await expect(cards).toHaveCount(ticketEvents.length);
  for (const e of ticketEvents) {
    const card = panel.getByTestId(`mar-entrada-${e.id}`);
    await expect(card).toContainText(e.name);
    await expect(card).toHaveAttribute('data-estado', 'on_sale');
    await expect(card.getByTestId(`mar-entradas-comprar-${e.id}`)).toBeVisible();
  }
  // Ninguno de los de antes (ni la primavera, ni la noche de mayo, ni el verano).
  await expect(panel).not.toContainText('Primavera');
  await expect(panel).not.toContainText('Noche · Mayo');
  expect(errors).toEqual([]);
});

test('`/mar?ir=halloween` sale navegando a la isla de Halloween y abre su evento', async ({
  page,
}) => {
  // El nombre del mapa es el del catálogo (T219: HALLOWEEN IN THE CLUB).
  expect(halloween.identity.name).toBe(t('island.halloween.name'));
  const errors = await openMar(page, `?ir=${HALLOWEEN_PLACE_ID}`);
  await expect.poll(() => new URL(page.url()).searchParams.has('ir')).toBe(false);
  // Navegando (el viaje en turbo de la barra) y, al llegar, la ficha del evento.
  const seenSailing = page
    .locator(`[data-testid="mar-viaje"][data-lugar="${HALLOWEEN_PLACE_ID}"]`)
    .waitFor({ timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  await expect(mar(page)).toHaveAttribute('data-llegada', HALLOWEEN_PLACE_ID, { timeout: 60_000 });
  expect(await seenSailing, 'el barco navegó hasta la isla').toBe(true);
  const sheet = marSheet(page);
  await expect(sheet).toHaveAttribute('data-tipo', 'event');
  await expect(sheet).toHaveAttribute('data-lugar', HALLOWEEN_PLACE_ID);
  await expect(sheet).toContainText(halloweenEvent.name);
  // Su rótulo en el mar dice su nombre.
  await expect(page.locator(`[data-pin="${HALLOWEEN_PLACE_ID}"]`)).toContainText(
    halloween.identity.name,
  );
  expect(errors).toEqual([]);
});
