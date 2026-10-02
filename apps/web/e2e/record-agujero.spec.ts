import { WORLD_REGISTRY, type WorldObject } from '@boia/world';
import { chromium, expect, test, type Browser } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Grabación del cambio de mundo por agujero negro (T41) para la revisión
 * visual. No corre con `pnpm e2e`; se pide aparte:
 *
 *   RECORD_AGUJERO=1 pnpm e2e record-agujero.spec.ts --project=mobile --workers=1
 *
 * Deja en docs/informes/img/ p004-t41-agujero-negro.webm (tiempo real) y
 * p004-t41-agujero-negro.png (tira de 6 fotogramas con reloj simulado:
 * antes, cayendo, a oscuras, desplegándose y después), si hay ffmpeg.
 */

test.skip(!process.env.RECORD_AGUJERO, 'sólo con RECORD_AGUJERO=1');
test.describe.configure({ timeout: 180_000 });

const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../docs/informes/img',
);
const first = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId);
const second = WORLD_REGISTRY.get(WORLD_REGISTRY.ids().find((id) => id !== first.id)!);
const place = first.config.objects.find(
  (o: WorldObject) => o.behaviors.some((b) => b.type === 'content') && o.identity.active,
)!;

// Como record.spec.ts: la GPU del Mac para que el vórtice vaya fluido.
let gpu: Browser;
test.beforeAll(async () => {
  gpu = await chromium.launch({
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
  });
});
test.afterAll(async () => gpu?.close());

const viewport = { width: 360, height: 640 };

test('grabación y tira del agujero negro', async ({ baseURL }) => {
  mkdirSync(OUT, { recursive: true });
  const tmp = mkdtempSync(path.join(tmpdir(), 'boia-agujero-'));

  // 1. Vídeo en tiempo real.
  const ctx = await gpu.newContext({
    baseURL: baseURL ?? '',
    viewport,
    recordVideo: { dir: tmp, size: viewport },
  });
  const page = await ctx.newPage();
  await page.goto(`/juego?cerca=${place.identity.id}`);
  const juego = page.getByTestId('juego');
  await expect(page.getByTestId('hud')).toContainText(/\d+ fps/, { timeout: 60_000 });
  await page.waitForTimeout(2500);
  await page.getByTestId('menu-ancla').click();
  await page.getByTestId('menu').getByRole('tab', { name: 'Mundos', exact: true }).click();
  await page.waitForTimeout(600);
  await page.getByTestId(`mundo-${second.id}`).click();
  await expect(juego).toHaveAttribute('data-mundo', second.id, { timeout: 30_000 });
  await expect(juego).not.toHaveAttribute('data-cambio-mundo', /.+/, { timeout: 30_000 });
  await page.waitForTimeout(1500);
  const video = page.video()!;
  await ctx.close();
  renameSync(await video.path(), path.join(OUT, 'p004-t41-agujero-negro.webm'));

  // 2. Tira de fotogramas con reloj simulado (el ticker de Pixi va por rAF).
  const shots = await gpu.newContext({ baseURL: baseURL ?? '', viewport });
  const p2 = await shots.newPage();
  await p2.clock.install();
  await p2.goto(`/juego?cerca=${place.identity.id}`);
  const j2 = p2.getByTestId('juego');
  for (let i = 0; i < 200; i++) {
    await p2.clock.runFor(100);
    if (
      /\d+ fps/.test(
        (await p2
          .getByTestId('hud')
          .textContent()
          .catch(() => '')) ?? '',
      )
    )
      break;
  }
  await p2.clock.runFor(2500);
  await p2.getByTestId('menu-ancla').click();
  await p2.getByTestId('menu').getByRole('tab', { name: 'Mundos', exact: true }).click();
  const frames: string[] = [];
  const shoot = async (name: string) => {
    const file = path.join(tmp, `${String(frames.length).padStart(2, '0')}-${name}.png`);
    await p2.screenshot({ path: file });
    frames.push(file);
  };
  await p2.keyboard.press('Escape');
  await p2.clock.runFor(200);
  await shoot('antes');
  await p2.getByTestId('menu-ancla').click();
  await p2.getByTestId('menu').getByRole('tab', { name: 'Mundos', exact: true }).click();
  await p2.getByTestId(`mundo-${second.id}`).click();
  await p2.clock.runFor(450);
  await shoot('cayendo');
  await p2.clock.runFor(350);
  await shoot('hundido');
  // A oscuras hasta que el mundo nuevo está alrededor del barco.
  for (let i = 0; i < 100 && (await j2.getAttribute('data-mundo')) !== second.id; i++) {
    await p2.clock.runFor(100);
  }
  await shoot('oscuras');
  await p2.clock.runFor(500);
  await shoot('desplegando');
  for (let i = 0; i < 50 && (await j2.getAttribute('data-cambio-mundo')); i++) {
    await p2.clock.runFor(100);
  }
  await p2.clock.runFor(500);
  await shoot('despues');
  await shots.close();

  const dest = path.join(OUT, 'p004-t41-agujero-negro.png');
  const layout = frames
    .map((_, i) =>
      i === 0 ? '0_0' : `${Array.from({ length: i }, (_, k) => `w${k}`).join('+')}_0`,
    )
    .join('|');
  try {
    execFileSync('ffmpeg', [
      '-loglevel',
      'error',
      '-y',
      ...frames.flatMap((f) => ['-i', f]),
      '-filter_complex',
      `xstack=inputs=${frames.length}:layout=${layout},scale='min(2160,iw)':-2`,
      dest,
    ]);
  } catch {
    test.info().annotations.push({ type: 'tira', description: `sin ffmpeg; fotogramas en ${tmp}` });
  }
});
