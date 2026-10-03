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

/**
 * Modo local (plan 008, T89; D-20): sin Supabase no aparece nada de la cuenta
 * con email. «Crear mi Carnet» abre el alta de siempre y guardar lo crea en
 * este navegador, sin hoja de acceso ni «Tu cuenta».
 */
test('modo local: el Carnet se crea sin pedir email', async ({ page }, info) => {
  const errors = await openMar(page);
  await page.getByTestId('mar-enlace-carnet').click();
  const carnet = page.getByTestId('mar-carnet');
  await expect(carnet.getByTestId('carnet-invitacion')).toBeVisible();
  await carnet.getByTestId('carnet-crear').click();
  await carnet.getByTestId('carnet-apodo-input').fill(`Local ${info.project.name}`);
  await carnet.getByTestId('carnet-guardar').click();
  await expect(carnet.getByTestId('carnet-apodo')).toHaveText(`Local ${info.project.name}`);
  await expect(page.getByTestId('acceso')).toHaveCount(0);
  await expect(page.getByTestId('cuenta')).toHaveCount(0);
  await expect(page.locator('#boia-cuenta-capa')).toHaveCount(0);
  expect(errors).toEqual([]);
});
