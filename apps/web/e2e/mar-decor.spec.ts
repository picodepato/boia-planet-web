import path from 'node:path';
import { expect, test } from '@playwright/test';

test('Santa Bárbara loads as local Blender scenery from the normal sailing camera', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/mar');
  const canvas = page.getByTestId('mar-canvas');
  await expect(canvas).toHaveAttribute('data-castillo-modelo', 'glb', { timeout: 30000 });
  await expect(page.locator('.mar-splash')).toHaveCount(0);
  await page.screenshot({
    path: path.resolve(`node_modules/t101-preview/integrated-${info.project.name}.png`),
  });
  await page.getByRole('button', { name: 'Alejar' }).click();
  await page.getByRole('button', { name: 'Alejar' }).click();
  // Two zoom-out steps (+0.28) from the start zoom, which depends on the aspect
  // ratio (0.2 wide .. 0.26 portrait): the bar settles between 46 % and 52 %
  // (47 % at 360x640). Poll the settled value instead of one exact percentage.
  await expect
    .poll(async () => {
      const style = (await page.locator('.mar-zoom span').getAttribute('style')) ?? '';
      return Number(/height:\s*(\d+)%/.exec(style)?.[1] ?? NaN);
    })
    .toBeGreaterThanOrEqual(46);
  await expect
    .poll(async () => {
      const style = (await page.locator('.mar-zoom span').getAttribute('style')) ?? '';
      return Number(/height:\s*(\d+)%/.exec(style)?.[1] ?? NaN);
    })
    .toBeLessThanOrEqual(52);
  await page.screenshot({
    path: path.resolve(`node_modules/t101-preview/overview-${info.project.name}.png`),
  });
  expect(errors).toEqual([]);
});

test('missing castle GLB preserves procedural scenery and sailing', async ({ page }) => {
  await page.route('**/api/art/decor/3d/santa-barbara.glb', (route) => route.abort());
  await page.goto('/mar');
  const canvas = page.getByTestId('mar-canvas');
  await expect(canvas).toHaveAttribute('data-castillo-modelo', 'procedural', { timeout: 30000 });
  await expect(page.locator('.mar-splash')).toHaveCount(0);
  await expect(canvas).toBeVisible();
});
