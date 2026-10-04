import { WORLD_REGISTRY } from '@boia/world';
import { type Page, expect, test } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../lib/barco/load';
import { marWorld } from '../app/mar/engine/compact';
import { PLACE_MODELS_URL } from '../app/mar/engine/island-models';
import { mar, marSheet, openMar, shipAt, steerTo } from './mar-helpers';

/**
 * Benidorm (`fotos`) e Ibiza (`tienda`) con sus modelos de Blender (T112;
 * T110, T111): cerca, el GLB sustituye a la isla entera (sus luces de a mano
 * se apagan) y, si no llega, se queda la composición a mano; en Benidorm la
 * boia del club baila por su barra con el reloj de /mar (`boia-pole-dance`)
 * y, con movimiento reducido, se queda quieta en su pose del manifiesto.
 * Ibiza sigue abriendo su ficha de tienda al llegar. Móvil y escritorio.
 *
 * Con RECORD_T112=<carpeta> deja capturas allí (fuera del repositorio).
 */

test.describe.configure({ timeout: 180_000 });

const world = marWorld(WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config);
const place = (id: string) => world.objects.find((o) => o.identity.id === id)!;
const fotosManifest = JSON.parse(
  readFileSync(path.join(repoRoot(), 'art/places/3d/fotos/manifest.json'), 'utf8'),
) as { motion: { node: string; clip: string; static_frame: number }[] };
const canvas = (page: Page) => page.getByTestId('mar-canvas');
const islandState = (page: Page) => canvas(page).getAttribute('data-islas-modelo');
const glbOf = (id: string) => `**${PLACE_MODELS_URL}/${id}/${id}.glb`;

/** La altura del nodo que baila en Benidorm (`data-lugares-pose`), o null. */
async function pose(page: Page): Promise<number | null> {
  const v = await canvas(page).getAttribute('data-lugares-pose');
  const part = (v ?? '').split(' ').find((p) => p.startsWith('fotos:'));
  return part ? Number(part.split(':')[1]) : null;
}

async function shot(page: Page, name: string) {
  const dir = process.env.RECORD_T112;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}-${test.info().project.name}.png`) });
}

async function loaded(page: Page, id: string) {
  await expect.poll(() => islandState(page), { timeout: 30_000 }).toContain(`${id}:glb`);
  await expect(canvas(page)).toHaveAttribute('data-islas-sin-luces', new RegExp(`(^| )${id}( |$)`));
}

/** Se acerca a la isla hasta tenerla a 1.5 radios (su costa llena la vista). */
async function approach(page: Page, id: string) {
  const o = place(id);
  const near = o.geometry.collision!.radius * 1.5;
  await steerTo(page, id, async () => {
    const s = await shipAt(page);
    return Math.hypot(s.x - o.position.x, s.y - o.position.y) < near;
  });
}

test('Benidorm: su modelo sustituye a la isla y la boia del club baila', async ({ page }) => {
  const glb: string[] = [];
  page.on('response', (r) => {
    if (r.url().endsWith('/fotos/fotos.glb')) glb.push(String(r.status()));
  });
  const errors = await openMar(page, '?cerca=fotos');
  await loaded(page, 'fotos');
  expect(glb).toEqual(['200']);
  await expect(canvas(page)).toHaveAttribute('data-lugares-movimiento', /(^| )fotos:baile( |$)/);
  await approach(page, 'fotos');
  // Varias fases del baile: sube y baja entre la pose baja y la alta del clip.
  const seen = new Set<number>();
  for (let i = 0; i < 8; i++) {
    const y = await pose(page);
    expect(y).not.toBeNull();
    expect(y!).toBeGreaterThanOrEqual(0.419);
    expect(y!).toBeLessThanOrEqual(0.591);
    seen.add(y!);
    await shot(page, `benidorm-fase-${i}`);
    await page.waitForTimeout(500);
  }
  expect(seen.size).toBeGreaterThan(3);
  await expect(page.locator('[data-pin="fotos"]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('Benidorm con movimiento reducido: la boia se queda quieta en su pose', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = await openMar(page, '?cerca=fotos');
  await loaded(page, 'fotos');
  await expect(canvas(page)).toHaveAttribute('data-lugares-movimiento', /(^| )fotos:quieto( |$)/);
  const still = new Set<number | null>();
  for (let i = 0; i < 5; i++) {
    still.add(await pose(page));
    await page.waitForTimeout(400);
  }
  // La pose del fotograma quieto del manifiesto (T110: el 1, la boia abajo).
  expect(fotosManifest.motion[0]!.static_frame).toBe(1);
  expect([...still]).toEqual([0.42]);
  await shot(page, 'benidorm-quieta');
  // Y si vuelve el movimiento, baila otra vez.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(canvas(page)).toHaveAttribute('data-lugares-movimiento', /(^| )fotos:baile( |$)/);
  expect(errors).toEqual([]);
});

test('sin sus GLB, Benidorm e Ibiza a mano: nada baila y el mar sigue', async ({ page }) => {
  await page.route(glbOf('fotos'), (r) => r.fulfill({ status: 404, body: '' }));
  await page.route(glbOf('tienda'), (r) => r.fulfill({ status: 404, body: '' }));
  const errors = await openMar(page, '?cerca=fotos');
  await expect.poll(() => islandState(page), { timeout: 30_000 }).toContain('fotos:error');
  await expect(page.locator('[data-pin="fotos"]')).toHaveCount(1);
  expect(await canvas(page).getAttribute('data-lugares-movimiento')).not.toContain('fotos');
  await shot(page, 'benidorm-a-mano');
  await openMar(page, '?cerca=tienda');
  await expect.poll(() => islandState(page), { timeout: 30_000 }).toContain('tienda:error');
  await expect(mar(page)).toHaveAttribute('data-barco', /\d/);
  await shot(page, 'ibiza-a-mano');
  expect(errors).toEqual([]);
});

test('Ibiza: su modelo sustituye a la isla y al llegar sale su ficha de tienda', async ({
  page,
}) => {
  const glb: string[] = [];
  page.on('response', (r) => {
    if (r.url().endsWith('/tienda/tienda.glb')) glb.push(String(r.status()));
  });
  const errors = await openMar(page, '?cerca=tienda');
  await loaded(page, 'tienda');
  expect(glb).toEqual(['200']);
  // Ibiza no tiene nada que baile.
  expect(await canvas(page).getAttribute('data-lugares-movimiento')).not.toContain('tienda');
  await shot(page, 'ibiza-modelo');
  const sheet = page.locator('[data-testid="mar-ficha"][data-lugar="tienda"]');
  await steerTo(page, 'tienda', async () => await sheet.isVisible());
  await expect(sheet).toBeVisible();
  await expect(marSheet(page).getByTestId('mar-merchandise-open').first()).toBeAttached();
  await shot(page, 'ibiza-ficha');
  expect(errors).toEqual([]);
});

test('de noche, Benidorm e Ibiza con sus luces (captura)', async ({ page }) => {
  test.skip(!process.env.RECORD_T112, 'sólo la captura');
  await page.addInitScript(() => window.localStorage.setItem('boia:mar3d:momento', 'noche'));
  await openMar(page, '?cerca=fotos');
  await loaded(page, 'fotos');
  await approach(page, 'fotos');
  await shot(page, 'benidorm-noche');
  await openMar(page, '?cerca=tienda');
  await loaded(page, 'tienda');
  await approach(page, 'tienda');
  await shot(page, 'ibiza-noche');
});
