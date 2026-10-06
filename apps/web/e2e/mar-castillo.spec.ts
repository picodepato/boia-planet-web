import {
  DEFENSE_CONFIG,
  DEFENSE_TOWER_KINDS,
  buildDefensePath,
  createDefense,
  defenseSiteReason,
} from '@boia/engine/defense';
import { CASTLE_PLACE_ID, LIGHTHOUSE_PLACE_ID, WORLD_REGISTRY } from '@boia/world';
import { type Page, type TestInfo, expect, test } from '@playwright/test';
import { marWorld } from '../app/mar/engine/compact';
import { arenaFrame, vortexSpot } from '../app/mar/engine/defense-arena';
import { planetRect, wrapIn } from '../app/mar/engine/wrap';
import { t } from '../lib/i18n';
import { mar, openMar } from './mar-helpers';

/**
 * «Defensa del Castillo» (plan 014). T160, la arena: con el atajo
 * `?minijuego=castillo` el resto del mundo se hunde (sin rótulos ni capas
 * del mundo), la cámara sube sobre el castillo, que se ve; los enemigos
 * salen del vórtice (hacia el mar abierto) y van por el camino sin salirse;
 * el barco vuela como avión con las flechas; al salir, todo vuelve. Y el
 * tiempo por fotograma en `baja` con el pico de la partida de 10 min y las
 * siete islas a nivel 3 (se apunta: `[perf-castillo]`). El estado se lee de
 * `data-testid="mar-castillo"` y del lienzo (`data-arena`, `data-hundido`…).
 */

test.describe.configure({ timeout: 240_000 });

const world = marWorld(WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config);
const castle = world.objects.find((o) => o.identity.id === CASTLE_PLACE_ID)!;
const path = buildDefensePath(DEFENSE_CONFIG.path, DEFENSE_CONFIG.castle.radius);

const game = (page: Page) => page.getByTestId('mar-castillo');
const canvas = (page: Page) => page.getByTestId('mar-canvas');
const pins = (page: Page) => page.locator('[data-pin]');
const pointOf = (s: string | null) => {
  const [x, y] = (s ?? '0,0').split(',').map(Number);
  return { x: x!, y: y! };
};

/** Pausa (Esc) → «Terminar partida» → «Sí, terminar» → la tarjeta → «Volver al mar». */
async function quitAndLeave(page: Page): Promise<void> {
  await page.getByTestId('mar-castillo-pausa').click();
  await page.getByTestId('mar-menu-terminar').click();
  await page.getByTestId('mar-menu-terminar-si').click();
  await expect(page.getByTestId('mar-castillo-final')).toBeVisible();
  await page.getByTestId('mar-castillo-volver').click();
}

test('arena: el mundo se hunde, el castillo se ve, los enemigos por el camino y el avión vuela; al salir, todo vuelve', async ({
  page,
}, info) => {
  const errors = await openMar(page, '?minijuego=castillo&seed=7');
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  await expect(canvas(page)).toHaveAttribute('data-arena', 'on');
  // El vórtice, al principio del camino, hacia el mar abierto (en el planeta).
  const v = vortexSpot(arenaFrame(castle.position, path), path);
  const b = planetRect(world.bounds);
  const want = { x: wrapIn(v.x, b.left, b.right), y: wrapIn(v.y, b.top, b.bottom) };
  const got = pointOf(await canvas(page).getAttribute('data-vortice'));
  expect(Math.hypot(got.x - want.x, got.y - want.y)).toBeLessThan(2);

  // Todo lo demás, bajo el agua; sin rótulos ni capas del mundo; el castillo, a la vista.
  await expect(canvas(page)).toHaveAttribute('data-hundido', '1.00', { timeout: 15_000 });
  await expect(canvas(page)).toHaveAttribute('data-islas-vista', '0');
  await expect(canvas(page)).toHaveAttribute('data-castillo-vista', 'si', { timeout: 10_000 });
  await expect(canvas(page)).toHaveAttribute('data-ruta', 'off');
  await expect(canvas(page)).toHaveAttribute('data-escondido', /encounters/);
  await expect(pins(page)).toHaveCount(0);

  // Los enemigos salen del vórtice y van por el camino, sin salirse del carril.
  await expect
    .poll(async () => Number(await canvas(page).getAttribute('data-arena-enemigos')), {
      timeout: 30_000,
    })
    .toBeGreaterThan(0);
  await expect(canvas(page)).toHaveAttribute('data-arena-fuera', '0');
  expect(Number(await game(page).getAttribute('data-enemigos'))).toBeGreaterThan(0);
  // Para mirarla (en la carpeta de resultados de Playwright, no se compara).
  await page.screenshot({ path: info.outputPath('arena.png') });

  // El avión vuela con las flechas (como al navegar).
  const before = pointOf(await game(page).getAttribute('data-avion'));
  const shipBefore = pointOf(await mar(page).getAttribute('data-barco'));
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(1200);
  await page.keyboard.up('ArrowLeft');
  await expect
    .poll(async () => {
      const now = pointOf(await game(page).getAttribute('data-avion'));
      return Math.hypot(now.x - before.x, now.y - before.y);
    })
    .toBeGreaterThan(100);
  const shipNow = pointOf(await mar(page).getAttribute('data-barco'));
  expect(Math.hypot(shipNow.x - shipBefore.x, shipNow.y - shipBefore.y)).toBeGreaterThan(100);

  // Salir (T161: pausa → «Terminar partida» → «Volver al mar»): el mundo vuelve como estaba.
  await quitAndLeave(page);
  await expect(game(page)).toHaveAttribute('data-fin', 'quit');
  await expect(canvas(page)).toHaveAttribute('data-arena', 'off');
  await expect(canvas(page)).toHaveAttribute('data-hundido', '0.00', { timeout: 15_000 });
  await expect(canvas(page)).toHaveAttribute('data-ruta', 'on');
  await expect(canvas(page)).not.toHaveAttribute('data-escondido', /./);
  await expect(canvas(page)).not.toHaveAttribute('data-vortice', /./);
  await expect.poll(async () => pins(page).count()).toBeGreaterThan(0);
  await expect(page.getByTestId('mar-castillo-hud')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('arena: con movimiento reducido el mundo se hunde y vuelve de golpe', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = await openMar(page, '?minijuego=castillo&seed=7');
  await expect(canvas(page)).toHaveAttribute('data-arena', 'on');
  await expect(canvas(page)).toHaveAttribute('data-hundido', '1.00', { timeout: 5_000 });
  await quitAndLeave(page);
  await expect(canvas(page)).toHaveAttribute('data-hundido', '0.00', { timeout: 5_000 });
  expect(errors).toEqual([]);
});

// --- Rendimiento en `baja` ----------------------------------------------------------

const PERF_MS = 8000;
/** Tope holgado del percentil 95 (el de las pruebas del Cañón, máquina cargada). */
const PERF_P95_MAX_MS = 100;

function percentile(values: readonly number[], p: number): number {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? 0;
}

async function measureFrames(page: Page, info: TestInfo, label: string) {
  const frames = await page.evaluate(async (ms) => {
    const deltas: number[] = [];
    await new Promise<void>((done) => {
      let t0 = 0;
      let last = 0;
      const step = (now: number) => {
        if (!t0) t0 = last = now;
        else {
          deltas.push(now - last);
          last = now;
        }
        if (now - t0 < ms) requestAnimationFrame(step);
        else done();
      };
      requestAnimationFrame(step);
    });
    return deltas;
  }, PERF_MS);
  const report = {
    label,
    frames: frames.length,
    p50: +percentile(frames, 50).toFixed(1),
    p95: +percentile(frames, 95).toFixed(1),
    worst: +Math.max(...frames).toFixed(1),
    enemies: Number(await game(page).getAttribute('data-enemigos')),
    drawn: Number(await canvas(page).getAttribute('data-arena-enemigos')),
    kinds: (await canvas(page).getAttribute('data-arena-tipos')) ?? '',
    islands: Number(await canvas(page).getAttribute('data-arena-islas')),
    effects: (await canvas(page).getAttribute('data-arena-efectos')) ?? '',
  };
  console.log(`[perf-castillo] ${JSON.stringify(report)}`);
  info.annotations.push({ type: 'perf', description: JSON.stringify(report) });
  expect(frames.length, label).toBeGreaterThan(10);
  return report;
}

test('arena: rendimiento en `baja` con el pico de la partida de 10 min y las siete islas a nivel 3', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile', 'se mide una vez, en el teléfono');
  // Calidad `baja` forzada: un teléfono con 2 GB.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, get: () => 2 });
  });
  const errors = await openMar(
    page,
    '?minijuego=castillo&duracion=10&dificultad=tormenta&t=505&islas=1&seed=7',
  );
  await expect(game(page)).toHaveAttribute('data-calidad', 'baja');
  await expect(game(page)).toHaveAttribute('data-islas', '7');
  await expect(canvas(page)).toHaveAttribute('data-arena-islas', '7');
  // El pico: el camino lleno (y el Kraken saliendo del vórtice).
  await expect
    .poll(async () => Number(await game(page).getAttribute('data-enemigos')), {
      timeout: 120_000,
      intervals: [500],
    })
    .toBeGreaterThanOrEqual(30);
  const free = await measureFrames(page, info, 'sin limitar la CPU');
  expect(free.p95, 'percentil 95 del tiempo por fotograma (ms)').toBeLessThanOrEqual(
    PERF_P95_MAX_MS,
  );
  // Con la CPU 4× más lenta: sólo se apunta.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await measureFrames(page, info, 'CPU 4×');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  expect(errors).toEqual([]);
});

// --- El HUD (T161): construir, colocar, mejorar, vender, la pausa ---------------------

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width - 0.5 &&
  b.x < a.x + a.width - 0.5 &&
  a.y < b.y + b.height - 0.5 &&
  b.y < a.y + a.height - 0.5;

const frame = arenaFrame(castle.position, path);
const start = createDefense(DEFENSE_CONFIG, 7).snapshot().plane;
const kinds = DEFENSE_TOWER_KINDS;

/**
 * Sitios para construir con holgura (la regla de T159 los deja también 50 u
 * alrededor, por si el avión se para un poco antes o después), cerca de la
 * salida del avión y uno tras otro: la ruta más corta para el avión.
 */
function roomySpots(n: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const cfg = DEFENSE_CONFIG;
  const free = (x: number, y: number) => {
    if (defenseSiteReason(cfg, path, out, x, y) !== null) return false;
    for (let a = 0; a < 8; a++) {
      const px = x + Math.cos((a * Math.PI) / 4) * 50;
      const py = y + Math.sin((a * Math.PI) / 4) * 50;
      if (defenseSiteReason(cfg, path, out, px, py) !== null) return false;
    }
    return out.every((p) => Math.hypot(p.x - x, p.y - y) > cfg.islandRadius * 2 + 60);
  };
  let from = { x: start.x, y: start.y };
  while (out.length < n) {
    let best: { x: number; y: number; d: number } | null = null;
    for (let x = -cfg.arenaRadius; x <= cfg.arenaRadius; x += 30) {
      for (let y = -cfg.arenaRadius; y <= cfg.arenaRadius; y += 30) {
        if (!free(x, y)) continue;
        const d = Math.hypot(x - from.x, y - from.y);
        if (!best || d < best.d) best = { x, y, d };
      }
    }
    if (!best) break;
    out.push({ x: best.x, y: best.y });
    from = best;
  }
  return out;
}

/** El avión ahora (u de la partida), del lienzo. */
async function planeAt(page: Page) {
  return pointOf(await canvas(page).getAttribute('data-arena-avion'));
}

/**
 * Lleva el avión hasta `to` (u de la partida) con las flechas, a toques
 * cortos y mirando dónde va (las flechas van en el mar: se gira con el marco
 * de la arena). La isla que se coloca va debajo del avión.
 */
async function flyTo(page: Page, to: { x: number; y: number }, tol = 28): Promise<void> {
  const c = Math.cos(frame.rot);
  const sn = Math.sin(frame.rot);
  for (let i = 0; i < 80; i++) {
    const p = await planeAt(page);
    const dx = to.x - p.x;
    const dy = to.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < tol) {
      await page.waitForTimeout(450);
      const q = await planeAt(page);
      if (Math.hypot(to.x - q.x, to.y - q.y) < tol) return;
      continue;
    }
    const wx = dx * c - dy * sn;
    const wy = dx * sn + dy * c;
    const keys: string[] = [];
    if (Math.abs(wx) > d * 0.38) keys.push(wx > 0 ? 'ArrowRight' : 'ArrowLeft');
    if (Math.abs(wy) > d * 0.38) keys.push(wy > 0 ? 'ArrowDown' : 'ArrowUp');
    for (const k of keys) await page.keyboard.down(k);
    await page.waitForTimeout(Math.max(50, Math.min(500, (d / 300) * 1000 * 0.55)));
    for (const k of keys) await page.keyboard.up(k);
    await page.waitForTimeout(380);
  }
  throw new Error(`el avión no llega a ${to.x},${to.y}`);
}

const hud = (page: Page) => page.getByTestId('mar-castillo-hud');
const placing = (page: Page) => page.getByTestId('mar-castillo-colocar');
const islands = async (page: Page) => Number(await game(page).getAttribute('data-islas'));
const coins = async (page: Page) => Number(await game(page).getAttribute('data-monedas'));

test('construir: cada una de las siete islas, y encima del camino no se puede (rojo con su motivo)', async ({
  page,
}) => {
  const errors = await openMar(
    page,
    '?minijuego=castillo&seed=7&dificultad=tranquila&duracion=10&monedas=3000',
  );
  await expect(hud(page)).toBeVisible();
  await expect(canvas(page)).toHaveAttribute('data-arena-avion', /\d/);

  // Encima del camino: el trozo más cercano a la salida del avión.
  let onPath = { x: 0, y: 0, d: Infinity };
  for (let d = 0; d < path.length; d += 10) {
    const p = path.sampleAt(d);
    const dd = Math.hypot(p.x - start.x, p.y - start.y);
    if (dd < onPath.d) onPath = { x: p.x, y: p.y, d: dd };
  }
  await page.getByTestId('mar-castillo-construir').click();
  await expect(page.getByTestId('mar-castillo-islas')).toBeVisible();
  await expect(page.getByTestId('mar-castillo-isla')).toHaveCount(kinds.length);
  await page.locator('[data-testid="mar-castillo-isla"][data-isla="faro"]').click();
  await expect(placing(page)).toHaveAttribute('data-isla', 'faro');
  await expect(canvas(page)).toHaveAttribute('data-arena-colocar', /ok|no/);
  await flyTo(page, onPath, 20);
  await expect(placing(page)).toHaveAttribute('data-motivo', 'path');
  await expect(placing(page)).toHaveAttribute('data-valido', 'no');
  await expect(canvas(page)).toHaveAttribute('data-arena-colocar', 'no');
  await expect(page.getByTestId('mar-castillo-colocar-estado')).toHaveText(/camino/i);
  // Ni con el botón (apagado: `aria-disabled`, se le manda el clic igual) ni con Intro.
  await page.getByTestId('mar-castillo-colocar-si').dispatchEvent('click');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  expect(await islands(page)).toBe(0);
  await page.getByTestId('mar-castillo-colocar-no').click();
  await expect(placing(page)).toHaveCount(0);

  // Las siete, una a una (la primera con el dedo o el ratón, el resto con B y su número).
  const spots = roomySpots(kinds.length);
  expect(spots).toHaveLength(kinds.length);
  for (const [i, kind] of kinds.entries()) {
    const before = await coins(page);
    if (i === 0) {
      await page.getByTestId('mar-castillo-construir').click();
      await page.locator(`[data-testid="mar-castillo-isla"][data-isla="${kind}"]`).click();
    } else {
      await page.keyboard.press('b');
      await expect(page.getByTestId('mar-castillo-islas')).toBeVisible();
      await page.keyboard.press(String(i + 1));
    }
    await expect(placing(page)).toHaveAttribute('data-isla', kind);
    await flyTo(page, spots[i]!);
    await expect(placing(page)).toHaveAttribute('data-valido', 'si');
    await expect(canvas(page)).toHaveAttribute('data-arena-colocar', 'ok');
    if (i % 2) await page.keyboard.press('Enter');
    else await page.getByTestId('mar-castillo-colocar-si').click();
    await expect.poll(() => islands(page)).toBe(i + 1);
    await expect(placing(page)).toHaveCount(0);
    // Cobrada (las caídas mientras tanto suman algo).
    expect(await coins(page)).toBeLessThan(before - DEFENSE_CONFIG.towers.kinds[kind].cost / 2);
  }
  await expect(canvas(page)).toHaveAttribute('data-arena-islas', String(kinds.length));
  expect(errors).toEqual([]);
});

test('mejorar y vender: tocar una isla, subirla a nivel 3 y venderla; el avión sube su daño', async ({
  page,
}) => {
  const errors = await openMar(
    page,
    '?minijuego=castillo&seed=7&dificultad=tranquila&duracion=10&monedas=3000',
  );
  await expect(hud(page)).toBeVisible();
  await expect(canvas(page)).toHaveAttribute('data-arena-avion', /\d/);
  // Una Ibiza cerca de la salida del avión.
  await page.getByTestId('mar-castillo-construir').click();
  await page.locator('[data-testid="mar-castillo-isla"][data-isla="tienda"]').click();
  await flyTo(page, roomySpots(1)[0]!);
  await page.getByTestId('mar-castillo-colocar-si').click();
  await expect.poll(() => islands(page)).toBe(1);

  // Con el dedo (o el ratón) sobre ella en la pantalla: su ficha.
  // (Donde se ve: en el lienzo y sin nada del HUD encima.)
  const box = (await canvas(page).boundingBox())!;
  let at: { x: number; y: number } | null = null;
  await expect
    .poll(async () => {
      const spot = (await canvas(page).getAttribute('data-arena-islas-pantalla')) ?? '';
      const m = spot.match(/^\d+:(-?\d+),(-?\d+)/);
      if (!m) return false;
      const p = { x: box.x + Number(m[1]), y: box.y + Number(m[2]) };
      const free = await page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('data-testid') === 'mar-canvas',
        p,
      );
      at = free ? p : null;
      return free;
    })
    .toBe(true);
  const tapAt = at as unknown as { x: number; y: number };
  if (test.info().project.name === 'mobile') await page.touchscreen.tap(tapAt.x, tapAt.y);
  else await page.mouse.click(tapAt.x, tapAt.y);
  const card = page.getByTestId('mar-castillo-ficha');
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('data-isla', 'tienda');
  await expect(card).toHaveAttribute('data-nivel', '1');
  await expect(canvas(page)).toHaveAttribute('data-arena-elegida', 'si');
  const up = DEFENSE_CONFIG.towers.kinds.tienda.upgradeCost;
  await expect(page.getByTestId('mar-castillo-mejorar')).toContainText(String(up[0]));

  // Mejorar dos veces (con el botón y con la U): nivel 3, «Nivel máximo».
  await page.getByTestId('mar-castillo-mejorar').click();
  await expect(card).toHaveAttribute('data-nivel', '2');
  await expect(page.getByTestId('mar-castillo-mejorar')).toContainText(String(up[1]));
  await page.keyboard.press('u');
  await expect(card).toHaveAttribute('data-nivel', '3');
  await expect(page.getByTestId('mar-castillo-mejorar')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByTestId('mar-castillo-ficha-nivel')).toContainText('3/3');

  // Vender: se va y devuelve lo que decía.
  const refund = Number(
    (await page.getByTestId('mar-castillo-vender').textContent())!.match(/\+(\d+)/)![1],
  );
  expect(refund).toBeGreaterThan(0);
  const hudCoins = async () =>
    Number(await page.getByTestId('mar-castillo-monedas').getAttribute('data-monedas'));
  await page.waitForTimeout(400);
  const before = await hudCoins();
  await page.getByTestId('mar-castillo-vender').click();
  await expect.poll(() => islands(page)).toBe(0);
  await expect(card).toHaveCount(0);
  await expect.poll(hudCoins).toBeGreaterThanOrEqual(before + refund);

  // El daño del avión: 1 → 2.
  await expect(game(page)).toHaveAttribute('data-avion-nivel', '1');
  await page.getByTestId('mar-castillo-avion').click();
  await expect(game(page)).toHaveAttribute('data-avion-nivel', '2');
  await expect(page.getByTestId('mar-castillo-avion')).toHaveAttribute('data-nivel', '2');
  expect(errors).toEqual([]);
});

test('HUD: arriba vida, tiempo, oleada y monedas; la pausa con el sonido y «Terminar partida» → «Partida terminada», sin medalla ni ranking', async ({
  page,
}) => {
  const errors = await openMar(page, '?minijuego=castillo&seed=7&duracion=5');
  await expect(hud(page)).toBeVisible();
  await expect(page.getByTestId('mar-castillo-vida')).toHaveAttribute('data-pct', '100');
  await expect(page.getByTestId('mar-castillo-tiempo')).toHaveText(/^[45]:\d\d$/);
  await expect(page.getByTestId('mar-castillo-monedas')).toHaveAttribute(
    'data-monedas',
    String(DEFENSE_CONFIG.startCoins),
  );
  // Lo que no llega va en gris (aria-disabled), según las monedas de ese momento.
  await page.getByTestId('mar-castillo-construir').click();
  await expect(page.getByTestId('mar-castillo-isla')).toHaveCount(kinds.length);
  const wrong = await page.evaluate(() => {
    const have = Number(
      document.querySelector('[data-testid="mar-castillo-monedas"]')?.getAttribute('data-monedas'),
    );
    return [...document.querySelectorAll('[data-testid="mar-castillo-isla"]')]
      .filter(
        (el) =>
          Number(el.getAttribute('data-coste')) > have !==
          (el.getAttribute('aria-disabled') === 'true'),
      )
      .map((el) => el.getAttribute('data-isla'));
  });
  expect(wrong).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('mar-castillo-islas')).toHaveCount(0);
  // Empieza la primera oleada: se anuncia.
  await expect(page.getByTestId('mar-castillo-oleada')).toHaveAttribute('data-oleada', '1', {
    timeout: 30_000,
  });
  await expect(page.getByTestId('mar-castillo-anuncio')).toHaveText(/oleada 1/i);

  // Esc: la pausa (el menú de /mar) con el sonido y el volumen.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('mar-menu')).toBeVisible();
  await expect(game(page)).toHaveAttribute('data-estado', 'paused');
  await expect(page.getByTestId('mar-canon-volumen')).toBeVisible();
  await expect(page.getByTestId('mar-canon-mostrar-health')).toHaveCount(0);
  await page.getByTestId('mar-menu-terminar').click();
  await expect(page.getByTestId('mar-menu-terminar-confirmar')).toBeVisible();
  await page.getByTestId('mar-menu-terminar-si').click();
  const end = page.getByTestId('mar-castillo-final');
  await expect(end).toBeVisible();
  await expect(end).toHaveAttribute('data-fin', 'quit');
  await expect(end).toHaveAttribute('data-ranking', 'no');
  await expect(game(page)).toHaveAttribute('data-fin', 'quit');
  await expect(end.locator('h2')).toHaveText(/partida terminada/i);
  await expect(page.getByTestId('mar-castillo-anuncio')).toHaveText(/partida terminada/i);
  await expect(hud(page)).toHaveCount(0);
  await expect(page.getByTestId('mar-castillo-volver')).toBeFocused();
  await page.getByTestId('mar-castillo-volver').click();
  await expect(end).toHaveCount(0);
  await expect(canvas(page)).toHaveAttribute('data-arena', 'off');
  expect(errors).toEqual([]);
});

const HUD_SIZES = [
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;

/** Las cajas de lo fijo de /mar y del HUD del castillo (lo que se ve). */
async function boxesOf(page: Page): Promise<Record<string, Box>> {
  return page.evaluate(() => {
    const sel: Record<string, string> = {
      hud: '[data-testid="mar-castillo-hud"]',
      franja: '[data-testid="mar-castillo-franja"] > *',
      aviso: '[data-testid="mar-castillo-jefe-aviso"]',
      menu: '[data-testid="mar-logros"]',
      minimapa: '[data-testid="mar-minimapa"]',
      enlaces: '[data-testid="mar-enlaces"]',
      entradas: '[data-testid="mar-entradas"]',
      turbo: '[data-testid="mar-turbo"]',
      nudos: '.mar-speed',
      zoom: '.mar-rail',
    };
    const out: Record<string, { x: number; y: number; width: number; height: number }> = {};
    for (const [id, q] of Object.entries(sel)) {
      const el = document.querySelector<HTMLElement>(q);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      if (r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none')
        out[id] = { x: r.x, y: r.y, width: r.width, height: r.height };
    }
    return out;
  });
}

/** Lo que se toca en el HUD, con su zona de toque (la caja más el `::before` que la agranda). */
async function touchTargets(page: Page): Promise<{ id: string; w: number; h: number }[]> {
  return page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        '[data-testid="mar-castillo-hud"] button, [data-testid="mar-castillo-franja"] button',
      ),
    ].map((el) => {
      const r = el.getBoundingClientRect();
      const before = getComputedStyle(el, '::before');
      const grow =
        before.position === 'absolute' && before.content !== 'none'
          ? Math.max(0, -parseFloat(before.left || '0'))
          : 0;
      return {
        id: el.dataset.testid ?? el.className,
        w: r.width + 2 * grow,
        h: r.height + 2 * grow,
      };
    }),
  );
}

test('HUD: nada se pisa en 360×640, 390×844, 768×1024 y 1440×900 (reposo, construir, colocar, ficha y boss) y todo se toca con 44 px', async ({
  page,
}) => {
  // `islas=1`: siete islas ya puestas (para la ficha); `t=`: con el primer boss en el camino.
  const run = DEFENSE_CONFIG.runs[5];
  const errors = await openMar(
    page,
    `?minijuego=castillo&seed=7&duracion=5&dificultad=tranquila&islas=1&monedas=2000&t=${Math.round(run.bosses[0]!.atFrac * run.durationS)}`,
  );
  await expect(hud(page)).toBeVisible();
  await expect(page.getByTestId('mar-canon-jefe')).toBeVisible({ timeout: 30_000 });
  const modes: { name: string; enter: () => Promise<void> }[] = [
    { name: 'reposo', enter: async () => {} },
    {
      name: 'construir',
      enter: async () => {
        await page.getByTestId('mar-castillo-construir').click();
        await expect(page.getByTestId('mar-castillo-islas')).toBeVisible();
      },
    },
    {
      name: 'colocar',
      enter: async () => {
        await page.locator('[data-testid="mar-castillo-isla"][data-isla="cala"]').click();
        await expect(placing(page)).toBeVisible();
      },
    },
    {
      name: 'ficha',
      enter: async () => {
        await page.keyboard.press('Escape');
        await page.keyboard.press('i');
        await expect(page.getByTestId('mar-castillo-ficha')).toBeVisible();
      },
    },
  ];
  for (const mode of modes) {
    await mode.enter();
    for (const size of HUD_SIZES) {
      await page.setViewportSize(size);
      await page.waitForTimeout(150);
      const where = `${mode.name} ${size.width}×${size.height}`;
      const b = await boxesOf(page);
      expect(b.hud, where).toBeTruthy();
      expect(b.franja, where).toBeTruthy();
      // Dentro de la pantalla.
      for (const id of ['hud', 'franja'] as const) {
        expect(b[id]!.x, `${where} ${id}`).toBeGreaterThanOrEqual(0);
        expect(b[id]!.y, `${where} ${id}`).toBeGreaterThanOrEqual(0);
        expect(b[id]!.x + b[id]!.width, `${where} ${id}`).toBeLessThanOrEqual(size.width + 0.5);
        expect(b[id]!.y + b[id]!.height, `${where} ${id}`).toBeLessThanOrEqual(size.height + 0.5);
      }
      for (const [id, box] of Object.entries(b)) {
        if (id !== 'hud') expect(overlaps(b.hud!, box), `${where}: hud × ${id}`).toBe(false);
        if (id !== 'franja')
          expect(overlaps(b.franja!, box), `${where}: franja × ${id}`).toBe(false);
      }
      for (const t of await touchTargets(page)) {
        expect(Math.min(t.w, t.h), `${where}: ${t.id}`).toBeGreaterThanOrEqual(44);
      }
    }
    await page.setViewportSize(HUD_SIZES[3]);
  }
  expect(errors).toEqual([]);
});

// --- T162: el pop-up antes de la partida, la tarjeta final y las medallas ------------

const previa = (page: Page) => page.getByTestId('mar-castillo-previa');

test('pop-up, tarjeta y medalla: 5 min + Tranquila, se gana con `vencer=1`, la tarjeta con oro y el tablón la enseña', async ({
  page,
}, info) => {
  const touch = info.project.name === 'mobile';
  // `oferta=1`: el panel de la isla del castillo; `vencer=1` espera a «Jugar» del pop-up.
  const errors = await openMar(page, '?minijuego=castillo&oferta=1&vencer=1');
  const panel = page.getByTestId('panel-minijuego');
  await expect(panel).toBeVisible({ timeout: 15_000 });
  await expect(panel).toHaveAttribute('data-game', CASTLE_PLACE_ID);
  await expect(panel).not.toHaveAttribute('data-bloqueado', 'si');
  const play = panel.getByRole('button', { name: t('juego.minigameLayer.jugar') });
  if (touch) await play.tap();
  else await play.click();

  // El pop-up: el foco en la duración marcada; dificultad, medalla y ranking vacío.
  await expect(previa(page)).toBeVisible();
  await expect(panel).toBeHidden();
  await expect(previa(page)).toHaveAttribute('role', 'dialog');
  await expect(page.getByTestId('mar-castillo-duracion')).toBeVisible();
  await expect(page.getByTestId('mar-castillo-previa-ranking-vacio')).toBeVisible();
  await expect(page.getByTestId('mar-castillo-previa-medalla')).toHaveAttribute(
    'data-medalla',
    'ninguna',
  );
  if (touch) {
    await page.getByTestId('mar-castillo-duracion-10').tap();
    await page.getByTestId('mar-castillo-duracion-5').tap();
    await previa(page).getByTestId('mar-canon-dificultad-tranquila').tap();
  } else {
    // Con el teclado: flechas en la duración (5 → 7 → 5) y en la dificultad.
    await expect(page.getByTestId('mar-castillo-duracion-5')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('mar-castillo-duracion-7')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('mar-castillo-duracion-5')).toBeFocused();
    await previa(page).getByTestId('mar-canon-dificultad-normal').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(previa(page).getByTestId('mar-canon-dificultad-tranquila')).toBeFocused();
  }
  await expect(previa(page)).toHaveAttribute('data-duracion', '5');
  await expect(previa(page)).toHaveAttribute('data-dificultad', 'tranquila');
  await expect(page.getByTestId('mar-castillo-previa-ranking')).toHaveAttribute(
    'data-duracion',
    '5',
  );
  // Todo se toca con 44 px y nada se sale de la pantalla.
  const viewport = page.viewportSize()!;
  for (const id of [
    'mar-castillo-duracion-5',
    'mar-castillo-previa-jugar',
    'mar-castillo-previa-cerrar',
  ]) {
    const box = (await page.getByTestId(id).boundingBox())!;
    expect(box.height, id).toBeGreaterThanOrEqual(44);
    expect(box.x + box.width, id).toBeLessThanOrEqual(viewport.width + 0.5);
  }

  // Esc cierra y vuelve el panel de la isla; «Jugar» lo abre otra vez con lo elegido.
  await page.keyboard.press('Escape');
  await expect(previa(page)).toHaveCount(0);
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('mar-menu')).toHaveCount(0);
  if (touch) await play.tap();
  else await play.click();
  await expect(previa(page)).toHaveAttribute('data-duracion', '5');
  await expect(previa(page)).toHaveAttribute('data-dificultad', 'tranquila');

  // «Jugar»: la partida de 5 min en Tranquila; con `vencer=1`, aguanta en un momento.
  const go = page.getByTestId('mar-castillo-previa-jugar');
  if (touch) await go.tap();
  else await go.click();
  await expect(previa(page)).toHaveCount(0);
  await expect(game(page)).toHaveAttribute('data-duracion', '5');
  await expect(game(page)).toHaveAttribute('data-dificultad', 'tranquila');
  const end = page.getByTestId('mar-castillo-final');
  await expect(end).toBeVisible({ timeout: 30_000 });
  await expect(game(page)).toHaveAttribute('data-fin', 'held');

  // La tarjeta: título, medalla, la partida, tiempo, enemigos, vida, puntos; de prueba: sin ranking.
  await expect(end).toHaveAttribute('data-fin', 'held');
  await expect(end.locator('h2')).toHaveText(t('mar.castillo.fin.held'));
  await expect(page.getByTestId('mar-castillo-final-medalla')).toHaveAttribute(
    'data-medalla',
    'oro',
  );
  await expect(page.getByTestId('mar-castillo-final-medalla')).toHaveText(
    t('mar.canon.fin.medalla.oro'),
  );
  await expect(page.getByTestId('mar-castillo-final-partida')).toHaveText(/5 min/);
  await expect(page.getByTestId('mar-castillo-final-vida')).toHaveText(/100/);
  await expect(page.getByTestId('mar-castillo-final-tiempo')).toHaveText(/^\d+:\d\d$/);
  await expect(page.getByTestId('mar-castillo-final-enemigos')).toHaveText(/^\d+$/);
  const points = Number(await page.getByTestId('mar-castillo-final-puntos').textContent());
  expect(points).toBeGreaterThan(0);
  await expect(end).toHaveAttribute('data-puntos', String(points));
  await expect(end).toHaveAttribute('data-ranking', 'no');
  await expect(page.getByTestId('mar-castillo-final-prueba')).toBeVisible();
  // La medalla se guardó: es la mejor de ese par.
  await expect(page.getByTestId('mar-castillo-final-mejor')).toBeVisible();
  await expect(page.getByTestId('mar-castillo-otra')).toBeFocused();
  await expect(page.getByTestId('mar-castillo-anuncio')).toHaveText(t('mar.castillo.fin.held'));
  await page.getByTestId('mar-castillo-volver').click();
  await expect(end).toHaveCount(0);
  await expect(canvas(page)).toHaveAttribute('data-arena', 'off');

  // El pop-up ya enseña la medalla de ese par (y la duración, su icono).
  await page.evaluate(() =>
    window.history.replaceState(null, '', '/mar?minijuego=castillo&oferta=1'),
  );
  await page.reload();
  await expect(page.getByTestId('mar-canvas')).toBeVisible();
  await expect(panel).toBeVisible({ timeout: 60_000 });
  if (touch) await play.tap();
  else await play.click();
  await previa(page).getByTestId('mar-canon-dificultad-tranquila').click();
  await page.getByTestId('mar-castillo-duracion-5').click();
  await expect(page.getByTestId('mar-castillo-previa-medalla')).toHaveAttribute(
    'data-medalla',
    'oro',
  );
  await expect(page.getByTestId('mar-castillo-duracion-5')).toHaveAttribute('data-medalla', 'oro');
  await expect(page.getByTestId('mar-castillo-duracion-7')).not.toHaveAttribute(
    'data-medalla',
    /./,
  );
  await page.getByTestId('mar-castillo-previa-cerrar').click();
  await expect(previa(page)).toHaveCount(0);

  // El «Tablón del faro»: la tarjeta del Castillo, con su mejor medalla.
  await openMar(page, `?ir=${LIGHTHOUSE_PLACE_ID}`);
  await expect(mar(page)).toHaveAttribute('data-llegada', LIGHTHOUSE_PLACE_ID, { timeout: 60_000 });
  const card = page.getByTestId('tablon-castillo');
  await expect(card).toHaveAttribute('data-medalla', 'oro');
  await expect(page.getByTestId('tablon-medalla-castillo')).toBeVisible();
  expect(errors).toEqual([]);
});

test('tarjeta: «Otra vez» empieza otra igual (10 min, Tormenta) y una partida de atajo nunca entra en el ranking', async ({
  page,
}) => {
  const errors = await openMar(
    page,
    '?minijuego=castillo&vencer=1&duracion=10&dificultad=tormenta',
  );
  const end = page.getByTestId('mar-castillo-final');
  await expect(end).toBeVisible({ timeout: 30_000 });
  await expect(end).toHaveAttribute('data-fin', 'held');
  await expect(end).toHaveAttribute('data-ranking', 'no');
  await expect(page.getByTestId('mar-castillo-final-medalla')).toHaveAttribute(
    'data-medalla',
    'oro',
  );
  await expect(page.getByTestId('mar-castillo-final-partida')).toHaveText(/10 min/);
  // El sonido (T164): al acabar suena el final y vuelve el mar.
  await expect(game(page)).toHaveAttribute('data-musica', 'mar', { timeout: 15_000 });

  // «Otra vez» (con Intro, el foco ya está): la misma duración y dificultad, desde el principio.
  await expect(page.getByTestId('mar-castillo-otra')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(end).toHaveCount(0);
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  await expect(game(page)).toHaveAttribute('data-duracion', '10');
  await expect(game(page)).toHaveAttribute('data-dificultad', 'tormenta');
  await expect(canvas(page)).toHaveAttribute('data-arena', 'on');
  // …y vuelve el bucle de batalla.
  await expect(game(page)).toHaveAttribute('data-musica', /batalla|jefe/);
  await expect(end).toBeVisible({ timeout: 30_000 });
  await expect(end).toHaveAttribute('data-ranking', 'no');
  await expect(game(page)).toHaveAttribute('data-musica', 'mar', { timeout: 15_000 });
  // Ya tenía oro en ese par: no es «tu mejor».
  await expect(page.getByTestId('mar-castillo-final-mejor')).toHaveCount(0);
  // Esc en la tarjeta: vuelve al mar.
  await page.keyboard.press('Escape');
  await expect(end).toHaveCount(0);
  await expect(canvas(page)).toHaveAttribute('data-arena', 'off');
  expect(errors).toEqual([]);
});
