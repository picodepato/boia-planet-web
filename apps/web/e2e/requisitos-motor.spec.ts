import { eventSchema, EVENT_FORMATS, isIslandlessSatellite } from '@boia/contracts';
import { expect, test, type Browser, type TestInfo } from '@playwright/test';
import { SAMPLE_CONTENT } from '../lib/landing/sample-content';
import { openMar, shipAt } from './mar-helpers';

/**
 * Pruebas que nombran dos requisitos que sólo tenían código (plan 017 T196):
 * REQ-PRO-006 (formato All Day BOIA o satélite) y REQ-MUN-009 (la física del
 * mar no depende de los FPS).
 */

const EVENTS = SAMPLE_CONTENT.events;

test.describe('REQ-PRO-006: formato All Day BOIA o satélite', () => {
  test('el esquema exige uno de los dos formatos', () => {
    expect([...EVENT_FORMATS].sort()).toEqual(['all_day', 'satelite']);
    const base = EVENTS[0]!;
    expect(eventSchema.safeParse(base).success).toBe(true);
    expect(eventSchema.safeParse({ ...base, format: 'otro' }).success).toBe(false);
    const withoutFormat: Record<string, unknown> = { ...base };
    delete withoutFormat.format;
    expect(eventSchema.safeParse(withoutFormat).success).toBe(false);
  });

  test('cada evento del contenido tiene formato válido y cada All Day tiene isla', () => {
    expect(EVENTS.length).toBeGreaterThan(0);
    for (const e of EVENTS) {
      expect(eventSchema.safeParse(e).success, e.id).toBe(true);
      expect(EVENT_FORMATS, e.id).toContain(e.format);
      // Sólo un satélite puede no tener isla.
      if (e.format === 'all_day') {
        expect(e.islandId, `${e.id} (All Day) tiene isla`).toBeTruthy();
        expect(isIslandlessSatellite(e)).toBe(false);
      }
    }
  });
});

/**
 * Lo que avanza el barco con la tecla ↑ pulsada 700 ms y soltada (hasta que
 * se para), con la CPU frenada `rate` veces, y los fotogramas por segundo.
 */
async function sprint(
  browser: Browser,
  info: TestInfo,
  rate: number,
): Promise<{ dist: number; fps: number }> {
  const ctx = await browser.newContext({
    viewport: info.project.use.viewport ?? null,
    baseURL: info.project.use.baseURL ?? '',
  });
  const page = await ctx.newPage();
  try {
    await openMar(page, '?seed=7');
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    await page.evaluate(() => {
      const w = window as unknown as { __frames: number };
      w.__frames = 0;
      const tick = () => {
        w.__frames++;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const a = await shipAt(page);
    const t0 = Date.now();
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(700);
    await page.keyboard.up('ArrowUp');
    await page.waitForTimeout(2500); // hasta que se para
    const seconds = (Date.now() - t0) / 1000;
    const frames = await page.evaluate(() => (window as unknown as { __frames: number }).__frames);
    const b = await shipAt(page);
    return { dist: Math.hypot(b.x - a.x, b.y - a.y), fps: frames / seconds };
  } finally {
    await ctx.close();
  }
}

test('REQ-MUN-009: con menos FPS el barco recorre la misma distancia por segundo', async ({
  browser,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'basta una pasada (CDP sólo en Chromium)');
  test.setTimeout(120_000);
  const fast = await sprint(browser, info, 1);
  const slow = await sprint(browser, info, 3);
  expect(fast.dist, 'el barco avanza').toBeGreaterThan(20);
  // El freno de CPU baja de verdad los fotogramas (si no, la prueba no probaría nada).
  expect(slow.fps).toBeLessThan(fast.fps * 0.9);
  // Con otros FPS, el mismo recorrido (a pasos fijos de 1/60 s), con la tolerancia de la pulsación.
  expect(Math.abs(slow.dist - fast.dist) / fast.dist).toBeLessThan(0.2);
});
