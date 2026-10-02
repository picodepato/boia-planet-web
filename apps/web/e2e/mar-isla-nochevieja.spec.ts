import { rescueMissionOf } from '@boia/engine/mission';
import { WORLD_REGISTRY } from '@boia/world';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseIslandManifest } from '../app/mar/engine/island-models';
import { t } from '../lib/i18n';
import { repoRoot } from '../lib/barco/load';
import { mar, openMar, sheetIs, steerTo } from './mar-helpers';

/**
 * La Isla de Nochevieja de Blender en /mar (T71): el lugar donde se entrega
 * la Boia Fiestera (el destino de la misión del mundo) tiene su modelo en
 * art/islas/3d/ (tools/blender/islas/ultima.py); cerca de ella el GLB
 * sustituye a la composición a mano, y la entrega de la Fiestera (aviso,
 * confeti, código) sigue funcionando con el modelo puesto.
 *
 * Con RECORD_T71=1 (en escritorio) deja capturas en docs/informes/img/
 * p006-t71-*.png: la isla de tarde, de noche y la entrega.
 */

test.describe.configure({ timeout: 180_000 });

const first = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId);
const spec = rescueMissionOf(first.config)!;
const ISLAND = spec.destination;
const entry = parseIslandManifest(
  JSON.parse(readFileSync(path.join(repoRoot(), 'art/islas/3d/manifest.json'), 'utf8')),
).get(ISLAND);

const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../docs/informes/img',
);
const islandState = (page: Page) =>
  page.getByTestId('mar-canvas').getAttribute('data-islas-modelo');
const recording = () => test.info().project.name === 'desktop' && !!process.env.RECORD_T71;

async function snap(page: Page, name: string) {
  if (!recording()) return;
  mkdirSync(OUT, { recursive: true });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, name) });
}

test('la Isla de Nochevieja (destino de la Fiestera) tiene su modelo en el manifiesto', () => {
  expect(entry?.file).toBe(`${ISLAND}.glb`);
  // El nombre del modelo es el del lugar en el mapa.
  expect(entry?.label).toBe(
    first.config.objects.find((o) => o.identity.id === ISLAND)?.identity.name,
  );
});

test('cerca de la Isla de Nochevieja se ve su modelo de Blender', async ({ page }) => {
  const glb: string[] = [];
  page.on('response', (r) => {
    if (r.url().endsWith(`/api/art/islas/3d/${entry!.file}`)) glb.push(String(r.status()));
  });
  const errors = await openMar(page, `?cerca=${ISLAND}`);
  await expect.poll(() => islandState(page), { timeout: 30_000 }).toContain(`${ISLAND}:glb`);
  expect(glb).toEqual(['200']);
  await snap(page, 'p006-t71-isla-nochevieja.png');
  expect(errors).toEqual([]);
});

test('de noche brillan las luces, el reloj y las tiendas (captura)', async ({ page }) => {
  test.skip(!recording(), 'sólo la captura');
  await page.addInitScript(() => window.localStorage.setItem('boia:mar3d:momento', 'noche'));
  await openMar(page, `?cerca=${ISLAND}`);
  await expect.poll(() => islandState(page), { timeout: 30_000 }).toContain(`${ISLAND}:glb`);
  await snap(page, 'p006-t71-isla-nochevieja-noche.png');
});

test('la Fiestera se entrega en la Isla de Nochevieja con su modelo puesto', async ({ page }) => {
  // El recorrido entero ya lo prueban ambos proyectos en mar-fiestera.spec; aquí, en escritorio.
  test.skip(test.info().project.name !== 'desktop', 'escritorio');
  const errors = await openMar(page, `?cerca=${spec.characterId}`);
  await steerTo(
    page,
    spec.characterId,
    async () => (await mar(page).getAttribute('data-mision')) === 'aboard',
  );
  await expect(mar(page)).toHaveAttribute('data-mision', 'aboard');

  await openMar(page, `?cerca=${ISLAND}`);
  await expect.poll(() => islandState(page), { timeout: 30_000 }).toContain(`${ISLAND}:glb`);
  await steerTo(page, ISLAND, sheetIs(page, 'discount'));
  await expect(mar(page)).toHaveAttribute('data-mision', 'delivered', { timeout: 10_000 });
  await expect(
    page
      .getByTestId('mar-aviso')
      .filter({ hasText: t('juego.mission.fiestaEnLaUltima') })
      .first(),
  ).toBeVisible();
  await expect(page.getByTestId('mar-ficha')).toHaveAttribute('data-tipo', 'discount');
  // El modelo sigue puesto durante la fiesta.
  expect(await islandState(page)).toContain(`${ISLAND}:glb`);
  await snap(page, 'p006-t71-entrega-fiestera.png');
  expect(errors).toEqual([]);
});
