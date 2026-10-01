import { SAMPLE_ACHIEVEMENTS } from '@boia/store';
import { WORLD_REGISTRY } from '@boia/world';
import { expect, test, type Page } from '@playwright/test';
import { rescueMissionOf } from '@boia/engine/mission';
import { BOARDED_NOTICE } from '../lib/mundo/mission';

/**
 * La misión de la Boia Fiestera en /juego (T21, REQ-AVE-005…010), en
 * escritorio: el barco llega al remanso, los cocodrilos se sumergen, ella
 * sube a bordo con su aviso; tras recargar sigue a bordo y, en la última
 * isla, baja con celebración, logro y premio grande, que no se repiten al
 * volver. Como en mundo-arcilla.spec.ts, cada tramo empieza con `?cerca=`
 * (el mapa es demasiado grande para cruzarlo en una prueba) y el progreso
 * vive en el navegador de la prueba, así que la recarga lo conserva.
 */

test.describe.configure({ timeout: 120_000 });

const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId);
const spec = rescueMissionOf(world.config)!;
const deliverAchievement = SAMPLE_ACHIEVEMENTS.find(
  (a) => a.trigger === 'deliver_character' && a.triggerParams?.character === 'boia-fiestera',
)!;
const rescueAchievement = SAMPLE_ACHIEVEMENTS.find((a) => a.trigger === 'rescue_character')!;

const game = (page: Page) => page.getByTestId('juego');

async function sailFrom(page: Page, near: string) {
  await page.goto(`/juego?cerca=${near}`);
  await expect(page.getByTestId('hud')).toContainText(/\d+ fps/, { timeout: 30_000 });
  await expect(game(page)).toHaveAttribute('data-mundo', world.id);
  await page
    .locator('canvas:visible')
    .first()
    .focus()
    .catch(() => {});
}

async function sailNorthUntil(page: Page, until: () => Promise<void>) {
  await page.keyboard.down('ArrowUp');
  try {
    await until();
  } finally {
    await page.keyboard.up('ArrowUp');
  }
}

async function points(page: Page): Promise<number> {
  const saldos = page.getByTestId('saldos');
  await expect(saldos).toHaveAttribute('data-points', /\d+/);
  return Number(await saldos.getAttribute('data-points'));
}

test('rescata a la Fiestera y la deja en la última isla', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'la misión entera se prueba en escritorio');
  expect(spec, 'el mundo por defecto tiene la misión').toBeTruthy();

  // 1. El remanso: los cocodrilos se sumergen y ella sube a bordo.
  await sailFrom(page, spec.characterId);
  await expect(game(page)).toHaveAttribute('data-mision', 'waiting');
  const notice = page.getByTestId('aviso');
  await sailNorthUntil(page, () =>
    expect(game(page)).toHaveAttribute('data-tripulante', 'a-bordo', { timeout: 30_000 }),
  );
  await expect(notice).toContainText(BOARDED_NOTICE.title, { timeout: 10_000 });
  await expect(notice).toContainText(BOARDED_NOTICE.body);
  // Tras el aviso de a bordo, el logro del rescate.
  await expect(page.locator('[data-kind="achievement"]')).toContainText(rescueAchievement.title, {
    timeout: 15_000,
  });

  // 2. Recarga junto a la última isla: sigue a bordo (lo guardado manda).
  await sailFrom(page, spec.destination);
  await expect(game(page)).toHaveAttribute('data-tripulante', 'a-bordo', { timeout: 10_000 });
  const before = await points(page);
  await sailNorthUntil(page, () =>
    expect(game(page)).toHaveAttribute('data-mision', /landing|delivered/, { timeout: 30_000 }),
  );
  await expect(page.getByTestId('celebracion')).toBeVisible();
  await expect(game(page)).toHaveAttribute('data-mision', 'delivered', { timeout: 10_000 });
  await expect(game(page)).not.toHaveAttribute('data-tripulante', /.+/);
  // Premio grande de la misión: los puntos suben. El logro queda conseguido y
  // su premio llega al reclamarlo (D-22, T36), así que aquí no cuenta.
  await expect.poll(() => points(page), { timeout: 10_000 }).toBeGreaterThan(before);
  await page.getByTestId('menu-ancla').click();
  await page.getByTestId('menu').getByRole('tab', { name: 'Logros' }).click();
  await expect(page.getByTestId(`logro-${deliverAchievement.id}`)).toHaveAttribute(
    'data-obtenido',
    'si',
  );
  await page.keyboard.press('Escape');
  const after = await points(page);

  // 3. Otra visita: ya está en su isla, sin misión en pantalla ni premio repetido.
  await sailFrom(page, spec.destination);
  await expect(game(page)).toHaveAttribute('data-mision', 'delivered', { timeout: 10_000 });
  await sailNorthUntil(page, () => page.waitForTimeout(2500));
  await expect(page.getByTestId('celebracion')).toHaveCount(0);
  expect(await points(page)).toBe(after);
});
