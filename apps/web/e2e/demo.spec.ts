import { SAMPLE_COSMETICS } from '@boia/store';
import { ALLDAY_EVENT_ID, WORLD_REGISTRY } from '@boia/world';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAMPLE_CONTENT } from '../lib/landing/sample-content';
import { mar, marSheet, openMar } from './mar-helpers';

/**
 * Demo de punta a punta (T12), con datos de muestra y sin Supabase: entrada
 * 3D con el planeta (T57; en cada carga de `/`, D-21) → landing → Tickets; el
 * hero lleva a /mar → isla de evento → barco por `?estilo=` → artistas (el mar
 * 3D es el único mundo desde T62, D-25). Corre en móvil 360×640 y en
 * escritorio.
 *
 * Con DEMO_SHOTS=1 guarda además capturas del recorrido en docs/informes/img/
 * (p001-t12-<paso>-<móvil|escritorio>.png).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const SHOTS = path.join(ROOT, 'docs/informes/img');

// Estilos y skins del arte real: la prueba sigue a lo que haya en art/barco.
const shipRoot = JSON.parse(readFileSync(path.join(ROOT, 'art/barco/manifest.json'), 'utf8')) as {
  style: string;
  skins: string[];
  style_variants: { id: string }[];
};
// Estilos que se compran, se ganan o se desbloquean con puntos van con candado
// en la tienda (T36, T40); de base, sólo los barcos de los dos mundos iniciales.
const LOCKED_STYLES = new Set(
  SAMPLE_COSMETICS.filter((c) => c.slot === 'ship' && !c.base).map((c) => c.assetKey ?? c.id),
);

// El mundo por defecto (Arcilla desde T20) trae su barco y su isla de evento.
const defaultWorld = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId);
const WORLD_SHIP_STYLE = defaultWorld.theme.ship.style;
// El otro barco de base (el del otro mundo inicial): libre desde el principio.
const OTHER_STYLE = SAMPLE_COSMETICS.find(
  (c) => c.slot === 'ship' && c.base && c.assetKey !== WORLD_SHIP_STYLE,
)!.assetKey!;
const LOCKED_STYLE = shipRoot.style_variants.find((v) => LOCKED_STYLES.has(v.id))!.id;
// El evento de la Isla del Sonido (SONIDO desde T67).
const EVENT_ID = ALLDAY_EVENT_ID;
const eventIsland = defaultWorld.config.objects.find((o) =>
  o.behaviors.some(
    (b) =>
      b.type === 'content' &&
      (b.params as { target?: string; ref?: string }).target === 'event' &&
      (b.params as { ref?: string }).ref === EVENT_ID,
  ),
)!;

async function shot(page: Page, info: TestInfo, name: string) {
  if (!process.env.DEMO_SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const device = info.project.name === 'mobile' ? 'movil' : 'escritorio';
  await page.screenshot({ path: path.join(SHOTS, `p001-t12-${name}-${device}.png`) });
}

test('`/` → planeta → «Zarpar» → /mar con la bienvenida; la landing → Tickets; isla de evento', async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  await page.goto('/');
  // Entrada 3D con el planeta (T57): aparece y espera al botón; «Zarpar»
  // entra en el mar 3D con la bienvenida de la boia abierta (T64).
  await expect(page.locator('html')).toHaveAttribute('data-entry', 'intro');
  await page.waitForFunction(() => window.__boiaIntro?.phase === 'paused', null, {
    timeout: 20_000,
  });
  // El planeta es el del mundo activo de /mar.
  expect((await page.evaluate(() => window.__boiaIntro))!.world).toBe(defaultWorld.id);
  await page.getByRole('button', { name: 'Zarpar' }).click();
  await expect(page).toHaveURL(/\/mar$/, { timeout: 30_000 });
  await expect(page.getByTestId('mar-bienvenida')).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('main.mar')).toHaveAttribute('data-mundo', defaultWorld.id);
  await shot(page, info, '1-mar');

  // La landing, directa: el botón principal del hero es el mundo 3D (T57).
  await page.goto('/?intro=0');
  await expect(page.getByTestId('cta-3d')).toHaveAttribute('href', '/mar');

  // Tickets abre el panel de muestra.
  await page.locator('.hero').getByRole('link', { name: 'Tickets', exact: true }).click();
  const tickets = page.getByRole('dialog', { name: 'Elige tu evento' });
  await expect(tickets).toBeVisible();
  await shot(page, info, '2-tickets');
  await page.keyboard.press('Escape');
  await expect(tickets).toBeHidden();

  // El mar navega hasta la isla de evento (`?evento=`, con «Saltar») y abre su ficha.
  expect(eventIsland, `el mundo ${defaultWorld.id} tiene la isla de ${EVENT_ID}`).toBeDefined();
  await openMar(page, `?evento=${EVENT_ID}`);
  await page
    .getByTestId('mar-entradas-saltar')
    .click({ timeout: 5_000 })
    .catch(() => {});
  const sheet = marSheet(page);
  await expect(sheet).toHaveAttribute('data-lugar', eventIsland.identity.id, { timeout: 30_000 });
  const event = SAMPLE_CONTENT.events.find((e) => e.id === EVENT_ID)!;
  await expect(sheet.getByRole('heading', { name: event.name })).toBeVisible();
  await shot(page, info, '4-isla');
});

test('el barco: el del mundo sin elección; `?estilo=` pone uno tuyo y no uno bloqueado', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openMar(page);
  // Sin elección guardada, el barco del mundo (T17).
  await expect(mar(page)).toHaveAttribute('data-ship-style', WORLD_SHIP_STYLE);
  await expect(mar(page)).toHaveAttribute('data-ship-skin', 'base');
  // ?estilo= manda (T11) si el barco es tuyo: el otro de base es libre.
  await openMar(page, `?estilo=${OTHER_STYLE}`);
  await expect(mar(page)).toHaveAttribute('data-ship-style', OTHER_STYLE);
  // Uno bloqueado no (T40): queda el que llevaba.
  await openMar(page, `?estilo=${LOCKED_STYLE}`);
  await expect(mar(page)).toHaveAttribute('data-ship-style', OTHER_STYLE);
});

test('«Ver todos los artistas» enseña los 26 artistas', async ({ page }, info) => {
  // Enlace directo: sin cinemática (REQ-ENT-011).
  await page.goto('/#artistas');
  await page.getByTestId('ver-artistas').click();
  await expect(page).toHaveURL(/\/artistas$/);
  const list = page.getByTestId('artistas-lista');
  await expect(list.locator('li')).toHaveCount(SAMPLE_CONTENT.artists.length);
  expect(SAMPLE_CONTENT.artists.length).toBe(26);
  for (const a of SAMPLE_CONTENT.artists) {
    await expect(list.getByRole('heading', { name: a.name, exact: true })).toBeVisible();
  }
  await shot(page, info, '8-artistas');
});

test.describe('sin JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('/artistas se abre por enlace directo y desde la landing', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('ver-artistas').click();
    await expect(page).toHaveURL(/\/artistas$/);
    await expect(page.getByTestId('artistas-lista').locator('li')).toHaveCount(
      SAMPLE_CONTENT.artists.length,
    );
  });
});
