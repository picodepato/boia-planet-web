import {
  CANONCITO,
  ESTELA_VORTICE,
  MINIKRAKEN,
  MemoryStorage,
  TORTUGA_TURBO,
  SAMPLE_ACHIEVEMENTS,
  SAMPLE_COSMETICS,
  STORE_KEY,
  createLocalRepository,
} from '@boia/store';
import { WORLD_REGISTRY } from '@boia/world';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACHIEVEMENT_READY_BODY } from '../lib/mundo/achievements';
import { shipAt } from './mar-helpers';

/**
 * La tienda «Barco» (T40, D-23 punto 1, O5), en el mar 3D: el
 * visitante trae unas monedas guardadas, gana las que le faltan reclamando
 * «Primera boia», compra un barco (con confirmación) y una estela, los
 * equipa, recarga y los sigue llevando. Móvil y escritorio.
 *
 * Con RECORD_T40=1 guarda además las capturas del informe a 390×844 en
 * docs/informes/img/ (p004-t40-tienda.png y p004-t40-barco-equipado.png).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.resolve(HERE, '../../../docs/informes/img');

const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId);
// La boia del tutorial: al llegar habla y cuenta para «Primera boia».
const talkingBoia = world.config.objects.find(
  (o) =>
    o.identity.category === 'boia' &&
    o.behaviors.some((b) => b.type === 'dialogue') &&
    o.behaviors.some((b) => b.type === 'achievement'),
)!;
const firstBuoy = SAMPLE_ACHIEVEMENTS.find(
  (a) => a.trigger === 'find_buoy' && (a.triggerParams as { count?: number }).count === 1,
)!;
// El barco más barato de la tienda y una estela a la venta.
const ship = SAMPLE_COSMETICS.filter((c) => c.slot === 'ship' && !c.base && c.priceCoins).sort(
  (a, b) => a.priceCoins! - b.priceCoins!,
)[0]!;
const STYLE = ship.assetKey!;
const wake = SAMPLE_COSMETICS.find((c) => c.slot === 'wake' && c.priceCoins)!;
const COST = ship.priceCoins! + wake.priceCoins!;

/**
 * Un navegador que ya había jugado: le faltan justo las monedas de «Primera
 * boia» para el barco y la estela. Sólo si el navegador está vacío (recargar
 * no lo pisa).
 */
async function seedCoins(page: Page) {
  const storage = new MemoryStorage();
  const repo = createLocalRepository({ storage, watch: false });
  await repo.progress.grantWorldReward({
    sourceRef: 'e2e:cofre',
    coins: COST - firstBuoy.coins,
    points: 1,
  });
  const json = storage.getItem(STORE_KEY)!;
  await page.addInitScript(
    ([key, doc]) => {
      try {
        if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, doc);
      } catch {
        // sin almacenamiento: la prueba fallará más abajo, con su motivo
      }
    },
    [STORE_KEY, json] as const,
  );
}

async function shot(page: Page, info: TestInfo | null, name: string) {
  if (!process.env.RECORD_T40 || info?.project.name !== 'mobile') return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `p004-t40-${name}.png`) });
}

/** Rumbo norte hasta que salga el aviso del logro. */
async function sailUntilAchievement(page: Page, notice: Locator) {
  await page.keyboard.down('ArrowUp');
  try {
    await expect(notice).toContainText(ACHIEVEMENT_READY_BODY, { timeout: 25_000 });
  } finally {
    await page.keyboard.up('ArrowUp');
  }
}

/** Reclama «Primera boia» en un panel de logros abierto: las monedas que faltaban. */
async function claimFirstBuoy(panel: Locator) {
  const claim = panel.getByTestId(`logro-reclamar-${firstBuoy.id}`);
  await claim.click();
  await expect(panel.getByTestId(`logro-${firstBuoy.id}`)).toHaveAttribute(
    'data-estado',
    'claimed',
  );
}

/** En la tienda abierta: comprar con confirmación y comprobar que ya es tuyo. */
async function buy(shop: Locator, buyId: string, optionId: string) {
  const button = shop.getByTestId(buyId);
  await expect(button).toBeEnabled();
  await button.click();
  const confirm = shop.getByTestId('barco-confirmar');
  await expect(confirm).toBeVisible();
  await confirm.getByTestId('barco-confirmar-si').click();
  await expect(confirm).toHaveCount(0);
  await expect(shop.getByTestId('barco-mensaje')).toBeVisible();
  await expect(shop.getByTestId(optionId)).not.toHaveAttribute('data-bloqueado', 'si');
}

/** Barco y estela: antes, bloqueados con lo que falta; comprados y equipados después. */
async function shopFlow(page: Page, shop: Locator, info: TestInfo | null, root: Locator) {
  await expect(shop.locator('#tienda-flag')).toHaveCount(0);
  await expect(shop.getByRole('heading', { name: 'Bandera', exact: true })).toHaveCount(0);
  await expect(shop.locator('.tienda-intro')).not.toContainText(/bandera/i);
  const saldo = shop.getByTestId('barco-saldo');
  await expect(saldo).toHaveAttribute('data-coins', String(COST));
  await expect(shop.getByTestId(`barco-estilo-${STYLE}`)).toHaveAttribute('data-bloqueado', 'si');
  await expect(shop.getByTestId(`barco-item-${STYLE}`)).toContainText(`${ship.priceCoins} 🪙`);
  // Cancelar no compra nada.
  await shop.getByTestId(`barco-comprar-${STYLE}`).click();
  await expect(shop.getByTestId('barco-confirmar')).toBeVisible();
  await shot(page, info, 'tienda');
  await shop.getByTestId('barco-confirmar-no').click();
  await expect(saldo).toHaveAttribute('data-coins', String(COST));

  await buy(shop, `barco-comprar-${STYLE}`, `barco-estilo-${STYLE}`);
  await expect(saldo).toHaveAttribute('data-coins', String(wake.priceCoins));
  await buy(shop, `barco-comprar-${wake.id}`, `barco-estela-${wake.id}`);
  await expect(saldo).toHaveAttribute('data-coins', '0');
  // Los puntos no se tocan al gastar monedas.
  await expect(saldo).toHaveAttribute('data-points', String(1 + firstBuoy.points));

  await shop.getByTestId(`barco-estilo-${STYLE}`).click();
  await expect(root).toHaveAttribute('data-ship-style', STYLE);
  await expect(shop.getByTestId(`barco-estilo-${STYLE}`)).toHaveAttribute('aria-checked', 'true');
  await shop.getByTestId(`barco-estela-${wake.id}`).click();
  await expect(root).toHaveAttribute('data-ship-wake', wake.id);
}

test.describe.configure({ timeout: 150_000 });

// Referencia histórica de la spec: «/mar: ganar monedas, comprar un barco y una bandera, equiparlos y recargar».
test('/mar: ganar monedas, comprar un barco y una estela, equiparlos y recargar', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await seedCoins(page);
  await page.goto(`/mar?cerca=${talkingBoia.identity.id}`);
  await expect(page.getByTestId('mar-canvas')).toBeVisible();
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 30_000 });
  const root = page.locator('main.mar');
  await expect(root).toHaveAttribute('data-ship-style', world.theme.ship.style);

  await sailUntilAchievement(
    page,
    page.locator('[data-testid="mar-aviso"][data-kind="achievement"]'),
  );
  // Logros y Barco, en el menú del juego (T65).
  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-menu-logros').click();
  const panel = page.getByTestId('mar-logros-panel');
  await claimFirstBuoy(panel);
  await expect(page.getByTestId('logro-premio')).toHaveCount(0, { timeout: 6000 });
  await page.getByTestId('mar-logros-cerrar').click();

  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-barco').click();
  const sheet = page.getByTestId('mar-tienda');
  await expect(sheet).toBeVisible();
  await shopFlow(page, sheet.getByTestId('barco'), null, root);
  await page.getByTestId('mar-tienda-cerrar').click();
  await expect(sheet).toHaveCount(0);

  await page.reload();
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 30_000 });
  await expect(root).toHaveAttribute('data-ship-style', STYLE);
  await expect(root).toHaveAttribute('data-ship-wake', wake.id);
  expect(errors).toEqual([]);
});

/**
 * La mascota de cubierta (plan 013 T154): con el atajo de desarrollo
 * `?mascota=1` el minikraken es tuyo (como al vencer al Kraken); en Mi Barco
 * se activa y se desactiva en su categoría «Mascota» y, activa, va en
 * cubierta (el lienzo lo dice en `data-mascota`), también al volver sin el
 * atajo.
 */
test('/mar: la mascota minikraken se gana, se equipa en Mi Barco y va en cubierta', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/mar?mascota=1');
  const canvas = page.getByTestId('mar-canvas');
  await expect(canvas).toBeVisible();
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 30_000 });
  const root = page.locator('main.mar');
  await expect(root).toHaveAttribute('data-ship-style', world.theme.ship.style);
  await expect(canvas).not.toHaveAttribute('data-mascota', /.+/);

  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-barco').click();
  const sheet = page.getByTestId('mar-tienda');
  await expect(sheet).toBeVisible();
  const shop = sheet.getByTestId('barco');
  const option = shop.getByTestId(`barco-mascota-${MINIKRAKEN}`);
  const none = shop.getByTestId('barco-mascota-ninguna');
  // Ganada con el atajo: ya no está bloqueada, y aún no va puesta.
  await expect(option).not.toHaveAttribute('data-bloqueado', 'si');
  await expect(none).toHaveAttribute('aria-checked', 'true');
  await option.click();
  await expect(option).toHaveAttribute('aria-checked', 'true');
  await expect(root).toHaveAttribute('data-ship-mascot', MINIKRAKEN);
  await expect(canvas).toHaveAttribute('data-mascota', 'minikraken');

  // Desactivar: fuera de cubierta. Y otra vez dentro.
  await none.click();
  await expect(none).toHaveAttribute('aria-checked', 'true');
  await expect(canvas).not.toHaveAttribute('data-mascota', /.+/);
  await option.click();
  await expect(canvas).toHaveAttribute('data-mascota', 'minikraken');
  await page.getByTestId('mar-tienda-cerrar').click();

  // Sin el atajo: sigue siendo tuya y sigue en cubierta.
  await page.goto('/mar');
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 30_000 });
  await expect(root).toHaveAttribute('data-ship-mascot', MINIKRAKEN);
  await expect(canvas).toHaveAttribute('data-mascota', 'minikraken');
  expect(errors).toEqual([]);
});

/**
 * Los premios del castillo y la carrera (plan 015 T175, decisión 16): con
 * el atajo `?mascota=canoncito,tortuga-turbo&estela=vortice` son tuyos; en
 * Mi Barco se equipan (una mascota a la vez) y el mar los pinta: el
 * Cañoncito en cubierta y la Tortuga turbo detrás, con su modelo de Blender
 * (`data-mascota-modelo` = `glb`, los GLB a 200), y la estela con el estilo
 * `vortice`; al volver sin el atajo siguen puestos.
 *
 * Con RECORD_T175=<carpeta> deja ahí las capturas de la hoja de contacto:
 * cada mascota con el barco en el mundo y la estela en marcha, por proyecto.
 */
test('/mar: el Cañoncito, la Tortuga turbo y la Estela del vórtice se ganan, se equipan y se ven', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const glbs: string[] = [];
  page.on('response', (r) => {
    const m = /\/api\/art\/mascotas\/3d\/([a-z-]+\.glb)$/.exec(r.url());
    if (m) glbs.push(`${m[1]} ${r.status()}`);
  });
  const snap = async (name: string) => {
    const dir = process.env.RECORD_T175;
    if (!dir) return;
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, `${name}-${test.info().project.name}.png`) });
  };
  /**
   * Navega con una flecha (y turbo) hasta que el barco se haya movido de verdad, y un poco más para
   * que haya estela. Al este y al oeste del punto de partida hay mar abierto (al norte, la boia del
   * tutorial habla y para el barco).
   */
  const sail = async (key: 'ArrowRight' | 'ArrowLeft', turbo = false) => {
    // Más cerca del barco, que se vean la mascota y la estela.
    for (let i = 0; i < 3; i++) await page.keyboard.press('+');
    const from = await shipAt(page);
    await page.keyboard.down(key);
    if (turbo) await page.getByTestId('mar-turbo').click();
    await expect
      .poll(async () => {
        const now = await shipAt(page);
        return Math.hypot(now.x - from.x, now.y - from.y);
      }, { timeout: 15_000 })
      .toBeGreaterThan(60);
    await page.waitForTimeout(1500);
  };
  await page.goto('/mar?mascota=canoncito,tortuga-turbo&estela=vortice');
  const canvas = page.getByTestId('mar-canvas');
  await expect(canvas).toBeVisible();
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 30_000 });
  const root = page.locator('main.mar');
  await expect(canvas).not.toHaveAttribute('data-mascota', /.+/);
  await expect(canvas).toHaveAttribute('data-estela', 'espuma');

  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-barco').click();
  const sheet = page.getByTestId('mar-tienda');
  await expect(sheet).toBeVisible();
  const shop = sheet.getByTestId('barco');
  const canon = shop.getByTestId(`barco-mascota-${CANONCITO}`);
  const turtle = shop.getByTestId(`barco-mascota-${TORTUGA_TURBO}`);
  const vortex = shop.getByTestId(`barco-estela-${ESTELA_VORTICE}`);
  for (const o of [canon, turtle, vortex]) await expect(o).not.toHaveAttribute('data-bloqueado', 'si');
  // Cada mascota con su dibujo.
  await expect(canon.locator('svg[data-mascota]')).toHaveCount(1);
  await expect(turtle.locator('svg[data-mascota]')).toHaveCount(1);

  await canon.click();
  await expect(canon).toHaveAttribute('aria-checked', 'true');
  await expect(root).toHaveAttribute('data-ship-mascot', CANONCITO);
  await expect(canvas).toHaveAttribute('data-mascota', 'canoncito');
  await expect(canvas).toHaveAttribute('data-mascota-modelo', 'glb', { timeout: 30_000 });
  await vortex.click();
  await expect(vortex).toHaveAttribute('aria-checked', 'true');
  await expect(root).toHaveAttribute('data-ship-wake', ESTELA_VORTICE);
  await expect(canvas).toHaveAttribute('data-estela', 'vortice');
  await page.getByTestId('mar-tienda-cerrar').click();
  await expect(sheet).toHaveCount(0);
  // Sin el atajo siguen puestos. Navegando: la estela del vórtice detrás y el Cañoncito en
  // cubierta (se vuelve a abrir el mar: tras cerrar Mi Barco el teclado no gobierna, como en las
  // demás pruebas, que navegan desde la carga).
  await page.goto('/mar');
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 30_000 });
  await expect(root).toHaveAttribute('data-ship-mascot', CANONCITO);
  await expect(root).toHaveAttribute('data-ship-wake', ESTELA_VORTICE);
  await expect(canvas).toHaveAttribute('data-mascota', 'canoncito');
  await expect(canvas).toHaveAttribute('data-estela', 'vortice');
  await expect(canvas).toHaveAttribute('data-mascota-modelo', 'glb', { timeout: 30_000 });
  await sail('ArrowRight');
  await snap('canoncito-estela');
  await page.keyboard.up('ArrowRight');

  // La tortuga ocupa la ranura: fuera el cañón, y nada detrás (también en turbo).
  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-barco').click();
  await turtle.click();
  await expect(turtle).toHaveAttribute('aria-checked', 'true');
  await expect(canon).toHaveAttribute('aria-checked', 'false');
  await expect(canvas).toHaveAttribute('data-mascota', 'tortuga-turbo');
  await expect(canvas).toHaveAttribute('data-mascota-modelo', 'glb', { timeout: 30_000 });
  await page.getByTestId('mar-tienda-cerrar').click();
  await page.goto('/mar');
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 30_000 });
  await expect(root).toHaveAttribute('data-ship-mascot', TORTUGA_TURBO);
  await expect(canvas).toHaveAttribute('data-mascota', 'tortuga-turbo');
  await expect(canvas).toHaveAttribute('data-mascota-modelo', 'glb', { timeout: 30_000 });
  await sail('ArrowLeft', true);
  await snap('tortuga-turbo');
  await page.keyboard.up('ArrowLeft');
  // Cada GLB se pidió (y llegó) en cada carga del mar que lo llevaba puesto.
  expect(new Set(glbs)).toEqual(new Set(['canoncito.glb 200', 'tortuga-turbo.glb 200']));
  expect(errors).toEqual([]);
});
