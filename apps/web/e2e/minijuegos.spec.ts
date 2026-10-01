import { CANON_DEFAULTS, LAMP, powerFor, pullFor } from '@boia/engine/minigames';
import { expect, test, type Page } from '@playwright/test';

/**
 * Minijuegos rehechos (T60) dentro del mar 3D: cada uno se abre en su isla
 * (`/mar?ir=faro`, `/mar?ir=canon`: el barco navega hasta allí y la isla
 * ofrece «Jugar»), se juega con entradas de guion hasta sumar puntos, se
 * deja que los intrusos lleguen a la costa hasta perder las tres vidas y,
 * desde la pantalla final (con la mejor marca), se vuelve al mar.
 */

// Se juega en tiempo real: hasta perder las tres vidas pasan unos 40 s.
test.describe.configure({ timeout: 150_000 });

const layer = (page: Page) => page.getByTestId('minijuego');
const score = async (page: Page) => Number((await layer(page).getAttribute('data-score')) ?? 0);

async function openMar(page: Page, path: string) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(path);
  await expect(page.getByTestId('mar-canvas')).toBeVisible();
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 45_000 });
  return errors;
}

/** Navega hasta la isla del juego, cierra su ficha y lo abre con «Jugar». */
async function openAtIsland(page: Page, id: 'faro' | 'canon') {
  const errors = await openMar(page, `/mar?ir=${id}`);
  await expect(page.locator('main.mar')).toHaveAttribute('data-llegada', id, { timeout: 60_000 });
  const sheet = page.getByTestId('mar-ficha');
  if (await sheet.isVisible().catch(() => false)) {
    await sheet.getByRole('button', { name: 'Cerrar' }).first().click();
  }
  const panel = page.getByTestId('panel-minijuego');
  await expect(panel).toBeVisible({ timeout: 15_000 });
  // Ya no es «Minijuego · muestra»: es un juego de verdad.
  await expect(panel).not.toContainText('muestra');
  await panel.getByRole('button', { name: 'Jugar' }).click();
  await expect(layer(page)).toBeVisible();
  await expect(layer(page)).toHaveAttribute('data-game', id);
  await expect(page.getByTestId('minijuego-intro')).toBeVisible();
  await expect(page.getByTestId('minijuego-intro')).not.toContainText('muestra ·');
  await page.getByTestId('minijuego-empezar').click();
  await expect(layer(page)).toHaveAttribute('data-phase', 'playing');
  return errors;
}

/** Sin jugar más, los intrusos llegan a la costa: fin de partida y vuelta al mar. */
async function loseAndReturn(page: Page) {
  await expect(layer(page)).toHaveAttribute('data-phase', 'ended', { timeout: 100_000 });
  const final = page.getByTestId('minijuego-final');
  await expect(final).toBeVisible();
  await expect(final).toContainText('Vidas: 0/3');
  await expect(page.getByTestId('minijuego-marca')).toContainText(/[1-9]\d* puntos/);
  await expect(final).toContainText('mejor marca');
  await final.getByTestId('minijuego-volver').click();
  await expect(layer(page)).toHaveCount(0);
  await expect(page.getByTestId('mar-canvas')).toBeVisible();
}

test('Vigilancia del faro, en su isla: el haz descubre piratas y las vidas acaban la guardia', async ({
  page,
}) => {
  const errors = await openAtIsland(page, 'faro');
  const status = page.getByTestId('minijuego-estado');
  await expect(status).toContainText('Vidas 3/3');
  await expect(status).toContainText('Oleada 1/');
  await expect(page.getByTestId('minijuego-accion')).toHaveText('DESTELLO');

  // Guion: un destello cuando ya hay barcos en el mar y, después, barridos lentos del haz.
  const box = (await page.locator('.mg-canvas').boundingBox())!;
  const pointAt = (a: number) => ({
    x: box.x + box.width * (LAMP.x + Math.sin(a) * 0.4),
    y: box.y + box.height * (LAMP.y - Math.cos(a) * 0.4),
  });
  await page.waitForTimeout(3000);
  await page.getByTestId('minijuego-accion').click();
  const deadline = Date.now() + 40_000;
  let a = -1.2;
  let dir = 1;
  while ((await score(page)) === 0 && Date.now() < deadline) {
    const p = pointAt(a);
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(150);
    a += dir * 0.05;
    if (Math.abs(a) > 1.2) dir = -dir;
  }
  expect(await score(page)).toBeGreaterThan(0);
  // Se deja de vigilar: el haz al borde, y los piratas tocan costa.
  const away = pointAt(1.35);
  await page.mouse.move(away.x, away.y);
  await loseAndReturn(page);
  expect(errors).toEqual([]);
});

test('Cañón contra tiburones, en su isla: arrastrar apunta, la bola cae en parábola y puntúa', async ({
  page,
}) => {
  const errors = await openAtIsland(page, 'canon');
  const status = page.getByTestId('minijuego-estado');
  await expect(status).toContainText('Vidas 3/3');
  await expect(status).toContainText('Combo x1');
  await expect(page.getByTestId('minijuego-accion')).toHaveText('FUEGO');

  // Guion: arrastrar con el ángulo y la potencia que hacen caer la bola en x = 0,55,
  // por donde pasan los tiburones camino de la playa; soltar dispara.
  const angle = 0.7;
  const pull = pullFor(angle, powerFor(angle, 0.55, CANON_DEFAULTS)!, CANON_DEFAULTS);
  const box = (await page.locator('.mg-canvas').boundingBox())!;
  const from = { x: box.x + box.width * 0.3, y: box.y + box.height * 0.6 };
  const deadline = Date.now() + 60_000;
  while ((await score(page)) === 0 && Date.now() < deadline) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + pull.x * box.width, from.y + pull.y * box.height, {
      steps: 4,
    });
    await page.mouse.up();
    await page.waitForTimeout(700);
  }
  expect(await score(page)).toBeGreaterThan(0);
  await loseAndReturn(page);
  expect(errors).toEqual([]);
});

test('la pausa detiene la partida y ocultar la pestaña quita el premio', async ({ page }) => {
  await openMar(page, '/mar?minijuego=canon');
  await expect(layer(page)).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('minijuego-empezar').click();
  await expect(layer(page)).toHaveAttribute('data-phase', 'playing');
  await page.getByTestId('minijuego-pausa').click();
  await expect(layer(page)).toHaveAttribute('data-phase', 'paused');
  await expect(page.getByTestId('minijuego-pausada')).toBeVisible();
  await page.getByTestId('minijuego-seguir').click();
  await expect(layer(page)).toHaveAttribute('data-phase', 'playing');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(layer(page)).toHaveAttribute('data-phase', 'paused');
  await expect(layer(page)).toContainText('ya no da premio');
  await page.getByTestId('minijuego-seguir').click();
  await expect(page.getByTestId('minijuego-estado')).toContainText('sin premio');
  await page.getByTestId('minijuego-salir').click();
  await expect(layer(page)).toHaveCount(0);
  await expect(page.getByTestId('mar-canvas')).toBeVisible();
  // Al salir, la ruta de prueba se consume.
  expect(new URL(page.url()).searchParams.has('minijuego')).toBe(false);
});
