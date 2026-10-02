import { minimapProjection } from '@boia/engine/ui';
import { SAMPLE_BOTTLES, emptyDoc } from '@boia/store';
import { WORLD_REGISTRY } from '@boia/world';
import { expect, test, type Page } from '@playwright/test';
import { ADMIN_COPY } from '../lib/admin/copy';
import { eventIslands } from '../lib/admin/world';
import { SAMPLE_CONTENT } from '../lib/landing/sample-content';

/**
 * «Probar admin» (T26, D-20, REQ-ADM-039): desde el pie de la landing se abre
 * el Admin sin login, con su aviso; se crea un evento en una isla, se suben
 * los artistas en la home y se publica el borrador (T48), se mueve la isla en
 * el mapa compartido (antes, un
 * movimiento que dejaría la salida en tierra se rechaza con su motivo) y se
 * retira una botella reportada. Todo se ve después en la landing y en el mar,
 * en el mismo navegador. Corre en móvil 360×640 y en escritorio.
 */

test.describe.configure({ timeout: 150_000 });

const map = WORLD_REGISTRY.map;
// La isla de evento del mapa (la que abre un evento) y su posición de muestra.
const island = eventIslands(map).find((p) =>
  p.behaviors.some((b) => b.type === 'content' && b.params.target === 'event'),
)!;
const moved = { x: Math.round(island.position.x + 600), y: Math.round(island.position.y) };
// Una botella de muestra con un reporte sembrado (reportar exige Carnet y navegar hasta ella).
const bottle = SAMPLE_BOTTLES[0]!;
const REPORT_REASON = 'Spam de prueba';
// Bloques de la home de muestra: los artistas van después de los próximos eventos.
const blockIds = SAMPLE_CONTENT.blocks.map((b) => b.id);
const artistsBlock = SAMPLE_CONTENT.blocks.find((b) => b.type === 'artists')!.id;
const upcomingBlock = SAMPLE_CONTENT.blocks.find((b) => b.type === 'upcoming_events')!.id;
const stepsUp = blockIds.indexOf(artistsBlock) - blockIds.indexOf(upcomingBlock);

const EVENT_NAME = 'Noche del Admin';
const EVENT_ID = 'ev-noche-del-admin';

/** Mañana a las 22:00, para el `<input type="datetime-local">`. */
function tomorrowLocal(): string {
  const d = new Date(Date.now() + 36 * 3600_000);
  return `${d.toISOString().slice(0, 10)}T22:00`;
}

/** Un reporte pendiente sobre una botella de muestra, sólo si el navegador está vacío. */
function seedReport(page: Page) {
  const doc = emptyDoc();
  const at = new Date().toISOString();
  doc.identity = { id: 'e2e-invitado', kind: 'guest', createdAt: at };
  doc.bottleReports = [
    {
      id: 'reporte-e2e',
      bottleId: bottle.id,
      reporterId: 'e2e-invitado',
      reason: REPORT_REASON,
      createdAt: at,
      resolvedAt: null,
      resolvedBy: null,
      resolution: null,
    },
  ];
  return page.addInitScript((json) => {
    try {
      if (!window.localStorage.getItem('boia.store'))
        window.localStorage.setItem('boia.store', json);
    } catch {
      // sin almacenamiento: la prueba fallará más abajo, con su motivo
    }
  }, JSON.stringify(doc));
}

async function ok(page: Page) {
  await expect(page.getByTestId('admin-ok').first()).toBeVisible();
}

async function section(page: Page, id: string) {
  await page.getByTestId(`admin-nav-${id}`).click();
  await expect(page.getByTestId(`admin-seccion-${id}`)).toBeVisible();
}

test('Probar admin: los cambios se ven en la landing y en el mar', async ({ page }) => {
  await seedReport(page);

  // 1. Desde el pie de la landing, sin login, con el aviso permanente.
  await page.goto('/?intro=0');
  await page.getByTestId('probar-admin').click();
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByTestId('admin-aviso')).toContainText(ADMIN_COPY.bannerTitle);
  await expect(page.getByTestId('admin-aviso')).toContainText('este navegador');

  // 2. Un evento nuevo, a la venta, en la isla de evento.
  await section(page, 'eventos');
  await page.getByTestId('evento-nuevo').click();
  const form = page.getByTestId('evento-form');
  await form.getByTestId('evento-nombre').fill(EVENT_NAME);
  await form.getByTestId('evento-fecha').fill(tomorrowLocal());
  await form.getByTestId('evento-estado').selectOption('on_sale');
  await form
    .getByTestId('evento-tickets')
    .fill('https://example.com/boia-sandbox/tickets/noche-del-admin');
  await form.getByTestId('evento-isla').selectOption(island.id);
  await form.getByTestId('evento-guardar').click();
  await expect(page.getByTestId(`evento-${EVENT_ID}`)).toContainText(EVENT_NAME);
  await expect(page.getByTestId(`isla-${island.id}`)).toContainText(`Abre ahora: ${EVENT_NAME}`);

  // 3. Página principal: los artistas suben por encima de los próximos eventos.
  await section(page, 'inicio');
  for (let i = 0; i < stepsUp; i++) {
    await page.getByTestId(`bloque-subir-${artistsBlock}`).click();
    await ok(page);
  }
  const order = await page
    .getByTestId('bloques')
    .locator(':scope > li')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
  expect(order.indexOf(`bloque-${artistsBlock}`)).toBeLessThan(
    order.indexOf(`bloque-${upcomingBlock}`),
  );
  // La home va en borrador (T48, REQ-ADM-015): se ve en la web al publicar.
  await expect(page.getByTestId('borrador')).not.toHaveAttribute('data-pendientes', '0');
  await page.getByTestId('publicar').click();
  await expect(page.getByTestId('borrador')).toHaveAttribute('data-pendientes', '0');

  // 4. Mundo: mover la isla sobre la salida se rechaza con su motivo; 600 u al este, no.
  await section(page, 'mundo');
  await page.getByTestId('lugar-selector').selectOption(island.id);
  const editor = page.getByTestId('lugar-editor');
  await editor.getByTestId('lugar-x').fill(String(Math.round(map.spawn.x)));
  await editor.getByTestId('lugar-y').fill(String(Math.round(map.spawn.y)));
  await editor.getByTestId('lugar-guardar').click();
  await expect(editor.getByTestId('admin-error')).toContainText(/tierra/);
  await editor.getByTestId('lugar-x').fill(String(moved.x));
  await editor.getByTestId('lugar-y').fill(String(moved.y));
  await editor.getByTestId('lugar-guardar').click();
  await expect(
    page.getByTestId('mapa-preview').locator(`[data-lugar="${island.id}"]`),
  ).toHaveAttribute('data-x', String(moved.x));

  // 5. Moderación: la botella reportada se retira del mar.
  await section(page, 'moderacion');
  const row = page.getByTestId(`botella-${bottle.id}`);
  await expect(row).toContainText('1 reporte');
  await row.getByTestId(`botella-retirar-${bottle.id}`).click();
  await expect(row).toHaveAttribute('data-estado', 'removed');

  // 6. La landing lee el repositorio: evento nuevo y artistas antes que los eventos.
  await page.goto('/?intro=0');
  await expect(page.locator('main')).toHaveAttribute('data-contenido', 'repositorio');
  await expect(page.locator('#eventos')).toContainText(EVENT_NAME);
  const blocks = await page
    .locator('main [data-block]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-block')));
  expect(blocks.indexOf(artistsBlock)).toBeGreaterThanOrEqual(0);
  expect(blocks.indexOf(artistsBlock)).toBeLessThan(blocks.indexOf(upcomingBlock));

  // 7. El mar: la brújula lleva a la isla del evento nuevo, en su sitio nuevo...
  await page.goto(`/juego?evento=${EVENT_ID}`);
  await expect(page.getByTestId('hud')).toContainText(/\d+ fps/, { timeout: 30_000 });
  await page.getByTestId('brujula').click();
  const expanded = page.getByTestId('minimapa-ampliado');
  const svg = expanded.locator('svg').first();
  const selected = expanded.locator('circle[stroke-dasharray="4 3"]');
  await expect(selected).toHaveCount(1);
  const [w, h, cx, cy] = await Promise.all([
    svg.getAttribute('width'),
    svg.getAttribute('height'),
    selected.getAttribute('cx'),
    selected.getAttribute('cy'),
  ]);
  const proj = minimapProjection(map.bounds, Number(w), Number(h), 12);
  const want = proj.project(moved);
  const old = proj.project(island.position);
  expect(Math.abs(Number(cx) - want.x)).toBeLessThan(1);
  expect(Math.abs(Number(cy) - want.y)).toBeLessThan(1);
  expect(Math.abs(Number(cx) - old.x)).toBeGreaterThan(1);
  await page.keyboard.press('Escape');

  // ...y al llegar, su panel abre el evento creado en el Admin.
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
  await expect(panel.getByRole('heading', { name: EVENT_NAME })).toBeVisible();

  // 8. El Menú de a bordo también lleva al Admin.
  await page.getByTestId('menu-ancla').click();
  await expect(page.getByTestId('menu-probar-admin')).toHaveAttribute('href', '/admin');
});
