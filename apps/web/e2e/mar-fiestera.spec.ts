import { rescueMissionOf } from '@boia/engine/mission';
import { SAMPLE_COSMETICS, SAMPLE_DISCOUNTS } from '@boia/store';
import { WORLD_REGISTRY, type WorldObject } from '@boia/world';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marWorld } from '../app/mar/engine/compact';
import { SAMPLE_CONTENT } from '../lib/landing/sample-content';
import { discountRefOf, guideSpots, missionDiscountOf } from '../lib/mundo/guide';
import { seedCarnet } from './carnet-seed';

/**
 * La Boia Fiestera como misión central y tres descuentos claros en /mar
 * (T59): el minimapa enseña tres «?» (los códigos del mundo, leídos de la
 * muestra); rescatarla y dejarla en la Isla de Nochevieja da su código de entradas,
 * que la compra de prueba aplica, y el barco exclusivo; un secreto sin
 * código sigue escondido y premia al encontrarlo; el delfín guía a la
 * Fiestera, a los códigos y a los minijuegos (las boies informativas ya no
 * ponen chip de rumbo desde T68). Como en las
 * otras pruebas del mar, cada tramo empieza con `?cerca=` y el progreso vive
 * en el navegador de la prueba.
 *
 * Con RECORD_T59=1 deja capturas en docs/informes/img/ p005-t59-*.png (móvil).
 */

test.describe.configure({ timeout: 180_000 });

const first = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId);
const objects = first.config.objects;
const spec = rescueMissionOf(first.config)!;
const fiesteraCode = SAMPLE_DISCOUNTS.find(
  (d) => d.id === missionDiscountOf(objects, spec.destination),
)!;
const exclusive = SAMPLE_COSMETICS.find((c) => c.slot === 'ship' && c.unlockMission)!;
/** Con checkout online: Halloween y SONIDO son sólo de taquilla (plan 017 T199). */
const buyable = SAMPLE_CONTENT.events.find(
  (e) => e.state === 'on_sale' && e.islandId && !e.boxOfficeOnly,
)!;
/** Un secreto sin código: escondido, sin «?», con monedas o puntos. */
const secret = objects.find(
  (o) =>
    o.identity.category === 'secreto' &&
    discountRefOf(o) === null &&
    o.behaviors.some((b) => b.type === 'reward' && b.params.kind === 'coins'),
)!;
const secretCoins = (o: WorldObject) =>
  o.behaviors.reduce(
    (n, b) => (b.type === 'reward' && b.params.kind === 'coins' ? n + b.params.amount : n),
    0,
  );

const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../docs/informes/img',
);

async function snap(page: Page, name: string) {
  if (test.info().project.name !== 'mobile' || !process.env.RECORD_T59) return;
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, name) });
}

const mar = (page: Page) => page.locator('main.mar');

async function openMar(page: Page, query = '') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`/mar${query}`);
  await expect(page.getByTestId('mar-canvas')).toBeVisible();
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 30_000 });
  await expect(mar(page)).toHaveAttribute('data-barco', /\d/);
  return errors;
}

async function shipAt(page: Page) {
  const [x, y] = ((await mar(page).getAttribute('data-barco')) ?? '0,0').split(',').map(Number);
  return { x: x!, y: y! };
}

/** Gobierna con las flechas hacia un lugar del mar 3D hasta que `done` se cumpla. */
async function steerTo(page: Page, id: string, done: () => Promise<boolean>, ms = 30_000) {
  const target = marWorld(first.config).objects.find((o) => o.identity.id === id)!.position;
  const held = new Set<string>();
  const hold = async (keys: string[]) => {
    for (const k of [...held]) {
      if (keys.includes(k)) continue;
      await page.keyboard.up(k);
      held.delete(k);
    }
    for (const k of keys) {
      if (held.has(k)) continue;
      await page.keyboard.down(k);
      held.add(k);
    }
  };
  try {
    const until = Date.now() + ms;
    while (Date.now() < until && !(await done())) {
      const s = await shipAt(page);
      const dx = target.x - s.x;
      const dy = target.y - s.y;
      const d = Math.hypot(dx, dy) || 1;
      const keys: string[] = [];
      if (dx / d > 0.35) keys.push('ArrowRight');
      if (dx / d < -0.35) keys.push('ArrowLeft');
      if (dy / d > 0.35) keys.push('ArrowDown');
      if (dy / d < -0.35) keys.push('ArrowUp');
      await hold(keys);
      await page.waitForTimeout(150);
    }
  } finally {
    await hold([]);
  }
}

const missionIs = (page: Page, phase: string) => async () =>
  (await mar(page).getAttribute('data-mision')) === phase;
const sheetIs = (page: Page, kind: string) => async () =>
  (await page.locator(`[data-testid="mar-ficha"][data-tipo="${kind}"]`).count()) > 0;
const minimap = (page: Page) => page.getByTestId('mar-minimapa').locator('canvas');
const marks = async (page: Page) =>
  ((await minimap(page).getAttribute('data-marks')) ?? '').split(',').filter(Boolean).sort();
const coins = async (page: Page) =>
  Number(/🪙\s*(\d+)/.exec((await page.getByTestId('mar-saldos').textContent()) ?? '')?.[1]);

test('el minimapa enseña un «?» por cada uno de los tres códigos del mundo', async ({ page }) => {
  // La muestra tiene exactamente tres códigos, y son los que esconde el mundo.
  const inWorld = new Set([
    ...objects.flatMap((o) => (discountRefOf(o) ? [discountRefOf(o)!] : [])),
    fiesteraCode.id,
  ]);
  expect(SAMPLE_DISCOUNTS).toHaveLength(3);
  expect(new Set(SAMPLE_DISCOUNTS.map((d) => d.id))).toEqual(inWorld);

  const errors = await openMar(page);
  await expect
    .poll(() => marks(page), { timeout: 15_000 })
    .toEqual(SAMPLE_DISCOUNTS.map((d) => d.id).sort());
  await expect(page.getByTestId('mar-minimapa')).toHaveAttribute('data-codigos', '3');
  await snap(page, 'p005-t59-minimapa.png');
  expect(errors).toEqual([]);
});

test('rescatar a la Fiestera y dejarla en la Isla de Nochevieja: su código vale en la compra y el barco exclusivo es tuyo', async ({
  page,
}) => {
  // Comprar pide el Carnet BOIA (plan 019): se viene con uno.
  await seedCarnet(page);
  // 1. El remanso: los cocodrilos se sumergen y ella sube a bordo.
  const errors = await openMar(page, `?cerca=${spec.characterId}`);
  await expect(mar(page)).toHaveAttribute('data-mision', 'waiting');
  await steerTo(page, spec.characterId, missionIs(page, 'aboard'));
  await expect(mar(page)).toHaveAttribute('data-mision', 'aboard');
  // Su «?» va con ella: ahora está en su destino.
  await expect
    .poll(async () => (await minimap(page).getAttribute('data-mark-places')) ?? '')
    .toContain(spec.destination);

  // 2. La Isla de Nochevieja (otra visita: sigue a bordo): baja y deja su código.
  await openMar(page, `?cerca=${spec.destination}`);
  await expect(mar(page)).toHaveAttribute('data-mision', 'aboard');
  await steerTo(page, spec.destination, sheetIs(page, 'discount'));
  await expect(mar(page)).toHaveAttribute('data-mision', 'delivered', { timeout: 10_000 });
  // La entrega nombra la Isla de Nochevieja (2026-10-02): su destino y su aviso.
  expect(objects.find((o) => o.identity.id === spec.destination)?.identity.name).toBe(
    'Isla de Nochevieja',
  );
  await expect(
    page.getByTestId('mar-aviso').filter({ hasText: '¡Fiesta en la Isla de Nochevieja!' }).first(),
  ).toBeVisible();
  const sheet = page.getByTestId('mar-ficha');
  await expect(sheet).toHaveAttribute('data-tipo', 'discount');
  await expect(sheet).toContainText(fiesteraCode.code);
  await snap(page, 'p005-t59-codigo-fiestera.png');
  // Su «?» ya no está; quedan los otros dos.
  await expect
    .poll(() => marks(page))
    .toEqual(
      SAMPLE_DISCOUNTS.filter((d) => d.id !== fiesteraCode.id)
        .map((d) => d.id)
        .sort(),
    );

  // 3. La compra de prueba, dentro del mar, lo aplica.
  await page.getByTestId('mar-entradas').click();
  const panel = page.getByTestId('mar-entradas-panel');
  await expect(panel).toBeVisible();
  const card = panel.getByTestId(`mar-entrada-${buyable.id}`);
  await expect(card.getByTestId('banner-descuento-codigo')).toHaveText(fiesteraCode.code);
  await card.getByTestId(`mar-entradas-comprar-${buyable.id}`).click();
  const checkout = page.getByTestId('checkout');
  await expect(checkout.getByTestId('checkout-confirmar')).toBeVisible({ timeout: 20_000 });
  await expect(checkout.getByTestId('checkout-descuento')).toHaveAttribute(
    'data-discount-id',
    fiesteraCode.id,
  );

  // 4. El barco exclusivo: en la tienda, ya suyo; se lo pone y se queda tras recargar.
  await openMar(page);
  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-barco').click();
  const shop = page.getByTestId('mar-tienda');
  await expect(shop).toBeVisible();
  const row = shop.getByTestId(`barco-estilo-${exclusive.assetKey}`);
  await expect(row).not.toHaveAttribute('data-bloqueado', 'si');
  await row.click();
  await expect(mar(page)).toHaveAttribute('data-ship-style', exclusive.assetKey!, {
    timeout: 20_000,
  });
  await snap(page, 'p005-t59-barco-fiestera.png');
  expect(errors).toEqual([]);
});

test('sin rescatarla, el barco exclusivo está bloqueado y dice cómo se gana', async ({ page }) => {
  await openMar(page);
  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-barco').click();
  const row = page.getByTestId('mar-tienda').getByTestId(`barco-estilo-${exclusive.assetKey}`);
  await expect(row).toHaveAttribute('data-bloqueado', 'si');
  await expect(row).toContainText('Boia Fiestera');
});

test('un secreto sin código sigue escondido y premia al encontrarlo', async ({ page }) => {
  expect(secret, 'hay un secreto sin código que da monedas').toBeDefined();
  const errors = await openMar(page, `?cerca=${secret.identity.id}`);
  // Ni «?» ni rótulo: no se chiva.
  expect(await marks(page)).not.toContain(secret.identity.id);
  await expect(page.locator(`[data-pin="${secret.identity.id}"]`)).toHaveCount(0);
  await expect.poll(() => coins(page)).not.toBeNaN();
  const before = await coins(page);
  const prize = page
    .getByTestId('mar-aviso')
    .filter({ hasText: `+${secretCoins(secret)} monedas` });
  await steerTo(page, secret.identity.id, async () => (await prize.count()) > 0);
  await expect(prize.first()).toBeVisible();
  await expect.poll(() => coins(page)).toBeGreaterThanOrEqual(before + secretCoins(secret));
  expect(errors).toEqual([]);
});

test('el delfín guía a lo pendiente (las boies informativas ya no ponen chip: T68, mar-ayuda.spec)', async ({
  page,
}) => {
  // El delfín (`?delfin=1`: sale tras 1 s de mar abierto) guía a algo señalado.
  const guided = guideSpots(marWorld(first.config).objects, {
    phase: 'waiting',
    destination: null,
    found: { has: () => false },
    foundDiscounts: { has: () => false },
  }).map((s) => s.objectId);
  await openMar(page, '?delfin=1');
  await page.keyboard.down('ArrowLeft');
  try {
    await expect(mar(page)).toHaveAttribute('data-delfin', 'guiando', { timeout: 20_000 });
  } finally {
    await page.keyboard.up('ArrowLeft');
  }
  const to = await mar(page).getAttribute('data-delfin-hacia');
  expect(guided).toContain(to);
});
