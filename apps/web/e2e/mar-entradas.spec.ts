import { SAMPLE_DISCOUNTS, SAMPLE_EVENTS } from '@boia/store';
import { WORLD_REGISTRY, type WorldObject } from '@boia/world';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marWorld } from '../app/mar/engine/compact';
import { SAMPLE_CONTENT } from '../lib/landing/sample-content';
import { CHECKOUT_COPY } from '../lib/ticketing/copy';

/**
 * Entradas dentro del mar 3D (T58, REQ-ENT-037): «Entradas» abre «Elige tu
 * evento» en la hoja de abajo, sin salir de /mar ni ir a la landing; con el
 * código del náufrago encontrado navegando, la compra de prueba lo aplica; el
 * sello llega a Mi Carnet (dentro del mar) y, si no se mira el Carnet, llega
 * la invitación a crearlo. La analítica dice que la compra vino del mundo.
 * Todo sale del mapa y de la muestra.
 *
 * Con RECORD_T58=1 deja capturas en docs/informes/img/ p005-t58-*.png (móvil).
 */

test.describe.configure({ timeout: 120_000 });

const objects = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config.objects;
const castaway = objects.find((o) => o.identity.category === 'naufrago')!;
const rewardRef = (o: WorldObject) =>
  o.behaviors.flatMap((b) =>
    b.type === 'reward' && b.params.kind === 'discount' && b.params.ref ? [b.params.ref] : [],
  )[0];
const discount = SAMPLE_DISCOUNTS.find((d) => d.id === rewardRef(castaway))!;
const event = SAMPLE_CONTENT.events.find((e) => e.id === discount.eventId)!;
// Mi Carnet lee los nombres del repositorio.
const storeName = (id: string) => SAMPLE_EVENTS.find((e) => e.id === id)!.name;

const mar = (page: Page) => page.locator('main.mar');

const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../docs/informes/img',
);

async function snap(page: Page, name: string) {
  if (test.info().project.name !== 'mobile' || !process.env.RECORD_T58) return;
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, name) });
}

async function openMar(page: Page, query = '') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`/mar${query}`);
  await expect(page.getByTestId('mar-canvas')).toBeVisible();
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 30_000 });
  await expect(mar(page)).toHaveAttribute('data-barco', /\d/);
  return errors;
}

async function shipAt(page: Page) {
  const [x, y] = ((await mar(page).getAttribute('data-barco')) ?? '0,0').split(',').map(Number);
  return { x: x!, y: y! };
}

/** Gobierna con las flechas hacia un lugar del mar 3D hasta que `done` se cumpla. */
async function steerTo(page: Page, id: string, done: () => Promise<boolean>) {
  const first = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config;
  const target = marWorld(first).objects.find((o) => o.identity.id === id)!.position;
  const held = new Set<string>();
  const hold = async (keys: string[]) => {
    for (const k of [...held]) {
      if (keys.includes(k)) continue;
      await page.keyboard.up(k);
      held.delete(k);
    }
    for (const k of keys) {
      if (held.has(k)) continue;
      await page.keyboard.down(k);
      held.add(k);
    }
  };
  try {
    const until = Date.now() + 25_000;
    while (Date.now() < until && !(await done())) {
      const s = await shipAt(page);
      const dx = target.x - s.x;
      const dy = target.y - s.y;
      const d = Math.hypot(dx, dy) || 1;
      const keys: string[] = [];
      if (dx / d > 0.35) keys.push('ArrowRight');
      if (dx / d < -0.35) keys.push('ArrowLeft');
      if (dy / d > 0.35) keys.push('ArrowDown');
      if (dy / d < -0.35) keys.push('ArrowUp');
      await hold(keys);
      await page.waitForTimeout(150);
    }
  } finally {
    await hold([]);
  }
}

const discountFound = (page: Page) => async () =>
  (await page.locator('[data-testid="mar-ficha"][data-tipo="discount"]').count()) > 0;

type Captured = { event: string } & Record<string, unknown>;
async function analytics(page: Page): Promise<Captured[]> {
  return page.evaluate(() =>
    (window.__boiaAnalytics ?? []).map((e) => ({ event: e.event, ...e.properties })),
  );
}

/** La ruta sigue siendo /mar: nada salió del mundo ni fue a la landing. */
async function expectStillAtSea(page: Page) {
  expect(new URL(page.url()).pathname).toBe('/mar');
}

test('«Entradas» abre «Elige tu evento» en el mar; el código encontrado se aplica y el sello llega al Carnet', async ({
  page,
}, info) => {
  expect(discount, 'el náufrago esconde un código de la muestra').toBeDefined();
  expect(event, 'el código es de un evento de la muestra').toBeDefined();
  const errors = await openMar(page, `?cerca=${castaway.identity.id}`);

  // El código del náufrago, encontrado navegando.
  await steerTo(page, castaway.identity.id, discountFound(page));
  await expect(page.getByTestId('mar-ficha')).toHaveAttribute('data-tipo', 'discount');
  await expect(page.getByTestId('mar-ficha')).toContainText(discount.code);

  // «Entradas»: el panel se abre dentro del mundo, con el aviso del código.
  const tickets = page.getByTestId('mar-entradas');
  await tickets.click();
  const panel = page.getByRole('dialog', { name: 'Elige tu evento' });
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('data-testid', 'mar-entradas-panel');
  await expect(tickets).toHaveAttribute('aria-expanded', 'true');
  await expectStillAtSea(page);
  const card = panel.getByTestId(`mar-entrada-${event.id}`);
  await expect(card).toContainText(event.name);
  await expect(card.getByTestId('banner-descuento-codigo')).toHaveText(discount.code);
  await snap(page, 'p005-t58-entradas.png');

  // «Comprar entrada»: el checkout de prueba encima, con el código aplicado.
  await card.getByTestId(`mar-entradas-comprar-${event.id}`).click();
  const checkout = page.getByTestId('checkout');
  await expect(checkout.getByTestId('checkout-confirmar')).toBeVisible({ timeout: 20_000 });
  await expect(checkout).toHaveClass(/checkout--mar/);
  await expect(checkout.getByTestId('checkout-prueba')).toHaveText(CHECKOUT_COPY.kicker);
  await expect(checkout.getByTestId('checkout-evento')).toHaveText(event.name);
  await expect(checkout.getByTestId('checkout-descuento')).toHaveAttribute(
    'data-discount-id',
    discount.id,
  );
  await snap(page, 'p005-t58-checkout.png');
  await checkout.getByTestId('checkout-confirmar').click();
  await expect(checkout.getByTestId('checkout-resultado')).toContainText(
    CHECKOUT_COPY.stamp.granted,
  );
  await snap(page, 'p005-t58-comprada.png');
  await expectStillAtSea(page);

  // «Ver mi Carnet»: Mi Carnet dentro del mar; al crearlo, el sello ya está.
  await checkout.getByTestId('checkout-carnet').click();
  await expect(checkout).toHaveCount(0);
  await expect(panel).toHaveCount(0);
  const carnet = page.getByTestId('mar-carnet');
  await expect(carnet).toBeVisible();
  await carnet.getByTestId('carnet-crear').click();
  await carnet.getByTestId('carnet-apodo-input').fill(`Marinera ${info.project.name}`);
  await carnet.getByTestId('carnet-guardar').click();
  await expect(carnet.getByTestId('carnet-sellos')).toContainText(storeName(event.id));
  await expectStillAtSea(page);

  // El embudo: panel abierto desde el mundo, clic de compra y compra confirmada del mundo.
  const events = await analytics(page);
  expect(events).toContainEqual(
    expect.objectContaining({ event: 'tickets_panel_open', source: 'world' }),
  );
  expect(events).toContainEqual(
    expect.objectContaining({ event: 'ticket_click_out', eventId: event.id, source: 'world' }),
  );
  expect(events).toContainEqual(
    expect.objectContaining({
      event: 'purchase_confirmed',
      eventId: event.id,
      provider: 'sandbox',
      discountId: discount.id,
      source: 'world',
    }),
  );
  expect(errors).toEqual([]);
});

test('sin código: precio entero; al cerrar tras comprar, el panel se va y llega la invitación al Carnet', async ({
  page,
}) => {
  const errors = await openMar(page);
  await page.getByTestId('mar-entradas').click();
  const panel = page.getByTestId('mar-entradas-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId(`mar-entrada-${event.id}`)).toBeVisible();
  await expect(panel.getByTestId('banner-descuento')).toHaveCount(0);

  // Cerrar sin comprar vuelve al panel; otro toque de «Entradas» lo cierra.
  await panel.getByTestId(`mar-entradas-comprar-${event.id}`).click();
  const checkout = page.getByTestId('checkout');
  await expect(checkout.getByTestId('checkout-sin-descuento')).toBeVisible({ timeout: 20_000 });
  await checkout.getByTestId('checkout-cerrar').click();
  await expect(checkout).toHaveCount(0);
  await expect(panel).toBeVisible();
  await page.getByTestId('mar-entradas-cerrar').click();
  await expect(panel).toHaveCount(0);

  // Comprar y cerrar: el panel se cierra y llega la invitación (como en la landing).
  await page.getByTestId('mar-entradas').click();
  await panel.getByTestId(`mar-entradas-comprar-${event.id}`).click();
  await checkout.getByTestId('checkout-confirmar').click();
  await expect(checkout.getByTestId('checkout-resultado')).toBeVisible();
  await checkout.getByTestId('checkout-cerrar').click();
  await expect(checkout).toHaveCount(0);
  await expect(panel).toHaveCount(0);
  const invite = page.getByTestId('invitacion-carnet');
  await expect(invite).toHaveAttribute('data-motivo', 'purchase');
  await expectStillAtSea(page);
  expect(errors).toEqual([]);
});
