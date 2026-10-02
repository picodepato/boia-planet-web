import { SAMPLE_BOTTLES, SAMPLE_CREW } from '@boia/store';
import { expect, test } from '@playwright/test';
import { openMar } from './mar-helpers';

/**
 * Una botella lleva al Carnet de quien la escribió (T22; en el mar 3D desde
 * T62, D-25): se lee una botella de muestra junto a la salida y «Ver su
 * Carnet» abre el Carnet público de su autor (REQ-IDE-011, REQ-IDE-051).
 * Crear el Carnet y echar la propia botella lo prueba mar-botellas.spec.ts.
 * Corre en móvil 360×640 y en escritorio.
 */

test.describe.configure({ timeout: 120_000 });

test('leer una botella de muestra → VER SU CARNET', async ({ page }) => {
  const errors = await openMar(page);
  const seeded = page.locator('[data-testid^="mar-botella-cerca-botella-muestra-"]').first();
  await expect(seeded).toBeVisible({ timeout: 10_000 });
  const id = (await seeded.getAttribute('data-testid'))!.replace('mar-botella-cerca-', '');
  const sample = SAMPLE_BOTTLES.find((b) => b.id === id)!;
  const author = SAMPLE_CREW.find((c) => c.userId === sample.userId)!;

  await seeded.click();
  const read = page.getByTestId('mar-botella').getByTestId('botella-leida');
  await expect(read.getByTestId('botella-mensaje')).toHaveText(sample.message);
  await read.getByTestId('botella-ver-carnet').click();

  await expect(page).toHaveURL(new RegExp(`/carnet/${author.userId}`));
  await expect(page.getByTestId('carnet-apodo')).toHaveText(author.nickname);
  expect(errors).toEqual([]);
});
