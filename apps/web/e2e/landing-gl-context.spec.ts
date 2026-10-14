import { expect, test, type Page } from '@playwright/test';
import { GL_RESTORE_WAIT_MS } from '../lib/intro/gl-context';

/**
 * The landing's planet survives losing its WebGL context (plan 030 T289,
 * REQ-ARQ-016 case 16). The browser can take the context away (app switch,
 * memory pressure, another WebGL tab, a locked screen); here it is forced
 * with `WEBGL_lose_context`. While it is gone the static version shows (T78's
 * stills), never a black hole; when it comes back the scene paints and moves
 * again; when it does not come back, the static version stays. No console
 * errors on any path.
 */

test.describe.configure({ timeout: 120_000 });

type Lose = { loseContext(): void; restoreContext(): void };

/** Console and page errors from the first script on. */
function errors(page: Page): string[] {
  const seen: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') seen.push(m.text());
  });
  page.on('pageerror', (e) => seen.push(e.message));
  return seen;
}

/** The scene at rest and painting; keeps the canvas's `WEBGL_lose_context` on `window`. */
async function liveScene(page: Page): Promise<void> {
  await page.goto('/?intro=0');
  await page.waitForFunction(
    () => window.__boiaIntro?.sceneStatus === 'ready' && window.__boiaIntro.phase === 'paused',
    null,
    { timeout: 60_000 },
  );
  await expect(page.locator('html')).toHaveAttribute('data-hero', 'scene');
  await expect(page.locator('.hero__scene')).toHaveAttribute('data-ready', '');
  await moving(page);
  const ok = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.hero__canvas');
    const gl = canvas?.getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_lose_context') as Lose | null | undefined;
    if (!ext) return false;
    (window as Window & { __lose?: Lose }).__lose = ext;
    return true;
  });
  expect(ok).toBe(true);
}

/** The scene paints new frames and the planet turns. */
async function moving(page: Page): Promise<void> {
  const before = await page.evaluate(() => ({
    frames: window.__boiaIntro!.framesRendered,
    moves: window.__boiaIntro!.cameraMoves,
  }));
  await page.waitForFunction(
    (b) =>
      (window.__boiaIntro?.framesRendered ?? 0) > b.frames + 2 &&
      (window.__boiaIntro?.cameraMoves ?? 0) > b.moves,
    before,
    { timeout: 20_000 },
  );
}

const lose = (page: Page) =>
  page.evaluate(() => (window as Window & { __lose?: Lose }).__lose!.loseContext());
const restore = (page: Page) =>
  page.evaluate(() => (window as Window & { __lose?: Lose }).__lose!.restoreContext());
const glState = (page: Page) => page.evaluate(() => window.__boiaIntro?.gl.state);

/** The static version shows and the canvas is hidden. */
async function staticShows(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-hero', 'still');
  await expect(page.locator('.hero__still-img').first()).toBeVisible();
  await expect(page.locator('.hero__scene')).not.toHaveAttribute('data-ready', /.*/);
  await expect
    .poll(() => page.locator('.hero__canvas').evaluate((c) => Number(getComputedStyle(c).opacity)))
    .toBe(0);
}

test('pérdida de contexto: la versión estática; al restaurar, el planeta vuelve a moverse', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'one browser is enough');
  const seen = errors(page);
  await liveScene(page);

  await lose(page);
  await expect.poll(() => glState(page)).toBe('lost');
  await staticShows(page);
  // Nothing is painted while the context is gone.
  const frames = await page.evaluate(() => window.__boiaIntro!.framesRendered);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__boiaIntro!.framesRendered)).toBe(frames);

  await restore(page);
  await expect.poll(() => glState(page)).toBe('running');
  await expect(page.locator('html')).toHaveAttribute('data-hero', 'scene');
  await expect(page.locator('.hero__scene')).toHaveAttribute('data-ready', '');
  await expect(page.locator('.hero__still-img').first()).toBeHidden();
  await moving(page);
  expect(await page.evaluate(() => window.__boiaIntro!.gl)).toEqual({
    state: 'running',
    losses: 1,
    restores: 1,
  });
  expect(seen).toEqual([]);
});

test('sin restauración a tiempo: la versión estática se queda, sin errores', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'one browser is enough');
  const seen = errors(page);
  await liveScene(page);

  await lose(page);
  await expect.poll(() => glState(page)).toBe('lost');
  await staticShows(page);
  await expect.poll(() => glState(page), { timeout: GL_RESTORE_WAIT_MS + 20_000 }).toBe('fallback');
  // A late restore does not bring the scene back.
  await restore(page);
  await page.waitForTimeout(500);
  expect(await glState(page)).toBe('fallback');
  await staticShows(page);
  expect(seen).toEqual([]);
});
