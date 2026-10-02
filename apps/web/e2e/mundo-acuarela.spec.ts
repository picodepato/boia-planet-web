import { SAMPLE_DISCOUNTS } from '@boia/store';
import { WORLD_PARAM, WORLD_REGISTRY, type WorldObject } from '@boia/world';
import { expect, test } from '@playwright/test';
import { SAMPLE_CONTENT } from '../lib/landing/sample-content';
import { mar, marSheet, openMar, sheetIs, steerTo } from './mar-helpers';

/**
 * Acuarela en el mar 3D (T24; desde T62, D-25, el único mundo navegable): con
 * `?mundo=` se juega Acuarela con su barco (sin barco elegido, el del mundo)
 * y se navega con el teclado a su isla de evento y a su náufrago, cada tramo
 * desde `?cerca=<lugar>`. Cambiar de mundo desde «Mundos» lo prueba
 * mar-paridad.spec.ts. Corre en móvil 360×640 y en escritorio.
 */

test.describe.configure({ timeout: 120_000 });

const arcilla = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId);
const acuarela = WORLD_REGISTRY.get(WORLD_REGISTRY.ids().find((id) => id !== arcilla.id)!);
const objects = acuarela.config.objects;
const paramsOf = (o: WorldObject, type: string) =>
  o.behaviors.filter((b) => b.type === type).map((b) => b.params as Record<string, unknown>);

const eventIsland = objects.find((o) => paramsOf(o, 'content').some((p) => p.target === 'event'))!;
const eventId = paramsOf(eventIsland, 'content').find((p) => p.target === 'event')!.ref as string;
const castaway = objects.find((o) => o.identity.category === 'naufrago')!;
const castawayDiscount = SAMPLE_DISCOUNTS.find(
  (d) => d.id === paramsOf(castaway, 'reward').find((p) => p.kind === 'discount')?.ref,
)!;

test('Acuarela: su barco, su isla de evento y su náufrago', async ({ page }) => {
  const event = SAMPLE_CONTENT.events.find((e) => e.id === eventId)!;
  expect(event, `el evento ${eventId} de la isla existe`).toBeDefined();
  expect(castawayDiscount, 'el náufrago da un descuento').toBeDefined();
  const sheet = marSheet(page);
  const world = `${WORLD_PARAM}=${acuarela.id}`;

  await openMar(page, `?${world}&cerca=${eventIsland.identity.id}`);
  await expect(mar(page)).toHaveAttribute('data-mundo', acuarela.id);
  await expect(mar(page)).toHaveAttribute('data-ship-style', acuarela.theme.ship.style);
  await steerTo(page, eventIsland.identity.id, sheetIs(page, 'event'), { worldId: acuarela.id });
  await expect(sheet).toHaveAttribute('data-tipo', 'event');
  await expect(sheet.getByRole('heading', { name: event.name })).toBeVisible();

  await openMar(page, `?${world}&cerca=${castaway.identity.id}`);
  await expect(mar(page)).toHaveAttribute('data-mundo', acuarela.id);
  await steerTo(page, castaway.identity.id, sheetIs(page, 'discount'), { worldId: acuarela.id });
  await expect(sheet).toHaveAttribute('data-tipo', 'discount');
  await expect(sheet).toContainText(castawayDiscount.code);
});
