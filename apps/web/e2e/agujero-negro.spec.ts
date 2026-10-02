import { WORLD_REGISTRY, type WorldObject } from '@boia/world';
import { expect, test } from '@playwright/test';
import { mar, openMar } from './mar-helpers';

/**
 * Cambio de mundo por agujero negro (T41, D-23 punto 4) cuando el Admin
 * cambia el mundo activo con el mar 3D abierto en otra pestaña (desde T62,
 * D-25, el único mundo navegable): el mismo vórtice centrado en el barco, que
 * no se mueve. El cambio desde «Mundos» y su fundido con movimiento reducido
 * los prueba mar-paridad.spec.ts. Los mundos y el lugar salen del registro.
 */

test.describe.configure({ timeout: 120_000 });

const first = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId);
const second = WORLD_REGISTRY.get(WORLD_REGISTRY.ids().find((id) => id !== first.id)!);
const islandOf = (o: WorldObject) =>
  o.behaviors.some((b) => b.type === 'content') && o.identity.active;
/** Un lugar de los dos mundos (el mapa es compartido, D-20.7). */
const place = first.config.objects.find(
  (o) => islandOf(o) && second.config.objects.some((x) => x.identity.id === o.identity.id),
)!;

test('el Admin cambia el mundo activo con el mar abierto: el mismo agujero negro', async ({
  page,
  context,
}) => {
  await openMar(page, `?cerca=${place.identity.id}`);
  await expect(mar(page)).toHaveAttribute('data-mundo', first.id);
  // Quieto: el barco puede asentarse un poco al arrancar.
  let ship = '';
  await expect
    .poll(
      async () => {
        const now = (await mar(page).getAttribute('data-barco')) ?? '';
        const same = now === ship;
        ship = now;
        return same;
      },
      { intervals: [500], timeout: 15_000 },
    )
    .toBe(true);

  const admin = await context.newPage();
  await admin.goto('/admin');
  await admin.getByTestId('admin-nav-temporadas').click();
  await admin.getByTestId(`temporada-${second.id}`).getByRole('radio').check();
  await expect(admin.getByTestId('admin-ok').first()).toBeVisible();
  await admin.close();

  await expect(mar(page)).toHaveAttribute('data-cambio-mundo', 'vortice', { timeout: 10_000 });
  await expect(mar(page)).toHaveAttribute('data-mundo', second.id, { timeout: 20_000 });
  await expect(mar(page)).not.toHaveAttribute('data-cambio-mundo', /.+/, { timeout: 20_000 });
  expect(await mar(page).getAttribute('data-barco')).toBe(ship);
});
