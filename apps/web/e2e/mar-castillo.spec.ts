import { DEFENSE_CONFIG, buildDefensePath } from '@boia/engine/defense';
import { CASTLE_PLACE_ID, WORLD_REGISTRY } from '@boia/world';
import { type Page, type TestInfo, expect, test } from '@playwright/test';
import { marWorld } from '../app/mar/engine/compact';
import { arenaFrame, vortexSpot } from '../app/mar/engine/defense-arena';
import { planetRect, wrapIn } from '../app/mar/engine/wrap';
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

  // Salir: el mundo vuelve como estaba.
  await page.getByTestId('mar-castillo-salir').click();
  await expect(game(page)).toHaveAttribute('data-fin', 'quit');
  await expect(canvas(page)).toHaveAttribute('data-arena', 'off');
  await expect(canvas(page)).toHaveAttribute('data-hundido', '0.00', { timeout: 15_000 });
  await expect(canvas(page)).toHaveAttribute('data-ruta', 'on');
  await expect(canvas(page)).not.toHaveAttribute('data-escondido', /./);
  await expect(canvas(page)).not.toHaveAttribute('data-vortice', /./);
  await expect.poll(async () => pins(page).count()).toBeGreaterThan(0);
  await expect(page.getByTestId('mar-castillo-salir')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('arena: con movimiento reducido el mundo se hunde y vuelve de golpe', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = await openMar(page, '?minijuego=castillo&seed=7');
  await expect(canvas(page)).toHaveAttribute('data-arena', 'on');
  await expect(canvas(page)).toHaveAttribute('data-hundido', '1.00', { timeout: 5_000 });
  await page.getByTestId('mar-castillo-salir').click();
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
