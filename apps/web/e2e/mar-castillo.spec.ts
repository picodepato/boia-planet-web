import {
  DEFENSE_CONFIG,
  DEFENSE_PLANE_MAX_LEVEL,
  DEFENSE_TOWER_KINDS,
  buildDefensePath,
  createDefense,
  defenseSiteReason,
  defenseTowerStats,
} from '@boia/engine/defense';
import { CASTLE_PLACE_ID, LIGHTHOUSE_PLACE_ID, WORLD_REGISTRY } from '@boia/world';
import { type Page, type TestInfo, expect, test } from '@playwright/test';
import { marWorld } from '../app/mar/engine/compact';
import { arenaFrame, vortexSpot } from '../app/mar/engine/defense-arena';
import { DEFENSE_OVERLAYS_KEY } from '../app/mar/engine/defense-overlays';
import { planetRect, wrapIn } from '../app/mar/engine/wrap';
import { t } from '../lib/i18n';
import { mar, openMar } from './mar-helpers';
import { CASTLE_BEST_KEY, recordCastleBest } from '../lib/mundo/ranking-castle';
import { CASTLE_ISLAND_IMAGES } from '../lib/mundo/castle-island-images';
import {
  CANONCITO,
  CASTLE_STORM_ACHIEVEMENT,
  CASTLE_VORTEX_ACHIEVEMENT,
  SAMPLE_COSMETICS,
} from '@boia/store';

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

test('arena: rendimiento en `baja` con la arena llena de islas a nivel 3, el Kraken saliendo del vórtice y el sonido', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile', 'se mide una vez, en el teléfono');
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, get: () => 2 });
  });
  // T165: `islas=lleno`, todas las islas que caben (sin tope), a nivel 3; el
  // Kraken (el último boss de la partida de 10 min) sale a su fracción.
  const run = DEFENSE_CONFIG.runs[10];
  const kraken = run.bosses.find((b) => b.kind === 'kraken')!;
  const krakenS = Math.round(kraken.atFrac * run.durationS);
  const errors = await openMar(
    page,
    `?minijuego=castillo&duracion=10&dificultad=tormenta&t=${krakenS - 4}&islas=lleno&seed=7`,
  );
  await expect(game(page)).toHaveAttribute('data-calidad', 'baja');
  const full = Number(await game(page).getAttribute('data-islas'));
  expect(full).toBeGreaterThan(DEFENSE_TOWER_KINDS.length * 4);
  await expect(canvas(page)).toHaveAttribute('data-arena-islas', String(full));
  // El sonido encendido: el primer gesto (una tecla) lo desbloquea.
  await page.keyboard.press('ArrowLeft');
  await expect(game(page)).toHaveAttribute('data-sonido', 'activo', { timeout: 15_000 });
  // El Kraken sale del vórtice (las islas lo reciben en el camino).
  await expect
    .poll(async () => (await canvas(page).getAttribute('data-arena-tipos')) ?? '', {
      timeout: 120_000,
      intervals: [250],
    })
    .toContain('kraken');
  const free = await measureFrames(page, info, 'arena llena, sin limitar la CPU');
  expect(free.p95, 'percentil 95 del tiempo por fotograma (ms)').toBeLessThanOrEqual(
    PERF_P95_MAX_MS,
  );
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await measureFrames(page, info, 'arena llena, CPU 4×');
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

/**
 * En la lista de «Construir», una isla: su detalle (cómo hace daño, plan 015
 * T171) y «Colocar» → la isla que se coloca.
 */
async function chooseIsland(page: Page, kind: string): Promise<void> {
  await page.locator(`[data-testid="mar-castillo-isla"][data-isla="${kind}"]`).click();
  await expect(page.getByTestId('mar-castillo-detalle')).toHaveAttribute('data-isla', kind);
  await page.getByTestId('mar-castillo-detalle-colocar').click();
}

test('construir: cada una de las siete islas, y encima del camino no se puede (rojo con su motivo)', async ({
  page,
}) => {
  const errors = await openMar(
    page,
    '?minijuego=castillo&seed=7&dificultad=tranquila&duracion=10&monedas=3000',
  );
  await expect(hud(page)).toBeVisible();
  await expect(canvas(page)).toHaveAttribute('data-arena-avion', /\d/);

  // Encima del camino: el trozo más cercano a la salida del avión (donde el
  // motivo es el camino, no el castillo ni el vórtice).
  let onPath = { x: 0, y: 0, d: Infinity };
  for (let d = 0; d < path.length; d += 10) {
    const p = path.sampleAt(d);
    if (defenseSiteReason(DEFENSE_CONFIG, path, [], p.x, p.y) !== 'path') continue;
    const dd = Math.hypot(p.x - start.x, p.y - start.y);
    if (dd < onPath.d) onPath = { x: p.x, y: p.y, d: dd };
  }
  await page.getByTestId('mar-castillo-construir').click();
  await expect(page.getByTestId('mar-castillo-islas')).toBeVisible();
  await expect(page.getByTestId('mar-castillo-isla')).toHaveCount(kinds.length);
  // Cada isla con la foto de su modelo (T172), no un icono.
  for (const kind of kinds) {
    const img = page.locator(`[data-testid="mar-castillo-isla"][data-isla="${kind}"] img`);
    await expect(img).toHaveAttribute('src', CASTLE_ISLAND_IMAGES[kind].src);
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);
  }
  await chooseIsland(page, 'faro');
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
    if (i === 0) {
      await page.getByTestId('mar-castillo-construir').click();
      await chooseIsland(page, kind);
    } else {
      await page.keyboard.press('b');
      await expect(page.getByTestId('mar-castillo-islas')).toBeVisible();
      await page.keyboard.press(String(i + 1));
    }
    await expect(placing(page)).toHaveAttribute('data-isla', kind);
    // Si bajo carga el avión se desvió y la confirmación se rechazó, se vuelve a
    // apuntar y se reintenta, esperando al estado y no a un tiempo fijo.
    let before = 0;
    for (let attempt = 0; attempt < 4; attempt++) {
      await flyTo(page, spots[i]!);
      await expect(placing(page)).toHaveAttribute('data-valido', 'si');
      await expect(canvas(page)).toHaveAttribute('data-arena-colocar', 'ok');
      // Las monedas justo antes de confirmar (no antes del vuelo: con la máquina
      // cargada el vuelo es lento y las caídas de mientras suman más que media isla).
      before = await coins(page);
      if (i % 2) await page.keyboard.press('Enter');
      else await page.getByTestId('mar-castillo-colocar-si').click();
      const built = await expect
        .poll(() => islands(page), { timeout: 10_000 })
        .toBe(i + 1)
        .then(
          () => true,
          () => false,
        );
      if (built) break;
    }
    await expect.poll(() => islands(page)).toBe(i + 1);
    await expect(placing(page)).toHaveCount(0);
    // Cobrada (las caídas del segundo de confirmar suman poco).
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
  await chooseIsland(page, 'tienda');
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

  // «Mejoras»: velocidad y daño del avión hasta 5, y la vida del castillo.
  await expect(game(page)).toHaveAttribute('data-avion-nivel', '1');
  await page.getByTestId('mar-castillo-mejoras').click();
  await expect(page.getByTestId('mar-castillo-mejoras-panel')).toBeVisible();
  const upgrade = (id: string) =>
    page.locator(`[data-testid="mar-castillo-mejora"][data-mejora="${id}"]`);
  for (const [id, attr] of [
    ['speed', 'data-avion-velocidad'],
    ['damage', 'data-avion-nivel'],
  ] as const) {
    for (let level = 2; level <= DEFENSE_PLANE_MAX_LEVEL; level++) {
      await upgrade(id).click();
      await expect(game(page)).toHaveAttribute(attr, String(level));
      await expect(upgrade(id)).toHaveAttribute('data-nivel', String(level));
    }
    // En el tope: «Máximo», apagado.
    await expect(upgrade(id)).toHaveAttribute('aria-disabled', 'true');
    await expect(upgrade(id)).toHaveText(t('mar.castillo.mejora.max'));
  }
  const life0 = Number(await game(page).getAttribute('data-vida-max'));
  await upgrade('castle').click();
  await expect(game(page)).toHaveAttribute('data-castillo-nivel', '2');
  await expect(game(page)).toHaveAttribute(
    'data-vida-max',
    String(life0 + DEFENSE_CONFIG.castle.lifePerLevel),
  );
  await expect(page.getByTestId('mar-castillo-vida')).toHaveAttribute(
    'aria-valuemax',
    String(life0 + DEFENSE_CONFIG.castle.lifePerLevel),
  );
  await page.getByTestId('mar-castillo-mejoras-cerrar').click();
  await expect(page.getByTestId('mar-castillo-mejoras-panel')).toHaveCount(0);
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
          Number(el.getAttribute('data-coste')) > have !== (el.getAttribute('data-pobre') === 'si'),
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
      oleada: '[data-testid="mar-castillo-aviso-oleada"]',
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

test('HUD: nada se pisa en 360×640, 390×844, 768×1024 y 1440×900 (reposo, construir, detalle, colocar, ficha, mejoras, aviso de oleada y boss) y todo se toca con 44 px', async ({
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
      name: 'detalle',
      enter: async () => {
        await page.locator('[data-testid="mar-castillo-isla"][data-isla="cala"]').click();
        await expect(page.getByTestId('mar-castillo-detalle')).toBeVisible();
      },
    },
    {
      name: 'colocar',
      enter: async () => {
        await page.getByTestId('mar-castillo-detalle-colocar').click();
        await expect(placing(page)).toBeVisible();
      },
    },
    {
      name: 'ficha',
      enter: async () => {
        await page.keyboard.press('Escape');
        // Una isla que elige blanco: con las cuatro prioridades (la ficha más alta).
        for (let i = 0; i < kinds.length; i++) {
          await page.keyboard.press('i');
          await expect(page.getByTestId('mar-castillo-ficha')).toBeVisible();
          if ((await page.getByTestId('mar-castillo-prioridad').count()) > 0) break;
        }
        await expect(page.getByTestId('mar-castillo-prioridad')).toHaveCount(4);
      },
    },
    {
      name: 'mejoras',
      enter: async () => {
        await page.keyboard.press('Escape');
        await page.getByTestId('mar-castillo-mejoras').click();
        await expect(page.getByTestId('mar-castillo-mejoras-panel')).toBeVisible();
      },
    },
  ];
  for (const mode of modes) {
    await mode.enter();
    // Con el aviso de la oleada siguiente a la vista (sale unos segundos antes de cada una).
    await expect(page.getByTestId('mar-castillo-aviso-oleada')).toBeVisible({ timeout: 30_000 });
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
        for (const own of ['hud', 'franja', 'oleada'] as const) {
          if (id === own || !b[own]) continue;
          // El aviso de la oleada y el del boss van apilados bajo el HUD (no se pisan por el hueco).
          expect(overlaps(b[own]!, box), `${where}: ${own} × ${id}`).toBe(false);
        }
      }
      for (const t of await touchTargets(page)) {
        expect(Math.min(t.w, t.h), `${where}: ${t.id}`).toBeGreaterThanOrEqual(44);
      }
    }
    await page.setViewportSize(HUD_SIZES[3]);
  }
  expect(errors).toEqual([]);
});

// --- Plan 015 T170: zoom, toques, alcance, barras de vida, números de daño y nubes ---

const arenaZoom = async (page: Page) => Number(await canvas(page).getAttribute('data-arena-zoom'));

/** Toca la pantalla en `p` (px de la página): con el dedo en el móvil, con el ratón en escritorio. */
async function tapScreen(page: Page, p: { x: number; y: number }): Promise<void> {
  if (test.info().project.name === 'mobile') await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
}

/** Un punto de la pantalla donde sólo está el lienzo (nada del HUD encima), lejos de las islas. */
async function freeSea(page: Page): Promise<{ x: number; y: number }> {
  const vp = page.viewportSize()!;
  const spots = ((await canvas(page).getAttribute('data-arena-islas-pantalla')) ?? '')
    .split(' ')
    .filter(Boolean)
    .map((s) => pointOf(s.split(':')[1]!));
  const tries = [
    [0.08, 0.5],
    [0.92, 0.5],
    [0.08, 0.35],
    [0.92, 0.35],
    [0.3, 0.6],
    [0.7, 0.6],
    [0.5, 0.3],
  ] as const;
  for (const [fx, fy] of tries) {
    const p = { x: Math.round(vp.width * fx), y: Math.round(vp.height * fy) };
    if (spots.some((s) => Math.hypot(s.x - p.x, s.y - p.y) < 60)) continue;
    const free = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('data-testid') === 'mar-canvas',
      p,
    );
    if (free) return p;
  }
  throw new Error('no hay mar libre en la pantalla');
}

test('zoom: en la arena se acerca con el carril, la rueda y las teclas, nunca más abierto que la vista de salida; «Construir» vuelve a ella', async ({
  page,
}) => {
  const errors = await openMar(page, '?minijuego=castillo&seed=7&dificultad=tranquila');
  await expect(hud(page)).toBeVisible();
  await expect(canvas(page)).toHaveAttribute('data-arena-zoom', '1.00');
  // El carril del zoom se ve en la arena (T161 lo escondía).
  const rail = page.locator('.mar-rail');
  await expect(rail).toBeVisible();
  // Alejar desde la vista de salida no hace nada.
  await rail.getByRole('button', { name: t('mar.client.alejar') }).click();
  await page.keyboard.press('-');
  await page.waitForTimeout(400);
  expect(await arenaZoom(page)).toBe(1);
  // El carril y las teclas acercan.
  await rail.getByRole('button', { name: t('mar.client.acercar') }).click();
  await expect.poll(() => arenaZoom(page)).toBeLessThan(0.95);
  await page.keyboard.press('+');
  await page.keyboard.press('+');
  await expect.poll(() => arenaZoom(page)).toBeLessThan(0.7);
  // La rueda: hacia fuera, hasta la vista de salida y no más.
  const vp = page.viewportSize()!;
  await page.mouse.move(vp.width / 2, vp.height / 2);
  await page.mouse.wheel(0, 3000);
  await expect.poll(() => arenaZoom(page)).toBe(1);
  await page.mouse.wheel(0, -400);
  await expect.poll(() => arenaZoom(page)).toBeLessThan(0.9);
  for (let i = 0; i < 8; i++) await page.keyboard.press('+');
  await expect.poll(() => arenaZoom(page)).toBe(0);
  await expect(canvas(page)).toHaveAttribute('data-castillo-vista', 'si');
  // «Construir»: la vista de salida.
  await page.getByTestId('mar-castillo-construir').click();
  await expect(page.getByTestId('mar-castillo-islas')).toBeVisible();
  await expect.poll(() => arenaZoom(page)).toBe(1);
  // Con la lista abierta el zoom sigue: se acerca y ahí se queda.
  await page.keyboard.press('+');
  await expect.poll(() => arenaZoom(page)).toBeLessThan(1);
  expect(errors).toEqual([]);
});

test('tap: el mar manda el avión allí (acotado a la arena), una isla se elige y, construyendo, la vista previa va donde se toca con su alcance', async ({
  page,
}) => {
  const errors = await openMar(
    page,
    '?minijuego=castillo&seed=7&dificultad=tranquila&islas=1&monedas=2000',
  );
  await expect(hud(page)).toBeVisible();
  await expect(canvas(page)).toHaveAttribute('data-arena-islas-pantalla', /\d/);
  await expect(canvas(page)).toHaveAttribute('data-hundido', '1.00', { timeout: 15_000 });
  const R = DEFENSE_CONFIG.arenaRadius;

  // El mar: el avión vuela allí (si se toca fuera de la arena, a su borde).
  const sea = await freeSea(page);
  await tapScreen(page, sea);
  await expect(canvas(page)).toHaveAttribute('data-arena-toque-tipo', 'move');
  await expect(canvas(page)).toHaveAttribute('data-arena-destino', /\d/);
  const touched = pointOf(await canvas(page).getAttribute('data-arena-toque'));
  const to = pointOf(await canvas(page).getAttribute('data-arena-destino'));
  expect(Math.hypot(to.x, to.y)).toBeLessThanOrEqual(R + 1);
  if (Math.hypot(touched.x, touched.y) > R) expect(Math.hypot(to.x, to.y)).toBeGreaterThan(R - 2);
  else expect(Math.hypot(to.x - touched.x, to.y - touched.y)).toBeLessThan(2);
  const d0 = Math.hypot(to.x - start.x, to.y - start.y);
  await expect
    .poll(async () => {
      const p = await planeAt(page);
      return Math.hypot(to.x - p.x, to.y - p.y);
    })
    .toBeLessThan(d0 / 2);

  // Una isla: se elige (su ficha).
  const box = (await canvas(page).boundingBox())!;
  let at: { x: number; y: number } | null = null;
  await expect
    .poll(async () => {
      const spots = ((await canvas(page).getAttribute('data-arena-islas-pantalla')) ?? '').split(
        ' ',
      );
      for (const s of spots) {
        const m = s.match(/^\d+:(-?\d+),(-?\d+)/);
        if (!m) continue;
        const p = { x: box.x + Number(m[1]), y: box.y + Number(m[2]) };
        const free = await page.evaluate(
          ({ x, y }) =>
            document.elementFromPoint(x, y)?.getAttribute('data-testid') === 'mar-canvas',
          p,
        );
        if (free) {
          at = p;
          return true;
        }
      }
      return false;
    })
    .toBe(true);
  await tapScreen(page, at as unknown as { x: number; y: number });
  await expect(canvas(page)).toHaveAttribute('data-arena-toque-tipo', 'select');
  await expect(page.getByTestId('mar-castillo-ficha')).toBeVisible();
  await expect(canvas(page)).toHaveAttribute('data-arena-elegida', 'si');
  // Su alcance, a su nivel (3).
  const chosen = await page.getByTestId('mar-castillo-ficha').getAttribute('data-isla');
  const kind = kinds.find((k) => k === chosen)!;
  const chosenRange = defenseTowerStats(DEFENSE_CONFIG, kind, 3).range;
  if (chosenRange > 0)
    await expect(canvas(page)).toHaveAttribute('data-arena-alcance', String(chosenRange));
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('mar-castillo-ficha')).toHaveCount(0);

  // Construyendo: el toque deja ahí la vista previa, con el alcance de la isla (nivel 1).
  await page.getByTestId('mar-castillo-construir').click();
  await chooseIsland(page, 'cala');
  await expect(placing(page)).toHaveAttribute('data-isla', 'cala');
  const destino = await canvas(page).getAttribute('data-arena-destino');
  const here = await freeSea(page);
  await tapScreen(page, here);
  await expect(canvas(page)).toHaveAttribute('data-arena-toque-tipo', 'place');
  await expect(canvas(page)).toHaveAttribute('data-arena-colocar', /^(ok|no)$/);
  await expect(canvas(page)).toHaveAttribute(
    'data-arena-alcance',
    String(defenseTowerStats(DEFENSE_CONFIG, 'cala', 1).range),
  );
  // Roja con el motivo de la partida, o verde.
  const ok = (await canvas(page).getAttribute('data-arena-colocar')) === 'ok';
  if (!ok) await expect(canvas(page)).toHaveAttribute('data-arena-motivo', /\w/);
  await expect(placing(page)).toHaveAttribute('data-valido', ok ? 'si' : 'no');
  // El avión no cambia de rumbo por colocar.
  expect(await canvas(page).getAttribute('data-arena-destino')).toBe(destino);
  expect(errors).toEqual([]);
});

test('arena: barras de vida y números de daño encendidos al principio; apagados (guardado en el dispositivo), ninguno; nubes encima', async ({
  page,
}) => {
  const q = '?minijuego=castillo&seed=7&dificultad=tranquila&islas=1&t=150';
  let errors = await openMar(page, q);
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  await expect
    .poll(async () => Number(await canvas(page).getAttribute('data-arena-barras')), {
      timeout: 30_000,
    })
    .toBeGreaterThan(0);
  await expect
    .poll(async () => Number(await canvas(page).getAttribute('data-arena-numeros')), {
      timeout: 30_000,
    })
    .toBeGreaterThan(0);
  await expect(canvas(page)).toHaveAttribute('data-arena-nubes', 'si');
  expect(errors).toEqual([]);

  // Apagadas en las opciones (lo guardado en el dispositivo): ninguna, aunque caigan enemigos.
  await page.addInitScript(
    ([key]) => window.localStorage.setItem(key!, JSON.stringify({ bars: false, numbers: false })),
    [DEFENSE_OVERLAYS_KEY],
  );
  errors = await openMar(page, q);
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  const kills = Number(await game(page).getAttribute('data-derrotados'));
  const seen = { bars: 0, numbers: 0 };
  await expect
    .poll(
      async () => {
        seen.bars = Math.max(
          seen.bars,
          Number(await canvas(page).getAttribute('data-arena-barras')),
        );
        seen.numbers = Math.max(
          seen.numbers,
          Number(await canvas(page).getAttribute('data-arena-numeros')),
        );
        return Number(await game(page).getAttribute('data-derrotados'));
      },
      { timeout: 30_000 },
    )
    .toBeGreaterThan(kills + 2);
  expect(seen).toEqual({ bars: 0, numbers: 0 });
  // Plan 015 T178: lo que paga Ibiza salta siempre («+N» y una moneda), con los números apagados.
  await expect
    .poll(async () => Number(await canvas(page).getAttribute('data-arena-monedas')), {
      timeout: 30_000,
    })
    .toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

// --- Plan 015 T171: el HUD v2 (construir en cualquier sitio, prioridad, oleadas, ×2, opciones) ---

/** Puntos de la pantalla (px de la página) donde sólo está el lienzo, de arriba abajo. */
async function seaGrid(page: Page): Promise<{ x: number; y: number }[]> {
  const vp = page.viewportSize()!;
  const out: { x: number; y: number }[] = [];
  for (let fy = 0.3; fy <= 0.72; fy += 0.07) {
    for (let fx = 0.12; fx <= 0.88; fx += 0.12) {
      const p = { x: Math.round(vp.width * fx), y: Math.round(vp.height * fy) };
      const free = await page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('data-testid') === 'mar-canvas',
        p,
      );
      if (free) out.push(p);
    }
  }
  return out;
}

test('construir: en cualquier sitio de la arena tocando el agua e «Instalar isla»; mejorar: a quién apunta la isla', async ({
  page,
}) => {
  const errors = await openMar(
    page,
    '?minijuego=castillo&seed=7&dificultad=tranquila&duracion=10&monedas=3000',
  );
  await expect(hud(page)).toBeVisible();
  await expect(canvas(page)).toHaveAttribute('data-hundido', '1.00', { timeout: 15_000 });

  // El detalle: cómo hace daño, con los números de nivel 1, y la tabla por niveles.
  await page.getByTestId('mar-castillo-construir').click();
  await page.locator('[data-testid="mar-castillo-isla"][data-isla="fotos"]').click();
  const detail = page.getByTestId('mar-castillo-detalle');
  await expect(detail).toHaveAttribute('data-isla', 'fotos');
  await expect(page.getByTestId('mar-castillo-detalle-texto')).toContainText(
    String(defenseTowerStats(DEFENSE_CONFIG, 'fotos', 1).range),
  );
  await expect(
    page.locator('[data-testid="mar-castillo-detalle-tabla"] tbody tr[data-dato="alcance"] td'),
  ).toHaveText(DEFENSE_CONFIG.towers.kinds.fotos.levels.map((l) => String(l.range)));
  // Volver a la lista y otra vez: «Colocar».
  await page.getByTestId('mar-castillo-detalle-atras').click();
  await expect(page.getByTestId('mar-castillo-islas')).toBeVisible();
  await chooseIsland(page, 'fotos');
  await expect(placing(page)).toHaveAttribute('data-isla', 'fotos');
  await expect(page.getByTestId('mar-castillo-colocar-si')).toHaveText(
    new RegExp(t('mar.castillo.colocar.si')),
  );

  // Un toque en el agua deja ahí la isla (lejos del avión: en cualquier sitio), verde o roja.
  const box = (await canvas(page).boundingBox())!;
  let spot: { x: number; y: number } | null = null;
  for (const p of await seaGrid(page)) {
    await tapScreen(page, p);
    await expect(canvas(page)).toHaveAttribute('data-arena-toque-tipo', 'place');
    const ok = await expect(placing(page))
      .toHaveAttribute('data-valido', 'si', { timeout: 1500 })
      .then(
        () => true,
        () => false,
      );
    if (ok) {
      spot = p;
      break;
    }
  }
  expect(spot, 'un sitio libre en la pantalla').not.toBeNull();
  const at = spot!;
  const tapped = pointOf(await canvas(page).getAttribute('data-arena-toque'));
  // La isla se queda donde se tocó aunque el avión siga volando.
  await page.waitForTimeout(600);
  await expect(placing(page)).toHaveAttribute('data-valido', 'si');
  const before = await coins(page);
  await page.getByTestId('mar-castillo-colocar-si').click();
  await expect.poll(() => islands(page)).toBe(1);
  await expect(placing(page)).toHaveCount(0);
  expect(await coins(page)).toBeLessThan(before - DEFENSE_CONFIG.towers.kinds.fotos.cost / 2);
  // Construida en el sitio tocado (en la pantalla, donde se tocó).
  await expect
    .poll(async () => {
      const s = (await canvas(page).getAttribute('data-arena-islas-pantalla')) ?? '';
      const m = s.match(/^\d+:(-?\d+),(-?\d+)/);
      return m ? Math.hypot(box.x + Number(m[1]) - at.x, box.y + Number(m[2]) - at.y) : Infinity;
    })
    .toBeLessThan(40);
  expect(Math.hypot(tapped.x, tapped.y)).toBeLessThanOrEqual(DEFENSE_CONFIG.arenaRadius);

  // Tocarla: su ficha, con «Apunta a» y la de Benidorm por defecto (el más fuerte).
  await tapScreen(page, at);
  const card = page.getByTestId('mar-castillo-ficha');
  await expect(card).toHaveAttribute('data-isla', 'fotos');
  await expect(card).toHaveAttribute('data-prioridad', DEFENSE_CONFIG.towers.kinds.fotos.priority!);
  await expect(page.getByTestId('mar-castillo-prioridad')).toHaveCount(4);
  await expect(
    page.locator('[data-testid="mar-castillo-prioridad"][aria-pressed="true"]'),
  ).toHaveAttribute('data-prioridad', 'strongest');
  // Cambiarla: el más cercano.
  await page.locator('[data-testid="mar-castillo-prioridad"][data-prioridad="closest"]').click();
  await expect(card).toHaveAttribute('data-prioridad', 'closest');
  await expect(
    page.locator('[data-testid="mar-castillo-prioridad"][data-prioridad="closest"]'),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('mar-castillo-ficha-cerrar').click();
  await expect(card).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('oleada: el aviso dice qué viene (y se lee en voz alta), «Llamar oleada» la adelanta con su premio, ×2 acelera y la pausa apaga barras y números (guardado)', async ({
  page,
}) => {
  const q = '?minijuego=castillo&seed=7&dificultad=tranquila&duracion=5';
  let errors = await openMar(page, q);
  await expect(hud(page)).toBeVisible();

  // El aviso de la primera oleada, antes de que empiece, y su anuncio.
  const warn = page.getByTestId('mar-castillo-aviso-oleada');
  await expect(warn).toHaveAttribute('data-oleada', '1', { timeout: 15_000 });
  await expect(warn).toContainText('×');
  await expect(page.getByTestId('mar-castillo-anuncio')).toHaveText(/oleada 1 llega/i);
  await expect(page.getByTestId('mar-castillo-oleada')).toHaveAttribute('data-oleada', '1', {
    timeout: 30_000,
  });

  // «Llamar oleada»: la siguiente sale ya y paga su premio.
  const call = page.getByTestId('mar-castillo-llamar');
  await expect(call).toHaveAttribute('data-oleada', '2');
  await expect.poll(async () => Number(await call.getAttribute('data-bono'))).toBeGreaterThan(2);
  const bonus = Number(await call.getAttribute('data-bono'));
  const before = await coins(page);
  await call.click();
  await expect(page.getByTestId('mar-castillo-oleada')).toHaveAttribute('data-oleada', '2');
  await expect
    .poll(async () => Number(await game(page).getAttribute('data-adelanto')))
    .toBeGreaterThan(0);
  expect(await coins(page)).toBeGreaterThanOrEqual(before + bonus - 1);
  await expect(call).toHaveAttribute('data-oleada', '3');

  // ×2: el tiempo de partida corre el doble (se compara con ×1 en la misma máquina).
  const speed = page.getByTestId('mar-castillo-velocidad');
  await expect(speed).toHaveAttribute('aria-pressed', 'false');
  const rate = async () => {
    const a = Number(await game(page).getAttribute('data-activo'));
    const t0 = Date.now();
    await page.waitForTimeout(2500);
    const b = Number(await game(page).getAttribute('data-activo'));
    return (b - a) / ((Date.now() - t0) / 1000);
  };
  const r1 = await rate();
  await speed.click();
  await expect(speed).toHaveAttribute('aria-pressed', 'true');
  await expect(game(page)).toHaveAttribute('data-escala', '2');
  const r2 = await rate();
  expect(r2).toBeGreaterThan(r1 * 1.4);
  // La X lo devuelve a ×1.
  await page.keyboard.press('x');
  await expect(game(page)).toHaveAttribute('data-escala', '1');
  await expect(speed).toHaveAttribute('aria-pressed', 'false');

  // La pausa: barras de vida y números de daño, encendidos; se apagan y se guarda.
  await page.getByTestId('mar-castillo-pausa').click();
  await expect(page.getByTestId('mar-menu')).toBeVisible();
  const bars = page.getByTestId('mar-castillo-opcion-barras');
  const numbers = page.getByTestId('mar-castillo-opcion-numeros');
  await expect(bars).toHaveAttribute('aria-checked', 'true');
  await expect(numbers).toHaveAttribute('aria-checked', 'true');
  await bars.click();
  await numbers.click();
  await expect(bars).toHaveAttribute('aria-checked', 'false');
  await expect(numbers).toHaveAttribute('aria-checked', 'false');
  expect(
    JSON.parse((await page.evaluate((k) => localStorage.getItem(k), DEFENSE_OVERLAYS_KEY)) ?? '{}'),
  ).toEqual({ bars: false, numbers: false });
  await page.getByTestId('mar-menu-seguir').click();
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  await expect(canvas(page)).toHaveAttribute('data-arena-barras', '0');
  await expect(canvas(page)).toHaveAttribute('data-arena-numeros', '0');
  expect(errors).toEqual([]);

  // Otra partida en el mismo dispositivo: siguen apagados; se vuelven a encender.
  errors = await openMar(page, q);
  await expect(hud(page)).toBeVisible();
  await page.getByTestId('mar-castillo-pausa').click();
  await expect(bars).toHaveAttribute('aria-checked', 'false');
  await bars.click();
  await numbers.click();
  await expect(bars).toHaveAttribute('aria-checked', 'true');
  expect(
    JSON.parse((await page.evaluate((k) => localStorage.getItem(k), DEFENSE_OVERLAYS_KEY)) ?? '{}'),
  ).toEqual({ bars: true, numbers: true });
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

  // El pop-up: el foco en la duración marcada; dificultad, medalla y ranking local.
  await expect(previa(page)).toBeVisible();
  await expect(panel).toBeHidden();
  await expect(previa(page)).toHaveAttribute('role', 'dialog');
  await expect(page.getByTestId('mar-castillo-duracion')).toBeVisible();
  await expect(page.getByTestId('mar-castillo-ranking')).toHaveAttribute('data-ranking', 'local');
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
  // La primera partida pregunta por la guía (T173): sin ella.
  const noGuide = page.getByTestId('mar-castillo-guia-no');
  if (touch) await noGuide.tap();
  else await noGuide.click();
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
  // El tablón sale cerrado (plan 015 T168): la medalla se ve al desplegarlo.
  await page.getByTestId('mar-ficha-mas').click();
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

// T163: muestra y mejor propio por duración × dificultad, sin excepciones para atajos.
test('ranking local: muestra + puntuación propia, nueve tablas y atajo/Terminar partida no cambian el récord', async ({
  page,
}) => {
  // Se juega la sim completa, sin startAtS ni unranked, y se precarga su récord.
  // El navegador usa atajos para abrir la isla y acabar rápido; ésos jamás puntúan.
  const sim = createDefense(DEFENSE_CONFIG, 7);
  while (!sim.result()) sim.step();
  const result = sim.result()!;
  let saved = '';
  recordCastleBest(
    {
      getItem: () => null,
      setItem: (_key, value) => {
        saved = value;
      },
    },
    result,
    '2026-10-06T00:00:00Z',
  );
  expect(saved).not.toBe('');
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: CASTLE_BEST_KEY,
    value: saved,
  });
  const errors = await openMar(page, '?minijuego=castillo&oferta=1&vencer=1');
  const panel = page.getByTestId('panel-minijuego');
  await panel.getByRole('button', { name: t('juego.minigameLayer.jugar') }).click();
  await expect(previa(page)).toBeVisible();
  const ranking = page.getByTestId('mar-castillo-ranking');
  const mine = page.locator('[data-testid="mar-castillo-ranking-fila"][data-mio="si"]');
  for (const min of [5, 7, 10])
    for (const diff of ['tranquila', 'normal', 'tormenta']) {
      await page.getByTestId(`mar-castillo-duracion-${min}`).click();
      await previa(page).getByTestId(`mar-canon-dificultad-${diff}`).click();
      await expect(ranking).toHaveAttribute('data-ranking', 'local');
      const table = page.getByTestId('mar-castillo-ranking-tabla');
      await expect(table).toHaveAttribute('data-duracion', String(min));
      await expect(table).toHaveAttribute('data-dificultad', diff);
      await expect(page.getByTestId('mar-castillo-ranking-fila')).toHaveCount(4);
      if (min === 5 && diff === 'normal') {
        await expect(mine).toHaveAttribute('data-puntos', String(result.score));
        await expect(mine).toHaveAttribute('data-puesto', /[1-4]/);
        await expect(mine).toContainText(t('mar.castillo.ranking.tu'));
      } else {
        await expect(mine).not.toHaveAttribute('data-puntos');
        await expect(mine).toContainText(t('mar.castillo.ranking.tu.sin'));
      }
    }
  await page.getByTestId('mar-castillo-duracion-5').click();
  await previa(page).getByTestId('mar-canon-dificultad-normal').click();
  await page.getByTestId('mar-castillo-previa-jugar').click();
  // La primera partida pregunta por la guía (T173): sin ella.
  await page.getByTestId('mar-castillo-guia-no').click();
  const endRank = page.getByTestId('mar-castillo-final-ranking');
  await expect(endRank).toHaveAttribute('data-ranking', 'off', { timeout: 30000 });
  await expect(endRank).toHaveAttribute('data-motivo', 'test');
  await expect(endRank).toHaveAttribute('data-mejor', String(result.score));
  expect(await page.evaluate((key) => localStorage.getItem(key), CASTLE_BEST_KEY)).toBe(saved);
  await page.getByTestId('mar-castillo-volver').click();
  // Recargar con otra partida de atajo, esta vez terminada desde la pausa.
  await openMar(page, '?minijuego=castillo&duracion=5');
  await page.getByTestId('mar-castillo-pausa').click();
  await page.getByTestId('mar-menu-terminar').click();
  await page.getByTestId('mar-menu-terminar-si').click();
  await expect(endRank).toHaveAttribute('data-motivo', 'quit');
  expect(await page.evaluate((key) => localStorage.getItem(key), CASTLE_BEST_KEY)).toBe(saved);
  expect(errors).toEqual([]);
});

/**
 * Plan 015 T176 (decisión 16): ganar en Tormenta completa su logro y la
 * tarjeta final dice que desbloquea el Cañoncito (5 min: el del vórtice no);
 * reclamado en «Logros», el Cañoncito es tuyo en Mi Barco. Con `vencer=1`:
 * en las e2e los atajos dan premio (como la medalla).
 */
test('logro y mascota: ganar en Tormenta desbloquea el Cañoncito; reclamado, es tuyo en Mi Barco', async ({
  page,
}) => {
  const errors = await openMar(page, '?minijuego=castillo&vencer=1&duracion=5&dificultad=tormenta');
  const end = page.getByTestId('mar-castillo-final');
  await expect(end).toBeVisible({ timeout: 30_000 });
  await expect(end).toHaveAttribute('data-fin', 'held');
  const unlocked = page.getByTestId('mar-castillo-final-logros');
  const storm = unlocked.locator(`[data-logro="${CASTLE_STORM_ACHIEVEMENT}"]`);
  const name = SAMPLE_COSMETICS.find((c) => c.id === CANONCITO)!.name;
  await expect(storm).toContainText(name);
  await expect(unlocked.locator(`[data-logro="${CASTLE_VORTEX_ACHIEVEMENT}"]`)).toHaveCount(0);
  await page.getByTestId('mar-castillo-volver').click();
  await expect(end).toHaveCount(0);

  // «Logros»: listo para reclamar; reclamarlo da la mascota.
  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-menu-logros').click();
  const panel = page.getByTestId('mar-logros-panel');
  const row = panel.getByTestId(`logro-${CASTLE_STORM_ACHIEVEMENT}`);
  await expect(row).toHaveAttribute('data-estado', 'ready');
  await panel.getByTestId(`logro-reclamar-${CASTLE_STORM_ACHIEVEMENT}`).click();
  await expect(row).toHaveAttribute('data-estado', 'claimed');
  await expect(panel.getByTestId(`logro-${CASTLE_VORTEX_ACHIEVEMENT}`)).toHaveAttribute(
    'data-estado',
    'in_progress',
  );
  await page.getByTestId('mar-logros-cerrar').click();
  await expect(panel).toHaveCount(0);

  // Mi Barco: el Cañoncito ya no está bloqueado y se equipa.
  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-barco').click();
  const shop = page.getByTestId('mar-tienda').getByTestId('barco');
  const option = shop.getByTestId(`barco-mascota-${CANONCITO}`);
  await expect(option).not.toHaveAttribute('data-bloqueado', 'si');
  await option.click();
  await expect(option).toHaveAttribute('aria-checked', 'true');
  expect(errors).toEqual([]);
});

/**
 * Plan 015 T173 (decisión 14): la primera partida pregunta «¿Empezar con la
 * guía?»; con «Sí», bocadillos sobre la partida de verdad que pasan haciendo
 * lo que piden (mover el avión, «Construir», elegir y colocar una isla) o
 * con su ✕ (y sale el siguiente); «Saltar guía» la acaba y la partida sigue
 * igual. Respondida, la segunda partida (también tras recargar) no pregunta
 * y el pop-up deja repetirla con «Con la guía».
 */
test('guía: la primera partida pregunta; «Sí» lleva los pasos (haciendo y con la ✕); «Saltar guía» vuelve al juego normal; la segunda no pregunta', async ({
  page,
}) => {
  const errors = await openMar(page, '?minijuego=castillo&oferta=1&seed=7&dificultad=tranquila');
  const panel = page.getByTestId('panel-minijuego');
  const playIsland = panel.getByRole('button', { name: t('juego.minigameLayer.jugar') });
  await playIsland.click();
  await expect(previa(page)).toBeVisible();
  // Antes de responder no hay «Con la guía».
  await expect(page.getByTestId('mar-castillo-previa-guia')).toHaveCount(0);
  await page.getByTestId('mar-castillo-previa-jugar').click();
  const question = page.getByTestId('mar-castillo-guia-pregunta');
  await expect(question).toBeVisible();
  await expect(question).toContainText(t('mar.castillo.guia.pregunta'));
  await expect(question).toHaveAttribute('role', 'dialog');
  for (const id of ['mar-castillo-guia-si', 'mar-castillo-guia-no']) {
    const box = (await page.getByTestId(id).boundingBox())!;
    expect(box.height, id).toBeGreaterThanOrEqual(44);
  }
  await page.getByTestId('mar-castillo-guia-si').click();
  await expect(question).toHaveCount(0);
  await expect(game(page)).toHaveAttribute('data-guia', 'si');
  await expect(hud(page)).toBeVisible();
  await expect(canvas(page)).toHaveAttribute('data-hundido', '1.00', { timeout: 15_000 });

  const guide = page.getByTestId('mar-castillo-guia');
  const bubble = page.getByTestId('mar-castillo-guia-bocadillo');
  const skip = page.getByTestId('mar-castillo-guia-saltar');
  await expect(skip).toBeVisible();
  await expect(skip).toHaveText(t('mar.castillo.guia.saltar'));

  // 1. Mover el avión tocando el mar: el bocadillo flota solo (es el mar entero).
  await expect(guide).toHaveAttribute('data-paso', 'mover');
  await expect(bubble).toContainText(t('mar.castillo.guia.mover'));
  await expect(bubble).toHaveAttribute('data-lado', 'free');
  await tapScreen(page, await freeSea(page));
  // 2. «Construir»: el bocadillo apunta al botón, encima.
  await expect(guide).toHaveAttribute('data-paso', 'construir', { timeout: 10_000 });
  await expect(bubble).toContainText(t('mar.castillo.guia.construir'));
  await expect(bubble).toHaveAttribute('data-lado', 'above');
  const build = (await page.getByTestId('mar-castillo-construir').boundingBox())!;
  await expect
    .poll(async () => {
      const b = (await bubble.boundingBox())!;
      return b.y + b.height <= build.y && b.x <= build.x + build.width && b.x + b.width >= build.x;
    })
    .toBe(true);
  await page.getByTestId('mar-castillo-construir').click();
  // 3. Elegir una isla: se cierra con la ✕ y sale el siguiente (colocar).
  await expect(guide).toHaveAttribute('data-paso', 'elegir');
  await expect(bubble).toContainText(t('mar.castillo.guia.elegir'));
  const x = page.getByTestId('mar-castillo-guia-cerrar');
  // La ✕ se toca con 44 px (tras la entrada del bocadillo, que crece un poco).
  await expect.poll(async () => (await x.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await x.click();
  await expect(guide).toHaveAttribute('data-paso', 'colocar');
  await expect(bubble).toContainText(t('mar.castillo.guia.colocar'));
  // La partida no se para con la guía.
  const t0 = Number(await game(page).getAttribute('data-tiempo'));
  await expect.poll(async () => Number(await game(page).getAttribute('data-tiempo'))).toBeLessThan(t0);
  // 4. Colocar la isla (la más barata, «fotos»): pasa a «Instalar isla».
  await page.locator('[data-testid="mar-castillo-isla"][data-isla="fotos"]').click();
  await page.getByTestId('mar-castillo-detalle-colocar').click();
  await expect(placing(page)).toBeVisible();
  await expect(guide).toHaveAttribute('data-paso', 'instalar');
  await expect(bubble).toContainText(t('mar.castillo.guia.instalar'));
  // 5. La ✕ otra vez: el siguiente (la ficha de la isla).
  await page.getByTestId('mar-castillo-guia-cerrar').click();
  await expect(guide).toHaveAttribute('data-paso', 'ficha');

  // «Saltar guía»: se acaba y la partida sigue normal (colocando, construir, el HUD).
  await skip.click();
  await expect(guide).toHaveCount(0);
  await expect(game(page)).toHaveAttribute('data-guia', 'no');
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  await page.getByTestId('mar-castillo-colocar-no').click();
  await page.getByTestId('mar-castillo-construir').click();
  await expect(page.getByTestId('mar-castillo-islas')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('mar-castillo-franja')).toHaveAttribute('data-modo', 'idle');
  await page.waitForTimeout(600);
  await expect(guide).toHaveCount(0);
  await quitAndLeave(page);

  // La segunda partida (tras recargar: guardado) no pregunta y va sin guía.
  await openMar(page, '?minijuego=castillo&oferta=1&seed=7&dificultad=tranquila');
  await expect(panel).toBeVisible({ timeout: 15_000 });
  await playIsland.click();
  await expect(previa(page)).toBeVisible();
  const replay = page.getByTestId('mar-castillo-previa-guia');
  await expect(replay).toHaveAttribute('aria-checked', 'false');
  await page.getByTestId('mar-castillo-previa-jugar').click();
  await expect(question).toHaveCount(0);
  await expect(previa(page)).toHaveCount(0);
  await expect(game(page)).toHaveAttribute('data-guia', 'no');
  await expect(hud(page)).toBeVisible();
  await expect(guide).toHaveCount(0);
  await quitAndLeave(page);

  // Repetirla desde el pop-up: «Con la guía» y «Jugar».
  await openMar(page, '?minijuego=castillo&oferta=1&seed=7&dificultad=tranquila');
  await expect(panel).toBeVisible({ timeout: 15_000 });
  await playIsland.click();
  await replay.click();
  await expect(replay).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('mar-castillo-previa-jugar').click();
  await expect(question).toHaveCount(0);
  await expect(game(page)).toHaveAttribute('data-guia', 'si');
  await expect(guide).toHaveAttribute('data-paso', 'mover');
  expect(errors).toEqual([]);
});
