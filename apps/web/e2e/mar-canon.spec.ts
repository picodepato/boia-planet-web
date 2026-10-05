import { circuitFromWorld } from '@boia/engine/circuit';
import { CANON_DEFAULTS } from '@boia/engine/minigames';
import { rescueMissionOf } from '@boia/engine/mission';
import { SURVIVORS_CONFIG } from '@boia/engine/survivors';
import { CIRCUIT_ID, WORLD_REGISTRY } from '@boia/world';
import { type Locator, type Page, expect, test } from '@playwright/test';
import { formatClock, formatPlayed } from '../app/mar/canon-hud-model';
import { marWorld } from '../app/mar/engine/compact';
import { lapTargets } from '../app/mar/race';
import { type MessageKey, t as msg } from '../lib/i18n';
import { mar, marSheet, openMar, shipAt, steerTo } from './mar-helpers';

/**
 * El Cañón «Que no pare la música» dentro de /mar (plan 009, T99): el panel
 * de su isla lo empieza en el mismo mar, donde está el barco (sin la capa
 * 2D), sin las marcas amarillas ni lo demás que la partida aparta; el atajo
 * `?minijuego=canon&t=&seed=` empieza en ese segundo con esa semilla; en
 * carrera el panel explica que ahora no; al acabar vuelve el mundo con el
 * barco donde acabó. El estado se lee de `data-testid="mar-canon"`.
 *
 * T119 cierra la beta: inundarse, llegar al amanecer (con `&t=` cerca del
 * final) y su premio de 150 puntos y 50 monedas una sola vez por temporada
 * (con el logro `canon` listo para reclamar), el abandono tras más de 5 min
 * en pausa y la Boia Fiestera que sigue a bordo durante una partida.
 *
 * T121: en producción (sin Playwright al mando, con `?dev=1`), una partida
 * empezada con `&t=` no da premio ni logro, y la pantalla final lo dice.
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

test('el botón de turbo acelera durante el Cañón y conserva su cooldown (T124)', async ({
  page,
}) => {
  const errors = await openMar(page, '?minijuego=canon&seed=7');
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  const turbo = page.getByTestId('mar-turbo');
  await expect(turbo).toBeVisible();
  await page.keyboard.down('ArrowRight');
  await expect
    .poll(async () => Number(await canvas(page).getAttribute('data-canon-speed')), {
      timeout: 20_000,
    })
    .toBeGreaterThan(140);
  await turbo.click();
  await expect(turbo).toHaveClass(/is-on/);
  await expect
    .poll(async () => Number(await canvas(page).getAttribute('data-canon-speed')), {
      timeout: 20_000,
    })
    .toBeGreaterThan(170);
  const before = Number(await canvas(page).getAttribute('data-canon-turbo-cooldown'));
  expect(before).toBeGreaterThan(0);
  // Otra pulsación no reinicia el reloj del turbo.
  await turbo.click();
  await expect
    .poll(async () => Number(await canvas(page).getAttribute('data-canon-turbo-cooldown')))
    .toBeLessThan(before);
  await page.keyboard.up('ArrowRight');
  expect(errors).toEqual([]);
});

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
  // La etiqueta «BETA» también en el panel (T118).
  await expect(panel(page).getByTestId('panel-minijuego-beta')).toHaveText(msg('mar.canon.beta'));
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
  // Una partida del Cañón nunca es carrera: el barco, sin los 22 nudos (T109).
  await expect(canvas(page)).toHaveAttribute('data-manejo', 'crucero');
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

test('ya tarde (`t=` pasadas las 3:30) salen en pantalla los seis enemigos, sin errores (T126)', async ({
  page,
}) => {
  const errors = await openMar(page, '?minijuego=canon&t=240&seed=7');
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  expect(Number(await game(page).getAttribute('data-tiempo'))).toBeLessThan(420 - 210);
  // `data-canon-vistos`: los tipos que han salido dentro de la vista de la cámara en la partida.
  const all = Object.keys(SURVIVORS_CONFIG.enemies).sort();
  await expect
    .poll(
      async () => ((await canvas(page).getAttribute('data-canon-vistos')) ?? '').split(' ').sort(),
      { timeout: 90_000 },
    )
    .toEqual(all);
  expect(errors).toEqual([]);
});

for (const reduced of [false, true]) {
  test(`all max-level weapons are drawn without console errors (T128, reduced=${reduced})`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
    if (reduced) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'deviceMemory', { configurable: true, get: () => 2 });
      });
    }
    const errors = await openMar(page, '?minijuego=canon&armas=1&seed=7');
    await expect(game(page)).toHaveAttribute('data-estado', 'running');
    if (reduced) await expect(game(page)).toHaveAttribute('data-calidad', 'baja');
    expect(new URL(page.url()).searchParams.has('armas')).toBe(false);
    const all = Object.keys(SURVIVORS_CONFIG.weapons).sort();
    // Level cards pause the sim; pick with the supported keyboard input throughout the run.
    await expect
      .poll(
        async () => {
          if ((await game(page).getAttribute('data-estado')) === 'card')
            await page.keyboard.press('Enter');
          const seen = ((await canvas(page).getAttribute('data-canon-armas-vistas')) ?? '')
            .split(' ')
            .filter(Boolean)
            .sort();
          const active = Number(await game(page).getAttribute('data-activo'));
          return active >= 12 && JSON.stringify(seen) === JSON.stringify(all);
        },
        { timeout: 90_000, intervals: [400] },
      )
      .toBe(true);
    const counts = ((await canvas(page).getAttribute('data-canon-armas')) ?? '')
      .split(' ')
      .filter(Boolean);
    expect(counts.length).toBeGreaterThan(0);
    for (const count of counts) expect(count).toMatch(/^[A-Za-z]+:[1-9]\d*$/);
    expect(errors).toEqual([]);
  });
}

test('el interruptor de desarrollo cambia en vivo el estilo de derrota (T117)', async ({
  page,
}) => {
  const errors = await openMar(page, '?minijuego=canon&t=120&seed=7&derrota=puf');
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  const toggle = page.getByTestId('mar-canon-derrota');
  await expect(toggle).toHaveAttribute('data-derrota', 'puf');
  await expect(canvas(page)).toHaveAttribute('data-derrota', 'puf');
  await expect(toggle).toContainText(msg('mar.canon.dev.derrota.puf'));
  // El cañón dispara solo: caen enemigos con el estilo de ahora.
  await expect
    .poll(async () => Number(await game(page).getAttribute('data-derrotados')), { timeout: 30_000 })
    .toBeGreaterThan(0);
  await toggle.dispatchEvent('click');
  await expect(toggle).toHaveAttribute('data-derrota', 'sumergirse');
  await expect(canvas(page)).toHaveAttribute('data-derrota', 'sumergirse');
  await expect(toggle).toContainText(msg('mar.canon.dev.derrota.sumergirse'));
  const before = Number(await game(page).getAttribute('data-derrotados'));
  await expect
    .poll(async () => Number(await game(page).getAttribute('data-derrotados')), { timeout: 30_000 })
    .toBeGreaterThan(before);
  // El atajo `derrota` también se consume.
  expect(new URL(page.url()).searchParams.has('derrota')).toBe(false);
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
  // La pantalla final (T118); el mundo vuelve con «Volver al mar».
  await expect(page.getByTestId('mar-canon-final')).toBeVisible();
  await page.getByTestId('mar-canon-volver').click();
  await expect(page.getByTestId('mar-canon-final')).toHaveCount(0);
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

// --- La interfaz de la partida (T118) -------------------------------------------------

type Box = { x: number; y: number; width: number; height: number };

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/**
 * «Entradas» sigue a la vista y a mano: ninguna pieza de la partida la pisa
 * y lo que hay en su centro es el propio botón.
 */
async function expectTicketsFree(page: Page, pieces: Locator[]): Promise<void> {
  const tickets = page.getByTestId('mar-entradas');
  await expect(tickets).toBeVisible();
  const t = (await tickets.boundingBox())!;
  for (const piece of pieces) {
    const b = (await piece.boundingBox())!;
    expect(overlaps(b, t), (await piece.getAttribute('data-testid')) ?? '').toBe(false);
  }
  const onTop = await page.evaluate(
    ({ x, y }) => !!document.elementFromPoint(x, y)?.closest('[data-testid="mar-entradas"]'),
    { x: t.x + t.width / 2, y: t.y + t.height / 2 },
  );
  expect(onTop).toBe(true);
}

/** La pieza se ve entera dentro de la pantalla. */
async function expectOnScreen(page: Page, piece: Locator): Promise<Box> {
  await expect(piece).toBeVisible();
  const b = (await piece.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(vp.width + 0.5);
  expect(b.y + b.height).toBeLessThanOrEqual(vp.height + 0.5);
  return b;
}

const activeS = async (page: Page) => Number(await game(page).getAttribute('data-activo'));

test('HUD con BETA, cuenta atrás y nivel; el agua a bordo bajo el barco; nada tapa «Entradas»', async ({
  page,
}) => {
  const errors = await openMar(page, '?minijuego=canon&t=120&seed=7');
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  const hud = page.getByTestId('mar-canon-hud');
  await expectOnScreen(page, hud);
  // T123: pequeño y pegado arriba (la banda alta de la pantalla), sin pisar nada fijo.
  const vp0 = page.viewportSize()!;
  const hudBox = (await hud.boundingBox())!;
  const xpBox = (await hud.getByRole('progressbar').boundingBox())!;
  const timeBox = (await hud.getByTestId('mar-canon-tiempo').boundingBox())!;
  for (const b of [hudBox, xpBox, timeBox]) expect(b.y + b.height).toBeLessThan(vp0.height * 0.2);
  expect(hudBox.height).toBeLessThanOrEqual(64);
  expect(xpBox.height).toBeLessThanOrEqual(8);
  const fixed = ['mar-entradas', 'mar-enlaces', 'mar-minimapa', 'mar-saldos'].map((id) =>
    page.getByTestId(id),
  );
  for (const piece of fixed) {
    if ((await piece.count()) === 0 || !(await piece.isVisible())) continue;
    const pb = (await piece.boundingBox())!;
    expect(overlaps(hudBox, pb), (await piece.getAttribute('data-testid')) ?? '').toBe(false);
  }
  await expect(hud.getByTestId('mar-canon-beta')).toHaveText(msg('mar.canon.beta'));
  // La cuenta atrás, «m:ss», baja desde lo que queda de la partida.
  const time = hud.getByTestId('mar-canon-tiempo');
  await expect(time).toHaveText(/^\d+:\d\d$/);
  // Texto y segundos se leen en el mismo instante: el reloj sigue corriendo entre dos lecturas.
  const read = await time.evaluate((el) => ({
    secs: Number(el.getAttribute('data-segundos')),
    text: el.textContent ?? '',
  }));
  const secs = read.secs;
  expect(secs).toBeLessThanOrEqual(SURVIVORS_CONFIG.durationS - 120);
  expect(read.text).toBe(formatClock(secs));
  await expect
    .poll(async () => Number(await time.getAttribute('data-segundos')), { timeout: 15_000 })
    .toBeLessThan(secs);
  // El nivel, encima de su barra (el del atajo `t=`: ya subió).
  const level = hud.getByTestId('mar-canon-nivel');
  const lv = Number(await level.getAttribute('data-nivel'));
  expect(lv).toBeGreaterThan(1);
  await expect(level).toHaveText(msg('mar.canon.hud.nivel', { nivel: lv }));
  await expect(hud.getByRole('progressbar')).toBeVisible();
  // El agua a bordo, bajo el barco: de un tamaño que se lee y en medio del mar.
  const water = page.getByTestId('mar-canon-agua');
  const w = await expectOnScreen(page, water);
  expect(w.width).toBeGreaterThanOrEqual(60);
  expect(w.height).toBeGreaterThanOrEqual(12);
  const vp = page.viewportSize()!;
  expect(w.x + w.width / 2).toBeGreaterThan(vp.width * 0.2);
  expect(w.x + w.width / 2).toBeLessThan(vp.width * 0.8);
  expect(w.y).toBeGreaterThan(vp.height * 0.2);
  expect(w.y + w.height).toBeLessThan(vp.height * 0.85);
  await expect(water).toHaveAttribute('data-pct', /^\d+$/);
  await expect(water).toHaveAttribute('data-nivel', /^(ok|alerta|peligro)$/);
  await expectTicketsFree(page, [hud, water]);
  expect(errors).toEqual([]);
});

test('carta de nivel con el teclado: flechas, números e Intro; mientras, la partida espera', async ({
  page,
}) => {
  const errors = await openMar(page, '?minijuego=canon&seed=5&carta=1');
  const cards = page.getByTestId('mar-canon-carta');
  const n = SURVIVORS_CONFIG.cardChoices;
  await expect(cards).toHaveCount(n);
  await expect(game(page)).toHaveAttribute('data-estado', 'card');
  // Cada carta dice qué mejora es y lo que da.
  for (let i = 0; i < n; i++) {
    const card = cards.nth(i);
    await expect(card.locator('.mar-canon-card__name')).not.toBeEmpty();
    await expect(card.locator('.mar-canon-card__effect')).toHaveText(/\d/);
    await expect(card).toHaveAttribute('data-tipo', /^(weapon|vinyl|evolution|salvavidas|fallback)/);
  }
  // La partida no corre con la carta abierta.
  const before = await activeS(page);
  await page.waitForTimeout(800);
  expect(await activeS(page)).toBe(before);
  // El foco empieza en la primera; flechas y números lo mueven.
  await expect(cards.nth(0)).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(cards.nth(1)).toBeFocused();
  await page.keyboard.press(String(n));
  await expect(cards.nth(n - 1)).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(cards.nth(0)).toBeFocused();
  await page.keyboard.press('ArrowRight');
  const pick = await cards.nth(1).getAttribute('data-mejora');
  await page.keyboard.press('Enter');
  await expect(cards).toHaveCount(0);
  await expect(game(page)).toHaveAttribute('data-mejoras', `${pick}:1`);
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  await expect.poll(() => activeS(page), { timeout: 15_000 }).toBeGreaterThan(before);
  expect(errors).toEqual([]);
});

test('la fila de armas y vinilos: abajo en escritorio, arriba a la izquierda en móvil; nada tapa «Entradas» (T130)', async ({
  page,
  isMobile,
}) => {
  const errors = await openMar(page, '?minijuego=canon&t=120&seed=7');
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  const row = page.getByTestId('mar-canon-equipo');
  const b = await expectOnScreen(page, row);
  const vp = page.viewportSize()!;
  // 4 armas + 4 vinilos (los que dice la config), con el arma inicial ya a bordo.
  const slots = SURVIVORS_CONFIG.slots.weapons + SURVIVORS_CONFIG.slots.vinyls;
  await expect(row.getByTestId('mar-canon-hueco')).toHaveCount(slots);
  await expect(row.locator('[data-fila="armas"] [data-id]:not([data-id=""])').first()).toBeVisible();
  if (isMobile) {
    expect(b.y).toBeLessThan(vp.height * 0.4);
    expect(b.x + b.width / 2).toBeLessThan(vp.width * 0.5);
  } else {
    expect(b.y).toBeGreaterThan(vp.height * 0.6);
    expect(Math.abs(b.x + b.width / 2 - vp.width / 2)).toBeLessThan(vp.width * 0.1);
  }
  // No tapa la cuenta atrás ni el nivel, ni «Entradas», ni lo demás fijo, ni el agua.
  const hud = page.getByTestId('mar-canon-hud');
  const water = page.getByTestId('mar-canon-agua');
  await expectTicketsFree(page, [row, hud, water]);
  for (const id of ['mar-enlaces', 'mar-minimapa', 'mar-saldos', 'mar-turbo']) {
    const piece = page.getByTestId(id);
    if ((await piece.count()) === 0 || !(await piece.isVisible())) continue;
    expect(overlaps(b, (await piece.boundingBox())!), id).toBe(false);
  }
  expect(overlaps(b, (await hud.boundingBox())!)).toBe(false);
  expect(errors).toEqual([]);
});

test('el atajo carta=surtido enseña una carta de cada clase; la evolución destaca y deja su arma dorada en la fila (T130)', async ({
  page,
}) => {
  const errors = await openMar(page, '?minijuego=canon&seed=3&carta=surtido');
  const cards = page.getByTestId('mar-canon-carta');
  await expect(cards).toHaveCount(6);
  const kinds = await cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-tipo')));
  expect([...kinds].sort()).toEqual(
    ['evolution', 'salvavidas', 'vinyl-level', 'vinyl-new', 'weapon-level', 'weapon-new'].sort(),
  );
  // Cada una: nombre, lo que da y su clase; las de nivel dicen «Nivel n: …».
  for (let i = 0; i < 6; i++) {
    const card = cards.nth(i);
    await expect(card.locator('.mar-canon-card__name')).not.toBeEmpty();
    await expect(card.locator('.mar-canon-card__tag')).not.toBeEmpty();
    const effect = card.locator('.mar-canon-card__effect');
    await expect(effect).not.toBeEmpty();
    await expect(effect).not.toContainText(/[{}]/);
    const kind = kinds[i]!;
    if (kind.endsWith('-level')) await expect(effect).toContainText(/^Nivel \d/);
  }
  // La evolución destaca (clase aparte) y ya ocupa su sitio en la oferta.
  const evo = page.locator('[data-testid="mar-canon-carta"][data-tipo="evolution"]');
  await expect(evo).toHaveCount(1);
  await expect(evo).toHaveClass(/is-evolution/);
  const evoIndex = kinds.indexOf('evolution');
  await page.waitForTimeout(500);
  await page.keyboard.press(String(evoIndex + 1));
  await page.keyboard.press('Enter');
  await expect(cards).toHaveCount(0);
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  await expect(page.locator('[data-testid="mar-canon-hueco"].is-evolved')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('carta de nivel con el dedo: grandes, a la vista y sin tapar «Entradas»', async ({
  page,
  isMobile,
}) => {
  const errors = await openMar(page, '?minijuego=canon&seed=9&carta=1');
  const cards = page.getByTestId('mar-canon-carta');
  const n = SURVIVORS_CONFIG.cardChoices;
  await expect(cards).toHaveCount(n);
  const pieces: Locator[] = [page.getByTestId('mar-canon-hud')];
  for (let i = 0; i < n; i++) {
    const b = await expectOnScreen(page, cards.nth(i));
    // Áreas táctiles amplias.
    expect(b.height).toBeGreaterThanOrEqual(64);
    expect(b.width).toBeGreaterThanOrEqual(150);
    pieces.push(cards.nth(i));
  }
  await expectTicketsFree(page, pieces);
  // Un momento tras abrirse no se elige sin querer; luego, un toque elige.
  await page.waitForTimeout(500);
  const last = cards.nth(n - 1);
  const pick = await last.getAttribute('data-mejora');
  if (isMobile) await last.tap();
  else await last.click();
  await expect(cards).toHaveCount(0);
  await expect(game(page)).toHaveAttribute('data-mejoras', `${pick}:1`);
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  expect(errors).toEqual([]);
});

test('Esc abre el menú de /mar con el aviso de salir; al cerrarlo sigue; la pausa y las fichas también paran', async ({
  page,
}) => {
  const errors = await openMar(page, '?minijuego=canon&seed=4');
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  await expect.poll(() => activeS(page), { timeout: 15_000 }).toBeGreaterThan(0.5);
  const menu = page.getByTestId('mar-menu');

  await page.keyboard.press('Escape');
  await expect(menu).toBeVisible();
  await expect(page.getByTestId('mar-menu-aviso-partida')).toHaveText(msg('mar.canon.menu.aviso'));
  await expect(game(page)).toHaveAttribute('data-estado', 'paused');
  const paused = await activeS(page);
  await page.waitForTimeout(800);
  expect(await activeS(page)).toBe(paused);
  // Cerrar el menú (Esc otra vez) sigue la partida.
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  await expect.poll(() => activeS(page), { timeout: 15_000 }).toBeGreaterThan(paused);

  // El botón de pausa del HUD abre el mismo menú; «Seguir jugando» lo cierra.
  await page.getByTestId('mar-canon-pausa').click();
  await expect(menu).toBeVisible();
  await expect(game(page)).toHaveAttribute('data-estado', 'paused');
  await page.getByTestId('mar-menu-seguir').click();
  await expect(menu).toHaveCount(0);
  await expect(game(page)).toHaveAttribute('data-estado', 'running');

  // «Mis códigos» desde el menú también deja la partida en pausa (T116).
  await page.getByTestId('mar-canon-pausa').click();
  await page.getByTestId('mar-mis-codigos').click();
  await expect(page.getByTestId('mar-ficha')).toHaveAttribute('data-tipo', 'codes');
  await expect(game(page)).toHaveAttribute('data-estado', 'paused');
  const inSheet = await activeS(page);
  await page.waitForTimeout(800);
  expect(await activeS(page)).toBe(inSheet);
  await page
    .getByTestId('mar-ficha')
    .getByRole('button', { name: msg('mar.sheet.cerrar') })
    .click();
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  expect(errors).toEqual([]);
});

test('pantalla final con tiempo, enemigos y notas; «Otra vez» empieza otra donde está el barco', async ({
  page,
}) => {
  const errors = await openMar(page, '?minijuego=canon&t=416&seed=3');
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  const end = page.getByTestId('mar-canon-final');
  await expect(end).toBeVisible({ timeout: 60_000 });
  await expect(game(page)).toHaveAttribute('data-estado', 'ended');
  const reason = (await game(page).getAttribute('data-fin')) as 'survived' | 'flooded';
  expect(['survived', 'flooded']).toContain(reason);
  await expect(end).toHaveAttribute('data-fin', reason);
  await expect(end.getByRole('heading')).toHaveText(
    msg(reason === 'survived' ? 'mar.canon.fin.amanece' : 'mar.canon.fin.inundado'),
  );
  await expect(end.getByTestId('mar-canon-final-enemigos')).toHaveText(
    (await game(page).getAttribute('data-derrotados'))!,
  );
  await expect(end.getByTestId('mar-canon-final-notas')).toHaveText(
    (await game(page).getAttribute('data-notas'))!,
  );
  await expect(end.getByTestId('mar-canon-final-tiempo')).toHaveText(
    formatPlayed(Number(await game(page).getAttribute('data-activo'))),
  );
  // El HUD se va; la escena se queda quieta detrás y el mundo sigue apartado.
  await expect(page.getByTestId('mar-canon-hud')).toHaveCount(0);
  await expect(canvas(page)).toHaveAttribute('data-canon', 'on');
  await expect(canvas(page)).toHaveAttribute('data-ruta', 'off');
  await expectTicketsFree(page, [end]);
  const where = pointOf(await game(page).getAttribute('data-barco'));

  await page.getByTestId('mar-canon-otra').click();
  await expect(end).toHaveCount(0);
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  await expect(page.getByTestId('mar-canon-hud')).toBeVisible();
  expect(Number(await game(page).getAttribute('data-tiempo'))).toBeGreaterThan(
    SURVIVORS_CONFIG.durationS - 10,
  );
  expect(dist(pointOf(await game(page).getAttribute('data-barco')), where)).toBeLessThan(80);
  await expect(canvas(page)).toHaveAttribute('data-ruta', 'off');
  expect(errors).toEqual([]);
});

// --- Sesión, premio y finales (T119) --------------------------------------------------

/** Los saldos del mar: ★ puntos y 🪙 monedas. */
async function balances(page: Page): Promise<{ points: number; coins: number }> {
  const text = (await page.getByTestId('mar-saldos').textContent()) ?? '';
  return {
    points: Number(/★\s*(\d+)/.exec(text)?.[1] ?? NaN),
    coins: Number(/🪙\s*(\d+)/.exec(text)?.[1] ?? NaN),
  };
}

const prize = (page: Page) => page.getByTestId('mar-canon-final-premio');

test('sin esquivar, el agua llena el barco: «¡Barco inundado!» y sin premio', async ({ page }) => {
  const errors = await openMar(page, '?minijuego=canon&t=200&seed=2');
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  // Nadie toca el timón: las pirañas llegan y el agua sube.
  await expect
    .poll(async () => Number(await game(page).getAttribute('data-agua')), { timeout: 60_000 })
    .toBeGreaterThan(0);
  const end = page.getByTestId('mar-canon-final');
  // Las armas de la beta 2 suben de nivel aun sin timón, y cada carta para la
  // partida hasta elegir: se coge la primera con Intro, sin esquivar nada.
  await expect
    .poll(
      async () => {
        if ((await game(page).getAttribute('data-estado')) === 'card') {
          await page.keyboard.press('Enter');
        }
        return end.isVisible();
      },
      { timeout: 120_000, intervals: [500] },
    )
    .toBe(true);
  await expect(game(page)).toHaveAttribute('data-fin', 'flooded');
  await expect(end).toHaveAttribute('data-fin', 'flooded');
  await expect(end.getByRole('heading')).toHaveText(msg('mar.canon.fin.inundado'));
  // La sesión se liquida: perdida, sin premio ni línea de premio.
  await expect(game(page)).toHaveAttribute('data-premio', 'not_won');
  await expect(prize(page)).toHaveAttribute('data-premio', 'not_won');
  await expect(prize(page)).toHaveText('');
  // De vuelta al mar.
  await page.getByTestId('mar-canon-volver').click();
  await expect(canvas(page)).toHaveAttribute('data-canon', 'off');
  await expect(canvas(page)).toHaveAttribute('data-ruta', 'on');
  expect(errors).toEqual([]);
});

test('llegar al amanecer da 150 puntos y 50 monedas una vez por temporada, y el logro del Cañón', async ({
  page,
}) => {
  const { points: rewardPoints, coins: rewardCoins } = CANON_DEFAULTS.reward;
  // `&t=419`: el último segundo de la noche (atajo de desarrollo).
  const errors = await openMar(page, '?minijuego=canon&t=419&seed=3');
  await expect(game(page)).toHaveAttribute('data-semilla', '3');
  const before = await balances(page);
  const end = page.getByTestId('mar-canon-final');
  await expect(end).toBeVisible({ timeout: 60_000 });
  await expect(game(page)).toHaveAttribute('data-fin', 'survived');
  await expect(end.getByRole('heading')).toHaveText(msg('mar.canon.fin.amanece'));
  await expect(end.getByTestId('mar-canon-final-tiempo')).toHaveText(formatPlayed(420));
  // La sesión valida el tiempo activo y el libro da el premio.
  await expect(game(page)).toHaveAttribute('data-premio', 'granted', { timeout: 15_000 });
  await expect(prize(page)).toHaveText(
    msg('mar.canon.premio.ganado', { puntos: rewardPoints, monedas: rewardCoins }),
  );
  await expect
    .poll(() => balances(page), { timeout: 15_000 })
    .toEqual({ points: before.points + rewardPoints, coins: before.coins + rewardCoins });
  await page.getByTestId('mar-canon-volver').click();
  await expect(canvas(page)).toHaveAttribute('data-canon', 'off');
  // La señal `win_minigame`: el logro «canon» queda listo para reclamar.
  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-menu-logros').click();
  await expect(page.getByTestId('logro-canon')).toHaveAttribute('data-estado', 'ready');

  // Otra visita, otra partida ganada la misma temporada: vale, pero no paga otra vez.
  await openMar(page, '?minijuego=canon&t=419&seed=5');
  const again = await balances(page);
  await expect(end).toBeVisible({ timeout: 60_000 });
  await expect(game(page)).toHaveAttribute('data-fin', 'survived');
  await expect(game(page)).toHaveAttribute('data-premio', 'duplicate', { timeout: 15_000 });
  await expect(prize(page)).toHaveText(msg('mar.canon.premio.repetido'));
  await page.waitForTimeout(1000);
  expect(await balances(page)).toEqual(again);
  expect(errors).toEqual([]);
});

test('en producción, con `?dev=1`, una partida de `&t=` llega al amanecer pero no da premio ni logro (T121)', async ({
  page,
}) => {
  // Como un navegador cualquiera: sin `navigator.webdriver`, los atajos sólo
  // se encienden con `?dev=1` (el servidor de las e2e es un build de producción).
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false });
  });
  const errors = await openMar(page, '?dev=1&minijuego=canon&t=419&seed=3');
  expect(await page.evaluate(() => navigator.webdriver)).toBe(false);
  await expect(game(page)).toHaveAttribute('data-semilla', '3');
  const before = await balances(page);
  const end = page.getByTestId('mar-canon-final');
  await expect(end).toBeVisible({ timeout: 60_000 });
  await expect(game(page)).toHaveAttribute('data-fin', 'survived');
  await expect(end.getByRole('heading')).toHaveText(msg('mar.canon.fin.amanece'));
  await expect(game(page)).toHaveAttribute('data-premio', 'test_start', { timeout: 15_000 });
  await expect(prize(page)).toHaveText(msg('mar.canon.premio.prueba'));
  await page.waitForTimeout(1000);
  expect(await balances(page)).toEqual(before);
  await page.getByTestId('mar-canon-volver').click();
  await expect(canvas(page)).toHaveAttribute('data-canon', 'off');
  // Sin `win_minigame`: el logro «canon» no queda listo para reclamar.
  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-menu-logros').click();
  await expect(page.getByTestId('logro-canon')).toBeVisible();
  await expect(page.getByTestId('logro-canon')).not.toHaveAttribute('data-estado', 'ready');
  expect(errors).toEqual([]);
});

test('más de 5 minutos en pausa abandona la partida: vuelve el mundo, con aviso y sin premio', async ({
  page,
}) => {
  const errors = await openMar(page, '?minijuego=canon&seed=4');
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  await expect.poll(() => activeS(page), { timeout: 15_000 }).toBeGreaterThan(0.5);
  // La pestaña se oculta y el reloj salta 5 min y 1 s (como si la página se congelara).
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    const real = performance.now.bind(performance);
    performance.now = () => real() + 301_000;
  });
  await expect(page.getByTestId('mar-canon-aviso')).toContainText(msg('mar.canon.abandono'), {
    timeout: 15_000,
  });
  await expect(game(page)).toHaveAttribute('data-fin', 'abandoned');
  await expect(game(page)).toHaveAttribute('data-premio', 'abandoned');
  // Sin pantalla final: el mundo ya ha vuelto.
  await expect(page.getByTestId('mar-canon-final')).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });
  await expect(canvas(page)).toHaveAttribute('data-canon', 'off');
  await expect(canvas(page)).toHaveAttribute('data-ruta', 'on');
  await expect(canvas(page)).not.toHaveAttribute('data-escondido', /.+/);
  expect(errors).toEqual([]);
});

test('con la Boia Fiestera a bordo, sigue a bordo durante la partida y después', async ({
  page,
}) => {
  const spec = rescueMissionOf(WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config)!;
  const errors = await openMar(page, `?cerca=${spec.characterId}`);
  await expect(mar(page)).toHaveAttribute('data-mision', 'waiting');
  await steerTo(
    page,
    spec.characterId,
    async () => (await mar(page).getAttribute('data-mision')) === 'aboard',
  );
  await expect(mar(page)).toHaveAttribute('data-mision', 'aboard');

  // Una partida (otra visita, con el atajo): ella no se baja.
  await openMar(page, '?minijuego=canon&t=418&seed=6');
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  await expect(mar(page)).toHaveAttribute('data-mision', 'aboard');
  await expect(page.getByTestId('mar-canon-final')).toBeVisible({ timeout: 60_000 });
  await expect(mar(page)).toHaveAttribute('data-mision', 'aboard');
  await page.getByTestId('mar-canon-volver').click();
  await expect(canvas(page)).toHaveAttribute('data-canon', 'off');
  // La misión sigue: su «?» va con ella, camino de su destino.
  await expect(mar(page)).toHaveAttribute('data-mision', 'aboard');
  const minimap = page.getByTestId('mar-minimapa').locator('canvas');
  await expect
    .poll(async () => (await minimap.getAttribute('data-mark-places')) ?? '')
    .toContain(spec.destination);
  expect(errors).toEqual([]);
});

test('el panel de la isla ofrece tres dificultades con Normal marcada y la elegida empieza la partida (T131)', async ({
  page,
}) => {
  const errors = await openMar(page, '?minijuego=canon&oferta=1');
  await expect(panel(page)).toBeVisible({ timeout: 15_000 });
  const group = panel(page).getByTestId('mar-canon-dificultad');
  await expect(group).toBeVisible();
  const option = (id: string) => panel(page).getByTestId(`mar-canon-dificultad-${id}`);
  for (const id of ['tranquila', 'normal', 'tormenta']) {
    await expect(option(id)).toHaveText(msg(`mar.canon.dificultad.${id}` as MessageKey));
    await expect(option(id)).toHaveAttribute('aria-checked', id === 'normal' ? 'true' : 'false');
  }
  // Con el teclado: la flecha mueve la selección; con el dedo o el ratón: un toque.
  await option('normal').focus();
  await page.keyboard.press('ArrowLeft');
  await expect(option('tranquila')).toHaveAttribute('aria-checked', 'true');
  await option('tormenta').dispatchEvent('click');
  await expect(option('tormenta')).toHaveAttribute('aria-checked', 'true');
  await expect(option('normal')).toHaveAttribute('aria-checked', 'false');
  await panel(page)
    .getByRole('button', { name: msg('juego.minigameLayer.jugar') })
    .click();
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  await expect(game(page)).toHaveAttribute('data-dificultad', 'tormenta');
  expect(errors).toEqual([]);
});

test('`&dificultad=tormenta` (atajo de desarrollo) empieza con esa dificultad; sin él, Normal (T131)', async ({
  page,
}) => {
  const errors = await openMar(page, '?minijuego=canon&seed=7&dificultad=tormenta');
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  await expect(game(page)).toHaveAttribute('data-dificultad', 'tormenta');
  const again = await openMar(page, '?minijuego=canon&seed=7');
  await expect(game(page)).toHaveAttribute('data-dificultad', 'normal');
  expect([...errors, ...again]).toEqual([]);
});
