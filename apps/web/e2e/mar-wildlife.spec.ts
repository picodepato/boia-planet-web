import path from 'node:path';
import { expect, test } from '@playwright/test';

test('fish occasionally jump while sailing; gulls cross only in the actual cloud view', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/mar');
  const canvas = page.getByTestId('mar-canvas');
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 30000 });
  await expect(canvas).toHaveAttribute('data-fauna-motion', 'on');
  await expect(canvas).toHaveAttribute('data-fauna-clouds', 'off');
  await expect(canvas).toHaveAttribute('data-fauna', /^[12],0$/, { timeout: 20000 });
  await page.screenshot({
    path: path.resolve(`node_modules/t102-preview/fish-${info.project.name}.png`),
  });
  await page.getByTestId('mar-minimapa').click();
  await expect(canvas).toHaveAttribute('data-fauna-clouds', 'on');
  await expect(canvas).toHaveAttribute('data-fauna', '0,5', { timeout: 20000 });
  // Let the flock enter the middle of the camera before recording the preview.
  await page.waitForTimeout(2500);
  await expect(canvas).toHaveAttribute('data-fauna', '0,5');
  await page.screenshot({
    path: path.resolve(`node_modules/t102-preview/gulls-${info.project.name}.png`),
  });
  await page.getByTestId('mar-minimapa').click();
  await expect(canvas).toHaveAttribute('data-fauna-clouds', 'off');
  await expect(canvas).toHaveAttribute('data-fauna', /^\d,0$/);
  expect(errors).toEqual([]);
});

test('reduced motion immediately removes wildlife, and disabling it resumes the bounded flock', async ({
  page,
}) => {
  await page.goto('/mar');
  const canvas = page.getByTestId('mar-canvas');
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 30000 });
  await page.getByTestId('mar-minimapa').click();
  await expect(canvas).toHaveAttribute('data-fauna', '0,5', { timeout: 20000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(canvas).toHaveAttribute('data-fauna-motion', 'reduced');
  await expect(canvas).toHaveAttribute('data-fauna', '0,0');
  await page.waitForTimeout(1200);
  await expect(canvas).toHaveAttribute('data-fauna', '0,0');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(canvas).toHaveAttribute('data-fauna', '0,5', { timeout: 20000 });
});

test('starting with reduced motion produces no new wildlife at either zoom', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/mar');
  const canvas = page.getByTestId('mar-canvas');
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 30000 });
  await expect(canvas).toHaveAttribute('data-fauna-motion', 'reduced');
  await expect(canvas).toHaveAttribute('data-fauna', '0,0');
  await page.getByTestId('mar-minimapa').click();
  await expect(canvas).toHaveAttribute('data-fauna-clouds', 'on');
  await expect(canvas).toHaveAttribute('data-fauna', '0,0');
});
