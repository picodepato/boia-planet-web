import { SAMPLE_CREW } from '@boia/store';
import { WORLD_REGISTRY } from '@boia/world';
import { expect, test } from '@playwright/test';
import { marSheet, openMar, sheetIs, steerTo } from './mar-helpers';

/**
 * T45 en el navegador, sin servidor (D-20): un Carnet público se reporta y el
 * Admin lo modera (REQ-ADM-040, O9); y una isla ya visitada ofrece «Explorar
 * la isla» en el mar 3D (REQ-AVE-013, T62). El ranking local (REQ-IDE-053) lo
 * prueba mar-botellas.spec.ts y la boia informativa, mar-paridad.spec.ts. Los
 * datos salen de la muestra y del mapa, nada a mano.
 */

test.describe.configure({ timeout: 120_000 });

const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId);
const answered = SAMPLE_CREW.find((c) => Object.keys(c.answers).length > 0)!;
const [questionId, answer] = Object.entries(answered.answers)[0]!;

test('reportar un Carnet y ocultar su respuesta desde el Admin', async ({ page }) => {
  await page.goto(`/carnet/${answered.userId}`);
  const card = page.getByTestId('carnet');
  await expect(card.getByText(answer, { exact: true })).toBeVisible();
  await page.getByTestId('carnet-reportar').click();
  await page.getByTestId('carnet-reporte-motivo').fill('Respuesta ofensiva (e2e)');
  await page.getByTestId('carnet-reporte-enviar').click();
  await expect(page.getByTestId('carnet-reporte-hecho')).toHaveText(
    'Gracias. El equipo de BOIA lo revisará.',
  );

  // Moderación: el Carnet reportado, con su motivo; se oculta la respuesta.
  await page.goto('/admin#moderacion');
  const row = page.getByTestId(`carnet-reportado-${answered.userId}`);
  await expect(row).toBeVisible();
  await expect(row).toHaveAttribute('data-abiertos', '1');
  await expect(row).toContainText('Respuesta ofensiva (e2e)');
  await row.getByTestId(`carnet-ocultar-${answered.userId}-${questionId}`).click();
  const done = page.getByTestId(`carnet-reportado-${answered.userId}`);
  await expect(done).toHaveAttribute('data-abiertos', '0');
  await expect(done).toContainText('respuesta retirada');

  // Queda en la auditoría.
  await page.getByTestId('admin-nav-auditoria').click();
  await expect(page.getByTestId('admin-seccion-auditoria')).toContainText('Moderación de Carnets');

  // El Carnet sigue, sin esa respuesta.
  await page.goto(`/carnet/${answered.userId}`);
  await expect(card.getByText('Respuesta retirada por moderación.')).toBeVisible();
  await expect(card.getByText(answer, { exact: true })).toBeHidden();
  await expect(page.getByTestId('carnet-apodo')).toHaveText(answered.nickname);
});

test('una isla ya visitada ofrece «Explorar la isla»', async ({ page }) => {
  const island = world.config.objects.find(
    (o) =>
      o.identity.category === 'isla' &&
      o.behaviors.some((b) => b.type === 'content' && b.params.target === 'info'),
  )!;
  const id = island.identity.id;
  const sheet = marSheet(page);
  await openMar(page, `?cerca=${id}`);
  await steerTo(page, id, sheetIs(page, 'info'));
  await expect(sheet).toHaveAttribute('data-tipo', 'info');
  await expect(sheet).toHaveAttribute('data-lugar', id);
  await expect(sheet.getByTestId('isla-explorar')).toHaveCount(0);
  await sheet.getByTestId('mar-ficha-mas').click();
  await expect(sheet.locator('[data-visita]')).toHaveAttribute('data-visita', 'primera');

  // Otra visita: la ficha sale pequeña con el acceso directo.
  await openMar(page, `?cerca=${id}`);
  await steerTo(page, id, sheetIs(page, 'info'));
  await expect(sheet).toHaveAttribute('data-lugar', id);
  await sheet.getByTestId('isla-explorar').click();
  await expect(sheet.locator('[data-visita]')).toHaveAttribute('data-visita', 'otra');
  await expect(sheet.getByTestId('ver-fotos-isla')).toBeVisible();
});
