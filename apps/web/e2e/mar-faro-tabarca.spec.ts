import { LIGHTHOUSE_PLACE_ID } from '@boia/world';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { openMar } from './mar-helpers';

/**
 * El Faro de Tabarca (plan 014, T166): cerca del faro, junto a la salida, su
 * GLB (art/islas/3d/faro.glb, de tools/blender/islas/faro.py) sustituye a la
 * composición a mano; el lienzo lo dice en `data-islas-modelo`. Corre en
 * móvil y en escritorio.
 *
 * Con RECORD_T166=<carpeta> deja ahí las capturas de la hoja de contacto: el
 * faro visto desde el barco al llegar a la salida y de cerca, por proyecto.
 */

test.describe.configure({ timeout: 120_000 });

const canvas = (page: Page) => page.getByTestId('mar-canvas');
const islandState = (page: Page) => canvas(page).getAttribute('data-islas-modelo');

async function snap(page: Page, name: string) {
  const dir = process.env.RECORD_T166;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  // Unos fotogramas con el modelo puesto antes de la foto.
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(dir, `${name}-${test.info().project.name}.png`) });
}

test('cerca del faro se ve el Faro de Tabarca de Blender', async ({ page }) => {
  const glb: string[] = [];
  page.on('response', (r) => {
    if (r.url().endsWith(`/api/art/islas/3d/${LIGHTHOUSE_PLACE_ID}.glb`))
      glb.push(String(r.status()));
  });
  const errors = await openMar(page, `?cerca=${LIGHTHOUSE_PLACE_ID}`);
  await expect
    .poll(() => islandState(page), { timeout: 30_000 })
    .toContain(`${LIGHTHOUSE_PLACE_ID}:glb`);
  expect(glb).toEqual(['200']);
  await snap(page, 'faro-cerca');
  expect(errors).toEqual([]);
});

test('rumbo al faro desde la salida (captura)', async ({ page }) => {
  test.skip(!process.env.RECORD_T166, 'sólo la captura de la hoja de contacto');
  // Desde el anillo de salida, el barco vira a babor hacia el faro: lo ve de frente, aún lejos.
  await openMar(page);
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(1500);
  await page.keyboard.up('ArrowLeft');
  await snap(page, 'faro-rumbo');
});

test('al llegar a la salida, el faro ya se pide (está a la entrada del mundo)', async ({ page }) => {
  const errors = await openMar(page);
  // Junto al anillo de salida el faro está dentro del alcance de los modelos: se ve el suyo.
  await expect
    .poll(() => islandState(page), { timeout: 30_000 })
    .toContain(`${LIGHTHOUSE_PLACE_ID}:glb`);
  await snap(page, 'faro-salida');
  expect(errors).toEqual([]);
});
