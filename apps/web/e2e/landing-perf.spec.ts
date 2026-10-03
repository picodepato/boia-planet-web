import { expect, test, type Page } from '@playwright/test';

/**
 * Performance of the scroll landing (plan 007 T80). At 375×812 with the CPU
 * throttled 4× (CDP), a scripted 6 s scroll from the hero to the footer:
 * the 95th percentile of the frame time (rAF intervals) stays ≤ 50 ms and
 * no long task over 200 ms runs once the scene is ready. The reduced-motion
 * and low-power paths (`deviceMemory ≤ 2`, `hardwareConcurrency ≤ 4`,
 * `saveData`; D-26) get the static version and create no WebGL context. On a
 * portrait phone with DPR 2 the static version loads the 1600 px still
 * (T85: `sizes` follows the `object-fit: cover` crop, not just the width).
 *
 * The numbers go to the test's annotations and to stdout (`[perf] …`), for
 * ESTADO. Frame times are noisy while other suites load the machine.
 */

test.describe.configure({ timeout: 180_000 });

const VIEW = { width: 375, height: 812 };
const THROTTLE = 4;
const SCROLL_MS = 6000;
const P95_MAX_MS = 50;
const LONG_TASK_MAX_MS = 200;

/** Counts WebGL contexts and records long tasks, from before the first script. */
async function instrument(page: Page) {
  await page.addInitScript(() => {
    const w = window as Window & { __gl?: number; __longTasks?: { start: number; ms: number }[] };
    w.__gl = 0;
    w.__longTasks = [];
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      ...rest: unknown[]
    ) {
      if (/webgl/i.test(kind)) w.__gl!++;
      return (get as (...a: unknown[]) => RenderingContext | null).call(this, kind, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          w.__longTasks!.push({ start: e.startTime, ms: e.duration });
      }).observe({ type: 'longtask', buffered: true });
    } catch {
      /* without the API, no long tasks */
    }
  });
}

const glContexts = (page: Page) =>
  page.evaluate(() => (window as Window & { __gl?: number }).__gl ?? 0);

function percentile(values: number[], p: number): number {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? 0;
}

test('scroll del hero al pie con la CPU a 4×: p95 ≤ 50 ms y sin tareas largas > 200 ms', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile', 'the phone measure (375×812) runs once');
  await page.setViewportSize(VIEW);
  await instrument(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });

  await page.goto('/?intro=0');
  await page.waitForFunction(
    () => window.__boiaIntro?.sceneStatus === 'ready' && window.__boiaIntro.phase === 'paused',
    null,
    { timeout: 90_000 },
  );
  const readyAt = await page.evaluate(() => performance.now());
  // The props come after the first frame: wait for them (part of what is measured after).
  await page.waitForFunction(() => (window.__boiaIntro?.props ?? 0) > 0, null, {
    timeout: 60_000,
  });
  await page.waitForTimeout(500);

  const frames = await page.evaluate(async (ms) => {
    const max = document.documentElement.scrollHeight - innerHeight;
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
        const u = Math.min(1, (now - t0) / ms);
        window.scrollTo({ top: max * u, behavior: 'instant' });
        if (u < 1) requestAnimationFrame(step);
        else done();
      };
      requestAnimationFrame(step);
    });
    return deltas;
  }, SCROLL_MS);
  await page.waitForTimeout(300);

  const d = (await page.evaluate(() => window.__boiaIntro))!;
  expect(d.fallback, 'the scene stays live (not the static version)').toBe(false);
  expect(d.scroll.light, 'reached the night at the footer').toBeGreaterThan(0.99);
  const long = await page.evaluate(
    (from) =>
      ((window as Window & { __longTasks?: { start: number; ms: number }[] }).__longTasks ?? [])
        .filter((t) => t.start >= from)
        .map((t) => Math.round(t.ms)),
    readyAt,
  );
  const p95 = percentile(frames, 95);
  const p50 = percentile(frames, 50);
  const worst = Math.max(...frames);
  const report = {
    renderer: d.renderer,
    frames: frames.length,
    p50: +p50.toFixed(1),
    p95: +p95.toFixed(1),
    worst: +worst.toFixed(1),
    longTasksAfterReady: long,
    sceneReadyMs: d.sceneReadyMs,
    quality: d.quality,
  };
  console.log(`[perf] ${JSON.stringify(report)}`);
  info.annotations.push({ type: 'perf', description: JSON.stringify(report) });
  expect(frames.length, 'frames during the scroll').toBeGreaterThan(20);
  expect(p95, '95th percentile frame time (ms)').toBeLessThanOrEqual(P95_MAX_MS);
  expect(Math.max(0, ...long), 'longest task after the scene is ready (ms)').toBeLessThanOrEqual(
    LONG_TASK_MAX_MS,
  );
});

test.describe('movimiento reducido', () => {
  test.use({ reducedMotion: 'reduce' });

  test('la versión estática no crea ningún contexto WebGL', async ({ page }) => {
    await page.setViewportSize(VIEW);
    await instrument(page);
    await page.goto('/');
    await page.waitForFunction(() => window.__boiaIntro?.phase === 'paused');
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }));
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => window.__boiaIntro?.fallback)).toBe(true);
    await expect(page.locator('html')).toHaveAttribute('data-hero', 'still');
    expect(await glContexts(page)).toBe(0);
  });
});

test.describe('still en móvil vertical con DPR 2 (T85)', () => {
  test.use({ reducedMotion: 'reduce', viewport: VIEW, deviceScaleFactor: 2 });

  test('pide el still de 1600 px: el recorte de cover es más ancho que la pantalla', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-hero', 'still');
    await page.waitForFunction(() => window.__boiaIntro?.phase === 'paused');
    expect(await page.evaluate(() => window.devicePixelRatio)).toBe(2);
    const still = page.locator('.hero__still-img').first();
    await expect(still).toBeVisible();
    await expect
      .poll(() => still.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
      .toBeGreaterThan(0);
    const img = await still.evaluate((el: HTMLImageElement) => ({
      src: el.currentSrc,
      boxHeight: el.getBoundingClientRect().height,
      // The width/height attributes: the files' aspect (naturalWidth is
      // divided by the srcset density, el.width is the layout box).
      aspect: Number(el.getAttribute('width')) / Number(el.getAttribute('height')),
    }));
    // Cover fills the height: the still is drawn box height × its aspect wide,
    // in device pixels wider than the 800 px file, so that one would blur.
    expect(img.boxHeight * img.aspect * 2, 'ancho dibujado (px del dispositivo)').toBeGreaterThan(
      800,
    );
    expect(img.src).toMatch(/-1600\.webp$/);
  });
});

const LOW_POWER: [string, string][] = [
  [
    'deviceMemory 2',
    `Object.defineProperty(Navigator.prototype, 'deviceMemory', { get: () => 2 })`,
  ],
  [
    'hardwareConcurrency 4',
    `Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', { get: () => 4 })`,
  ],
  [
    'saveData',
    `Object.defineProperty(Navigator.prototype, 'connection', { get: () => ({ saveData: true }) })`,
  ],
];

for (const [name, script] of LOW_POWER) {
  test(`bajo consumo (${name}): la versión estática, sin WebGL`, async ({ page }) => {
    await page.setViewportSize(VIEW);
    await page.addInitScript({ content: script });
    await instrument(page);
    await page.goto('/');
    await page.waitForFunction(() => window.__boiaIntro?.phase === 'paused', null, {
      timeout: 30_000,
    });
    await page.waitForTimeout(1500);
    const d = (await page.evaluate(() => window.__boiaIntro))!;
    expect(d.fallback).toBe(true);
    expect(d.scenesCreated).toBe(0);
    await expect(page.locator('html')).toHaveAttribute('data-hero', 'still');
    await expect(page.locator('.hero__still-img').first()).toBeVisible();
    expect(await glContexts(page)).toBe(0);
  });
}
