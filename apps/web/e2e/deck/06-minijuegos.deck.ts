import { circuitFromWorld } from '@boia/engine/circuit';
import { SURVIVORS_CONFIG } from '@boia/engine/survivors';
import { CIRCUIT_ID, WORLD_REGISTRY } from '@boia/world';
import { expect, test, type Page } from '@playwright/test';
import { marWorld } from '../../app/mar/engine/compact';
import { lapTargets } from '../../app/mar/race';
import { t } from '../../lib/i18n';
import { openMar } from '../mar-helpers';
import { shot } from './deck-helpers';

/**
 * Capturas de la parte 6 (Minijuegos), en móvil y en modo local (D-20): Los
 * Rápidos (la tarjeta de la salida, en carrera y la meta), el Cañón «Que no
 * pare la música» (el pop-up desde el panel de su isla, una partida llena, la
 * carta de nivel, el Kraken y la tarjeta final) y la Defensa del Castillo (el
 * pop-up, una partida con las islas puestas, la lista de islas y la tarjeta
 * de una victoria en Tormenta). Las partidas usan los atajos de desarrollo de
 * `app/mar/survivors.ts` y `castillo.ts` (sólo en las e2e y en `pnpm dev`)
 * para llegar al momento de la foto sin jugar 7 minutos.
 */

test.describe.configure({ timeout: 420_000 });

const P = '06';

// ── Los Rápidos ──────────────────────────────────────────────────────────────

const world = marWorld(WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config);
const circuit = circuitFromWorld(world, CIRCUIT_ID)!;
const targets = lapTargets(world, circuit);
const start = targets.at(-1)!;

type Point = { x: number; y: number };

/**
 * Pilota dentro de la página con las flechas, un paso por fotograma (como
 * `e2e/mar-circuito.spec.ts`): `offer` hasta la tarjeta de la salida, `race`
 * boia a boia hasta la meta (o hasta `ms`).
 */
async function pilot(page: Page, goal: 'offer' | 'race', ms: number): Promise<string> {
  return page.evaluate(
    async ({ goal, targets, start, ms }) => {
      const main = document.querySelector<HTMLElement>('main.mar')!;
      const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
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
      const steer = (p: Point) => {
        const [x, y] = (main.dataset.barco ?? '0,0').split(',').map(Number);
        const dx = p.x - x!;
        const dy = p.y - y!;
        const d = Math.hypot(dx, dy) || 1;
        const keys: string[] = [];
        if (dx / d > 0.38) keys.push('ArrowRight');
        if (dx / d < -0.38) keys.push('ArrowLeft');
        if (dy / d > 0.38) keys.push('ArrowDown');
        if (dy / d < -0.38) keys.push('ArrowUp');
        press(keys);
      };
      const until = performance.now() + ms;
      try {
        while (performance.now() < until) {
          const chip = q('mar-crono');
          if (goal === 'offer') {
            if (q('mar-carrera-oferta')) return 'offer';
            steer(start);
          } else {
            if (q('mar-carrera-final')) return 'ok';
            if (!chip) return 'sin carrera';
            const buoy = Number(chip.dataset.boia);
            steer(buoy === 0 ? start : targets[buoy - 1]!);
          }
          await new Promise((r) => requestAnimationFrame(r));
        }
        return 'tiempo';
      } finally {
        press([]);
      }
    },
    { goal, targets, start, ms },
  );
}

/** Hasta la salida, «Empezar» y la cuenta atrás hasta «¡Ya!». */
async function startRace(page: Page): Promise<void> {
  expect(await pilot(page, 'offer', 120_000)).toBe('offer');
  await page.getByTestId('mar-carrera-empezar').click();
  await expect(page.getByTestId('mar-crono')).toHaveAttribute('data-fase', 'racing', {
    timeout: 20_000,
  });
}

test('Los Rápidos: la salida, en carrera y la meta', async ({ page }) => {
  await openMar(page, `?cerca=${start.id}`);
  expect(await pilot(page, 'offer', 120_000)).toBe('offer');
  await expect(page.getByTestId('mar-carrera-oferta')).toBeVisible();
  await shot(page, P, 'rapidos-oferta');

  await page.getByTestId('mar-carrera-empezar').click();
  await expect(page.getByTestId('mar-crono')).toHaveAttribute('data-fase', 'racing', {
    timeout: 20_000,
  });
  // Unos segundos de carrera hacia las boias: el cronómetro arriba y el barco lanzado.
  await pilot(page, 'race', 7_000);
  await expect(page.getByTestId('mar-crono')).toBeVisible();
  await shot(page, P, 'rapidos-carrera', { respiro: 200 });

  // Hasta la meta; si el piloto se sale del circuito (la carrera se anula), otra salida.
  let outcome = await pilot(page, 'race', 240_000);
  for (let i = 0; i < 2 && outcome !== 'ok'; i++) {
    await startRace(page);
    outcome = await pilot(page, 'race', 240_000);
  }
  expect(outcome).toBe('ok');
  await expect(page.getByTestId('mar-carrera-final')).toBeVisible();
  await shot(page, P, 'rapidos-meta');
});

// ── El Cañón ─────────────────────────────────────────────────────────────────

const canon = (page: Page) => page.getByTestId('mar-canon');

/** Contesta la carta de nivel si hay una abierta (la partida espera). */
async function answerCard(page: Page): Promise<void> {
  if ((await canon(page).getAttribute('data-estado')) === 'card') await page.keyboard.press('Enter');
}

/**
 * La foto de la partida en marcha, sin una carta de nivel delante: una carta
 * espera a que se conteste, así que si la partida sigue `running` después
 * de la foto, no se abrió ninguna durante ella. Si se abrió, se contesta y
 * se repite.
 */
async function shotRunning(
  page: Page,
  name: string,
  ready: () => Promise<boolean> = async () => true,
): Promise<void> {
  for (let i = 0; i < 6; i++) {
    await expect
      .poll(
        async () => {
          await answerCard(page);
          return (await canon(page).getAttribute('data-estado')) === 'running' && (await ready());
        },
        { timeout: 60_000, intervals: [250] },
      )
      .toBe(true);
    await shot(page, P, name, { respiro: 150 });
    if ((await canon(page).getAttribute('data-estado')) === 'running') return;
  }
  throw new Error(`${name}: siempre salía una carta de nivel delante`);
}

test('Cañón: el pop-up antes de jugar', async ({ page }) => {
  await openMar(page, '?minijuego=canon&oferta=1');
  const panel = page.getByTestId('panel-minijuego');
  await expect(panel).toBeVisible({ timeout: 15_000 });
  await panel.getByRole('button', { name: t('juego.minigameLayer.jugar') }).click();
  await expect(page.getByTestId('mar-canon-previa')).toBeVisible({ timeout: 15_000 });
  await shot(page, P, 'canon-previa');
});

test('Cañón: una partida llena con las siete armas', async ({ page }) => {
  await openMar(page, '?minijuego=canon&armas=1&t=300&seed=7');
  await expect(canon(page)).toHaveAttribute('data-estado', /running|card/);
  // Navegando un rato y después quieto, para que el enjambre se eche encima.
  await page.keyboard.down('ArrowRight');
  for (let i = 0; i < 8; i++) {
    await answerCard(page);
    await page.waitForTimeout(500);
  }
  await page.keyboard.up('ArrowRight');
  for (let i = 0; i < 8; i++) {
    await answerCard(page);
    await page.waitForTimeout(500);
  }
  await shotRunning(page, 'canon-partida');
});

test('Cañón: la carta de nivel', async ({ page }) => {
  await openMar(page, '?minijuego=canon&seed=5&carta=1&t=120');
  await expect(page.getByTestId('mar-canon-carta').first()).toBeVisible({ timeout: 20_000 });
  await shot(page, P, 'canon-carta');
});

test('Cañón: el Kraken del acto 2', async ({ page }) => {
  const act2 = SURVIVORS_CONFIG.acts.find((a) => a.act === 2)!;
  const slot = act2.events.find((e) => e.type === 'boss' && e.enabled !== false)!;
  await openMar(page, `?minijuego=canon&acto=2&armas=1&t=${slot.atS + 5}&seed=7`);
  const canvas = page.getByTestId('mar-canvas');
  await expect(canvas).toHaveAttribute('data-canon-boss', /kraken:/, { timeout: 20_000 });
  // Navegando hasta verlo fuera del agua, en la vista.
  await page.keyboard.down('ArrowRight');
  await expect
    .poll(
      async () => {
        await answerCard(page);
        return (await canvas.getAttribute('data-canon-boss-vista')) ?? '';
      },
      { timeout: 120_000, intervals: [300] },
    )
    .toMatch(/kraken:(emerged|grabbing)/);
  await page.keyboard.up('ArrowRight');
  await shotRunning(page, 'canon-kraken', async () =>
    /kraken:(emerged|grabbing|emerging)/.test(
      (await canvas.getAttribute('data-canon-boss-vista')) ?? '',
    ),
  );
});

test('Cañón: la tarjeta final con el boss vencido', async ({ page }) => {
  // `vencer=1`: el boss final cae al llegar (5:30) y la partida acaba con el oro.
  await openMar(page, '?minijuego=canon&armas=1&t=305&vencer=1&seed=7');
  const end = page.getByTestId('mar-canon-final');
  await page.keyboard.down('ArrowRight');
  await expect
    .poll(
      async () => {
        await answerCard(page);
        return end.isVisible();
      },
      { timeout: 90_000, intervals: [400] },
    )
    .toBe(true);
  await page.keyboard.up('ArrowRight');
  await shot(page, P, 'canon-final');
});

// ── Defensa del Castillo ─────────────────────────────────────────────────────

test('Castillo: el pop-up antes de jugar', async ({ page }) => {
  await openMar(page, '?minijuego=castillo&oferta=1');
  const panel = page.getByTestId('panel-minijuego');
  await expect(panel).toBeVisible({ timeout: 15_000 });
  await panel.getByRole('button', { name: t('juego.minigameLayer.jugar') }).click();
  await expect(page.getByTestId('mar-castillo-previa')).toBeVisible({ timeout: 15_000 });
  await shot(page, P, 'castillo-previa');
});

test('Castillo: una partida con las siete islas puestas', async ({ page }) => {
  await openMar(page, '?minijuego=castillo&seed=7&islas=1&t=150&duracion=7');
  const canvas = page.getByTestId('mar-canvas');
  await expect(canvas).toHaveAttribute('data-hundido', '1.00', { timeout: 20_000 });
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-arena-enemigos')), {
      timeout: 30_000,
    })
    .toBeGreaterThan(3);
  await page.waitForTimeout(2_500);
  await shot(page, P, 'castillo-partida', { respiro: 200 });
});

test('Castillo: la lista de islas para construir', async ({ page }) => {
  await openMar(page, '?minijuego=castillo&seed=7&monedas=3000');
  await expect(page.getByTestId('mar-castillo-hud')).toBeVisible();
  await page.getByTestId('mar-castillo-construir').click();
  await expect(page.getByTestId('mar-castillo-islas')).toBeVisible();
  await shot(page, P, 'castillo-construir');
});

test('Castillo: victoria en Tormenta y la mascota de premio', async ({ page }) => {
  await openMar(page, '?minijuego=castillo&vencer=1&duracion=5&dificultad=tormenta');
  const end = page.getByTestId('mar-castillo-final');
  await expect(end).toBeVisible({ timeout: 30_000 });
  await expect(end).toHaveAttribute('data-fin', 'held');
  await shot(page, P, 'castillo-final');
});
