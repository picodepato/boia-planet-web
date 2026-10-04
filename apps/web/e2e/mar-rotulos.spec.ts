import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseIslandManifest } from '../app/mar/engine/island-models';
import { HUD_MARGIN, PIN_AVOID } from '../app/mar/engine/labels';
import { t } from '../lib/i18n';
import { repoRoot } from '../lib/barco/load';
import { openMar } from './mar-helpers';

/**
 * Los rótulos de las islas en /mar (T75): cerca de cada isla de Blender
 * (las del manifiesto de art/islas/3d), en un móvil de 375×812 y en
 * escritorio, ningún rótulo a la vista pisa la barra de enlaces de arriba
 * (ni otro mando) y el de la isla va sobre su propio modelo: encima de su
 * alto real (no el de la composición a mano) o, si de cerca la cima queda
 * bajo los mandos, justo debajo de ellos sobre la isla. Las luces de a mano
 * de la isla se apagan con el modelo.
 *
 * Con RECORD_T75=1 deja capturas en docs/informes/img/p006-t75-<isla>-<proyecto>.png.
 */

test.describe.configure({ timeout: 120_000 });

const ISLANDS = [
  ...parseIslandManifest(
    JSON.parse(readFileSync(path.join(repoRoot(), 'art/islas/3d/manifest.json'), 'utf8')),
  ).keys(),
].sort();

const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../docs/informes/img',
);

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const overlaps = (a: Box, b: Box) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/** Lo que se ve ahora: la barra de enlaces, los rótulos encendidos y las islas de Blender. */
async function look(page: Page) {
  return page.evaluate((avoid) => {
    const box = (r: DOMRect) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="mar-canvas"]')!;
    const c = canvas.getBoundingClientRect();
    const islands: Record<string, { left: number; top: number; right: number; bottom: number }> =
      {};
    for (const part of (canvas.dataset.islasPantalla ?? '').split(' ').filter(Boolean)) {
      const [id, nums] = part.split(':');
      const [l, t, r, b] = nums!.split(',').map(Number);
      islands[id!] = { left: l! + c.left, top: t! + c.top, right: r! + c.left, bottom: b! + c.top };
    }
    return {
      links: box(document.querySelector('[data-testid="mar-enlaces"]')!.getBoundingClientRect()),
      pins: [...document.querySelectorAll<HTMLElement>('.mar-pin.is-on[data-pin]')].map((el) => ({
        id: el.dataset.pin!,
        ...box(el.getBoundingClientRect()),
      })),
      islands,
      hud: [...document.querySelectorAll(avoid)]
        .map((el) => box(el.getBoundingClientRect()))
        .filter((r) => r.right > r.left && r.bottom > r.top),
    };
  }, PIN_AVOID);
}

/** Lo que se ve, ya quieto: el rótulo de la isla en el mismo sitio dos lecturas seguidas. */
async function settled(page: Page, island: string) {
  let seen = await look(page);
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(300);
    const now = await look(page);
    const a = seen.pins.find((p) => p.id === island);
    const b = now.pins.find((p) => p.id === island);
    seen = now;
    if (a && b && Math.abs(a.left - b.left) < 1 && Math.abs(a.bottom - b.bottom) < 1) break;
  }
  return seen;
}

type Seen = Awaited<ReturnType<typeof look>>;

/** Ningún rótulo a la vista pisa la barra de enlaces ni otro mando; el de la isla, sobre ella. */
function checkClear(seen: Seen, island: string) {
  expect(seen.pins.length).toBeGreaterThan(0);
  for (const p of seen.pins) {
    expect(overlaps(p, seen.links), `${p.id} pisa la barra de enlaces`).toBe(false);
    for (const h of seen.hud) expect(overlaps(p, h), `${p.id} pisa un mando`).toBe(false);
  }
  const label = seen.pins.find((p) => p.id === island);
  const body = seen.islands[island];
  expect(label, 'rótulo de la isla').toBeTruthy();
  expect(body, 'la isla en pantalla').toBeTruthy();
  // Centrado sobre su isla y nunca por debajo de ella.
  const mid = (label!.left + label!.right) / 2;
  expect(mid).toBeGreaterThan(body!.left);
  expect(mid).toBeLessThan(body!.right);
  expect(label!.bottom).toBeLessThan(body!.bottom);
  return { label: label!, body: body! };
}

const shot = async (page: Page, name: string) => {
  if (!process.env.RECORD_T75) return;
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, name) });
};

for (const island of ISLANDS) {
  test(`cerca de ${island}: rótulos fuera de la barra de arriba y el suyo sobre su modelo`, async ({
    page,
  }) => {
    const project = test.info().project.name;
    if (project === 'mobile') await page.setViewportSize({ width: 375, height: 812 });
    const errors = await openMar(page, `?cerca=${island}`);
    const canvas = page.getByTestId('mar-canvas');
    await expect
      .poll(() => canvas.getAttribute('data-islas-modelo'), { timeout: 30_000 })
      .toContain(`${island}:glb`);
    // Con el modelo puesto, sus luces de a mano se apagan.
    await expect(canvas).toHaveAttribute('data-islas-sin-luces', new RegExp(`(^| )${island}( |$)`));

    // 1. Con el zoom de salida: de cerca, una isla alta llega hasta la barra
    //    de arriba; su rótulo no se esconde debajo, baja sobre la isla.
    await expect(page.locator(`.mar-pin.is-on[data-pin="${island}"]`)).toHaveCount(1, {
      timeout: 15_000,
    });
    const first = await settled(page, island);
    const near = checkClear(first, island);
    // O va encima de su modelo, o (si la cima queda bajo los mandos) bajado lo
    // justo: pegado por debajo del mando que tiene encima.
    if (near.label.bottom > near.body.top + 2) {
      const { label } = near;
      // El borde de abajo del mando más bajo que tiene encima (o el de la pantalla).
      const above = Math.max(
        0,
        ...first.hud
          .filter(
            (h) =>
              h.left - HUD_MARGIN < label.right &&
              h.right + HUD_MARGIN > label.left &&
              h.bottom <= label.top + 1,
          )
          .map((h) => h.bottom),
      );
      expect(
        label.top - above,
        `bajado lo justo bajo los mandos: ${JSON.stringify({ label, hud: first.hud, body: near.body })}`,
      ).toBeLessThanOrEqual(HUD_MARGIN + 4);
    }
    await shot(page, `p006-t75-${island}-${project}.png`);

    // 2. Algo más lejos, con la isla entera a la vista: el rótulo, encima de su modelo.
    const alejar = page.getByRole('button', { name: t('mar.client.alejar') });
    let seen = await settled(page, island);
    for (let i = 0; i < 6; i++) {
      const body = seen.islands[island];
      const label = seen.pins.find((p) => p.id === island);
      // Lo bastante lejos para que el rótulo quepa encima del modelo; en el móvil los
      // mandos de la izquierda (T65) lo bajan si la isla queda pegada a ellos.
      if (body && label && body.top > seen.links.bottom + 60 && label.bottom <= body.top + 2) break;
      await alejar.click();
      seen = await settled(page, island);
    }
    const far = checkClear(seen, island);
    expect(far.label.bottom).toBeLessThanOrEqual(far.body.top + 2);
    await shot(page, `p006-t75-${island}-${project}-lejos.png`);
    expect(errors).toEqual([]);
  });
}
