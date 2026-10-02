import { minimapProjection } from '@boia/engine/ui';
import { SAMPLE_COSMETICS } from '@boia/store';
import { WORLD_REGISTRY } from '@boia/world';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAMPLE_CONTENT } from '../lib/landing/sample-content';

/**
 * Demo de punta a punta (T12), con datos de muestra y sin Supabase: entrada
 * 3D con el planeta (T57; en cada carga de `/`, D-21) → landing → Tickets; el
 * hero lleva a /mar → isla de evento (en /juego hasta T62) → menú «Barco» →
 * artistas. Corre en móvil 360×640 y en escritorio.
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
const THEMED_SKIN = shipRoot.skins.find((s) => s !== 'base')!;
const SKIN_PRICE = SAMPLE_COSMETICS.find((c) => c.slot === 'skin')!.priceCoins!;

// El mundo por defecto (Arcilla desde T20) trae su barco y su isla de evento.
const defaultWorld = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId);
const WORLD_SHIP_STYLE = defaultWorld.theme.ship.style;
// El otro barco de base (el del otro mundo inicial): libre desde el principio.
const OTHER_STYLE = SAMPLE_COSMETICS.find(
  (c) => c.slot === 'ship' && c.base && c.assetKey !== WORLD_SHIP_STYLE,
)!.assetKey!;
const LOCKED_STYLE = shipRoot.style_variants.find((v) => LOCKED_STYLES.has(v.id))!.id;
const EVENT_ID = 'ev-all-day-primavera';
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

const game = (page: Page) => page.getByTestId('juego');

/** Salida del barco y puerto del mapa compartido (T20, T28). */
const SPAWN = WORLD_REGISTRY.map.spawn;

/**
 * El barco está en la salida del puerto: la flecha del minimapa cae donde el
 * minimapa proyecta la salida del mapa (a un par de px: el minimapa es pequeño).
 */
async function expectShipAtPort(page: Page) {
  const minimap = page.getByTestId('minimapa').locator('svg').first();
  await expect(minimap.locator('polygon')).toHaveCount(1, { timeout: 30_000 });
  const got = await minimap.evaluate((svg) => {
    const poly = svg.querySelector('polygon')!;
    const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(poly.getAttribute('transform') ?? '');
    return {
      w: Number(svg.getAttribute('width')),
      h: Number(svg.getAttribute('height')),
      x: Number(m?.[1]),
      y: Number(m?.[2]),
    };
  });
  const want = minimapProjection(defaultWorld.config.bounds, got.w, got.h).project(SPAWN);
  expect(Math.abs(got.x - want.x), 'barco en la salida (x del minimapa)').toBeLessThan(2);
  expect(Math.abs(got.y - want.y), 'barco en la salida (y del minimapa)').toBeLessThan(2);
}

/** El motor corre (y escucha el teclado) cuando la caja de datos da FPS. */
async function gameRunning(page: Page) {
  await expect(page.getByTestId('hud')).toContainText(/\d+ fps/, { timeout: 30_000 });
}

async function openBarco(page: Page) {
  await page.getByTestId('menu-ancla').click();
  const menu = page.getByTestId('menu');
  await menu.getByRole('tab', { name: 'Barco', exact: true }).click();
  await expect(menu.getByTestId('barco')).toBeVisible();
  return menu;
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

  // Rumbo norte hasta la isla de evento: su proximidad abre el panel del evento.
  // El mapa de Arcilla es grande y la isla queda lejos del puerto: se sigue
  // junto a ella con `?cerca=`.
  expect(eventIsland, `el mundo ${defaultWorld.id} tiene la isla de ${EVENT_ID}`).toBeDefined();
  await page.goto(`/juego?cerca=${eventIsland.identity.id}`);
  await gameRunning(page);
  await page
    .locator('canvas:visible')
    .first()
    .focus()
    .catch(() => {});
  await page.keyboard.down('ArrowUp');
  const panel = page.getByTestId('panel-evento');
  await expect(panel).toBeVisible({ timeout: 45_000 });
  await page.keyboard.up('ArrowUp');
  const event = SAMPLE_CONTENT.events.find((e) => e.id === EVENT_ID)!;
  await expect(panel.getByRole('heading', { name: event.name })).toBeVisible();
  await shot(page, info, '4-isla');
});

test('«Barco»: otro barco de base cambia el barco al momento y sobrevive a recargar; lo bloqueado no se pone', async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  await page.goto('/juego');
  await gameRunning(page);
  // Sin elección guardada, el barco del mundo (T17).
  await expect(game(page)).toHaveAttribute('data-ship-style', WORLD_SHIP_STYLE);
  await expect(game(page)).toHaveAttribute('data-ship-skin', 'base');
  await expect(game(page)).toHaveAttribute('data-world', 'nuevo');
  // Un enlace directo a /juego empieza en limpio en el puerto del mundo activo (T28).
  await expectShipAtPort(page);

  // El otro barco de base: se aplica sin recargar.
  let menu = await openBarco(page);
  await page.evaluate(() => ((window as Window & { __sinRecarga?: boolean }).__sinRecarga = true));
  await menu.getByTestId(`barco-estilo-${OTHER_STYLE}`).click();
  await expect(game(page)).toHaveAttribute('data-ship-style', OTHER_STYLE);
  await expect(menu.getByTestId(`barco-estilo-${OTHER_STYLE}`)).toHaveAttribute(
    'aria-checked',
    'true',
  );
  expect(
    await page.evaluate(() => (window as Window & { __sinRecarga?: boolean }).__sinRecarga),
  ).toBe(true);
  // Lo que no se tiene va con candado y su condición (T40): un barco y las skins.
  await expect(menu.getByTestId(`barco-estilo-${LOCKED_STYLE}`)).toHaveAttribute(
    'data-bloqueado',
    'si',
  );
  await expect(menu.getByTestId(`barco-skin-${THEMED_SKIN}`)).toHaveAttribute(
    'data-bloqueado',
    'si',
  );
  await expect(menu.getByTestId(`barco-skin-item-${THEMED_SKIN}`)).toContainText(
    `te faltan ${SKIN_PRICE} monedas`,
  );
  // Tocar lo bloqueado no cambia el barco.
  await menu.getByTestId(`barco-skin-${THEMED_SKIN}`).click({ force: true });
  await expect(game(page)).toHaveAttribute('data-ship-skin', 'base');
  await shot(page, info, '5-barco-menu');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('menu')).toBeHidden();
  await shot(page, info, '6-barco-estilo');

  await page.reload();
  await gameRunning(page);
  await expect(game(page)).toHaveAttribute('data-ship-style', OTHER_STYLE);
  await expect(game(page)).toHaveAttribute('data-ship-skin', 'base');

  // ?estilo= sigue mandando (T11) si el barco es tuyo, y el menú lo refleja.
  await page.goto(`/juego?estilo=${WORLD_SHIP_STYLE}`);
  await gameRunning(page);
  await expect(game(page)).toHaveAttribute('data-ship-style', WORLD_SHIP_STYLE);
  menu = await openBarco(page);
  await expect(menu.getByTestId(`barco-estilo-${WORLD_SHIP_STYLE}`)).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.keyboard.press('Escape');
  // Uno bloqueado no: queda lo equipado.
  await page.goto(`/juego?estilo=${LOCKED_STYLE}`);
  await gameRunning(page);
  await expect(game(page)).toHaveAttribute('data-ship-style', WORLD_SHIP_STYLE);
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
