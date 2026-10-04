import { expect, test, type Page } from '@playwright/test';
import { MemoryStorage, STORE_KEY, createLocalRepository } from '@boia/store';
import { WORLD_REGISTRY } from '@boia/world';
import { marWorld } from '../app/mar/engine/compact';
import { openMar, steerTo, marSheet, shipAt } from './mar-helpers';
import { CASTAWAY_REVISIT } from '../lib/mundo/ship-menu-discovery';

test.describe.configure({ timeout: 120_000 });

async function seed(page: Page, kind: 'discount' | 'menu') {
  const storage = new MemoryStorage();
  const repo = createLocalRepository({ storage, watch: false });
  if (kind === 'discount') await repo.progress.findDiscount('dto-naufrago');
  else await repo.progress.setPref('barco:menu-abierto', true);
  await page.addInitScript(
    ([key, data]) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, data);
    },
    [STORE_KEY, storage.getItem(STORE_KEY)!] as const,
  );
}

test('Cala introduces ship cosmetics once and remembers it after reload', async ({ page }) => {
  await openMar(page, '?cerca=cala');
  await steerTo(page, 'cala', async () => await page.getByTestId('mar-tienda').isVisible());
  await expect(page.getByTestId('mar-tienda')).toBeVisible();
  await page.getByTestId('mar-tienda-cerrar').click();
  await openMar(page, '?cerca=cala');
  await steerTo(page, 'cala', async () => await marSheet(page).isVisible());
  await expect(page.getByTestId('mar-tienda')).toHaveCount(0);
});

test('manual ship-menu opening suppresses Cala introduction', async ({ page }) => {
  await seed(page, 'menu');
  await openMar(page, '?cerca=cala');
  await steerTo(page, 'cala', async () => await marSheet(page).isVisible());
  await expect(page.getByTestId('mar-tienda')).toHaveCount(0);
});

test('castaway with an earned discount uses the supplied repeat-visit text', async ({ page }) => {
  await seed(page, 'discount');
  await openMar(page, '?cerca=naufrago');
  await steerTo(page, 'naufrago', async () => await page.getByTestId('mar-bocadillo').isVisible());
  await expect(page.getByTestId('mar-bocadillo')).toContainText(CASTAWAY_REVISIT);
});

test('opening the WhatsApp invitation completes the visible achievement once', async ({
  page,
  context,
}) => {
  context.on('page', (popup) => {
    if (popup !== page) void popup.close();
  });
  await openMar(page, '?cerca=puerto-whatsapp');
  const buoy = marWorld(WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config).objects.find(
    (object) => object.identity.id === 'puerto-whatsapp',
  )!;
  // Approach slowly with real keys, braking between pulses so inertia cannot carry
  // the ship past the interaction zone while the player reaches for the invitation.
  for (let pulse = 0; pulse < 30; pulse++) {
    const ship = await shipAt(page);
    const dx = buoy.position.x - ship.x;
    const dy = buoy.position.y - ship.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 80 && (await page.getByTestId('whatsapp-invitacion').isVisible())) break;
    const keys: string[] = [];
    if (dx / distance > 0.35) keys.push('ArrowRight');
    if (dx / distance < -0.35) keys.push('ArrowLeft');
    if (dy / distance > 0.35) keys.push('ArrowDown');
    if (dy / distance < -0.35) keys.push('ArrowUp');
    for (const key of keys) await page.keyboard.down(key);
    await page.waitForTimeout(100);
    for (const key of keys) await page.keyboard.up(key);
    await expect(page.locator('.mar-speed strong')).toHaveText('0');
  }
  const stopped = await shipAt(page);
  expect(Math.hypot(stopped.x - buoy.position.x, stopped.y - buoy.position.y)).toBeLessThan(80);
  await expect(page.getByTestId('whatsapp-invitacion')).toBeVisible();
  await page.getByTestId('whatsapp-invitacion').click();
  await expect
    .poll(async () =>
      page.evaluate((key) => {
        const raw = localStorage.getItem(key);
        return raw
          ? Object.values(JSON.parse(raw).players ?? {}).some(
              (player) =>
                (player as { achievements?: Record<string, unknown> }).achievements?.whatsapp,
            )
          : false;
      }, STORE_KEY),
    )
    .toBe(true);
  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-menu-logros').click();
  const achievement = page.getByTestId('logro-whatsapp');
  await expect(achievement.getByText('La tripulación BOIA', { exact: true })).toBeVisible();
  await expect(achievement).toHaveAttribute('data-estado', 'ready');
  await page.getByTestId('logro-reclamar-whatsapp').click();
  await expect(page.getByTestId('logro-premio-puntos')).toHaveText('+300 ★');
  await expect(achievement).toHaveAttribute('data-estado', 'claimed');
  await openMar(page);
  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-menu-logros').click();
  await expect(page.getByTestId('logro-whatsapp')).toHaveAttribute('data-estado', 'claimed');
  await expect(page.getByTestId('logro-reclamar-whatsapp')).toHaveCount(0);
});
