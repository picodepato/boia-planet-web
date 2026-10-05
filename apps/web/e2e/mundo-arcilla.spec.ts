import { SAMPLE_DISCOUNTS } from '@boia/store';
import { WORLD_REGISTRY, type WorldObject } from '@boia/world';
import { expect, test } from '@playwright/test';
import { marSheet, openMar, sheetIs, steerTo } from './mar-helpers';

/**
 * El mundo Arcilla en el mar 3D (T20; desde T62, D-25, el único mundo
 * navegable): con el teclado, desde `?cerca=<lugar>`, se llega al descuento
 * escondido (se copia y sólo se concede una vez, REQ-COM-022) y a la tienda
 * (enlace a la página de merchandising). La isla de evento, el náufrago y el
 * Puerto de Fotos los prueban mar-a-bordo.spec.ts y mar-paridad.spec.ts.
 * Corre en móvil 360×640 y en escritorio.
 */

test.describe.configure({ timeout: 120_000 });

const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId);
const objects = world.config.objects;
const paramsOf = (o: WorldObject, type: string) =>
  o.behaviors.filter((b) => b.type === type).map((b) => b.params as Record<string, unknown>);

const shop = objects.find((o) => paramsOf(o, 'content').some((p) => p.target === 'store'))!;
// El tesoro: un descuento que se recoge al pasar, en un sitio fijo.
const treasure = objects.find(
  (o) =>
    o.behaviors.some((b) => b.type === 'collectible') &&
    !o.behaviors.some((b) => b.type === 'spawn') &&
    paramsOf(o, 'reward').some((p) => p.kind === 'discount'),
)!;
const treasureDiscount = SAMPLE_DISCOUNTS.find(
  (d) => d.id === paramsOf(treasure, 'reward').find((p) => p.kind === 'discount')?.ref,
)!;

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

test('descuento escondido: se copia con un toque y sólo se concede una vez', async ({ page }) => {
  expect(treasureDiscount, 'el tesoro esconde un código de la muestra').toBeDefined();
  const id = treasure.identity.id;
  const sheet = marSheet(page);
  await openMar(page, `?cerca=${id}`);
  await steerTo(page, id, sheetIs(page, 'discount'));
  await expect(sheet).toHaveAttribute('data-tipo', 'discount');
  await sheet.getByTestId('mar-ficha-mas').click();
  const card = sheet.getByTestId('mar-descuento');
  await expect(card.getByTestId('descuento-codigo')).toHaveText(treasureDiscount.code);
  await card.getByTestId('descuento-copiar').click();
  await expect(card.getByTestId('descuento-copiar')).toHaveText(/Copiado|Cópialo a mano/);

  // Otra visita, mismo sitio: ya no se concede.
  await openMar(page, `?cerca=${id}`);
  await steerTo(page, id, sheetIs(page, 'discount'), { ms: 8_000 });
  await expect(sheet.and(page.locator('[data-tipo="discount"]'))).toHaveCount(0);
});

test('tienda: la ficha lleva a la tienda de merchandising', async ({ page }) => {
  const id = shop.identity.id;
  const sheet = marSheet(page);
  await openMar(page, `?cerca=${id}`);
  await steerTo(page, id, sheetIs(page, 'store'));
  await expect(sheet).toHaveAttribute('data-lugar', id);
  // The store sheet links to the in-app merchandise page (`/tienda?from=mar`),
  // not to an external site; the external new-tab link is the WhatsApp one.
  const link = sheet.getByTestId('mar-merchandise-open');
  await expect(link).toHaveAttribute('href', /^\/tienda\?from=mar$/);
});
