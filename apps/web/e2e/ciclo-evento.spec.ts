import { WORLD_REGISTRY } from '@boia/world';
import { expect, test, type Page } from '@playwright/test';
import { eventIslands } from '../lib/admin/world';
import { EVENTOS_COPY } from '../lib/landing/eventos-copy';
import { eventHref } from '../lib/landing/eventos';

/**
 * El ciclo completo de un evento sin desplegar código (REQ-COM-014, T42),
 * desde el Admin de la demo y en el mismo navegador (D-20):
 *
 * 1. publicar un evento futuro a la venta en la isla de evento: sale en la
 *    home, en Tickets, en su ficha y la isla lo abre con su compra;
 * 2. agotarlo: se ve agotado, sin compra;
 * 3. finalizarlo: sale de la home, su ficha sigue (recuerdos, sin compra) y
 *    la isla se queda con su recuerdo;
 * 4. ligar otro evento nuevo a la misma isla: la isla lo abre y conserva el
 *    anterior en sus recuerdos;
 * 5. posponerlo y cancelarlo: aviso en la home y en su ficha, sin compra.
 *
 * Corre en móvil 360×640 y en escritorio.
 */

test.describe.configure({ timeout: 240_000 });

const island = eventIslands(WORLD_REGISTRY.map).find((p) =>
  p.behaviors.some((b) => b.type === 'content' && b.params.target === 'event'),
)!;

// Ids y slugs los pone el Admin a partir del nombre (`saveEvent`).
const A = { name: 'Ciclo Isla', id: 'ev-ciclo-isla', slug: 'ciclo-isla' };
const B = { name: 'Ciclo Dos', id: 'ev-ciclo-dos', slug: 'ciclo-dos' };

/** Mañana (o pasado) a las 22:00, para el `<input type="datetime-local">`. */
function localDay(daysAhead: number): string {
  const d = new Date(Date.now() + daysAhead * 24 * 3600_000 + 12 * 3600_000);
  return `${d.toISOString().slice(0, 10)}T22:00`;
}

async function admin(page: Page) {
  await page.goto('/admin');
  await page.getByTestId('admin-nav-eventos').click();
  await expect(page.getByTestId('admin-seccion-eventos')).toBeVisible();
}

async function createEvent(page: Page, e: typeof A, day: number) {
  await admin(page);
  await page.getByTestId('evento-nuevo').click();
  const form = page.getByTestId('evento-form');
  await form.getByTestId('evento-nombre').fill(e.name);
  await form.getByTestId('evento-fecha').fill(localDay(day));
  await form.getByTestId('evento-estado').selectOption('on_sale');
  await form.getByTestId('evento-precio').fill('12,50');
  await form
    .getByTestId('evento-tickets')
    .fill(`https://example.com/boia-sandbox/tickets/${e.slug}`);
  await form.getByTestId('evento-isla').selectOption(island.id);
  await form.getByTestId('evento-guardar').click();
  await expect(page.getByTestId(`evento-${e.id}`)).toContainText(e.name);
}

/** Cambia el estado a mano desde la lista del Admin. */
async function setState(page: Page, e: typeof A, state: keyof typeof EVENTOS_COPY.state) {
  await admin(page);
  await page.getByTestId(`evento-estado-${e.id}`).selectOption(state);
  await expect(page.getByTestId(`evento-ahora-${e.id}`)).toContainText(
    `Ahora: ${EVENTOS_COPY.state[state]}`,
  );
}

async function home(page: Page) {
  await page.goto('/?intro=0');
  await expect(page.locator('main')).toHaveAttribute('data-contenido', 'repositorio');
}

const card = (page: Page, e: typeof A) =>
  page.locator('#eventos').locator(`[data-evento="${e.id}"]`);

async function ficha(page: Page, e: typeof A) {
  await page.goto(eventHref(e.slug));
  const f = page.getByTestId('evento-ficha');
  // Un evento creado en el Admin no tiene HTML propio: lo pinta el navegador.
  await expect(f).toBeVisible({ timeout: 15_000 });
  await expect(f.getByRole('heading', { level: 1 })).toHaveText(e.name);
  return f;
}

/** Navega hasta la isla de evento y devuelve su panel. */
async function sailToIsland(page: Page) {
  await page.goto(`/juego?cerca=${island.id}`);
  await expect(page.getByTestId('hud')).toContainText(/\d+ fps/, { timeout: 30_000 });
  await page
    .locator('canvas:visible')
    .first()
    .focus()
    .catch(() => {});
  const panel = page.getByTestId('panel-evento');
  await page.keyboard.down('ArrowUp');
  try {
    await expect(panel).toBeVisible({ timeout: 25_000 });
  } finally {
    await page.keyboard.up('ArrowUp');
  }
  return panel;
}

test('ciclo de un evento: publicar, agotar, finalizar, otro en la isla, posponer y cancelar', async ({
  page,
}) => {
  // 1. Publicar: home, Tickets, ficha, mapa (la isla) y su compra.
  await createEvent(page, A, 1);
  await expect(page.getByTestId(`isla-${island.id}`)).toContainText(`Abre ahora: ${A.name}`);
  await home(page);
  await expect(card(page, A).getByTestId(`comprar-${A.id}`)).toBeVisible();
  await page.locator('.hero').getByRole('link', { name: 'Tickets', exact: true }).click();
  const tickets = page.getByRole('dialog', { name: 'Elige tu evento' });
  await expect(tickets.getByTestId(`comprar-${A.id}`)).toBeVisible();
  let f = await ficha(page, A);
  await expect(f.getByTestId(`comprar-${A.id}`)).toBeVisible();
  await expect(f.getByTestId('evento-precio')).toContainText('12,50');
  let panel = await sailToIsland(page);
  await expect(panel.getByRole('heading', { name: A.name })).toBeVisible();
  await expect(panel.getByTestId('panel-evento-comprar')).toBeVisible({ timeout: 10_000 });

  // 2. Agotarlo: agotado en la home y en su ficha, sin compra.
  await setState(page, A, 'sold_out');
  await home(page);
  await expect(card(page, A)).toHaveAttribute('data-estado', 'sold_out');
  await expect(card(page, A).getByTestId(`comprar-${A.id}`)).toHaveCount(0);
  f = await ficha(page, A);
  await expect(f.getByTestId('evento-estado')).toHaveText(EVENTOS_COPY.state.sold_out);
  await expect(f.getByTestId('evento-aviso')).toContainText(EVENTOS_COPY.stateBody.sold_out);
  await expect(f.locator('[data-testid^="comprar-"]')).toHaveCount(0);

  // 3. Finalizarlo: fuera de la home; su URL sigue, con recuerdos y sin compra;
  //    la isla se queda con su recuerdo y vuelve a su siguiente evento.
  await setState(page, A, 'finished');
  await expect(page.getByTestId(`isla-${island.id}`)).toContainText(
    new RegExp(`Recuerdos:.*${A.name}`),
  );
  await expect(page.getByTestId(`isla-${island.id}`)).not.toContainText(`Abre ahora: ${A.name}`);
  await home(page);
  await expect(card(page, A)).toHaveCount(0);
  f = await ficha(page, A);
  await expect(f).toHaveAttribute('data-estado', 'finished');
  await expect(f.getByTestId('evento-recuerdos')).toBeVisible();
  await expect(f.locator('[data-testid^="comprar-"]')).toHaveCount(0);

  // 4. Otro evento nuevo en la misma isla: la isla lo abre y guarda el anterior.
  await createEvent(page, B, 2);
  await expect(page.getByTestId(`isla-${island.id}`)).toContainText(`Abre ahora: ${B.name}`);
  await home(page);
  await expect(card(page, B).getByTestId(`comprar-${B.id}`)).toBeVisible();
  panel = await sailToIsland(page);
  await expect(panel.getByRole('heading', { name: B.name })).toBeVisible();
  await expect(panel.getByTestId('panel-recuerdos')).toContainText(A.name);
  await expect(panel.getByTestId('ver-fotos-isla')).toHaveAttribute('href', `/fotos#${island.id}`);

  // 5. Posponerlo y cancelarlo: aviso, sin compra.
  for (const state of ['postponed', 'cancelled'] as const) {
    await setState(page, B, state);
    await home(page);
    await expect(card(page, B)).toHaveAttribute('data-estado', state);
    await expect(card(page, B)).toContainText(EVENTOS_COPY.stateBody[state]);
    await expect(card(page, B).getByTestId(`comprar-${B.id}`)).toHaveCount(0);
    f = await ficha(page, B);
    await expect(f.getByTestId('evento-aviso')).toContainText(EVENTOS_COPY.stateBody[state]);
    await expect(f.locator('[data-testid^="comprar-"]')).toHaveCount(0);
  }
  // La isla enseña el aviso del evento cancelado, sin compra.
  panel = await sailToIsland(page);
  await expect(panel).toHaveAttribute('data-estado', 'cancelled');
  await expect(panel.getByTestId('panel-evento-aviso')).toContainText(
    EVENTOS_COPY.stateBody.cancelled,
  );
  await expect(panel.getByTestId('panel-evento-comprar')).toHaveCount(0);
});
