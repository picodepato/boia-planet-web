import { SAMPLE_DISCOUNTS } from '@boia/store';
import { WORLD_REGISTRY, type WorldObject } from '@boia/world';
import { expect, test, type Page } from '@playwright/test';
import { SAMPLE_CONTENT } from '../lib/landing/sample-content';

/**
 * Acuarela en /juego (T24): desde el Menú de a bordo, «Mundos» enseña los
 * dos mundos con su historia y su barco; elegir Acuarela cambia el mundo al
 * momento (el barco sigue donde está y pasa a ser el B02) y la elección se
 * recuerda al recargar. Después se navega, con el teclado, a la isla de
 * evento y al náufrago de Acuarela. Como en `mundo-arcilla.spec.ts`, cada
 * tramo empieza con `?cerca=<lugar>`. Corre en móvil 360×640 y en escritorio.
 */

test.describe.configure({ timeout: 120_000 });

const arcilla = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId);
const other = WORLD_REGISTRY.ids().find((id) => id !== arcilla.id)!;
const acuarela = WORLD_REGISTRY.get(other);
const objects = acuarela.config.objects;
const paramsOf = (o: WorldObject, type: string) =>
  o.behaviors.filter((b) => b.type === type).map((b) => b.params as Record<string, unknown>);

const eventIsland = objects.find((o) => paramsOf(o, 'content').some((p) => p.target === 'event'))!;
const eventId = paramsOf(eventIsland, 'content').find((p) => p.target === 'event')!.ref as string;
const castaway = objects.find((o) => o.identity.category === 'naufrago')!;
const castawayDiscount = SAMPLE_DISCOUNTS.find(
  (d) => d.id === paramsOf(castaway, 'reward').find((p) => p.kind === 'discount')?.ref,
)!;

async function gameRunning(page: Page, worldId: string) {
  await expect(page.getByTestId('hud')).toContainText(/\d+ fps/, { timeout: 30_000 });
  await expect(page.getByTestId('juego')).toHaveAttribute('data-mundo', worldId);
}

async function focusSea(page: Page) {
  await page
    .locator('canvas:visible')
    .first()
    .focus()
    .catch(() => {});
}

/** Rumbo norte hasta que se cumpla `until`. */
async function sailNorthUntil(page: Page, until: () => Promise<void>) {
  await page.keyboard.down('ArrowUp');
  try {
    await until();
  } finally {
    await page.keyboard.up('ArrowUp');
  }
}

test('«Mundos» cambia a Acuarela y se navega a su isla de evento y a su náufrago', async ({
  page,
}) => {
  const event = SAMPLE_CONTENT.events.find((e) => e.id === eventId)!;
  expect(event, `el evento ${eventId} de la isla existe`).toBeDefined();
  expect(castawayDiscount, 'el náufrago da un descuento').toBeDefined();

  // Se empieza en Arcilla (el por defecto), con su barco, junto a la isla de evento.
  await page.goto(`/juego?cerca=${eventIsland.identity.id}`);
  await gameRunning(page, arcilla.id);
  const juego = page.getByTestId('juego');
  await expect(juego).toHaveAttribute('data-ship-style', arcilla.theme.ship.style);

  // Menú → Mundos: los dos mundos, con su historia y su barco.
  await page.getByTestId('menu-ancla').click();
  const menu = page.getByTestId('menu');
  await menu.getByRole('tab', { name: 'Mundos', exact: true }).click();
  const list = menu.getByTestId('mundos');
  await expect(list).toBeVisible();
  for (const w of WORLD_REGISTRY.list()) {
    const item = list.getByTestId(`mundo-${w.id}`);
    await expect(item).toContainText(w.name);
    await expect(item).toContainText(w.tagline!);
    await expect(list.getByTestId(`mundo-${w.id}-barco`)).toContainText('Barco:');
  }
  await expect(list.getByTestId(`mundo-${arcilla.id}`)).toHaveAttribute('aria-checked', 'true');

  // Elegir Acuarela: el menú se cierra, el mundo cambia por el agujero negro
  // (T41) y, sin barco elegido, el barco pasa a ser el suyo.
  await list.getByTestId(`mundo-${acuarela.id}`).click();
  await expect(menu).toBeHidden();
  await expect(juego).toHaveAttribute('data-mundo', acuarela.id, { timeout: 20_000 });
  await expect(juego).not.toHaveAttribute('data-cambio-mundo', /.+/, { timeout: 20_000 });
  await expect(juego).toHaveAttribute('data-ship-style', acuarela.theme.ship.style, {
    timeout: 20_000,
  });
  await page.getByTestId('menu-ancla').click();
  await menu.getByRole('tab', { name: 'Mundos', exact: true }).click();
  await expect(list.getByTestId(`mundo-${acuarela.id}`)).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();

  // A la isla de evento de Acuarela: el mismo panel del evento, en el mismo sitio.
  await focusSea(page);
  const panel = page.getByTestId('panel-evento');
  await sailNorthUntil(page, () => expect(panel).toBeVisible({ timeout: 20_000 }));
  await expect(panel.getByRole('heading', { name: event.name })).toBeVisible();

  // Al recargar sigue en Acuarela (se recuerda); ahora, al náufrago.
  await page.goto(`/juego?cerca=${castaway.identity.id}`);
  await gameRunning(page, acuarela.id);
  await expect(juego).toHaveAttribute('data-ship-style', acuarela.theme.ship.style);
  await focusSea(page);
  const found = page.getByTestId('panel-descuento');
  await sailNorthUntil(page, () => expect(found).toBeVisible({ timeout: 20_000 }));
  await expect(found.getByTestId('descuento-codigo')).toHaveText(castawayDiscount.code);
});
