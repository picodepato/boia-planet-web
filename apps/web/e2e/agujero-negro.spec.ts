import { WORLD_REGISTRY, type WorldObject, worldToScreen } from '@boia/world';
import { expect, test, type Page } from '@playwright/test';

/**
 * Cambio de mundo por agujero negro en /juego (T41, D-23 punto 4): elegir
 * otro mundo en «Mundos» (o que el Admin cambie el mundo activo con /juego
 * abierto) hace caer el mundo a un vórtice centrado en el barco y despliega
 * el nuevo desde el mismo punto. El barco no se mueve (la entrada está
 * bloqueada mientras dura) y cada lugar queda en el mismo sitio de la
 * pantalla: `data-vista` dice dónde queda el origen del mundo, así que un
 * lugar se ve en `worldToScreen(lugar) + vista`. Con movimiento reducido, un
 * fundido. Los mundos y el lugar se leen del registro.
 *
 * /mar no está aquí: el plan 003 trabaja en él (ver el informe de T41).
 */

test.describe.configure({ timeout: 120_000 });

const first = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId);
const second = WORLD_REGISTRY.get(WORLD_REGISTRY.ids().find((id) => id !== first.id)!);
const islandOf = (o: WorldObject) =>
  o.behaviors.some((b) => b.type === 'content') && o.identity.active;
/** Un lugar de los dos mundos (el mapa es compartido, D-20.7). */
const place = first.config.objects.find(
  (o) => islandOf(o) && second.config.objects.some((x) => x.identity.id === o.identity.id),
)!;

const juego = (page: Page) => page.getByTestId('juego');
const attr = async (page: Page, name: string) => (await juego(page).getAttribute(name)) ?? '';

async function gameRunning(page: Page, worldId: string) {
  await expect(page.getByTestId('hud')).toContainText(/\d+ fps/, { timeout: 30_000 });
  await expect(juego(page)).toHaveAttribute('data-mundo', worldId);
  await expect(juego(page)).toHaveAttribute('data-vista', /\d/);
}

/** Dónde se ve el lugar en pantalla, con la cámara ya quieta. */
async function placeOnScreen(page: Page) {
  let last = '';
  await expect
    .poll(
      async () => {
        const now = await attr(page, 'data-vista');
        const same = now === last;
        last = now;
        return same;
      },
      { intervals: [600], timeout: 15_000 },
    )
    .toBe(true);
  const [vx, vy] = last.split(',').map(Number) as [number, number];
  const p = worldToScreen(place.position);
  return { x: Math.round(p.x + vx), y: Math.round(p.y + vy) };
}

/** Anota cada valor de `data-cambio-mundo` (un fundido dura 300 ms: no se escapa). */
async function watchSwitches(page: Page) {
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="juego"]')!;
    const seen: string[] = [];
    (window as Window & { __cambios?: string[] }).__cambios = seen;
    new MutationObserver(() => {
      const v = el.getAttribute('data-cambio-mundo');
      if (v && seen.at(-1) !== v) seen.push(v);
    }).observe(el, { attributes: true, attributeFilter: ['data-cambio-mundo'] });
  });
  return () => page.evaluate(() => (window as Window & { __cambios?: string[] }).__cambios ?? []);
}

async function openMundos(page: Page) {
  await page.getByTestId('menu-ancla').click();
  const menu = page.getByTestId('menu');
  await menu.getByRole('tab', { name: 'Mundos', exact: true }).click();
  return menu;
}

test('«Mundos»: el mundo cae al agujero negro y vuelve con cada lugar en su sitio', async ({
  page,
}) => {
  expect(place, 'hay un lugar en los dos mundos').toBeDefined();
  await page.goto(`/juego?cerca=${place.identity.id}`);
  await gameRunning(page, first.id);
  const ship = await attr(page, 'data-barco');
  const spot = await placeOnScreen(page);

  const menu = await openMundos(page);
  await menu.getByTestId(`mundo-${second.id}`).click();
  // El menú se cierra para ver el vórtice; mientras dura, nada responde.
  await expect(menu).toBeHidden();
  await expect(juego(page)).toHaveAttribute('data-cambio-mundo', 'vortice');
  await expect(page.getByTestId('cambio-mundo')).toBeVisible();
  // Acelerar durante la transición no mueve el barco.
  await page.locator('canvas:visible').first().focus();
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowUp');

  await expect(juego(page)).toHaveAttribute('data-mundo', second.id, { timeout: 20_000 });
  await expect(juego(page)).not.toHaveAttribute('data-cambio-mundo', /.+/, { timeout: 20_000 });
  await expect(page.getByTestId('cambio-mundo')).toHaveCount(0);
  expect(await attr(page, 'data-barco')).toBe(ship);
  expect(await placeOnScreen(page)).toEqual(spot);
  expect(await attr(page, 'data-arte-faltante')).toBe('0');

  // Y la entrada vuelve: ahora el barco sí navega.
  await page.locator('canvas:visible').first().focus();
  await page.keyboard.down('ArrowUp');
  await expect.poll(() => attr(page, 'data-barco'), { timeout: 10_000 }).not.toBe(ship);
  await page.keyboard.up('ArrowUp');
});

test('el Admin cambia el mundo activo con /juego abierto: el mismo agujero negro', async ({
  page,
  context,
}) => {
  await page.goto(`/juego?cerca=${place.identity.id}`);
  await gameRunning(page, first.id);
  const ship = await attr(page, 'data-barco');
  const spot = await placeOnScreen(page);

  const admin = await context.newPage();
  await admin.goto('/admin');
  await admin.getByTestId('admin-nav-temporadas').click();
  await admin.getByTestId(`temporada-${second.id}`).getByRole('radio').check();
  await expect(admin.getByTestId('admin-ok').first()).toBeVisible();
  await admin.close();

  await expect(juego(page)).toHaveAttribute('data-cambio-mundo', 'vortice', { timeout: 10_000 });
  await expect(juego(page)).toHaveAttribute('data-mundo', second.id, { timeout: 20_000 });
  await expect(juego(page)).not.toHaveAttribute('data-cambio-mundo', /.+/, { timeout: 20_000 });
  expect(await attr(page, 'data-barco')).toBe(ship);
  expect(await placeOnScreen(page)).toEqual(spot);
});

test.describe('con movimiento reducido', () => {
  test.use({ reducedMotion: 'reduce' });

  test('un fundido en vez del vórtice, con cada lugar en su sitio', async ({ page }) => {
    await page.goto(`/juego?cerca=${place.identity.id}`);
    await gameRunning(page, first.id);
    const ship = await attr(page, 'data-barco');
    const spot = await placeOnScreen(page);
    const switches = await watchSwitches(page);

    const menu = await openMundos(page);
    await menu.getByTestId(`mundo-${second.id}`).click();
    await expect(juego(page)).toHaveAttribute('data-mundo', second.id, { timeout: 20_000 });
    await expect(juego(page)).not.toHaveAttribute('data-cambio-mundo', /.+/, { timeout: 20_000 });
    expect(await switches()).toEqual(['fundido']);
    expect(await attr(page, 'data-barco')).toBe(ship);
    expect(await placeOnScreen(page)).toEqual(spot);
  });
});
