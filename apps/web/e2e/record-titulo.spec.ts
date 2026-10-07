import {
  chromium,
  test,
  type Browser,
  type BrowserContextOptions,
  type TestInfo,
} from '@playwright/test';
import { mkdirSync, mkdtempSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { heroZarpar, tap } from './hero-helpers';

/**
 * Grabación del título 3D «BOIA» de la entrada (T27) para la revisión visual.
 * No corre con `pnpm e2e`; se pide aparte:
 *
 *   RECORD_TITLE=1 pnpm e2e record-titulo.spec.ts --workers=1
 *
 * Deja en docs/informes/img/:
 * - p002-t27-titulo-{movil,escritorio}.webm: primera visita en tiempo real
 *   (mini-mundo, las letras suben, 4 s de reposo, «Zarpar» y su salida);
 * - p002-t27-titulo-{movil,escritorio}.png: captura en reposo;
 * - p002-t27-titulo-reducido-{movil,escritorio}.png: el fotograma quieto con
 *   movimiento reducido.
 */

test.skip(!process.env.RECORD_TITLE, 'sólo con RECORD_TITLE=1');

const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../docs/informes/img',
);
const NAME: Record<string, string> = { mobile: 'movil', desktop: 'escritorio' };

// Con la GPU del Mac (ANGLE sobre Metal), como record.spec.ts.
let gpu: Browser;
test.beforeAll(async () => {
  gpu = await chromium.launch({
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
  });
});
test.afterAll(async () => gpu?.close());

function contextOptions(info: TestInfo, baseURL: string | undefined): BrowserContextOptions {
  const u = info.project.use;
  const o: BrowserContextOptions = { baseURL: baseURL ?? '' };
  if (u.viewport) o.viewport = u.viewport;
  if (u.deviceScaleFactor) o.deviceScaleFactor = u.deviceScaleFactor;
  if (u.isMobile !== undefined) o.isMobile = u.isMobile;
  if (u.hasTouch !== undefined) o.hasTouch = u.hasTouch;
  if (u.userAgent) o.userAgent = u.userAgent;
  return o;
}

test('grabación del título 3D', async ({ baseURL }, info) => {
  test.setTimeout(180_000); // la GPU por software es lenta
  const vp = info.project.use.viewport!;
  const tmp = mkdtempSync(path.join(tmpdir(), 'boia-titulo-'));
  const ctx = await gpu.newContext({
    ...contextOptions(info, baseURL),
    recordVideo: { dir: tmp, size: vp },
  });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.waitForFunction(() => window.__boiaIntro?.phase === 'paused', null, {
    timeout: 20_000,
  });
  await page.waitForFunction(() => window.__boiaIntro?.title.mode === '3d', null, {
    timeout: 10_000,
  });
  await page.waitForTimeout(2500);
  mkdirSync(OUT, { recursive: true });
  const name = NAME[info.project.name];
  await page.screenshot({ path: path.join(OUT, `p002-t27-titulo-${name}.png`) });
  await page.waitForTimeout(2500);
  await tap(page, heroZarpar(page));
  await page.waitForFunction(() => window.__boiaIntro?.phase === 'landed', null, {
    timeout: 15_000,
  });
  await page.waitForTimeout(1000);
  const video = page.video()!;
  await ctx.close();
  const dest = path.join(OUT, `p002-t27-titulo-${name}.webm`);
  renameSync(await video.path(), dest);
  info.annotations.push({ type: 'grabación', description: dest });
});

test('movimiento reducido: fotograma quieto', async ({ baseURL }, info) => {
  const ctx = await gpu.newContext({ ...contextOptions(info, baseURL), reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  // Con movimiento reducido la entrada es la versión estática (T78): sin
  // escena ni letras 3D, «BOIA» plano en reposo.
  await page.waitForFunction(() => window.__boiaIntro?.phase === 'paused', null, {
    timeout: 20_000,
  });
  await page.waitForTimeout(800);
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({
    path: path.join(OUT, `p002-t27-titulo-reducido-${NAME[info.project.name]}.png`),
  });
  await ctx.close();
});
