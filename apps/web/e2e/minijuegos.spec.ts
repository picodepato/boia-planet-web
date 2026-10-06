import { expect, test, type Page } from '@playwright/test';

/**
 * Los minijuegos dentro del mar 3D. La capa 2D se quitó: primero el cañón 2D
 * (plan 010, T119: el Cañón se juega en el propio mar, `mar-canon.spec.ts`) y
 * después el minijuego del faro (plan 014, T157: el faro es ahora el
 * «Tablón del faro», `mar-tablon.spec.ts`). Aquí sólo se comprueba que el
 * atajo del Cañón no abre ninguna capa.
 */

test.describe.configure({ timeout: 150_000 });

const layer = (page: Page) => page.getByTestId('minijuego');

async function openMar(page: Page, path: string) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(path);
  await expect(page.getByTestId('mar-canvas')).toBeVisible();
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 45_000 });
  return errors;
}

test('`?minijuego=canon` no abre ninguna capa 2D: el Cañón se juega en el mar', async ({
  page,
}) => {
  const errors = await openMar(page, '/mar?minijuego=canon&seed=3');
  await expect(page.getByTestId('mar-canon')).toHaveAttribute('data-estado', 'running', {
    timeout: 20_000,
  });
  await expect(layer(page)).toHaveCount(0);
  await expect(page.getByTestId('minijuego-capa')).toHaveCount(0);
  expect(errors).toEqual([]);
});
