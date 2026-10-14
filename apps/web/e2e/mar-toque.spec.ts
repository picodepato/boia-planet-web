import { WORLD_REGISTRY } from '@boia/world';
import { expect, test, type Page } from '@playwright/test';
import { marWorld, periodOfWorld } from '../app/mar/engine/compact';
import { mar, openMar, sailNorthUntil, shipAt } from './mar-helpers';

/**
 * Tocar el agua lleva el barco ahí (T279): en la vista normal y desde el
 * mapa grande. En el build publicado tras el plan 029 (c041d61) el toque
 * ponía siempre el mismo rumbo: el punto del agua se guardaba en un vector
 * compartido que la comprobación de los personajes (T270) pisaba al
 * proyectarlos, y el barco iba a un sitio fijo, no al tocado.
 *
 * `data-toque` del lienzo dice dónde cayó el último toque en el agua (u del
 * mundo compacto); `data-barco` de `main.mar`, dónde está el barco.
 */

test.describe.configure({ timeout: 120_000 });

const canvas = (page: Page) => page.getByTestId('mar-canvas');

/** Un punto de la pantalla (fracción del viewport) donde lo de encima es el lienzo. */
async function waterAt(page: Page, fx: number, fy: number): Promise<{ x: number; y: number }> {
  const vp = page.viewportSize()!;
  // Se busca cerca si encima hay un rótulo o un botón.
  for (const [ox, oy] of [
    [0, 0],
    [0.06, 0],
    [-0.06, 0],
    [0, 0.06],
    [0, -0.06],
    [0.1, 0.08],
    [-0.1, 0.08],
  ]) {
    const x = Math.round(vp.width * (fx + ox!));
    const y = Math.round(vp.height * (fy + oy!));
    const onCanvas = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x!, y!)?.getAttribute('data-testid') === 'mar-canvas',
      [x, y],
    );
    if (onCanvas) return { x, y };
  }
  throw new Error(`no hay agua libre cerca de ${fx},${fy}`);
}

async function tapAt(page: Page, p: { x: number; y: number }, touch: boolean) {
  if (touch) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
}

async function lastTap(page: Page): Promise<{ x: number; y: number }> {
  const v = await canvas(page).getAttribute('data-toque');
  const [x, y] = (v ?? '').split(',').map(Number);
  return { x: x!, y: y! };
}

/** Cierra el diálogo de un personaje si hay uno (su bocadillo puede quedar fuera de la pantalla). */
async function quietDialogue(page: Page) {
  const close = page.getByTestId('mar-bocadillo-cerrar');
  for (let k = 0; k < 3 && (await close.count()) > 0; k++) {
    await close.evaluate((b: HTMLButtonElement) => b.click()).catch(() => undefined);
    await page.waitForTimeout(200);
  }
}

/** El planeta da la vuelta (D-22): la distancia, por el camino más corto. */
const period = periodOfWorld(marWorld(WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config));
const around = (d: number, p: number) => d - p * Math.round(d / p);
/**
 * Toca el agua en el primero de estos sitios (fracción de la pantalla) donde
 * el toque pone rumbo (`data-toque` cambia): uno junto a un rótulo abre su
 * ficha y no cuenta (se cierra y se prueba el siguiente). En cubierta, al
 * salir hacia el norte se pasa junto a la boia del Puerto, que habla, y un
 * toque avanza su diálogo (así ha sido siempre): se cierra antes.
 */
async function tapWater(
  page: Page,
  touch: boolean,
  prev: { x: number; y: number } | null,
  spots: [number, number][],
): Promise<{ x: number; y: number }> {
  for (const [fx, fy] of spots) {
    await quietDialogue(page);
    const p = await waterAt(page, fx, fy).catch(() => null);
    if (!p) continue;
    await tapAt(page, p, touch);
    const moved = await expect
      .poll(
        async () => {
          if (!(await canvas(page).getAttribute('data-toque'))) return false;
          return !prev || dist(await lastTap(page), prev) > 40;
        },
        { timeout: 2_000 },
      )
      .toBe(true)
      .then(() => true)
      .catch(() => false);
    if (moved) return lastTap(page);
    const close = page.getByTestId('mar-ficha').getByRole('button', { name: 'Cerrar' });
    if ((await close.count()) > 0) await close.first().click();
  }
  throw new Error('ningún toque en el agua puso rumbo');
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(around(a.x - b.x, period.w), around(a.y - b.y, period.h));

test('tocar el agua navega hasta ahí: en la vista normal y desde el mapa', async ({
  page,
  hasTouch,
}) => {
  const errors = await openMar(page);
  // Los personajes del agua (T270) a la vista: con ellos el fallo salía siempre.
  await page.waitForTimeout(1500);

  // Vista normal: a la izquierda y a la derecha del barco caen en sitios distintos.
  const tLeft = await tapWater(page, hasTouch, null, [
    [0.3, 0.38],
    [0.36, 0.3],
    [0.34, 0.46],
  ]);
  const tRight = await tapWater(page, hasTouch, tLeft, [
    [0.66, 0.38],
    [0.6, 0.3],
    [0.62, 0.46],
  ]);
  // El barco mira al norte al salir: la derecha de la pantalla es más al este.
  expect(tRight.x).toBeGreaterThan(tLeft.x);
  // Lo tocado está a la vista, cerca del barco, y el barco se le acerca.
  const s0 = await shipAt(page);
  expect(dist(tRight, s0)).toBeLessThan(900);
  await expect(mar(page)).toHaveAttribute('data-autopilot', 'none');
  await expect
    .poll(async () => dist(await shipAt(page), tRight), { timeout: 15_000 })
    .toBeLessThan(dist(s0, tRight) * 0.6);

  // Desde el mapa grande: el toque cae en el sitio tocado de la carta.
  await page.keyboard.press('m');
  await expect(page.getByTestId('mar-minimapa')).toHaveAttribute('aria-pressed', 'true');
  // Se espera a que el zoom llegue a la carta y a que se vaya la pista (T275).
  await expect(page.getByTestId('mar-mapa-pista')).toHaveCount(0, { timeout: 8_000 });
  await page.waitForTimeout(1500);
  const tmLeft = await tapWater(page, hasTouch, tRight, [
    [0.35, 0.5],
    [0.3, 0.6],
    [0.38, 0.42],
  ]);
  const tmRight = await tapWater(page, hasTouch, tmLeft, [
    [0.65, 0.5],
    [0.7, 0.6],
    [0.62, 0.42],
  ]);
  expect(tmRight.x).toBeGreaterThan(tmLeft.x);
  const s1 = await shipAt(page);
  await expect
    .poll(async () => dist(await shipAt(page), tmRight), { timeout: 15_000 })
    .toBeLessThan(dist(s1, tmRight) - 40);
  expect(errors).toEqual([]);
});

test('los bocadillos de los personajes no salen en la vista de mapa (T279)', async ({ page }) => {
  const errors = await openMar(page);
  // Rumbo norte desde el Puerto: la boia del Puerto habla (su bocadillo).
  const bubble = page.getByTestId('mar-bocadillo');
  await sailNorthUntil(page, () => expect(bubble).toHaveCount(1, { timeout: 15_000 }));
  await page.keyboard.press('m');
  await expect(page.getByTestId('mar-minimapa')).toHaveAttribute('aria-pressed', 'true');
  await expect(bubble).toBeHidden();
  await expect(page.getByTestId('mar-charla')).toHaveCount(0);
  await expect(page.getByTestId('mar-guiri-bocadillo')).toBeHidden();
  // De vuelta a cubierta, junto a la boia, su bocadillo vuelve.
  await page.keyboard.press('m');
  await expect(page.getByTestId('mar-minimapa')).toHaveAttribute('aria-pressed', 'false');
  if ((await bubble.count()) > 0) await expect(bubble).toBeVisible();
  expect(errors).toEqual([]);
});
