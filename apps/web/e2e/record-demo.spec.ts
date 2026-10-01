import { rescueMissionOf } from '@boia/engine/mission';
import { WORLD_REGISTRY } from '@boia/world';
import {
  chromium,
  expect,
  test,
  type Browser,
  type BrowserContextOptions,
  type Page,
} from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, renameSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eventIslands } from '../lib/admin/world';

/**
 * Grabación de la versión de prueba entera en móvil (T30), para enseñarla y
 * revisarla. No corre con `pnpm e2e`; se pide aparte:
 *
 *   RECORD_DEMO=1 pnpm e2e record-demo.spec.ts --project=mobile --workers=1
 *
 * Un solo vídeo, en tiempo real: entrada → EXPLORAR al puerto → la Fiestera
 * sube a bordo y baja en su isla → isla de evento, compra de prueba y sello en
 * Mi Carnet → una botella → un minijuego → cambio a Acuarela → un evento nuevo
 * en el Admin que aparece en la isla. El mapa es demasiado grande para
 * cruzarlo en una toma: cada tramo empieza con `?cerca=<lugar>`. Deja
 * docs/informes/img/p002-t30-demo-movil.webm (recomprimido con ffmpeg si lo hay).
 */

test.skip(!process.env.RECORD_DEMO, 'sólo con RECORD_DEMO=1');
test.describe.configure({ timeout: 300_000 });

const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../docs/informes/img',
);
const DEST = path.join(OUT, 'p002-t30-demo-movil.webm');

const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId);
const acuarela = WORLD_REGISTRY.get(WORLD_REGISTRY.ids().find((id) => id !== world.id)!);
const mission = rescueMissionOf(world.config)!;
const island = eventIslands(WORLD_REGISTRY.map).find((p) =>
  p.behaviors.some((b) => b.type === 'content' && b.params.target === 'event'),
)!;
const EVENT_NAME = 'Noche del Admin';

// Como record.spec.ts: la GPU del Mac (ANGLE sobre Metal) para grabar a buen ritmo.
let gpu: Browser;
test.beforeAll(async () => {
  gpu = await chromium.launch({
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
  });
});
test.afterAll(async () => gpu?.close());

const game = (page: Page) => page.getByTestId('juego');
const pause = (page: Page, ms = 1200) => page.waitForTimeout(ms);

async function sailFrom(page: Page, near: string) {
  await page.goto(`/juego?cerca=${near}`);
  await expect(page.getByTestId('hud')).toContainText(/\d+ fps/, { timeout: 30_000 });
  await page
    .locator('canvas:visible')
    .first()
    .focus()
    .catch(() => {});
}

async function sailNorthUntil(page: Page, until: () => Promise<void>) {
  await page.keyboard.down('ArrowUp');
  try {
    await until();
  } finally {
    await page.keyboard.up('ArrowUp');
  }
}

function tomorrowLocal(): string {
  const d = new Date(Date.now() + 36 * 3600_000);
  return `${d.toISOString().slice(0, 10)}T22:00`;
}

test('recorrido de la versión de prueba en móvil', async ({ baseURL }, info) => {
  test.skip(info.project.name !== 'mobile', 'se graba en móvil');
  const u = info.project.use;
  const tmp = mkdtempSync(path.join(tmpdir(), 'boia-demo-'));
  // Como record.spec.ts: sólo lo que el proyecto define (exactOptionalPropertyTypes).
  const opts: BrowserContextOptions = { baseURL: baseURL ?? '' };
  if (u.viewport) opts.viewport = u.viewport;
  if (u.deviceScaleFactor) opts.deviceScaleFactor = u.deviceScaleFactor;
  if (u.isMobile !== undefined) opts.isMobile = u.isMobile;
  if (u.hasTouch !== undefined) opts.hasTouch = u.hasTouch;
  if (u.userAgent) opts.userAgent = u.userAgent;
  const ctx = await gpu.newContext({ ...opts, recordVideo: { dir: tmp, size: u.viewport! } });
  const page = await ctx.newPage();

  // 1. Entrada: mini-mundo y letras 3D, «Zarpar», landing; EXPLORAR descubre el puerto.
  await page.goto('/');
  await page.waitForFunction(() => window.__boiaIntro?.phase === 'paused', null, {
    timeout: 20_000,
  });
  await pause(page, 1500);
  await page.getByRole('button', { name: 'Zarpar' }).click();
  await page.waitForFunction(() => window.__boiaIntro?.phase === 'landed', null, {
    timeout: 20_000,
  });
  await page.waitForFunction(() => window.__boiaIntro?.sceneStatus === 'ready', null, {
    timeout: 20_000,
  });
  await pause(page);
  // El hero lleva a /mar (T57); la demo grabada sigue en el mundo 2D hasta T62.
  await page.goto('/juego');
  await expect(page.getByTestId('hud')).toContainText(/\d+ fps/, { timeout: 30_000 });
  await pause(page, 1500);

  // 2. La Boia Fiestera: sube a bordo en su remanso y baja en su isla.
  await sailFrom(page, mission.characterId);
  await sailNorthUntil(page, () =>
    expect(game(page)).toHaveAttribute('data-tripulante', 'a-bordo', { timeout: 30_000 }),
  );
  await expect(page.getByTestId('aviso').first()).toBeVisible({ timeout: 10_000 });
  await pause(page, 2000);
  await sailFrom(page, mission.destination);
  await sailNorthUntil(page, () =>
    expect(game(page)).toHaveAttribute('data-mision', /landing|delivered/, { timeout: 30_000 }),
  );
  await expect(page.getByTestId('celebracion')).toBeVisible();
  await pause(page, 2500);

  // 3. Isla de evento: su panel, compra de prueba y el sello en Mi Carnet.
  await sailFrom(page, island.id);
  const panel = page.getByTestId('panel-evento');
  const buy = panel.getByTestId('panel-evento-comprar');
  await sailNorthUntil(page, () => expect(buy).toBeVisible({ timeout: 30_000 }));
  await pause(page);
  await buy.click();
  const checkout = page.getByTestId('checkout');
  await expect(checkout.getByTestId('checkout-confirmar')).toBeVisible({ timeout: 20_000 });
  await pause(page);
  await checkout.getByTestId('checkout-confirmar').click();
  await expect(checkout.getByTestId('checkout-resultado')).toBeVisible();
  await pause(page, 1500);
  await checkout.getByTestId('checkout-carnet').click();
  const menu = page.getByTestId('menu');
  await menu.getByTestId('carnet-crear').click();
  await menu.getByTestId('carnet-apodo-input').pressSequentially('Marinera', { delay: 60 });
  await menu.getByTestId('carnet-guardar').click();
  await expect(menu.getByTestId('carnet-sellos').locator('li')).toHaveCount(1);
  await pause(page, 2000);

  // 4. Una botella: se echa junto al barco y se lee.
  await menu.getByTestId('carnet-mio').getByRole('button', { name: 'Echar una botella' }).click();
  const sheet = page.getByTestId('botella');
  await sheet.getByTestId('botella-texto').pressSequentially('¡Nos vemos en el All Day!', {
    delay: 40,
  });
  await sheet.getByTestId('botella-echar').click();
  await expect(sheet).toBeHidden();
  const own = page.locator('[data-testid^="botella-cerca-"]').filter({ hasText: 'Tu botella' });
  await expect(own).toBeVisible({ timeout: 10_000 });
  await pause(page);
  await own.click();
  await expect(page.getByTestId('botella-mensaje')).toBeVisible();
  await pause(page, 1800);
  await sheet.getByRole('button', { name: 'Cerrar' }).click();

  // 5. Un minijuego: Vigilancia del faro, hasta el final, y de vuelta al mar.
  await page.goto('/juego?minijuego=faro');
  const layer = page.getByTestId('minijuego');
  await expect(page.getByTestId('minijuego-intro')).toBeVisible({ timeout: 20_000 });
  await pause(page);
  await page.getByTestId('minijuego-empezar').click();
  await pause(page, 2500);
  for (let i = 0; i < 3 && (await layer.getAttribute('data-phase')) === 'playing'; i++) {
    await page.getByTestId('minijuego-accion').click();
    await pause(page, 900);
  }
  await expect(page.getByTestId('minijuego-final')).toBeVisible({ timeout: 30_000 });
  await pause(page, 1500);
  await page.getByTestId('minijuego-final').getByTestId('minijuego-volver').click();
  await expect(layer).toHaveCount(0);

  // 6. Cambio de mundo: Menú → Mundos → Acuarela, sin recargar.
  await page.getByTestId('menu-ancla').click();
  await menu.getByRole('tab', { name: 'Mundos', exact: true }).click();
  await pause(page);
  await menu.getByTestId(`mundo-${acuarela.id}`).click();
  await expect(game(page)).toHaveAttribute('data-mundo', acuarela.id, { timeout: 20_000 });
  await pause(page, 800);
  await page.keyboard.press('Escape');
  await pause(page, 2000);

  // 7. «Probar admin»: un evento nuevo en la isla, y se ve al llegar a ella.
  await page.getByTestId('menu-ancla').click();
  await page.getByTestId('menu-probar-admin').click();
  await expect(page).toHaveURL(/\/admin/);
  await page.getByTestId('admin-nav-eventos').click();
  await page.getByTestId('evento-nuevo').click();
  const form = page.getByTestId('evento-form');
  await form.getByTestId('evento-nombre').pressSequentially(EVENT_NAME, { delay: 50 });
  await form.getByTestId('evento-fecha').fill(tomorrowLocal());
  await form.getByTestId('evento-estado').selectOption('on_sale');
  await form
    .getByTestId('evento-tickets')
    .fill('https://example.com/boia-sandbox/tickets/noche-del-admin');
  await form.getByTestId('evento-isla').selectOption(island.id);
  await pause(page, 800);
  await form.getByTestId('evento-guardar').click();
  await expect(page.getByTestId(`isla-${island.id}`)).toContainText(EVENT_NAME);
  await page.getByTestId(`isla-${island.id}`).scrollIntoViewIfNeeded();
  await pause(page, 1500);
  await sailFrom(page, island.id);
  await expect(game(page)).toHaveAttribute('data-mundo', acuarela.id);
  await sailNorthUntil(page, () => expect(panel).toBeVisible({ timeout: 30_000 }));
  await expect(panel.getByRole('heading', { name: EVENT_NAME })).toBeVisible();
  await pause(page, 2500);

  const video = page.video()!;
  await ctx.close();
  mkdirSync(OUT, { recursive: true });
  const raw = await video.path();
  try {
    // VP9 a calidad constante: el mismo vídeo en unos pocos MB.
    execFileSync('ffmpeg', [
      '-loglevel',
      'error',
      '-y',
      '-i',
      raw,
      '-c:v',
      'libvpx-vp9',
      '-crf',
      '40',
      '-b:v',
      '0',
      '-an',
      DEST,
    ]);
  } catch {
    renameSync(raw, DEST);
  }
  info.annotations.push({
    type: 'grabación',
    description: `${DEST} (${(statSync(DEST).size / 1e6).toFixed(1)} MB)`,
  });
});
