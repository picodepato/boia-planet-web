import { expect, test, type Page } from '@playwright/test';
import { MemoryStorage, SAMPLE_DISCOUNTS, STORE_KEY, createLocalRepository } from '@boia/store';
import { WORLD_REGISTRY } from '@boia/world';
import { marWorld } from '../app/mar/engine/compact';
import { openMar, steerTo, marSheet, shipAt, sheetIs } from './mar-helpers';
import { t } from '../lib/i18n';

test.describe.configure({ timeout: 120_000 });

// The Puerto de Alicante boat-choice popup (T108) replaced the automatic Cala
// shop of T100: its tests live in mar-puerto.spec.ts.
async function seed(page: Page) {
  const storage = new MemoryStorage();
  const repo = createLocalRepository({ storage, watch: false });
  await repo.progress.findDiscount('dto-naufrago');
  await page.addInitScript(
    ([key, data]) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, data);
    },
    [STORE_KEY, storage.getItem(STORE_KEY)!] as const,
  );
}

test('castaway with an earned discount uses the supplied repeat-visit text', async ({ page }) => {
  await seed(page);
  // Recover the historical objective before returning to the character.
  await openMar(page);
  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-menu-logros').click();
  await expect(page.getByTestId('logro-naufrago-fiesta')).toHaveAttribute('data-estado', 'ready');
  await openMar(page, '?cerca=naufrago');
  await steerTo(page, 'naufrago', async () => await page.getByTestId('mar-bocadillo').isVisible());
  await expect(page.getByTestId('mar-bocadillo')).toContainText(t('naufrago.revisit'));
});

test('castaway rescue completes immediately, persists and grants its reward only on one manual claim', async ({
  page,
}) => {
  await openMar(page, '?cerca=naufrago');
  await steerTo(page, 'naufrago', sheetIs(page, 'discount'));
  await expect(marSheet(page)).toContainText(
    SAMPLE_DISCOUNTS.find((d) => d.id === 'dto-naufrago')!.code,
  );
  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-menu-logros').click();
  const row = page.getByTestId('logro-naufrago-fiesta');
  await expect(row).toHaveAttribute('data-estado', 'ready');
  await expect(row).toContainText(t('achievements.castaway.description'));
  await openMar(page);
  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-menu-logros').click();
  await expect(row).toHaveAttribute('data-estado', 'ready');
  await page.getByTestId('logro-reclamar-naufrago-fiesta').click();
  await expect(page.getByTestId('logro-premio-puntos')).toHaveText('+80 ★');
  await expect(page.getByTestId('logro-premio-monedas')).toHaveText('+40 🪙');
  await expect(row).toHaveAttribute('data-estado', 'claimed');
  await openMar(page, '?cerca=naufrago');
  await steerTo(page, 'naufrago', async () => await page.getByTestId('mar-bocadillo').isVisible());
  await expect(page.getByTestId('mar-bocadillo')).toContainText(
    '¿Otra vez he acabado aquí? Cómo se puede ser tan manija...',
  );
  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-menu-logros').click();
  await expect(row).toHaveAttribute('data-estado', 'claimed');
  await expect(page.getByTestId('logro-reclamar-naufrago-fiesta')).toHaveCount(0);
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
  await expect(achievement.getByText('El grupo BOIA', { exact: true })).toBeVisible();
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
