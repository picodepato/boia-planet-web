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
  await expect(page.locator('.mar-zoom span')).toHaveAttribute('style', /height: (52|46)%;/);
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
