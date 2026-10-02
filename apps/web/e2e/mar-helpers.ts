import { WORLD_REGISTRY } from '@boia/world';
import { expect, type Page } from '@playwright/test';
import { marWorld } from '../app/mar/engine/compact';

/**
 * Ayudas de las pruebas del mar 3D que antes abrían el mundo 2D (/juego, T62,
 * D-25): abrir `/mar` con el motor en marcha, dónde está el barco y
 * gobernarlo con las flechas hasta un lugar.
 */

export const mar = (page: Page) => page.locator('main.mar');
export const marSheet = (page: Page) => page.getByTestId('mar-ficha');

/** Abre el mar (con su consulta) y espera a que el motor corra; devuelve los errores de la página. */
export async function openMar(page: Page, query = ''): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`/mar${query}`);
  await expect(page.getByTestId('mar-canvas')).toBeVisible();
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 30_000 });
  await expect(mar(page)).toHaveAttribute('data-barco', /\d/);
  return errors;
}

/** El barco ahora (u del mundo compacto del mar 3D). */
export async function shipAt(page: Page): Promise<{ x: number; y: number }> {
  const [x, y] = ((await mar(page).getAttribute('data-barco')) ?? '0,0').split(',').map(Number);
  return { x: x!, y: y! };
}

/** Rumbo norte hasta que se cumpla `until`. */
export async function sailNorthUntil(page: Page, until: () => Promise<unknown>): Promise<void> {
  await page.keyboard.down('ArrowUp');
  try {
    await until();
  } finally {
    await page.keyboard.up('ArrowUp');
  }
}

/** La ficha abierta es de ese tipo (`event`, `discount`, `info`…). */
export const sheetIs = (page: Page, kind: string) => async () =>
  (await page.locator(`[data-testid="mar-ficha"][data-tipo="${kind}"]`).count()) > 0;

/**
 * Gobierna con las flechas hacia un lugar (su sitio en el mundo compacto del
 * mar) hasta que `done` se cumpla o pasen `ms`.
 */
export async function steerTo(
  page: Page,
  id: string,
  done: () => Promise<boolean>,
  { worldId = WORLD_REGISTRY.defaultId, ms = 45_000 } = {},
): Promise<void> {
  const config = WORLD_REGISTRY.get(worldId).config;
  const target = marWorld(config).objects.find((o) => o.identity.id === id)!.position;
  const held = new Set<string>();
  const hold = async (keys: string[]) => {
    for (const k of [...held]) {
      if (keys.includes(k)) continue;
      await page.keyboard.up(k);
      held.delete(k);
    }
    for (const k of keys) {
      if (held.has(k)) continue;
      await page.keyboard.down(k);
      held.add(k);
    }
  };
  try {
    const until = Date.now() + ms;
    while (Date.now() < until && !(await done())) {
      const s = await shipAt(page);
      const dx = target.x - s.x;
      const dy = target.y - s.y;
      const d = Math.hypot(dx, dy) || 1;
      const keys: string[] = [];
      if (dx / d > 0.35) keys.push('ArrowRight');
      if (dx / d < -0.35) keys.push('ArrowLeft');
      if (dy / d > 0.35) keys.push('ArrowDown');
      if (dy / d < -0.35) keys.push('ArrowUp');
      await hold(keys);
      await page.waitForTimeout(150);
    }
  } finally {
    await hold([]);
  }
}
