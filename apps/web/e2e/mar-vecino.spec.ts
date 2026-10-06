import { DEFENSE_CONFIG } from '@boia/engine/defense';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { openMar } from './mar-helpers';

/**
 * El Vecino Quejica de Blender (plan 015, T174): en el Cañón y en el castillo
 * su GLB (art/enemigos/3d/vecino.glb, de tools/blender/enemigos/vecino.py)
 * sustituye a la barcaza de a mano en cuanto llega; el lienzo lo dice en
 * `data-canon-vecino` y `data-arena-vecino`. Corre en móvil y en escritorio.
 *
 * Con RECORD_T174=<carpeta> deja ahí las capturas de la hoja de contacto: el
 * Vecino en el Cañón (justo cuando entra, `t=145`) y en la arena del
 * castillo (con el primer boss en el camino), por proyecto.
 */

test.describe.configure({ timeout: 180_000 });

const canvas = (page: Page) => page.getByTestId('mar-canvas');
const GLB = '/api/art/enemigos/3d/vecino.glb';

async function snap(page: Page, name: string) {
  const dir = process.env.RECORD_T174;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(dir, `${name}-${test.info().project.name}.png`) });
}

function watchGlb(page: Page): string[] {
  const seen: string[] = [];
  page.on('response', (r) => {
    if (r.url().endsWith(GLB)) seen.push(String(r.status()));
  });
  return seen;
}

test('en el Cañón, el Vecino llega con su modelo de Blender', async ({ page }) => {
  const glb = watchGlb(page);
  // Justo antes de que entre el Vecino (acto 1, 150 s), con la semilla de las guías.
  const errors = await openMar(page, '?minijuego=canon&t=145&seed=7');
  await expect(page.getByTestId('mar-canon')).toHaveAttribute('data-estado', 'running');
  await expect(canvas(page)).toHaveAttribute('data-canon-vecino', 'glb', { timeout: 30_000 });
  expect(glb).toEqual(['200']);
  // El boss en pantalla, ya con el modelo.
  await expect(canvas(page)).toHaveAttribute('data-canon-boss-vista', /vecino/, { timeout: 30_000 });
  await snap(page, 'vecino-canon');
  expect(errors).toEqual([]);
});

test('en el castillo, el mismo modelo en la arena', async ({ page }) => {
  const glb = watchGlb(page);
  // La partida de 5 min: el Vecino es su primer boss, a su fracción del tiempo.
  const run = DEFENSE_CONFIG.runs[5]!;
  const vecino = run.bosses.find((b) => b.kind === 'vecino')!;
  const t = Math.round(vecino.atFrac * run.durationS) - 3;
  const errors = await openMar(page, `?minijuego=castillo&duracion=5&dificultad=tranquila&t=${t}&islas=1&seed=7`);
  await expect(page.getByTestId('mar-castillo')).toHaveAttribute('data-estado', 'running');
  await expect(canvas(page)).toHaveAttribute('data-arena-vecino', 'glb', { timeout: 30_000 });
  expect(glb).toEqual(['200']);
  await expect(canvas(page)).toHaveAttribute('data-arena-tipos', /vecino/, { timeout: 60_000 });
  await snap(page, 'vecino-castillo');
  expect(errors).toEqual([]);
});
