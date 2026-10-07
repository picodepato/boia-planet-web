import { INFO_BOIES, WORLD_REGISTRY } from '@boia/world';
import { expect, test, type Page } from '@playwright/test';
import { marWorld } from '../../app/mar/engine/compact';
import { mar, marSheet, openMar, sheetIs, shipAt, steerTo } from '../mar-helpers';
import { shot } from './deck-helpers';

/**
 * Capturas de la parte 5 (el océano `/mar`, plan 018 T208): la llegada, el
 * HUD y sus paneles, el puerto y la tienda de barcos, las nueve islas, la
 * Boia Fiestera, los personajes y lo que se recoge, los secretos y los
 * descuentos escondidos. Móvil 390×844, contenido `muestra`; cada captura
 * parte de un perfil nuevo.
 */

test.describe.configure({ timeout: 240_000 });

/** Abre el mar junto a `id` y navega hasta que se abre su ficha. */
async function fichaDe(page: Page, id: string, tipo?: string) {
  await openMar(page, `?cerca=${id}`);
  const done = tipo ? sheetIs(page, tipo) : async () => (await marSheet(page).count()) > 0;
  await steerTo(page, id, done, { ms: 90_000 });
  await expect(marSheet(page)).toBeVisible();
}

test('llegada', async ({ page }) => {
  await openMar(page, '?menu=bienvenida');
  await expect(page.getByTestId('mar-bienvenida')).toBeVisible();
  await shot(page, '05', 'llegada', { respiro: 1500 });
});

test('navegando', async ({ page }) => {
  await openMar(page);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(1800);
  await page.keyboard.up('ArrowUp');
  await shot(page, '05', 'navegando', { respiro: 1500 });
});

test('menu', async ({ page }) => {
  await openMar(page);
  await page.getByTestId('mar-logros').click();
  await expect(page.getByTestId('mar-menu')).toBeVisible();
  await shot(page, '05', 'menu', { respiro: 1000 });
});

test('ayuda', async ({ page }) => {
  await openMar(page);
  await page.getByTestId('mar-ayuda-abrir').click();
  await expect(page.getByTestId('mar-ayuda')).toBeVisible();
  await shot(page, '05', 'ayuda', { respiro: 1000 });
});

test('entradas', async ({ page }) => {
  await openMar(page);
  await page.getByTestId('mar-entradas').click();
  await expect(page.getByTestId('mar-entradas-panel')).toBeVisible();
  await shot(page, '05', 'entradas', { respiro: 1000 });
});

test('mapa', async ({ page }) => {
  await openMar(page);
  await page.getByTestId('mar-minimapa').click();
  await page.waitForTimeout(2500);
  await shot(page, '05', 'mapa', { respiro: 1500 });
});

test('puerto y tienda de barcos', async ({ page }) => {
  await fichaDe(page, 'cala');
  await shot(page, '05', 'puerto', { respiro: 1500 });
  await marSheet(page).getByTestId('puerto-barcos').click();
  await expect(page.getByTestId('mar-tienda')).toBeVisible();
  // La fila de «Botijo» (el barco de serie del Mundo principal) arriba.
  await page
    .getByTestId('mar-tienda')
    .getByTestId('barco-estilo-arcilla')
    .evaluate((el) => {
      // Sólo se desplaza la hoja de la tienda (no la página): su primer padre con scroll.
      let box = el.parentElement;
      while (
        box &&
        !(
          box.scrollHeight > box.clientHeight + 4 &&
          /auto|scroll/.test(getComputedStyle(box).overflowY)
        )
      )
        box = box.parentElement;
      if (box)
        box.scrollTop += el.getBoundingClientRect().top - box.getBoundingClientRect().top - 12;
      window.scrollTo(0, 0);
    });
  await shot(page, '05', 'tienda-barcos', { respiro: 1500 });
});

const ISLAS = [
  ['halloween', 'halloween'],
  ['allday', 'sonido'],
  ['ultima', 'nochevieja'],
  ['fotos', 'benidorm'],
  ['tienda', 'ibiza'],
  ['faro', 'tabarca'],
] as const;

for (const [id, nombre] of ISLAS) {
  test(`isla ${nombre}`, async ({ page }) => {
    await fichaDe(page, id);
    await shot(page, '05', nombre, { respiro: 2000 });
  });
}

/** Las islas de minijuego abren su panel (`panel-minijuego`), no una ficha. */
test('isla castillo', async ({ page }) => {
  await openMar(page, '?cerca=castillo');
  const panel = page.getByTestId('panel-minijuego');
  await steerTo(page, 'castillo', async () => (await panel.count()) > 0, { ms: 90_000 });
  await expect(panel).toBeVisible();
  await shot(page, '05', 'castillo', { respiro: 2000 });
});

test('fiestera', async ({ page }) => {
  // El Remanso de los Cocodrilos con la Fiestera esperando, antes de arrimarse.
  await openMar(page, '?cerca=fiestera');
  await expect(mar(page)).toHaveAttribute('data-mision', 'waiting');
  await shot(page, '05', 'fiestera', { respiro: 2500 });
});

test('naufrago y mis codigos', async ({ page }) => {
  await fichaDe(page, 'naufrago', 'discount');
  await shot(page, '05', 'naufrago', { respiro: 1500 });
  await openMar(page);
  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-mis-codigos').click();
  await page.waitForTimeout(800);
  await shot(page, '05', 'codigos', { respiro: 1000 });
});

test('boia que habla', async ({ page }) => {
  const boia = INFO_BOIES[0]!;
  await openMar(page, `?cerca=${boia.id}`);
  const bubble = page.getByTestId('mar-bocadillo');
  await steerTo(page, boia.id, async () => (await bubble.count()) > 0, { ms: 90_000 });
  await expect(bubble).toBeVisible();
  await shot(page, '05', 'boia-habla', { respiro: 1200 });
});

test('whatsapp', async ({ page }) => {
  // A golpes cortos y frenando, como world-community.spec: si el barco se pasa
  // de largo, la ficha se cierra y sale el bocadillo del náufrago, que está al lado.
  await openMar(page, '?cerca=puerto-whatsapp');
  const boia = marWorld(WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config).objects.find(
    (o) => o.identity.id === 'puerto-whatsapp',
  )!.position;
  const invitacion = page.getByTestId('whatsapp-invitacion');
  for (let golpe = 0; golpe < 40; golpe++) {
    const barco = await shipAt(page);
    const dx = boia.x - barco.x;
    const dy = boia.y - barco.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 80 && (await invitacion.isVisible())) break;
    const teclas: string[] = [];
    if (dx / d > 0.35) teclas.push('ArrowRight');
    if (dx / d < -0.35) teclas.push('ArrowLeft');
    if (dy / d > 0.35) teclas.push('ArrowDown');
    if (dy / d < -0.35) teclas.push('ArrowUp');
    for (const k of teclas) await page.keyboard.down(k);
    await page.waitForTimeout(100);
    for (const k of teclas) await page.keyboard.up(k);
    await expect(page.locator('.mar-speed strong')).toHaveText('0');
  }
  await expect(invitacion).toBeVisible();
  await shot(page, '05', 'whatsapp', { respiro: 800 });
});

test('delfin', async ({ page }) => {
  await openMar(page, '?delfin=1');
  await page.keyboard.down('ArrowLeft');
  try {
    await expect(mar(page)).toHaveAttribute('data-delfin', 'guiando', { timeout: 30_000 });
  } finally {
    await page.keyboard.up('ArrowLeft');
  }
  await shot(page, '05', 'delfin', { respiro: 800 });
});

test('botella', async ({ page }) => {
  await openMar(page);
  const cerca = page.locator('[data-testid^="mar-botella-cerca-"]').first();
  await expect(cerca).toBeVisible({ timeout: 20_000 });
  await cerca.click();
  await expect(page.getByTestId('mar-botella')).toBeVisible();
  await shot(page, '05', 'botella', { respiro: 1000 });
});

test('anfora', async ({ page }) => {
  await fichaDe(page, 'secreto-anfora', 'discount');
  await shot(page, '05', 'anfora', { respiro: 1500 });
});

test('cueva', async ({ page }) => {
  await openMar(page, '?cerca=secreto-cueva');
  const aviso = page.getByTestId('mar-aviso').filter({ hasText: /monedas/ });
  await steerTo(page, 'secreto-cueva', async () => (await aviso.count()) > 0, { ms: 90_000 });
  await shot(page, '05', 'cueva', { respiro: 300 });
});
