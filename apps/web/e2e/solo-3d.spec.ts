import { WORLD_REGISTRY } from '@boia/world';
import { expect, test } from '@playwright/test';
import { t } from '../lib/i18n';
import { PHOTOS_PLACE_ID } from '../lib/landing/access';
import { mar, marSheet, openMar } from './mar-helpers';

/**
 * Sólo el planeta 3D (D-25, T62): el mundo 2D se fue. Un enlace viejo a
 * `/juego` lleva al mar 3D con su consulta (`?ir=`, `?evento=`, `?menu=`); sin
 * WebGL, el mar lo dice claro y ofrece las entradas; y no suena nada antes
 * del primer gesto. Corre en móvil 360×640 y en escritorio.
 */

test.describe.configure({ timeout: 120_000 });

const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId);
const eventIsland = world.config.objects.find((o) =>
  o.behaviors.some((b) => b.type === 'content' && b.params.target === 'event'),
)!;
const eventId = eventIsland.behaviors.flatMap((b) =>
  b.type === 'content' && b.params.target === 'event' && b.params.ref ? [b.params.ref] : [],
)[0]!;

test('`/juego?ir=<lugar>` lleva al mar 3D navegando hasta allí', async ({ page }) => {
  await page.goto(`/juego?ir=${PHOTOS_PLACE_ID}`);
  await expect(page).toHaveURL(/\/mar(\?|$)/);
  await expect(page.getByTestId('mar-viaje')).toHaveAttribute('data-lugar', PHOTOS_PLACE_ID, {
    timeout: 30_000,
  });
  await expect(mar(page)).toHaveAttribute('data-llegada', PHOTOS_PLACE_ID, { timeout: 60_000 });
  await expect(marSheet(page)).toHaveAttribute('data-lugar', PHOTOS_PLACE_ID);
});

test('`/juego?evento=` y `/juego?menu=carnet` abren lo mismo en el mar 3D', async ({ page }) => {
  await page.goto(`/juego?evento=${eventId}`);
  await expect(page).toHaveURL(/\/mar(\?|$)/);
  await page
    .getByTestId('mar-entradas-saltar')
    .click({ timeout: 30_000 })
    .catch(() => {});
  await expect(marSheet(page)).toHaveAttribute('data-lugar', eventIsland.identity.id, {
    timeout: 30_000,
  });

  await page.goto('/juego?menu=carnet');
  await expect(page).toHaveURL(/\/mar(\?|$)/);
  await expect(page.getByTestId('mar-carnet')).toBeVisible({ timeout: 30_000 });
});

test('sin WebGL: un aviso claro y las entradas, sin mundo 2D', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (/webgl/i.test(type)) return null;
      return (original as (...a: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto('/mar');
  const splash = page.locator('.mar-splash');
  await expect(splash).toContainText(t('error.3d.title'), { timeout: 30_000 });
  await expect(splash).toContainText(t('error.3d.body'));
  const tickets = page.getByTestId('mar-sin-3d-entradas');
  await expect(tickets).toHaveText(t('error.3d.cta'));
  await expect(tickets).toHaveAttribute('href', '/#tickets');
  await expect(page.locator('a[href^="/juego"]')).toHaveCount(0);
});

test('sin audio antes del primer gesto; el primer toque lo desbloquea', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as Window & { __audioContexts?: number };
    const Original = window.AudioContext;
    w.__audioContexts = 0;
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        super(options);
        w.__audioContexts = (w.__audioContexts ?? 0) + 1;
      }
    };
  });
  await openMar(page);
  const contexts = () =>
    page.evaluate(() => (window as Window & { __audioContexts?: number }).__audioContexts);
  expect(await contexts()).toBe(0);

  const canvas = page.getByTestId('mar-canvas');
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(contexts).toBe(1);
});
