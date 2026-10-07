import { EVENT_STATE_BEHAVIOR, eventState } from '@boia/contracts';
import { circuitFromWorld, circuitRecordId } from '@boia/engine/circuit';
import { MemoryStorage, SAMPLE_EVENTS, STORE_KEY, createLocalRepository } from '@boia/store';
import { CIRCUIT_ID, WORLD_REGISTRY } from '@boia/world';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { canonBoardOptions, castleBoardOptions } from '../../lib/mundo/ranking-boards';
import { CANON_BEST_KEY, canonBoardKey } from '../../lib/mundo/ranking-canon';
import { CASTLE_BEST_KEY, castleBoardKey } from '../../lib/mundo/ranking-castle';
import { shot } from './deck-helpers';

/**
 * Capturas de la parte 4 (Carnet BOIA y Ranking), en móvil y en modo local
 * (D-20): el Carnet propio por delante y por detrás, el Carnet público de un
 * miembro de muestra, el Carnet de artista, /sello
 * sin cuentas y las cuatro pestañas de /ranking. El progreso se siembra en
 * el navegador como lo dejaría jugar: una compra de prueba (su sello), unos
 * puntos, una vuelta a Los Rápidos y una partida en la primera tabla del
 * Cañón y del Castillo.
 */

test.describe.configure({ timeout: 180_000 });

const APODO = 'Medusa Disco';

/** Un Carnet de este navegador con sellos de compras de prueba, puntos y récords. */
async function sembrar(page: Page): Promise<void> {
  const now = new Date();
  const storage = new MemoryStorage();
  const repo = createLocalRepository({ storage, watch: false });
  await repo.carnet.create({ nickname: APODO });
  const aLaVenta = SAMPLE_EVENTS.filter(
    (e) => e.state !== 'draft' && EVENT_STATE_BEHAVIOR[eventState(e, now)].purchasable,
  );
  expect(aLaVenta.length, 'hay eventos de muestra a la venta').toBeGreaterThan(0);
  for (const [i, e] of aLaVenta.entries()) {
    await repo.purchases.confirmSandbox({ purchaseId: `deck-04-${i}`, eventId: e.id });
  }
  await repo.progress.grantWorldReward({ sourceRef: 'deck-04', points: 180, coins: 40 });
  const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config;
  const spec = circuitFromWorld(world, CIRCUIT_ID)!;
  await repo.progress.submitTime(circuitRecordId(spec), 98_400);

  const canon = canonBoardOptions()[0]!.board;
  const castle = castleBoardOptions()[0]!.board;
  if (canon.kind !== 'canon' || castle.kind !== 'castle') throw new Error('tablas');
  await page.addInitScript(
    ([key, doc, ck, ckey, tk, tkey]) => {
      if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, doc);
      const at = '2026-10-07T12:00:00Z';
      localStorage.setItem(ck, JSON.stringify({ [ckey]: { score: 12_480, at, games: 3 } }));
      localStorage.setItem(tk, JSON.stringify({ [tkey]: { score: 2_150, at, games: 2 } }));
    },
    [
      STORE_KEY,
      storage.getItem(STORE_KEY)!,
      CANON_BEST_KEY,
      canonBoardKey(canon.boss),
      CASTLE_BEST_KEY,
      castleBoardKey(castle.runMin, castle.difficulty),
    ] as const,
  );
}

/** Sube el elemento al principio de la pantalla, con un margen arriba. */
async function alPrincipio(loc: Locator, margen = 12) {
  await loc.evaluate((el, m) => {
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - m);
  }, margen);
}

test('carnet-anverso y carnet-reverso', async ({ page }) => {
  await sembrar(page);
  await page.goto('/carnet');
  const card = page.getByTestId('carnet-tarjeta');
  await expect(card.getByTestId('carnet-apodo')).toHaveText(APODO);
  await expect(card).toHaveAttribute('data-cara', 'front');
  await alPrincipio(card);
  await shot(page, '04', 'carnet-anverso', { respiro: 1000 });

  await card.getByTestId('carnet-girar').click();
  await expect(card).toHaveAttribute('data-cara', 'back');
  await alPrincipio(card);
  await shot(page, '04', 'carnet-reverso', { respiro: 1400 });
});

test('carnet-publico', async ({ page }) => {
  await page.goto('/carnet/muestra-la-del-castillo');
  const card = page.getByTestId('carnet-tarjeta');
  await expect(card.getByTestId('carnet-apodo')).toHaveText('La del Castillo');
  await alPrincipio(card);
  await shot(page, '04', 'carnet-publico', { respiro: 1000 });
});

test('carnet-artista', async ({ page }) => {
  await page.goto('/artista/muestra-presentacion');
  await expect(page).toHaveURL(/\/mar/, { timeout: 60_000 });
  await expect(page.getByTestId('mar-carnet')).toBeVisible({ timeout: 60_000 });
  if (!(await page.getByTestId('carnet-form').isVisible())) {
    await page.getByTestId('carnet-crear').click();
  }
  const form = page.getByTestId('carnet-form');
  await form.getByTestId('carnet-apodo-input').fill('DJ Salitre');
  await form.getByTestId('carnet-guardar').click();
  await expect(page.getByTestId('carnet-mio')).toBeVisible();
  await page.goto('/carnet');
  const card = page.getByTestId('carnet-tarjeta');
  await expect(card.getByTestId('carnet-sello-artista')).toBeVisible();
  await alPrincipio(card);
  await shot(page, '04', 'carnet-artista', { respiro: 1000 });
});

test('sello', async ({ page }) => {
  await page.goto('/sello?e=halloween-2026&c=ABCDEF123');
  await expect(page.getByTestId('sello-error')).toHaveAttribute('data-motivo', 'local');
  await shot(page, '04', 'sello');
});

/** Abre /ranking en una pestaña; con `desplegar`, el desplegable se ve abierto en la página. */
async function ranking(page: Page, pestana: string, nombre: string, desplegar?: string) {
  await sembrar(page);
  await page.goto('/ranking');
  const panel = page.getByTestId('ranking-pagina').getByTestId('ranking');
  await expect(panel).toHaveAttribute('data-modo', 'local');
  await panel.getByTestId(pestana).click();
  await expect(panel.getByTestId('ranking-fila-mia')).toBeVisible();
  if (desplegar) {
    // Un <select> nativo no se ve abierto en una captura: se despliega en la página.
    await panel
      .getByTestId(desplegar)
      .evaluate((el: HTMLSelectElement) => (el.size = el.options.length));
  }
  await shot(page, '04', nombre);
}

test('ranking-carrera', async ({ page }) => {
  await ranking(page, 'ranking-tab-circuito', 'ranking-carrera');
});

test('ranking-canon', async ({ page }) => {
  await ranking(page, 'ranking-tab-canon', 'ranking-canon', 'ranking-canon');
});

test('ranking-castillo', async ({ page }) => {
  await ranking(page, 'ranking-tab-castillo', 'ranking-castillo', 'ranking-castillo');
});

test('ranking-puntos', async ({ page }) => {
  await ranking(page, 'ranking-tab-siempre', 'ranking-puntos');
});
