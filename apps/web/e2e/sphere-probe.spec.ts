import {
  chromium,
  expect,
  test,
  type Browser,
  type BrowserContextOptions,
  type Page,
  type TestInfo,
} from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Medición de la prueba de técnica de T13 (intro «mini-mundo», opción A:
 * esfera falsa en Pixi sobre el mundo real). No corre con `pnpm e2e`; se pide
 * aparte, y la variable también abre la ruta `/sphere-probe` en `next start`:
 *
 *   BOIA_SPHERE_PROBE=1 pnpm e2e sphere-probe.spec.ts --workers=1
 *
 * Imprime fps del giro (actos 1–2) y del aterrizaje (acto 3) en dos modos:
 * - «software»: el Chromium sin cabeza de siempre, WebGL por SwiftShader;
 * - «gpu»: el mismo Chromium con la GPU del Mac (ANGLE sobre Metal), como
 *   las grabaciones de T03.
 * En el proyecto móvil (360×640) mide con la CPU ralentizada ×4 y, como
 * referencia, sin ralentizar. Deja las capturas k = 1 y k ≈ 0,5 en
 * docs/informes/img/p001-t13-esfera-*.png (con GPU).
 */

test.skip(!process.env.BOIA_SPHERE_PROBE, 'sólo con BOIA_SPHERE_PROBE=1');
test.describe.configure({ mode: 'serial' });

const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../docs/informes/img',
);
const NAME: Record<string, string> = { mobile: 'movil', desktop: 'escritorio' };
const SPIN_MS = 3000;
const LANDING_MS = 4500;

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

interface Stats {
  fps: number;
  p95Ms: number;
  maxMs: number;
  frames: number;
  p95JsMs: number;
  slow: { ms: number; k: number; live: number; jsMs: number }[];
  byPhase: Record<string, { frames: number; fps: number }>;
}

async function openProbe(page: Page) {
  await page.goto('/sphere-probe');
  await page.waitForFunction(() => !!window.__sphereProbe, null, { timeout: 60_000 });
  return page.evaluate(() => {
    const p = window.__sphereProbe!;
    return { renderer: p.renderer, resolution: p.resolution, texture: p.texturePx.join('×') };
  });
}

async function measure(page: Page, mode: 'spin' | 'landing', ms: number): Promise<Stats> {
  await page.evaluate((m) => window.__sphereProbe!.setMode(m), mode);
  // Un segundo para que se asiente el modo antes de contar.
  await page.waitForTimeout(1000);
  return page.evaluate((t) => window.__sphereProbe!.measure(t), ms);
}

const fmt = (s: Stats) =>
  `${s.fps.toFixed(1)} fps (p95 ${s.p95Ms.toFixed(1)} ms, máx ${s.maxMs.toFixed(1)} ms,` +
  ` JS p95 ${s.p95JsMs.toFixed(1)} ms, ${s.frames} fotogramas)` +
  (Object.keys(s.byPhase).length > 1
    ? `\n              por tramo: ${Object.entries(s.byPhase)
        .map(([name, b]) => `${name} ${b.fps.toFixed(1)} fps (${b.frames})`)
        .join(' · ')}`
    : '') +
  (s.slow.length
    ? `\n              > 50 ms: ${s.slow
        .map(
          (f) =>
            `${f.ms.toFixed(0)} ms en k=${f.k.toFixed(3)} vivo=${f.live.toFixed(2)} JS ${f.jsMs.toFixed(0)} ms`,
        )
        .join('; ')}`
    : '');

for (const renderMode of ['software', 'gpu'] as const) {
  test(`fps de la esfera · ${renderMode}`, async ({ browser, baseURL }, info) => {
    test.setTimeout(180_000);
    const b = renderMode === 'gpu' ? gpu : browser;
    const throttles = info.project.name === 'mobile' ? [4, 1] : [1];
    for (const rate of throttles) {
      const ctx = await b.newContext(contextOptions(info, baseURL));
      const page = await ctx.newPage();
      const meta = await openProbe(page);
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      const spin = await measure(page, 'spin', SPIN_MS);
      const landing = await measure(page, 'landing', LANDING_MS);
      const vp = info.project.use.viewport!;
      const line =
        `[sphere-probe] ${info.project.name} ${vp.width}×${vp.height} · ${renderMode} · CPU ×${rate}` +
        ` · ${meta.renderer} · resolución ${meta.resolution} · textura ${meta.texture}\n` +
        `  giro:       ${fmt(spin)}\n  aterrizaje: ${fmt(landing)}\n` +
        `  mínimo: ${Math.min(spin.fps, landing.fps).toFixed(1)} fps`;
      console.log(line);
      info.annotations.push({ type: 'fps', description: line });
      expect(spin.frames).toBeGreaterThan(0);
      expect(landing.frames).toBeGreaterThan(0);
      await ctx.close();
    }
  });
}

test('capturas del mini-mundo (k = 1) y de medio aterrizaje (k ≈ 0,5)', async ({
  baseURL,
}, info) => {
  test.setTimeout(120_000);
  const ctx = await gpu.newContext(contextOptions(info, baseURL));
  const page = await ctx.newPage();
  await openProbe(page);
  await page.addStyleTag({ content: '[data-probe-status] { display: none !important; }' });
  mkdirSync(OUT, { recursive: true });
  for (const [k, tag] of [
    [1, 'k1'],
    [0.5, 'k05'],
  ] as const) {
    await page.evaluate((kk) => window.__sphereProbe!.still(kk), k);
    await page.waitForTimeout(400);
    const pose = await page.evaluate(() => window.__sphereProbe!.pose);
    expect(pose?.k).toBeCloseTo(k, 3);
    const file = path.join(OUT, `p001-t13-esfera-${tag}-${NAME[info.project.name]}.png`);
    await page.screenshot({ path: file });
    info.annotations.push({ type: 'captura', description: file });
  }
  await ctx.close();
});
