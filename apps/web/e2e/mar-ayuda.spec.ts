import { INFO_BOIES } from '@boia/world';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { t } from '../lib/i18n';
import { WELCOME_TIPS } from '../lib/mundo/menu/sections/welcome';
import { openMar, steerTo } from './mar-helpers';

/**
 * Decisiones de Hernán y Álvaro del 2026-10-02 (T68), en el móvil (375×812,
 * proyecto `mobile`) y en escritorio (`desktop`):
 *
 * - Welcome Aboard corta tras «Zarpar» (`?menu=bienvenida`, lo que abre la
 *   entrada): el título en negrita, la frase, el objetivo, dos consejos, «A
 *   navegar» y «Comprar entradas», que abre «Elige tu evento» en el mar.
 * - Nada guía solo: al cerrarla no hay mensaje en el centro ni chips de
 *   rumbo, tampoco después de hablar con una boia informativa.
 * - El «?» bajo el menú: el objetivo y una pista, y su «Rumbo a…» fija rumbo.
 * - Arriba: Fotos, Shop, Artistas, Contacto y Carnet, en ese orden.
 * - El minimapa pequeño, centrado: el centro del planeta pintado cae en el
 *   centro de su caja (±2 px), como en el mapa grande.
 *
 * Con RECORD_T68=1 deja capturas en docs/informes/img/ p006-t68-*.png.
 */

test.describe.configure({ timeout: 150_000 });

const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../docs/informes/img',
);

async function snap(page: Page, name: string) {
  if (!process.env.RECORD_T68) return;
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, name) });
}

/** Lo que el mar no debe poner por su cuenta (T68): chips de rumbo ni mensajes. */
async function expectNoGuidance(page: Page) {
  await expect(page.getByTestId('mar-guia')).toHaveCount(0);
  await expect(page.getByTestId('mar-rumbo-activo')).toHaveCount(0);
  await expect(page.locator('.mar-chips .mar-chip')).toHaveCount(0);
  await expect(page.locator('.mar-help')).toHaveCount(0);
  await expect(page.getByTestId('mar-ayuda')).toHaveCount(0);
}

const VIEWS = [
  { name: 'móvil 375×812', project: 'mobile', viewport: { width: 375, height: 812 } },
  { name: 'escritorio', project: 'desktop', viewport: undefined },
] as const;

for (const view of VIEWS) {
  test.describe(`T68 en ${view.name}`, () => {
    if (view.viewport) test.use({ viewport: view.viewport });
    test.beforeEach(() => {
      test.skip(test.info().project.name !== view.project, `sólo en el proyecto ${view.project}`);
    });

    test('Welcome Aboard corta: título, frase, objetivo, dos consejos y sus dos botones', async ({
      page,
    }) => {
      const errors = await openMar(page, '?menu=bienvenida');
      const welcome = page.getByTestId('mar-bienvenida');
      await expect(welcome).toBeVisible();
      const title = welcome.getByTestId('mar-bienvenida-titulo');
      await expect(title).toHaveText(t('mar.bienvenida.titulo'));
      expect(await title.evaluate((el) => el.tagName)).toBe('STRONG');
      const text = welcome.getByTestId('bienvenida-texto');
      await expect(text).toHaveText(t('mar.bienvenida.texto'));
      expect(Number(await text.evaluate((el) => getComputedStyle(el).fontWeight))).toBeLessThan(
        600,
      );
      await expect(welcome.getByTestId('bienvenida-objetivo')).toHaveText(
        t('mar.bienvenida.objetivo'),
      );
      await expect(welcome.getByTestId('bienvenida-consejos').locator('li')).toHaveText(
        WELCOME_TIPS.map((k) => t(k)),
      );
      const go = welcome.getByTestId('mar-bienvenida-navegar');
      const buy = welcome.getByTestId('mar-bienvenida-entradas');
      await expect(go).toHaveText(t('mar.bienvenida.aNavegar'));
      await expect(buy).toHaveText(t('mar.bienvenida.comprar'));
      await expect(go).toBeInViewport();
      await expect(buy).toBeInViewport();
      // «A navegar» grande y naranja, encima; «Comprar entradas» debajo.
      const [g, b] = [(await go.boundingBox())!, (await buy.boundingBox())!];
      expect(g.y + g.height).toBeLessThanOrEqual(b.y + 1);
      expect(g.height).toBeGreaterThanOrEqual(b.height);
      expect(await go.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
        await buy.evaluate((el) => getComputedStyle(el).backgroundColor),
      );
      await snap(page, `p006-t68-bienvenida-${view.project}.png`);

      // «Comprar entradas»: «Elige tu evento», dentro del mar.
      await buy.click();
      await expect(welcome).toHaveCount(0);
      const tickets = page.getByTestId('mar-entradas-panel');
      await expect(tickets).toBeVisible();
      await expect(page).toHaveURL(/\/mar/);
      await expect(tickets.getByTestId(/^mar-entradas-comprar-/).first()).toBeVisible();
      expect(errors).toEqual([]);
    });

    test('«A navegar» deja el mar libre: sin mensajes ni chips, tampoco tras una boia informativa', async ({
      page,
    }) => {
      const boia = INFO_BOIES[0]!;
      const errors = await openMar(page, `?menu=bienvenida&cerca=${boia.id}`);
      await page.getByTestId('mar-bienvenida-navegar').click();
      await expect(page.getByTestId('mar-bienvenida')).toHaveCount(0);
      await page.waitForTimeout(1500);
      await expectNoGuidance(page);

      // Habla con la boia informativa y se cierra su bocadillo: ni chip ni rumbo.
      const bubble = page.getByTestId('mar-bocadillo');
      await steerTo(page, boia.id, async () => (await bubble.count()) > 0);
      await expect(bubble).toBeVisible();
      await page.getByTestId('mar-bocadillo-cerrar').click();
      await expect(bubble).toHaveCount(0);
      await page.waitForTimeout(1500);
      await expectNoGuidance(page);
      expect(errors).toEqual([]);
    });

    test('el «?» bajo el menú: el objetivo, una pista y su «Rumbo a…»', async ({ page }) => {
      const errors = await openMar(page);
      const menuBtn = (await page.getByTestId('mar-logros').boundingBox())!;
      const open = page.getByTestId('mar-ayuda-abrir');
      await expect(open).toBeVisible();
      const q = (await open.boundingBox())!;
      // Pequeño y justo debajo del botón del menú, en su columna.
      expect(q.width).toBeLessThan(menuBtn.width);
      expect(q.y).toBeGreaterThanOrEqual(menuBtn.y + menuBtn.height);
      expect(q.y - (menuBtn.y + menuBtn.height)).toBeLessThan(24);
      expect(Math.abs(q.x + q.width / 2 - (menuBtn.x + menuBtn.width / 2))).toBeLessThan(2);

      await open.click();
      const help = page.getByTestId('mar-ayuda');
      await expect(help).toBeVisible();
      await expect(help).toBeInViewport({ ratio: 1 });
      await expect(help.getByTestId('mar-ayuda-objetivo')).toHaveText(t('mar.bienvenida.objetivo'));
      await expect(help.getByTestId('mar-ayuda-pista')).toContainText(t('mar.ayuda.pista'));
      await snap(page, `p006-t68-ayuda-${view.project}.png`);

      // La pista: su «Rumbo a…» fija el rumbo y cierra la ayuda.
      const hint = help.getByTestId('mar-ayuda-rumbo-pista');
      await expect(hint).toBeVisible();
      await hint.click();
      await expect(help).toHaveCount(0);
      await expect(page.getByTestId('mar-rumbo-activo')).toBeVisible();

      // El del objetivo, también (a la Boia Fiestera).
      await open.click();
      const objective = help.getByTestId('mar-ayuda-rumbo-objetivo');
      await expect(objective).toHaveText(t('mar.guide.fiestera'));
      await expect(objective).toHaveAttribute('data-destino', /.+/);
      await objective.click();
      await expect(help).toHaveCount(0);
      await expect(page.getByTestId('mar-rumbo-activo')).toBeVisible();

      // Otro toque al «?» la abre y otro la cierra.
      await open.click();
      await expect(help).toBeVisible();
      await open.click();
      await expect(help).toHaveCount(0);
      expect(errors).toEqual([]);
    });

    test('arriba: Fotos, Shop, Artistas, Contacto y Carnet; el minimapa, centrado', async ({
      page,
    }) => {
      const errors = await openMar(page);
      await expect(page.getByTestId('mar-enlaces').locator('a, button')).toHaveText([
        t('mar.hud.fotos'),
        t('mar.hud.shop'),
        t('mar.hud.artistas'),
        t('mar.hud.contacto'),
        t('mar.hud.carnet'),
      ]);

      // El centro del planeta pintado en el minimapa, en el centro de su caja (±2 px).
      const mini = page.getByTestId('mar-minimapa');
      const canvas = mini.locator('canvas');
      await expect(canvas).toHaveAttribute('data-centro', /\d/);
      const drawn = async () => {
        const [cx, cy] = ((await canvas.getAttribute('data-centro')) ?? '0,0')
          .split(',')
          .map(Number);
        const c = (await canvas.boundingBox())!;
        const m = (await mini.boundingBox())!;
        return {
          dx: c.x + cx! - (m.x + m.width / 2),
          dy: c.y + cy! - (m.y + m.height / 2),
        };
      };
      const first = await drawn();
      expect(Math.abs(first.dx)).toBeLessThanOrEqual(2);
      expect(Math.abs(first.dy)).toBeLessThanOrEqual(2);
      // Y sigue centrado mientras el planeta gira (se repinta varias veces).
      const frames = Number((await canvas.getAttribute('data-frames')) ?? 0);
      await expect
        .poll(async () => Number((await canvas.getAttribute('data-frames')) ?? 0))
        .toBeGreaterThan(frames + 3);
      const later = await drawn();
      expect(Math.abs(later.dx)).toBeLessThanOrEqual(2);
      expect(Math.abs(later.dy)).toBeLessThanOrEqual(2);
      await snap(page, `p006-t68-hud-${view.project}.png`);
      expect(errors).toEqual([]);
    });
  });
}
