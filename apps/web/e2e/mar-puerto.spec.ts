import { MemoryStorage, SAMPLE_COSMETICS, STORE_KEY, createLocalRepository } from '@boia/store';
import { HARBOR_PLACE_ID, WORLD_REGISTRY } from '@boia/world';
import { type Page, expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { marWorld } from '../app/mar/engine/compact';
import { PLACE_MODELS_URL } from '../app/mar/engine/island-models';
import { PIN_AVOID } from '../app/mar/engine/labels';
import { t } from '../lib/i18n';
import { mar, marSheet, openMar, shipAt, steerTo } from './mar-helpers';

/**
 * El Puerto de Alicante (T108, antes la Cala Cantalar): al acercarse sale su
 * ficha de lugar, la de siempre, nunca la tienda sola (tampoco a quien ya
 * abrió «Barco» antes, con la preferencia vieja de T100); su botón «Cambiar
 * de barco» abre «Barco» para comprar y equipar; no anuncia eventos. En el
 * mar, el modelo de Blender de T107 sustituye a la isla entera, con la
 * composición a mano si el GLB no llega, y la misma colisión. Durante una
 * partida del Cañón su ficha no sale, como las de las demás islas. Su
 * rótulo va sobre el modelo sin pisar los mandos (en un móvil estrecho, el
 * nombre largo se apaga lejos y sale al acercarse, como manda T75).
 *
 * Con RECORD_T108=<carpeta> deja capturas allí (fuera del repositorio).
 */

test.describe.configure({ timeout: 180_000 });

const world = marWorld(WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config);
const harbor = world.objects.find((o) => o.identity.id === HARBOR_PLACE_ID)!;
const NAME = harbor.identity.name;
const GLB = `**${PLACE_MODELS_URL}/${HARBOR_PLACE_ID}/${HARBOR_PLACE_ID}.glb`;
/** El barco más barato de la tienda: el que se compra desde el puerto. */
const ship = SAMPLE_COSMETICS.filter((c) => c.slot === 'ship' && !c.base && c.priceCoins).sort(
  (a, b) => a.priceCoins! - b.priceCoins!,
)[0]!;
const STYLE = ship.assetKey!;

const canvas = (page: Page) => page.getByTestId('mar-canvas');
const islandState = (page: Page) => canvas(page).getAttribute('data-islas-modelo');
const harborSheet = (page: Page) =>
  page.locator(`[data-testid="mar-ficha"][data-lugar="${HARBOR_PLACE_ID}"]`);
const distance = async (page: Page) => {
  const s = await shipAt(page);
  return Math.hypot(s.x - harbor.position.x, s.y - harbor.position.y);
};

/** Un jugador que ya había jugado: con monedas y la preferencia vieja «ya abrió Barco» (T100). */
async function seedExisting(page: Page) {
  const storage = new MemoryStorage();
  const repo = createLocalRepository({ storage, watch: false });
  await repo.progress.grantWorldReward({
    sourceRef: 'e2e:t108',
    coins: ship.priceCoins!,
    points: 1,
  });
  await repo.progress.setPref('barco:menu-abierto', true);
  await page.addInitScript(
    ([key, doc]) => {
      if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, doc);
    },
    [STORE_KEY, storage.getItem(STORE_KEY)!] as const,
  );
}

async function shot(page: Page, name: string) {
  const dir = process.env.RECORD_T108;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(dir, `${name}-${test.info().project.name}.png`) });
}

/** Navega hasta el puerto hasta que salga su ficha; nunca la tienda sola. */
async function arrive(page: Page) {
  await steerTo(page, HARBOR_PLACE_ID, async () => await harborSheet(page).isVisible());
  await expect(harborSheet(page)).toBeVisible();
  await expect(harborSheet(page)).toHaveAttribute('data-tipo', 'info');
  await expect(harborSheet(page).getByRole('heading', { name: NAME })).toBeVisible();
  // La tienda de T100 se abría sola al llegar, tras leer el perfil: aquí, nunca.
  await page.waitForTimeout(2000);
  await expect(page.getByTestId('mar-tienda')).toHaveCount(0);
}

test('perfil nuevo: la ficha del puerto, sin tienda sola ni eventos; su botón abre «Barco»', async ({
  page,
}) => {
  const errors = await openMar(page, `?cerca=${HARBOR_PLACE_ID}`);
  await expect(page.locator(`.mar-pin[data-pin="${HARBOR_PLACE_ID}"]`)).toContainText(NAME);
  await arrive(page);
  const sheet = harborSheet(page);
  // Primera llegada: el botón del barco, sin «Explorar la isla».
  await expect(sheet.getByTestId('puerto-barcos')).toHaveText(t('mar.sheet.puerto.cambiarBarco'));
  await expect(sheet.getByTestId('isla-explorar')).toHaveCount(0);
  await shot(page, 'puerto-ficha');
  await sheet.getByTestId('mar-ficha-mas').click();
  await expect(sheet.locator('[data-puerto="si"]')).toBeVisible();
  await expect(sheet.getByTestId('panel-proximos')).toHaveCount(0);
  await expect(sheet.getByTestId('ver-fotos-isla')).toBeVisible();
  await sheet.getByTestId('puerto-barcos').click();
  const shop = page.getByTestId('mar-tienda').getByTestId('barco');
  await expect(shop).toBeVisible();
  await expect(shop.getByTestId(`barco-estilo-${STYLE}`)).toHaveAttribute('data-bloqueado', 'si');
  await expect(shop.getByTestId(`barco-comprar-${STYLE}`)).toBeVisible();
  await shot(page, 'puerto-barco');
  await page.getByTestId('mar-tienda-cerrar').click();
  await expect(page.getByTestId('mar-tienda')).toHaveCount(0);
  // Otra visita: la ficha otra vez (con «Explorar la isla»), y la tienda tampoco sale sola.
  await openMar(page, `?cerca=${HARBOR_PLACE_ID}`);
  await arrive(page);
  await expect(harborSheet(page).getByTestId('puerto-barcos')).toBeVisible();
  await expect(harborSheet(page).getByTestId('isla-explorar')).toBeVisible();
  expect(errors).toEqual([]);
});

test('perfil con la preferencia vieja de «Barco»: la ficha del puerto; compra y equipa desde ella', async ({
  page,
}) => {
  await seedExisting(page);
  const errors = await openMar(page, `?cerca=${HARBOR_PLACE_ID}`);
  await arrive(page);
  await harborSheet(page).getByTestId('puerto-barcos').click();
  const shop = page.getByTestId('mar-tienda').getByTestId('barco');
  await expect(shop.getByTestId('barco-saldo')).toHaveAttribute(
    'data-coins',
    String(ship.priceCoins),
  );
  await shop.getByTestId(`barco-comprar-${STYLE}`).click();
  await shop.getByTestId('barco-confirmar').getByTestId('barco-confirmar-si').click();
  await expect(shop.getByTestId(`barco-estilo-${STYLE}`)).not.toHaveAttribute(
    'data-bloqueado',
    'si',
  );
  await shop.getByTestId(`barco-estilo-${STYLE}`).click();
  await expect(mar(page)).toHaveAttribute('data-ship-style', STYLE);
  await page.getByTestId('mar-tienda-cerrar').click();
  // Cerrar la tienda deja la ficha del puerto donde estaba.
  await expect(harborSheet(page)).toBeVisible();
  expect(errors).toEqual([]);
});

test('cerca, el modelo de Blender sustituye a la isla entera; la colisión es la de siempre', async ({
  page,
}) => {
  const glb: string[] = [];
  page.on('response', (r) => {
    if (r.url().endsWith(`/${HARBOR_PLACE_ID}/${HARBOR_PLACE_ID}.glb`))
      glb.push(String(r.status()));
  });
  const errors = await openMar(page, `?cerca=${HARBOR_PLACE_ID}`);
  await expect
    .poll(() => islandState(page), { timeout: 30_000 })
    .toContain(`${HARBOR_PLACE_ID}:glb`);
  expect(glb).toEqual(['200']);
  // Sus luces de a mano se apagan con el modelo.
  await expect(canvas(page)).toHaveAttribute(
    'data-islas-sin-luces',
    new RegExp(`(^| )${HARBOR_PLACE_ID}( |$)`),
  );
  await shot(page, 'puerto-modelo');
  // Recto hacia la dársena: el barco se para en su colisión, como antes.
  const radius = harbor.geometry.collision!.radius;
  await page.keyboard.down('ArrowUp');
  let closest = Infinity;
  try {
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(200);
      closest = Math.min(closest, await distance(page));
    }
  } finally {
    await page.keyboard.up('ArrowUp');
  }
  expect(closest).toBeGreaterThan(radius * 0.9);
  await shot(page, 'puerto-muelle');
  expect(errors).toEqual([]);
});

test('su rótulo, «Puerto de Alicante», sale sobre el puerto sin pisar los mandos', async ({
  page,
}) => {
  const errors = await openMar(page, `?cerca=${HARBOR_PLACE_ID}`);
  await expect
    .poll(() => islandState(page), { timeout: 30_000 })
    .toContain(`${HARBOR_PLACE_ID}:glb`);
  const pin = page.locator(`.mar-pin.is-on[data-pin="${HARBOR_PLACE_ID}"]`);
  await steerTo(page, HARBOR_PLACE_ID, async () => (await pin.count()) > 0, { ms: 30_000 });
  await expect(pin).toContainText(NAME);
  await page.waitForTimeout(400);
  const seen = await page.evaluate(
    ([avoid, id]) => {
      const box = (r: DOMRect) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
      const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="mar-canvas"]')!;
      const c = canvas.getBoundingClientRect();
      const part = (canvas.dataset.islasPantalla ?? '')
        .split(' ')
        .find((p) => p.startsWith(`${id}:`));
      const [l, t, r, b] = (part?.split(':')[1] ?? '0,0,0,0').split(',').map(Number);
      return {
        label: box(
          document.querySelector(`.mar-pin.is-on[data-pin="${id}"]`)!.getBoundingClientRect(),
        ),
        body: part
          ? { left: l! + c.left, top: t! + c.top, right: r! + c.left, bottom: b! + c.top }
          : null,
        hud: [...document.querySelectorAll(avoid)]
          .map((el) => box(el.getBoundingClientRect()))
          .filter((h) => h.right > h.left && h.bottom > h.top),
      };
    },
    [PIN_AVOID, HARBOR_PLACE_ID] as const,
  );
  for (const h of seen.hud) {
    const overlap =
      seen.label.left < h.right &&
      seen.label.right > h.left &&
      seen.label.top < h.bottom &&
      seen.label.bottom > h.top;
    expect(overlap, `el rótulo pisa un mando: ${JSON.stringify({ label: seen.label, h })}`).toBe(
      false,
    );
  }
  // Centrado sobre su puerto y nunca por debajo de él.
  expect(seen.body).not.toBeNull();
  const mid = (seen.label.left + seen.label.right) / 2;
  expect(mid).toBeGreaterThan(seen.body!.left);
  expect(mid).toBeLessThan(seen.body!.right);
  expect(seen.label.bottom).toBeLessThan(seen.body!.bottom);
  await shot(page, 'puerto-rotulo');
  expect(errors).toEqual([]);
});

test('de noche, el puerto con sus farolas (captura)', async ({ page }) => {
  test.skip(!process.env.RECORD_T108, 'sólo la captura');
  await page.addInitScript(() => window.localStorage.setItem('boia:mar3d:momento', 'noche'));
  await openMar(page, `?cerca=${HARBOR_PLACE_ID}`);
  await expect
    .poll(() => islandState(page), { timeout: 30_000 })
    .toContain(`${HARBOR_PLACE_ID}:glb`);
  await shot(page, 'puerto-noche');
});

test('sin el GLB, el puerto a mano: se navega, se llega y su ficha sale igual', async ({
  page,
}) => {
  await page.route(GLB, (r) => r.fulfill({ status: 404, body: '' }));
  const errors = await openMar(page, `?cerca=${HARBOR_PLACE_ID}`);
  await expect
    .poll(() => islandState(page), { timeout: 30_000 })
    .toContain(`${HARBOR_PLACE_ID}:error`);
  await expect(page.locator(`[data-pin="${HARBOR_PLACE_ID}"]`)).toHaveCount(1);
  await shot(page, 'puerto-a-mano');
  await arrive(page);
  await expect(harborSheet(page).getByTestId('puerto-barcos')).toBeVisible();
  expect(errors).toEqual([]);
});

test('en plena partida del Cañón, el puerto no abre su ficha ni la tienda', async ({ page }) => {
  const errors = await openMar(page, `?cerca=${HARBOR_PLACE_ID}&minijuego=canon&t=20&seed=3`);
  const game = page.getByTestId('mar-canon');
  await expect(game).toHaveAttribute('data-estado', 'running');
  const reach = harbor.geometry.proximityRadius!;
  let closest = Infinity;
  await steerTo(
    page,
    HARBOR_PLACE_ID,
    async () => {
      // Una carta de nivel que se abra por el camino para la partida: se contesta (T156).
      if ((await game.getAttribute('data-estado')) === 'card') await page.keyboard.press('Enter');
      closest = Math.min(closest, await distance(page));
      return closest < reach * 0.7 || (await marSheet(page).count()) > 0;
    },
    { ms: 30_000 },
  );
  expect(closest).toBeLessThan(reach);
  await page.waitForTimeout(1500);
  // Sigue la partida (jugando o con una carta de nivel abierta), sin ficha ni tienda.
  await expect(game).toHaveAttribute('data-estado', /^(running|card)$/);
  await expect(marSheet(page)).toHaveCount(0);
  await expect(page.getByTestId('mar-tienda')).toHaveCount(0);
  expect(errors).toEqual([]);
});
