import { HALLOWEEN_EVENT_ID } from '@boia/store';
import { WORLD_REGISTRY } from '@boia/world';
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eventIslands } from '../lib/admin/world';
import { eventHref, photosHref } from '../lib/landing/eventos';
import { SAMPLE_CONTENT } from '../lib/landing/sample-content';

/**
 * Capturas de la T42 para el informe, a tamaño de móvil (390×844). No corre
 * con `pnpm e2e`; se pide aparte:
 *
 *   RECORD_T42=1 E2E_PORT=<libre> pnpm e2e record-eventos.spec.ts --project=mobile --workers=1
 *
 * Deja en docs/informes/img/: p004-t42-evento.png (ficha de BOIA Club ·
 * Halloween), p004-t42-fotos.png («Fotos y eventos» en la galería de la isla
 * del All Day) y p004-t42-isla-estado.png (panel de la isla con su evento
 * agotado desde el Admin, recuerdos y próximos eventos).
 */

test.skip(!process.env.RECORD_T42, 'sólo con RECORD_T42=1');
test.use({ viewport: { width: 390, height: 844 } });
test.describe.configure({ timeout: 120_000 });

const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../docs/informes/img',
);
const island = eventIslands(WORLD_REGISTRY.map).find((p) =>
  p.behaviors.some((b) => b.type === 'content' && b.params.target === 'event'),
)!;
const halloween = SAMPLE_CONTENT.events.find((e) => e.id === HALLOWEEN_EVENT_ID)!;
const islandEvent = SAMPLE_CONTENT.events.find(
  (e) =>
    e.islandId === island.id &&
    island.behaviors.some((b) => b.type === 'content' && b.params.ref === e.id),
)!;

test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

test('ficha de evento', async ({ page }) => {
  await page.goto(eventHref(halloween.slug));
  await expect(page.getByTestId('evento-ficha')).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'p004-t42-evento.png') });
});

test('fotos y eventos', async ({ page }) => {
  await page.goto(photosHref(island.id));
  await expect(page.getByTestId(`galeria-${island.id}`)).toBeInViewport();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'p004-t42-fotos.png') });
});

test('isla con su evento agotado', async ({ page }) => {
  await page.goto('/admin');
  await page.getByTestId('admin-nav-eventos').click();
  await page.getByTestId(`evento-estado-${islandEvent.id}`).selectOption('sold_out');
  await expect(page.getByTestId(`evento-ahora-${islandEvent.id}`)).toContainText('Agotado');

  await page.goto(`/juego?cerca=${island.id}`);
  await expect(page.getByTestId('hud')).toContainText(/\d+ fps/, { timeout: 30_000 });
  await page
    .locator('canvas:visible')
    .first()
    .focus()
    .catch(() => {});
  const panel = page.getByTestId('panel-evento');
  await page.keyboard.down('ArrowUp');
  try {
    await expect(panel).toBeVisible({ timeout: 25_000 });
  } finally {
    await page.keyboard.up('ArrowUp');
  }
  await expect(panel).toHaveAttribute('data-estado', 'sold_out');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 'p004-t42-isla-estado.png') });
});
