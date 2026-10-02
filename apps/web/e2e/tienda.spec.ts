import {
  MemoryStorage,
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

/**
 * La tienda «Barco» (T40, D-23 punto 1, O5), en el mar 3D: el
 * visitante trae unas monedas guardadas, gana las que le faltan reclamando
 * «Primera boia», compra un barco (con confirmación) y una bandera, los
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
// El barco más barato de la tienda y una bandera a la venta.
const ship = SAMPLE_COSMETICS.filter((c) => c.slot === 'ship' && !c.base && c.priceCoins).sort(
  (a, b) => a.priceCoins! - b.priceCoins!,
)[0]!;
const STYLE = ship.assetKey!;
const flag = SAMPLE_COSMETICS.find((c) => c.slot === 'flag' && c.priceCoins)!;
const COST = ship.priceCoins! + flag.priceCoins!;

/**
 * Un navegador que ya había jugado: le faltan justo las monedas de «Primera
 * boia» para el barco y la bandera. Sólo si el navegador está vacío (recargar
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

/** Barco y bandera: antes, bloqueados con lo que falta; comprados y equipados después. */
async function shopFlow(page: Page, shop: Locator, info: TestInfo | null, root: Locator) {
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
  await expect(saldo).toHaveAttribute('data-coins', String(flag.priceCoins));
  await buy(shop, `barco-comprar-${flag.id}`, `barco-bandera-${flag.id}`);
  await expect(saldo).toHaveAttribute('data-coins', '0');
  // Los puntos no se tocan al gastar monedas.
  await expect(saldo).toHaveAttribute('data-points', String(1 + firstBuoy.points));

  await shop.getByTestId(`barco-estilo-${STYLE}`).click();
  await expect(root).toHaveAttribute('data-ship-style', STYLE);
  await expect(shop.getByTestId(`barco-estilo-${STYLE}`)).toHaveAttribute('aria-checked', 'true');
  await shop.getByTestId(`barco-bandera-${flag.id}`).click();
  await expect(root).toHaveAttribute('data-ship-flag', flag.id);
}

test.describe.configure({ timeout: 150_000 });

test('/mar: ganar monedas, comprar un barco y una bandera, equiparlos y recargar', async ({
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
  await expect(root).toHaveAttribute('data-ship-flag', flag.id);
  expect(errors).toEqual([]);
});
