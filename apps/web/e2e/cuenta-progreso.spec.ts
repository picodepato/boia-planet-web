import { circuitFromWorld, formatRaceTime } from '@boia/engine/circuit';
import { SAMPLE_ACHIEVEMENTS, SAMPLE_COSMETICS } from '@boia/store';
import { CIRCUIT_ID, WORLD_REGISTRY } from '@boia/world';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { marWorld } from '../app/mar/engine/compact';
import { lapTargets } from '../app/mar/race';
import { PRIVACY_POLICY_VERSION } from '../lib/account/config';
import { ACHIEVEMENT_READY_BODY } from '../lib/mundo/achievements';
import { openMar } from './mar-helpers';
import {
  E2E_SUPABASE,
  createMember,
  deleteMembers,
  serviceClient,
  signInPage,
  signInSession,
  type TestMember,
} from './supabase';
import { supabaseTestEnv } from './supabase-env';

/**
 * El progreso de un miembro vive en su cuenta (plan 008, T90, decisión 6):
 * con sesión, lo que gana (un logro), lo que compra y equipa en la tienda
 * «Barco» (una skin) y su tiempo en El Freu van a las RPC de Supabase; otro
 * navegador, que entra con la misma cuenta y no tiene nada guardado, ve los
 * puntos, la skin puesta, el récord y el Carnet. Sólo con E2E_SUPABASE=1, en
 * escritorio (la carrera es larga); la cuenta se borra al acabar.
 */
test.skip(!E2E_SUPABASE, 'sólo con E2E_SUPABASE=1');
test.describe.configure({ timeout: 600_000 });

const created: TestMember[] = [];
test.afterAll(async () => {
  await deleteMembers(created);
});

const sample = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId);
const world = marWorld(sample.config);
const spec = circuitFromWorld(world, CIRCUIT_ID)!;
const targets = lapTargets(world, spec);
const start = targets.at(-1)!;
// La boia del tutorial: al llegar habla y cuenta para «Primera boia».
const talkingBoia = sample.config.objects.find(
  (o) =>
    o.identity.category === 'boia' &&
    o.behaviors.some((b) => b.type === 'dialogue') &&
    o.behaviors.some((b) => b.type === 'achievement'),
)!;
const firstBuoy = SAMPLE_ACHIEVEMENTS.find(
  (a) => a.trigger === 'find_buoy' && (a.triggerParams as { count?: number }).count === 1,
)!;
// Una skin a la venta del barco de serie del mundo (de base, ya es de todos).
const baseShip = SAMPLE_COSMETICS.find(
  (c) => c.slot === 'ship' && c.base && c.assetKey === sample.theme.ship.style,
)!;
const skin = SAMPLE_COSMETICS.find(
  (c) => c.slot === 'skin' && c.forShip === baseShip.id && c.priceCoins,
)!;
const SKIN_KEY = skin.assetKey!;
/** Monedas del cofre de la cuenta: con las del logro, justo la skin. */
const CHEST = skin.priceCoins! - firstBuoy.coins;

/** Una cuenta con Carnet y un cofre de monedas ya cobrado en el servidor. */
async function memberWithChest(): Promise<TestMember & { nickname: string }> {
  const m = await createMember('progreso');
  created.push(m);
  const env = supabaseTestEnv()!;
  const session = await signInSession(m);
  const client = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });
  const nickname = `Progreso ${m.id.slice(0, 6)}`;
  const profile = await client.rpc('save_profile', {
    p_nickname: nickname,
    p_privacy_version: PRIVACY_POLICY_VERSION,
  });
  if (profile.error) throw new Error(`save_profile: ${profile.error.message}`);
  const chest = await client.rpc('award_points', {
    p_action: 'world',
    p_ref: 'lugar:cofre-e2e:coins',
    p_coins: CHEST,
  });
  if (chest.error) throw new Error(`award_points: ${chest.error.message}`);
  return { ...m, nickname };
}

/** Lo que hay en el servidor de la cuenta (con la clave de servicio). */
async function server(userId: string) {
  const s = serviceClient();
  const [points, coins, equipped, times, ledger] = await Promise.all([
    s.from('point_balances').select('points').eq('user_id', userId).maybeSingle(),
    s.from('coin_balances').select('coins').eq('user_id', userId).maybeSingle(),
    s.from('equipped_cosmetics').select('slot, cosmetic_id').eq('user_id', userId),
    s.from('race_times').select('circuit_id, circuit_version, best_ms').eq('user_id', userId),
    s.from('ledger_transactions').select('action, source_ref, kind').eq('user_id', userId),
  ]);
  return {
    points: Number(points.data?.points ?? 0),
    coins: Number(coins.data?.coins ?? 0),
    equipped: Object.fromEntries((equipped.data ?? []).map((r) => [r.slot, r.cosmetic_id])),
    times: times.data ?? [],
    ledger: ledger.data ?? [],
  };
}

/** Rumbo norte hasta que salga el aviso del logro. */
async function sailUntilAchievement(page: Page) {
  const notice = page.locator('[data-testid="mar-aviso"][data-kind="achievement"]');
  await page.keyboard.down('ArrowUp');
  try {
    await expect(notice).toContainText(ACHIEVEMENT_READY_BODY, { timeout: 25_000 });
  } finally {
    await page.keyboard.up('ArrowUp');
  }
}

async function openShop(page: Page): Promise<Locator> {
  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-barco').click();
  const sheet = page.getByTestId('mar-tienda');
  await expect(sheet).toBeVisible();
  return sheet.getByTestId('barco');
}

async function closeShop(page: Page) {
  await page.getByTestId('mar-tienda-cerrar').click();
  await expect(page.getByTestId('mar-tienda')).toHaveCount(0);
}

type Goal = 'intro' | 'offer' | 'race';

/**
 * Pilota dentro de la página con las flechas, una decisión por fotograma
 * (como mar-circuito.spec.ts): `intro` hasta ver el récord junto a la
 * salida, `offer` hasta la tarjeta de empezar y `race` boia a boia hasta la
 * meta.
 */
async function pilot(page: Page, goal: Goal, ms = 240_000): Promise<string> {
  return page.evaluate(
    async ({ goal, targets, start, ms }) => {
      const main = document.querySelector<HTMLElement>('main.mar')!;
      const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      const held = new Set<string>();
      const press = (keys: string[]) => {
        for (const k of [...held]) {
          if (keys.includes(k)) continue;
          window.dispatchEvent(new KeyboardEvent('keyup', { key: k, code: k }));
          held.delete(k);
        }
        for (const k of keys) {
          if (held.has(k)) continue;
          window.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: k }));
          held.add(k);
        }
      };
      const steer = (t: { x: number; y: number }) => {
        const [x, y] = (main.dataset.barco ?? '0,0').split(',').map(Number);
        const dx = t.x - x!;
        const dy = t.y - y!;
        const d = Math.hypot(dx, dy) || 1;
        const keys: string[] = [];
        if (dx / d > 0.38) keys.push('ArrowRight');
        if (dx / d < -0.38) keys.push('ArrowLeft');
        if (dy / d > 0.38) keys.push('ArrowDown');
        if (dy / d < -0.38) keys.push('ArrowUp');
        press(keys);
      };
      const until = performance.now() + ms;
      try {
        while (performance.now() < until) {
          const chip = q('mar-crono');
          if (goal === 'intro') {
            const intro = q('mar-carrera-salida');
            if (intro) return intro.textContent ?? '';
            steer(start);
          } else if (goal === 'offer') {
            if (chip) return `carrera sin preguntar: ${chip.dataset.fase ?? ''}`;
            if (q('mar-carrera-oferta')) return 'offer';
            steer(start);
          } else {
            if (q('mar-carrera-final')) return 'ok';
            if (!chip) return 'sin carrera';
            const buoy = Number(chip.dataset.boia);
            steer(buoy === 0 ? start : targets[buoy - 1]!);
          }
          await new Promise((r) => requestAnimationFrame(r));
        }
        return 'tiempo';
      } finally {
        press([]);
      }
    },
    { goal, targets, start, ms },
  );
}

test('un miembro gana un logro, compra y equipa una skin y corre; otro navegador lo ve en su cuenta', async ({
  page,
  browser,
}) => {
  test.skip(test.info().project.name !== 'desktop', 'una vez basta: la carrera es larga');
  const m = await memberWithChest();
  await signInPage(page, m);

  // 1. Las monedas del cofre están en la cuenta: la tienda las enseña sin nada en este navegador.
  const errors = await openMar(page, `?cerca=${talkingBoia.identity.id}`);
  let shop = await openShop(page);
  await expect(shop.getByTestId('barco-saldo')).toHaveAttribute('data-coins', String(CHEST));
  await closeShop(page);

  // 2. Gana «Primera boia» navegando y la reclama: va a la cuenta.
  await sailUntilAchievement(page);
  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-menu-logros').click();
  const panel = page.getByTestId('mar-logros-panel');
  await panel.getByTestId(`logro-reclamar-${firstBuoy.id}`).click();
  await expect(panel.getByTestId(`logro-${firstBuoy.id}`)).toHaveAttribute(
    'data-estado',
    'claimed',
  );
  await page.getByTestId('mar-logros-cerrar').click();
  await expect
    .poll(async () => (await server(m.id)).ledger.some((r) => r.source_ref === firstBuoy.id))
    .toBe(true);
  expect((await server(m.id)).points).toBeGreaterThanOrEqual(firstBuoy.points);

  // 3. Compra la skin (con confirmación) y se la pone: en la cuenta, comprada y equipada.
  shop = await openShop(page);
  await expect(shop.getByTestId('barco-saldo')).toHaveAttribute(
    'data-coins',
    String(skin.priceCoins),
  );
  await shop.getByTestId(`barco-comprar-skin-${SKIN_KEY}`).click();
  await shop.getByTestId('barco-confirmar-si').click();
  await expect(shop.getByTestId('barco-mensaje')).toBeVisible();
  await expect(shop.getByTestId(`barco-skin-${SKIN_KEY}`)).not.toHaveAttribute(
    'data-bloqueado',
    'si',
  );
  await shop.getByTestId(`barco-skin-${SKIN_KEY}`).click();
  await expect(page.locator('main.mar')).toHaveAttribute('data-ship-skin', SKIN_KEY);
  await closeShop(page);
  await expect
    .poll(async () => (await server(m.id)).equipped)
    .toEqual({ skin: skin.id, ship: baseShip.id });
  expect((await server(m.id)).coins).toBe(0);

  // 4. Una carrera en El Freu: el tiempo va a la cuenta.
  await openMar(page, `?cerca=${start.id}`);
  expect(await pilot(page, 'offer')).toBe('offer');
  await page.getByTestId('mar-carrera-empezar').click();
  await expect(page.getByTestId('mar-crono')).toHaveAttribute('data-fase', 'racing', {
    timeout: 15_000,
  });
  expect(await pilot(page, 'race')).toBe('ok');
  await expect(page.getByTestId('mar-carrera-final')).toBeVisible();
  // La tarjeta de meta enseña su puesto en el ranking global (T92).
  const puesto = page.getByTestId('mar-carrera-puesto');
  await expect(puesto).toHaveAttribute('data-ranking', 'global', { timeout: 15_000 });
  await expect(puesto).toContainText(/Puesto \d+ de \d+/);
  await expect.poll(async () => (await server(m.id)).times.length, { timeout: 15_000 }).toBe(1);
  const best = (await server(m.id)).times[0]!;
  expect(best).toMatchObject({ circuit_id: spec.id, circuit_version: spec.version });
  expect(errors).toEqual([]);

  // 5. Otro navegador, sin nada guardado, entra con la misma cuenta.
  const other = await browser.newContext();
  try {
    const page2 = await other.newPage();
    await signInPage(page2, m);
    const errors2 = await openMar(page2, `?cerca=${start.id}`);
    // La skin puesta.
    await expect(page2.locator('main.mar')).toHaveAttribute('data-ship-skin', SKIN_KEY);
    // El récord, junto a la salida.
    expect(await pilot(page2, 'intro')).toContain(formatRaceTime(best.best_ms));
    // Los puntos y las monedas de la cuenta (navegar hasta la salida puede sumar alguno más).
    const shop2 = await openShop(page2);
    const saldo = shop2.getByTestId('barco-saldo');
    await expect
      .poll(async () => {
        const [points, coins, srv] = await Promise.all([
          saldo.getAttribute('data-points'),
          saldo.getAttribute('data-coins'),
          server(m.id),
        ]);
        return (
          Number(points) === srv.points &&
          Number(coins) === srv.coins &&
          srv.points >= firstBuoy.points
        );
      })
      .toBe(true);
    await closeShop(page2);
    // Y el Carnet de la cuenta.
    await page2.getByTestId('mar-enlace-carnet').click();
    const carnet = page2.getByTestId('mar-carnet');
    await expect(carnet).toBeVisible();
    await expect(carnet.getByTestId('carnet-mio')).toContainText(m.nickname);
    expect(errors2).toEqual([]);
  } finally {
    await other.close();
  }
});
