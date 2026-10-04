import { WORLD_PARAM, WORLD_REGISTRY, WORLD_STORAGE_KEY } from '@boia/world';
import { expect, test } from '@playwright/test';
import { mar, openMar } from './mar-helpers';

/**
 * Un solo mundo (T122): BOIA.PLANET se juega en Arcilla. Acuarela sigue en
 * código y datos pero está oculta, así que `?mundo=<oculto>` y una elección
 * guardada de un mundo oculto caen en silencio en Arcilla, y el menú no ofrece
 * «Mundos». Los ids salen del registro. Corre en móvil 360×640 y en escritorio.
 */

test.describe.configure({ timeout: 120_000 });

const arcilla = WORLD_REGISTRY.defaultId;
const hidden = [...WORLD_REGISTRY.hiddenIds][0]!;

test('`?mundo=` de un mundo oculto cae en Arcilla y el menú no ofrece «Mundos»', async ({
  page,
}) => {
  expect(hidden, 'hay un mundo oculto en el registro').toBeDefined();
  await openMar(page, `?${WORLD_PARAM}=${hidden}`);
  await expect(mar(page)).toHaveAttribute('data-mundo', arcilla);
  await page.getByTestId('mar-logros').click();
  await expect(page.locator('.mar-menu')).toBeVisible();
  await expect(page.getByTestId('mar-menu-mundos')).toHaveCount(0);
});

test('una elección guardada de un mundo oculto cae en Arcilla', async ({ page }) => {
  await page.addInitScript(
    ([key, id]) => {
      try {
        window.localStorage.setItem(key!, id!);
      } catch {
        // sin almacenamiento: el test fallará en la aserción
      }
    },
    [WORLD_STORAGE_KEY, hidden],
  );
  await openMar(page);
  await expect(mar(page)).toHaveAttribute('data-mundo', arcilla);
});
