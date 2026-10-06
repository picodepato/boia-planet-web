import { WORLD_REGISTRY } from '@boia/world';
import { expect, test } from '@playwright/test';
import { marWorld } from '../app/mar/engine/compact';
import { marSheet, openMar } from './mar-helpers';

/**
 * Los remolinos del mar 3D (REQ-AVE-019, T96): se pintan en el mar y se ven
 * de cerca y en el mapa grande, sin rótulo con su nombre encima (Hernán: se
 * ve solo y el nombre recargaba el mapa). Acercarse a uno no abre la ficha
 * de ninguna isla. Que se surfean (la corriente lleva el barco en círculo)
 * lo prueban `whirlpool.test.ts` y el motor. Móvil y escritorio.
 */

const world = marWorld(WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config);
const whirls = world.objects.filter((o) => o.identity.active && o.identity.category === 'remolino');
const whirl = whirls[0]!;

test('los remolinos se ven en el mar y en el mapa, sin rótulo encima', async ({ page }) => {
  // La vista de mapa es lo más lento de pintar en el Chromium sin GPU de las e2e.
  test.setTimeout(90_000);
  expect(whirls.length).toBeGreaterThan(0);
  const errors = await openMar(page, `?cerca=${whirl.identity.id}`);
  const canvas = page.getByTestId('mar-canvas');
  // Cada remolino del mundo tiene su remolino pintado en el mar…
  await expect(canvas).toHaveAttribute('data-remolinos', String(whirls.length));
  // …y desde cerca está en pantalla.
  const shown = async () => Number((await canvas.getAttribute('data-remolinos-vista')) ?? 0);
  await expect.poll(shown, { timeout: 15_000 }).toBeGreaterThan(0);
  // Sin rótulo: ningún remolino tiene nombre encima.
  for (const o of whirls) await expect(page.locator(`[data-pin="${o.identity.id}"]`)).toHaveCount(0);
  // Cerca de él no se abre su ficha (el remolino queda fuera de las de las islas).
  // Con el mar compacto de ahora la salida de `?cerca=` cae justo en el borde de
  // la ficha de Benidorm (295 u de 298): ésa puede abrirse; la del remolino, nunca.
  await expect(marSheet(page).filter({ hasText: whirl.identity.name })).toHaveCount(0);

  // En el mapa grande también se ve, y tampoco lleva rótulo.
  const mini = page.getByTestId('mar-minimapa');
  await mini.click();
  await expect(mini).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(shown, { timeout: 20_000 }).toBeGreaterThan(0);
  for (const o of whirls) await expect(page.locator(`[data-pin="${o.identity.id}"]`)).toHaveCount(0);
  // Los demás rótulos del mapa siguen ahí.
  await expect(page.locator('.mar-pin.is-on[data-pin]').first()).toBeVisible();
  expect(errors).toEqual([]);
});
