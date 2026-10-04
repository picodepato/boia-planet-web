import { circuitFromWorld } from '@boia/engine/circuit';
import { CIRCUIT_ID, WORLD_REGISTRY } from '@boia/world';
import { expect, test, type Page } from '@playwright/test';
import { marWorld } from '../app/mar/engine/compact';
import { lapTargets } from '../app/mar/race';
import { t as msg } from '../lib/i18n';
import { mar, marSheet, openMar, shipAt } from './mar-helpers';

/**
 * El Cañón «Que no pare la música» dentro de /mar (plan 009, T99): el panel
 * de su isla lo empieza en el mismo mar, donde está el barco (sin la capa
 * 2D), sin las marcas amarillas ni lo demás que la partida aparta; el atajo
 * `?minijuego=canon&t=&seed=` empieza en ese segundo con esa semilla; en
 * carrera el panel explica que ahora no; al acabar vuelve el mundo con el
 * barco donde acabó. El estado se lee de `data-testid="mar-canon"`. T102 lo
 * amplía (morir, sobrevivir, pausa, premio).
 */

test.describe.configure({ timeout: 240_000 });

const world = marWorld(WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config);
const spec = circuitFromWorld(world, CIRCUIT_ID)!;
const raceStart = lapTargets(world, spec).at(-1)!;

const game = (page: Page) => page.getByTestId('mar-canon');
const canvas = (page: Page) => page.getByTestId('mar-canvas');
const panel = (page: Page) => page.getByTestId('panel-minijuego');

const pointOf = (s: string | null) => {
  const [x, y] = (s ?? '0,0').split(',').map(Number);
  return { x: x!, y: y! };
};
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

test('desde el panel de su isla, el Cañón se juega en el mismo mar, sin marcas amarillas ni capa 2D', async ({
  page,
}) => {
  const errors = await openMar(page, '?ir=canon');
  await expect(mar(page)).toHaveAttribute('data-llegada', 'canon', { timeout: 60_000 });
  const sheet = marSheet(page);
  if (await sheet.isVisible().catch(() => false)) {
    await sheet.getByRole('button', { name: 'Cerrar' }).first().click();
  }
  await expect(panel(page)).toBeVisible({ timeout: 15_000 });
  await expect(panel(page)).toHaveAttribute('data-game', 'canon');
  await expect(panel(page)).toContainText(msg('mar.canon.title'));
  await expect(canvas(page)).toHaveAttribute('data-ruta', 'on');
  // Un objetivo marcado con el «!» (T99 de Codex) antes de jugar.
  await page.getByTestId('mar-ayuda-abrir').dispatchEvent('click');
  await page.getByTestId('mar-ayuda-rumbo-objetivo').dispatchEvent('click');
  await expect(page.getByTestId('mar-objective-marker')).toBeVisible();
  await expect(canvas(page)).not.toHaveAttribute('data-fauna-oculta', /.+/);
  const before = await shipAt(page);

  await panel(page)
    .getByRole('button', { name: msg('juego.minigameLayer.jugar') })
    .click();
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  await expect(canvas(page)).toHaveAttribute('data-canon', 'on');
  // Sin marcas amarillas, ni botellas, descuentos o encuentros en el mar.
  await expect(canvas(page)).toHaveAttribute('data-ruta', 'off');
  for (const layer of ['bottles', 'discounts', 'encounters']) {
    await expect(canvas(page)).toHaveAttribute('data-escondido', new RegExp(`\\b${layer}\\b`));
  }
  // Ni peces ni gaviotas, ni el «!» de objetivos ni el objetivo marcado (T120).
  await expect(canvas(page)).toHaveAttribute('data-fauna-oculta', 'on');
  await expect(page.getByTestId('mar-ayuda-abrir')).toHaveCount(0);
  await expect(page.getByTestId('mar-objective-marker')).toHaveCount(0);
  // Ni la capa 2D del cañón ni el panel.
  await expect(page.getByTestId('minijuego')).toHaveCount(0);
  await expect(panel(page)).toHaveCount(0);
  // Empieza donde está el barco, y el tiempo corre.
  expect(dist(pointOf(await game(page).getAttribute('data-barco')), before)).toBeLessThan(80);
  await expect
    .poll(async () => Number(await game(page).getAttribute('data-activo')), { timeout: 20_000 })
    .toBeGreaterThan(1);
  await expect(game(page)).toHaveAttribute('data-tiempo', /^\d+$/);
  expect(errors).toEqual([]);
});

test('`?minijuego=canon&t=<s>&seed=<n>` empieza en ese segundo con esa semilla', async ({
  page,
}) => {
  const errors = await openMar(page, '?minijuego=canon&t=120&seed=7');
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  await expect(game(page)).toHaveAttribute('data-semilla', '7');
  const left = Number(await game(page).getAttribute('data-tiempo'));
  expect(left).toBeLessThanOrEqual(420 - 120);
  expect(left).toBeGreaterThan(420 - 120 - 30);
  // Ya hay nivel y enemigos de ese momento de la partida.
  expect(Number(await game(page).getAttribute('data-nivel'))).toBeGreaterThan(1);
  // El atajo se consume.
  expect(new URL(page.url()).searchParams.has('minijuego')).toBe(false);
  expect(errors).toEqual([]);
});

test('al acabar vuelve el mundo, con el barco donde acabó la partida', async ({ page }) => {
  const errors = await openMar(page, '?minijuego=canon&t=416&seed=3');
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  await expect(canvas(page)).toHaveAttribute('data-ruta', 'off');
  await expect(canvas(page)).toHaveAttribute('data-fauna-oculta', 'on');
  const start = pointOf(await game(page).getAttribute('data-barco'));
  // Navega un poco durante la partida.
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(1500);
  await page.keyboard.up('ArrowLeft');
  await expect(game(page)).toHaveAttribute('data-estado', 'ended', { timeout: 60_000 });
  await expect(game(page)).toHaveAttribute('data-fin', /^(survived|flooded)$/);
  // El mundo, de vuelta.
  await expect(canvas(page)).toHaveAttribute('data-canon', 'off');
  await expect(canvas(page)).toHaveAttribute('data-ruta', 'on');
  await expect(canvas(page)).not.toHaveAttribute('data-escondido', /.+/);
  await expect(canvas(page)).not.toHaveAttribute('data-fauna-oculta', /.+/);
  await expect(page.getByTestId('mar-ayuda-abrir')).toBeVisible();
  // El barco sigue donde acabó (no vuelve a donde empezó).
  const end = pointOf(await game(page).getAttribute('data-barco'));
  expect(dist(end, start)).toBeGreaterThan(20);
  await page.waitForTimeout(1000);
  expect(dist(await shipAt(page), end)).toBeLessThan(80);
  // Y se puede volver a navegar.
  const now = await shipAt(page);
  await page.keyboard.down('ArrowRight');
  await expect
    .poll(async () => dist(await shipAt(page), now), { timeout: 15_000 })
    .toBeGreaterThan(20);
  await page.keyboard.up('ArrowRight');
  expect(errors).toEqual([]);
});

/** Pilota con las flechas hasta la salida de Los Rápidos, hasta que sale la tarjeta de empezar. */
async function sailToRaceOffer(page: Page): Promise<string> {
  return page.evaluate(
    async ({ start }) => {
      const main = document.querySelector<HTMLElement>('main.mar')!;
      const held = new Set<string>();
      const press = (keys: string[]) => {
        for (const k of [...held]) {
          if (keys.includes(k)) continue;
          window.dispatchEvent(new KeyboardEvent('keyup', { key: k, code: k }));
          held.delete(k);
        }
        for (const k of keys) {
          if (held.has(k)) continue;
          window.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: k }));
          held.add(k);
        }
      };
      const until = performance.now() + 120_000;
      try {
        while (performance.now() < until) {
          if (document.querySelector('[data-testid="mar-carrera-oferta"]')) return 'offer';
          const [x, y] = (main.dataset.barco ?? '0,0').split(',').map(Number);
          const dx = start.x - x!;
          const dy = start.y - y!;
          const d = Math.hypot(dx, dy) || 1;
          const keys: string[] = [];
          if (dx / d > 0.38) keys.push('ArrowRight');
          if (dx / d < -0.38) keys.push('ArrowLeft');
          if (dy / d > 0.38) keys.push('ArrowDown');
          if (dy / d < -0.38) keys.push('ArrowUp');
          press(keys);
          await new Promise((r) => requestAnimationFrame(r));
        }
        return 'tiempo';
      } finally {
        press([]);
      }
    },
    { start: { x: raceStart.x, y: raceStart.y } },
  );
}

test('en plena carrera el panel del Cañón explica que ahora no y no empieza', async ({ page }) => {
  // `&oferta=1`: el panel de la isla del Cañón sin ir hasta ella (atajo de desarrollo).
  const errors = await openMar(page, `?cerca=${raceStart.id}&minijuego=canon&oferta=1`);
  await expect(panel(page)).toBeVisible({ timeout: 15_000 });
  await expect(panel(page)).not.toHaveAttribute('data-bloqueado', 'si');
  expect(await sailToRaceOffer(page)).toBe('offer');
  // En el móvil el panel (abierto lejos de su isla sólo por el atajo) tapa la tarjeta: sin puntero.
  await page.getByTestId('mar-carrera-empezar').dispatchEvent('click');
  await expect(page.getByTestId('mar-crono')).toHaveAttribute('data-fase', /countdown|racing/);
  // El panel lo explica y «Jugar» no empieza nada.
  await expect(panel(page)).toHaveAttribute('data-bloqueado', 'si');
  await expect(page.getByTestId('panel-minijuego-bloqueo')).toHaveText(msg('mar.canon.lock.race'));
  const play = panel(page).getByRole('button', { name: msg('juego.minigameLayer.jugar') });
  await expect(play).toBeDisabled();
  await play.click({ force: true });
  await page.waitForTimeout(500);
  await expect(game(page)).toHaveCount(0);
  await expect(canvas(page)).not.toHaveAttribute('data-canon', 'on');
  expect(errors).toEqual([]);
});
