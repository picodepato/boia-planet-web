import { CASTLE_PLACE_ID, LIGHTHOUSE_PLACE_ID, WORLD_REGISTRY } from '@boia/world';
import { type Locator, type Page, expect, test } from '@playwright/test';
import { marWorld } from '../app/mar/engine/compact';
import { shortest, periodOf, planetRect } from '../app/mar/engine/wrap';
import { BOARD_CARDS, boardDestinations } from '../lib/mundo/board';
import { CANON_BEST_KEY, canonBoardBosses, canonBoardKey } from '../lib/mundo/ranking-canon';
import { t } from '../lib/i18n';
import { mar, openMar, shipAt } from './mar-helpers';

// T168: the collapsed board opens the minimap's shared destination sheet.
// REQ-AVE-036's existing evidence title, «el tablón del faro: tres tarjetas y «Rumbo a…»,
// is superseded here: the destinations now open a preview instead of marking a course.
test.describe.configure({ timeout: 180_000 });

const world = marWorld(WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config);
const destinations = boardDestinations(world.objects);
const at = (id: string) => world.objects.find((o) => o.identity.id === id)!.position;
const board = (page: Page) =>
  page.locator(`[data-testid="mar-ficha"][data-lugar="${LIGHTHOUSE_PLACE_ID}"]`);

async function activate(page: Page, button: Locator, touch: boolean, keyboard = false) {
  await expect(button).toBeEnabled();
  if (keyboard) {
    await button.focus();
    await expect(button).toBeFocused();
    await page.keyboard.press('Enter');
  } else if (touch) {
    await button.tap();
  } else {
    await button.click();
  }
}

async function fits(page: Page, button: Locator, minHeight = 44) {
  const box = (await button.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.height).toBeGreaterThanOrEqual(minHeight);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  await expect(button).toBeInViewport();
}

test('el tablón abre recogido; desplegar muestra explicaciones y la mejor medalla', async ({
  page,
}, info) => {
  const touch = info.project.name === 'mobile';
  await page.addInitScript(
    ({ storageKey, boardKey }) => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          [boardKey]: {
            score: 100,
            at: '2026-10-06T12:00:00.000Z',
            medal: 'oro',
            difficulty: 'normal',
            games: 1,
          },
        }),
      );
    },
    { storageKey: CANON_BEST_KEY, boardKey: canonBoardKey(canonBoardBosses()[0]!) },
  );
  const errors = await openMar(page, `?ir=${LIGHTHOUSE_PLACE_ID}`);
  await expect(mar(page)).toHaveAttribute('data-llegada', LIGHTHOUSE_PLACE_ID, { timeout: 60_000 });
  await expect(board(page)).toHaveAttribute('data-expandida', 'no');
  await expect(board(page)).toContainText(t('mar.tablon.intro'));
  await expect(board(page).getByTestId('tablon').locator('> li')).toHaveCount(BOARD_CARDS.length);
  for (const card of BOARD_CARDS) {
    await expect(board(page).getByTestId(`tablon-ir-${card}`)).toHaveText(
      t(`mar.tablon.${card}.titulo`),
    );
    await expect(board(page)).not.toContainText(t(`mar.tablon.${card}.linea`));
    await fits(page, board(page).getByTestId(`tablon-ir-${card}`));
  }
  await expect(board(page).locator('[data-testid^="tablon-medalla-"]')).toHaveCount(0);
  // Keyboard works on both projects, including the old mobile Enter regression.
  await activate(page, board(page).getByTestId('mar-ficha-mas'), touch, true);
  await expect(board(page)).toHaveAttribute('data-expandida', 'si');
  for (const card of BOARD_CARDS) {
    await expect(board(page)).toContainText(t(`mar.tablon.${card}.linea`));
    await expect(board(page).getByTestId(`tablon-ir-${card}`).locator('.boia-icon')).toBeVisible();
  }
  await expect(board(page).getByTestId('tablon-medalla-canon')).toHaveText(
    t('mar.tablon.medalla', { medal: t('mar.tablon.medalla.oro') }),
  );
  const menu = page.getByTestId('mar-logros');
  await expect(menu).toBeVisible();
  expect(
    await menu.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }),
  ).toBe(true);
  await activate(page, board(page).getByTestId('mar-ficha-mas'), touch);
  await expect(board(page)).toHaveAttribute('data-expandida', 'no');
  await expect(board(page).getByTestId('tablon-medalla-canon')).toHaveCount(0);
  expect(errors).toEqual([]);
});

for (const [i, card] of BOARD_CARDS.entries()) {
  for (const travel of ['mar-rumbo', 'mar-volar'] as const) {
    test(`${card}: el botón abre su ficha y ${travel} llega al destino`, async ({ page }, info) => {
      const touch = info.project.name === 'mobile';
      const place = destinations[card]!;
      const destination = world.objects.find((o) => o.identity.id === place)!;
      const errors = await openMar(page, `?ir=${LIGHTHOUSE_PLACE_ID}`);
      await expect(mar(page)).toHaveAttribute('data-llegada', LIGHTHOUSE_PLACE_ID, {
        timeout: 60_000,
      });
      await expect(board(page)).toHaveAttribute('data-expandida', 'no');
      if (travel === 'mar-volar') {
        await activate(page, board(page).getByTestId('mar-ficha-mas'), touch);
        await expect(board(page)).toHaveAttribute('data-expandida', 'si');
      }
      await activate(page, board(page).getByTestId(`tablon-ir-${card}`), touch, i === 1);
      const sheet = page.getByTestId('mar-ficha');
      await expect(sheet).toHaveAttribute('data-tipo', 'preview');
      await expect(sheet).toHaveAttribute('data-lugar', place);
      await expect(sheet).toHaveAttribute('data-expandida', 'no');
      await expect(
        sheet.getByRole('heading', { name: destination.identity.name, exact: true }),
      ).toBeVisible();
      await expect(sheet.getByTestId('mar-rumbo')).toHaveText(t('mar.sheet.navegar'));
      await expect(sheet.getByTestId('mar-volar')).toHaveText(t('mar.sheet.irEnNave'));
      await expect(mar(page)).not.toHaveAttribute('data-objective-target', /./);
      await fits(page, sheet.getByTestId('mar-rumbo'), 40);
      await fits(page, sheet.getByTestId('mar-volar'), 40);
      await activate(page, sheet.getByTestId(travel), touch);
      await expect(sheet).toBeHidden();
      if (travel === 'mar-volar') {
        await expect(mar(page)).toHaveAttribute('data-flight', /lift|cruise|land/);
        await expect(mar(page)).not.toHaveAttribute('data-flight', /./, { timeout: 120_000 });
      } else {
        await expect(page.getByTestId('mar-rumbo-activo')).toContainText(destination.identity.name);
        await expect(page.getByTestId('mar-rumbo-activo')).toBeHidden({ timeout: 120_000 });
      }
      const period = periodOf(planetRect(world.bounds));
      await expect
        .poll(async () => {
          const delta = shortest(await shipAt(page), destination.position, period);
          return Math.hypot(delta.dx, delta.dy);
        })
        .toBeLessThan(
          (destination.geometry.proximityRadius ?? destination.geometry.activation?.radius ?? 0) +
            80,
        );
      expect(errors).toEqual([]);
    });
  }
}

test('la isla del castillo, junto a la Boia 7, abre su panel: «Jugar» abre el pop-up', async ({
  page,
}) => {
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
  await expect(panel).not.toHaveAttribute('data-bloqueado', 'si');
  await expect(panel.getByRole('heading', { name: t('mar.castillo.titulo') })).toBeVisible();
  await panel.getByRole('button', { name: t('juego.minigameLayer.jugar') }).click();
  await expect(page.getByTestId('mar-castillo-previa')).toBeVisible();
  await expect(panel).toBeHidden();
  // El castillo de siempre: su modelo (o, sin él, la composición a mano).
  await expect(page.getByTestId('mar-canvas')).toHaveAttribute(
    'data-castillo-modelo',
    /glb|procedural/,
  );
  expect(errors).toEqual([]);
});
