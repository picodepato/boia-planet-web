import { HALLOWEEN_PLACE_ID } from '@boia/world';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openMar } from './mar-helpers';

/**
 * Las islas de Blender en /mar (T69): cerca de la Isla de Halloween su GLB
 * (art/islas/3d/halloween.glb, de tools/blender/export_islas_glb.py) sustituye
 * a la composición a mano, y si el GLB no llega la de a mano se queda. El
 * lienzo lo dice en `data-islas-modelo` («id:estado»). Corre en móvil y en
 * escritorio.
 *
 * Con RECORD_T69=1 (en escritorio) deja capturas en docs/informes/img/
 * p006-t69-*.png: la isla de tarde y de noche, y la de a mano sin el GLB.
 */

test.describe.configure({ timeout: 120_000 });

const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../docs/informes/img',
);
const canvas = (page: Page) => page.getByTestId('mar-canvas');
const islandState = (page: Page) => canvas(page).getAttribute('data-islas-modelo');

async function snap(page: Page, name: string) {
  if (test.info().project.name !== 'desktop' || !process.env.RECORD_T69) return;
  mkdirSync(OUT, { recursive: true });
  // Unos fotogramas con el modelo puesto antes de la foto.
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, name) });
}

test('cerca de la Isla de Halloween se ve su modelo de Blender', async ({ page }) => {
  const glb: string[] = [];
  page.on('response', (r) => {
    if (r.url().endsWith(`/api/art/islas/3d/${HALLOWEEN_PLACE_ID}.glb`)) glb.push(String(r.status()));
  });
  const errors = await openMar(page, `?cerca=${HALLOWEEN_PLACE_ID}`);
  await expect
    .poll(() => islandState(page), { timeout: 30_000 })
    .toContain(`${HALLOWEEN_PLACE_ID}:glb`);
  expect(glb).toEqual(['200']);
  await snap(page, 'p006-t69-isla-halloween.png');
  expect(errors).toEqual([]);
});

test('de noche la calabaza brilla (captura)', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop' || !process.env.RECORD_T69, 'sólo la captura');
  await page.addInitScript(() => window.localStorage.setItem('boia:mar3d:momento', 'noche'));
  await openMar(page, `?cerca=${HALLOWEEN_PLACE_ID}`);
  await expect
    .poll(() => islandState(page), { timeout: 30_000 })
    .toContain(`${HALLOWEEN_PLACE_ID}:glb`);
  await snap(page, 'p006-t69-isla-halloween-noche.png');
});

test('sin el GLB, la Isla de Halloween se queda con la composición a mano', async ({ page }) => {
  await page.route(`**/api/art/islas/3d/${HALLOWEEN_PLACE_ID}.glb`, (r) =>
    r.fulfill({ status: 404, body: '' }),
  );
  const errors = await openMar(page, `?cerca=${HALLOWEEN_PLACE_ID}`);
  // Se pidió y falló: se queda la de a mano (el estado «error» la deja en su hueco).
  await expect
    .poll(() => islandState(page), { timeout: 30_000 })
    .toContain(`${HALLOWEEN_PLACE_ID}:error`);
  await expect(page.locator(`[data-pin="${HALLOWEEN_PLACE_ID}"]`)).toHaveCount(1);
  // El mar sigue andando: el barco navega.
  await expect(page.locator('main.mar')).toHaveAttribute('data-barco', /\d/);
  await snap(page, 'p006-t69-isla-halloween-sin-glb.png');
  expect(errors).toEqual([]);
});
