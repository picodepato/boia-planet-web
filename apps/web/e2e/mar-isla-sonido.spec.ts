import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { t } from '../lib/i18n';
import { openMar } from './mar-helpers';

/**
 * La Isla del Sonido en /mar (T70): cerca de ella su GLB de Blender
 * (art/islas/3d/allday.glb, de tools/blender/islas/allday.py) sustituye a la
 * composición a mano, como la de Halloween (T69, mar-isla-modelo.spec.ts).
 * El lienzo lo dice en `data-islas-modelo` («id:estado»). Corre en móvil y en
 * escritorio.
 *
 * Con RECORD_T70=1 (en escritorio) deja capturas en docs/informes/img/
 * p006-t70-*.png: la isla de día y de noche.
 */

test.describe.configure({ timeout: 120_000 });

/** El lugar de la Isla del Sonido (el módulo y el GLB llevan su id). */
const SONIDO = 'allday';
const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../docs/informes/img',
);
const canvas = (page: Page) => page.getByTestId('mar-canvas');
const islandState = (page: Page) => canvas(page).getAttribute('data-islas-modelo');

async function snap(page: Page, name: string) {
  if (test.info().project.name !== 'desktop' || !process.env.RECORD_T70) return;
  mkdirSync(OUT, { recursive: true });
  // Un poco más lejos, para que el sound system entero (muros, pórtico y láser) quepa en la foto.
  const alejar = page.getByRole('button', { name: t('mar.client.alejar') });
  await alejar.click();
  // Unos fotogramas con el modelo puesto antes de la foto.
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, name) });
}

test('cerca de la Isla del Sonido se ve su modelo de Blender', async ({ page }) => {
  const glb: string[] = [];
  page.on('response', (r) => {
    if (r.url().endsWith(`/api/art/islas/3d/${SONIDO}.glb`)) glb.push(String(r.status()));
  });
  const errors = await openMar(page, `?cerca=${SONIDO}`);
  await expect.poll(() => islandState(page), { timeout: 30_000 }).toContain(`${SONIDO}:glb`);
  expect(glb).toEqual(['200']);
  await expect(page.locator(`[data-pin="${SONIDO}"]`)).toHaveCount(1);
  await snap(page, 'p006-t70-isla-sonido.png');
  expect(errors).toEqual([]);
});

test('de noche brillan los focos, el láser y la pista (captura)', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop' || !process.env.RECORD_T70, 'sólo la captura');
  await page.addInitScript(() => window.localStorage.setItem('boia:mar3d:momento', 'noche'));
  await openMar(page, `?cerca=${SONIDO}`);
  await expect.poll(() => islandState(page), { timeout: 30_000 }).toContain(`${SONIDO}:glb`);
  await snap(page, 'p006-t70-isla-sonido-noche.png');
});
