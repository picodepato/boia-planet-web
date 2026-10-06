import { CASTLE_PLACE_ID, LIGHTHOUSE_PLACE_ID, WORLD_REGISTRY } from '@boia/world';
import { type Page, expect, test } from '@playwright/test';
import { marWorld } from '../app/mar/engine/compact';
import { BOARD_CARDS, boardDestinations } from '../lib/mundo/board';
import { t } from '../lib/i18n';
import { mar, openMar } from './mar-helpers';

/**
 * Plan 014 T157: el faro, junto a la salida, ya no tiene minijuego; al llegar
 * abre el «Tablón del faro» con tres tarjetas (Cañón, Castillo, Carrera) y su
 * «Rumbo a…», que marca cada destino como el «!» de ayuda (con el ratón o el
 * dedo y con el teclado). El castillo, junto a la Boia 7, es la isla de su
 * minijuego: su panel sale como el del Cañón y dice «Próximamente» hasta T162.
 */

test.describe.configure({ timeout: 180_000 });

const world = marWorld(WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config);
const destinations = boardDestinations(world.objects);
const at = (id: string) => world.objects.find((o) => o.identity.id === id)!.position;

const board = (page: Page) =>
  page.locator(`[data-testid="mar-ficha"][data-lugar="${LIGHTHOUSE_PLACE_ID}"]`);

test('el tablón del faro: tres tarjetas y «Rumbo a…» marca cada destino', async ({
  page,
}, info) => {
  const touch = info.project.name === 'mobile';
  const errors = await openMar(page, `?ir=${LIGHTHOUSE_PLACE_ID}`);
  await expect(mar(page)).toHaveAttribute('data-llegada', LIGHTHOUSE_PLACE_ID, { timeout: 60_000 });
  await expect(board(page)).toBeVisible();
  // Se abre ya desplegado, con sus tres tarjetas en orden.
  await expect(board(page)).toHaveAttribute('data-expandida', 'si');
  await expect(board(page).getByRole('heading', { name: t('mar.tablon.titulo') })).toBeVisible();
  const cards = board(page).getByTestId('tablon').locator('> li');
  await expect(cards).toHaveCount(BOARD_CARDS.length);
  // Sin partidas, ninguna medalla (el Castillo no tendrá hasta T162).
  await expect(board(page).locator('[data-testid^="tablon-medalla-"]')).toHaveCount(0);

  for (const [i, card] of BOARD_CARDS.entries()) {
    const place = destinations[card]!;
    expect(place, card).toBeTruthy();
    const item = board(page).getByTestId(`tablon-${card}`);
    await expect(item).toHaveAttribute('data-destino', place);
    const go = item.getByTestId(`tablon-rumbo-${card}`);
    await expect(go).toHaveAttribute('aria-pressed', 'false');
    if (i === 1 && !touch) {
      // En escritorio, con el teclado: el foco en el botón y Enter.
      await go.focus();
      await page.keyboard.press('Enter');
    } else if (touch) {
      // En el móvil, con el dedo.
      await go.tap();
    } else {
      await go.click();
    }
    await expect(mar(page)).toHaveAttribute('data-objective-target', place);
    await expect(go).toHaveAttribute('aria-pressed', 'true');
    await expect(go).toHaveText(t('mar.tablon.marcado'));
    // Sólo una tarjeta marcada a la vez.
    await expect(board(page).locator('[aria-pressed="true"]')).toHaveCount(1);
  }
  // Ninguna tarjeta se sale de la ficha ni de la pantalla.
  const viewport = page.viewportSize()!;
  for (const card of BOARD_CARDS) {
    const box = (await board(page).getByTestId(`tablon-rumbo-${card}`).boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  }
  expect(errors).toEqual([]);
});

test('la isla del castillo, junto a la Boia 7, abre su panel: «Próximamente»', async ({ page }) => {
  // Junto a la Boia 7 de la carrera, fuera de su camino (lo comprueban las pruebas de unidad).
  const castle = at(CASTLE_PLACE_ID);
  const buoy = at('circuito-delfin');
  expect(Math.hypot(castle.x - buoy.x, castle.y - buoy.y)).toBeLessThan(600);

  const errors = await openMar(page, `?ir=${CASTLE_PLACE_ID}`);
  await expect(mar(page)).toHaveAttribute('data-llegada', CASTLE_PLACE_ID, { timeout: 90_000 });
  const sheet = page.getByTestId('mar-ficha');
  if (await sheet.isVisible().catch(() => false)) {
    await sheet
      .getByRole('button', { name: t('mar.sheet.cerrar') })
      .first()
      .click();
  }
  const panel = page.getByTestId('panel-minijuego');
  await expect(panel).toBeVisible({ timeout: 15_000 });
  await expect(panel).toHaveAttribute('data-game', CASTLE_PLACE_ID);
  await expect(panel).toHaveAttribute('data-bloqueado', 'si');
  await expect(panel.getByRole('heading', { name: t('mar.castillo.titulo') })).toBeVisible();
  await expect(panel.getByTestId('panel-minijuego-bloqueo')).toHaveText(
    t('mar.castillo.proximamente'),
  );
  await expect(panel.getByRole('button', { name: t('juego.minigameLayer.jugar') })).toBeDisabled();
  // El castillo de siempre: su modelo (o, sin él, la composición a mano).
  await expect(page.getByTestId('mar-canvas')).toHaveAttribute(
    'data-castillo-modelo',
    /glb|procedural/,
  );
  expect(errors).toEqual([]);
});
