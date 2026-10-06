import { canBuy } from '@boia/contracts';
import { SENSITIVITY_RANGE, SETTINGS_KEY } from '@boia/engine/ui';
import { expect, test, type Page } from '@playwright/test';
import { PHOTOS_PLACE_ID, PHOTOS_SAIL_HREF } from '../lib/landing/access';
import { eventHref } from '../lib/landing/eventos';
import { SAMPLE_CONTENT } from '../lib/landing/sample-content';
import { heroTickets, tap } from './hero-helpers';

/**
 * Lo que sólo tenía el 2D, dentro del mar 3D (T55): los enlaces profundos de
 * la landing (`?ir=`, `?evento=`, `?menu=carnet`) arrancan con el barco
 * navegando a su isla o con Mi Carnet abierto; Mi Carnet se ve y se edita sin
 * salir del mar; Ajustes cambia la sensibilidad del giro que lee el motor
 * (`turnScale`), la música, los efectos y el idioma; Controles y Welcome
 * Aboard se consultan desde el Menú. Y todos los enlaces de la landing, el
 * Carnet y el Admin que llevaban al 2D llevan a /mar.
 */

test.describe.configure({ timeout: 120_000 });

const mar = (page: Page) => page.locator('main.mar');
const sheet = (page: Page) => page.getByTestId('mar-ficha');

async function openMar(page: Page, path: string) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(path);
  await expect(page.getByTestId('mar-canvas')).toBeVisible();
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 45_000 });
  return errors;
}

test('Mi Barco: al abrir y cerrar desde el menú, las flechas vuelven a mover el barco', async ({
  page,
}) => {
  const errors = await openMar(page, '/mar');
  const boat = async () =>
    ((await mar(page).getAttribute('data-barco')) ?? '').split(',').map(Number);
  await expect(mar(page)).toHaveAttribute('data-barco', /^-?\d+,-?\d+$/);
  // Repetir también con Escape y volviendo al menú: ninguna ruta necesita tocar el lienzo.
  for (const close of ['button', 'escape', 'menu'] as const) {
    if (close !== 'button') {
      // Una carga nueva crea el barco sin velocidad: la deriva de la ruta
      // anterior no puede hacer pasar la prueba con el teclado bloqueado.
      await page.reload();
      await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 45_000 });
      await expect(mar(page)).toHaveAttribute('data-barco', /^-?\d+,-?\d+$/);
    }
    await page.getByTestId('mar-logros').click();
    await page.getByTestId('mar-barco').click();
    await expect(page.getByTestId('mar-tienda')).toBeVisible();
    if (close === 'button') await page.getByTestId('mar-tienda-cerrar').click();
    else if (close === 'escape') await page.keyboard.press('Escape');
    else {
      await page.getByTestId('mar-hoja-menu').click();
      await page.getByTestId('mar-menu-cerrar').click();
    }
    await expect(page.getByTestId('mar-tienda')).toHaveCount(0);
    await expect(page.getByTestId('mar-menu')).toHaveCount(0);
    const [x, y] = await boat();
    // Sin clicar el mar ni cambiar artificialmente el foco tras cerrar.
    await page.keyboard.down('ArrowRight');
    try {
      await expect
        .poll(
          async () => {
            const [nx, ny] = await boat();
            return Math.hypot(nx! - x!, ny! - y!);
          },
          { timeout: 5000 },
        )
        .toBeGreaterThan(20);
    } finally {
      await page.keyboard.up('ArrowRight');
    }
  }
  expect(errors).toEqual([]);
});

// Un evento a la venta con isla: su ficha ofrece «Ir a su isla».
const islandEvent = SAMPLE_CONTENT.events.find((e) => canBuy(e) && e.islandId)!;

test('`/mar?ir=<Puerto de Fotos>` sale navegando hasta allí y abre la galería', async ({
  page,
}) => {
  const errors = await openMar(page, PHOTOS_SAIL_HREF);
  // El enlace se consume: una recarga no repite el viaje.
  await expect.poll(() => new URL(page.url()).searchParams.has('ir')).toBe(false);
  // Navegando (el viaje en turbo de la barra) y, al llegar, la galería.
  const voyage = page.getByTestId('mar-viaje');
  const seenSailing = page
    .locator(`[data-testid="mar-viaje"][data-lugar="${PHOTOS_PLACE_ID}"]`)
    .waitFor({ timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  await expect(mar(page)).toHaveAttribute('data-llegada', PHOTOS_PLACE_ID, { timeout: 60_000 });
  expect(await seenSailing, 'el barco navegó hasta el puerto').toBe(true);
  await expect(sheet(page)).toHaveAttribute('data-tipo', 'photos');
  await expect(sheet(page)).toHaveAttribute('data-lugar', PHOTOS_PLACE_ID);
  await expect(voyage).not.toHaveAttribute('data-lugar', /.+/);
  expect(errors).toEqual([]);
});

test('`/mar?evento=<slug>` sale navegando a la isla del evento y abre su ficha', async ({
  page,
}) => {
  expect(islandEvent, 'hay un evento a la venta con isla').toBeDefined();
  const errors = await openMar(page, `/mar?evento=${islandEvent.slug}`);
  await expect.poll(() => new URL(page.url()).searchParams.has('evento')).toBe(false);
  await expect(mar(page)).toHaveAttribute('data-llegada', islandEvent.islandId!, {
    timeout: 60_000,
  });
  await expect(sheet(page)).toHaveAttribute('data-tipo', 'event');
  await expect(sheet(page)).toHaveAttribute('data-lugar', islandEvent.islandId!);
  expect(errors).toEqual([]);
});

test('`/mar?menu=carnet` abre Mi Carnet en el mar: crear, ver y editar sin salir', async ({
  page,
}, info) => {
  const errors = await openMar(page, '/mar?menu=carnet');
  const carnet = page.getByTestId('mar-carnet');
  await expect(carnet).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.has('menu')).toBe(false);
  // Sin Carnet, la invitación; el alta y lo que ven los demás.
  await carnet.getByTestId('carnet-crear').click();
  const nickname = `Marinera ${info.project.name}`;
  await carnet.getByTestId('carnet-apodo-input').fill(nickname);
  await carnet.getByTestId('carnet-guardar').click();
  await expect(carnet.getByTestId('carnet-mio').getByTestId('carnet-apodo')).toHaveText(nickname);
  // Editar sin salir del mar.
  await carnet.getByTestId('carnet-editar').click();
  await carnet.getByTestId('carnet-apodo-input').fill(`${nickname} 2`);
  await carnet.getByTestId('carnet-guardar').click();
  await expect(carnet.getByTestId('carnet-apodo')).toHaveText(`${nickname} 2`);
  await expect(page).toHaveURL(/\/mar/);
  await carnet.getByTestId('mar-carnet-cerrar').click();
  await expect(carnet).toBeHidden();

  // Carnet, arriba (T65), lo abre también, sin navegar: el menú del juego en Mi Carnet.
  await page.getByTestId('mar-enlace-carnet').click();
  await expect(carnet).toBeVisible();
  await expect(carnet.getByTestId('carnet-apodo')).toHaveText(`${nickname} 2`);
  await page.keyboard.press('Escape');
  await expect(carnet).toBeHidden();
  await expect(page).toHaveURL(/\/mar/);
  expect(errors).toEqual([]);
});

test('Ajustes: la sensibilidad del giro la lee el motor; música, efectos e idioma se guardan', async ({
  page,
}) => {
  const errors = await openMar(page, '/mar');
  const giro = async () => (await mar(page).getAttribute('data-giro')) ?? '';
  const before = await giro();
  expect(before).toMatch(/^[\d.]+,[\d.]+$/);

  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-menu-ajustes').click();
  const ajustes = page.getByTestId('mar-ajustes');
  await expect(ajustes).toBeVisible();
  const sens = ajustes.getByTestId('sensibilidad');
  await sens.getByRole('slider', { name: /teclado/ }).fill(String(SENSITIVITY_RANGE.max * 100));
  await sens.getByRole('slider', { name: /táctil/ }).fill(String(SENSITIVITY_RANGE.min * 100));
  // El motor gobierna ya con la nueva sensibilidad (`turnScale` de cada paso).
  const wanted = `${SENSITIVITY_RANGE.max},${SENSITIVITY_RANGE.min}`;
  await expect.poll(giro).toBe(wanted);
  expect(wanted).not.toBe(before);

  // Música y efectos por separado, con su volumen; el idioma.
  await ajustes.getByTestId('ajuste-music').getByRole('checkbox').uncheck();
  await ajustes.getByTestId('ajuste-sfx').getByRole('slider').fill('40');
  await expect(ajustes.getByTestId('ajuste-idioma').locator('select')).toHaveValue('es');
  const stored = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k) ?? '{}'),
    SETTINGS_KEY,
  );
  expect(stored).toMatchObject({
    sensitivity: { keyboard: SENSITIVITY_RANGE.max, touch: SENSITIVITY_RANGE.min },
    music: { enabled: false },
    sfx: { volume: 0.4 },
  });
  await ajustes.getByTestId('mar-ajustes-cerrar').click();
  await expect(ajustes).toBeHidden();

  // Al volver al mar, el motor arranca con lo guardado.
  await page.reload();
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 45_000 });
  await expect.poll(giro).toBe(wanted);
  expect(errors).toEqual([]);
});

test('Controles y Welcome Aboard se consultan desde el Menú', async ({ page }) => {
  const errors = await openMar(page, '/mar');
  for (const [item, panel] of [
    ['mar-menu-controles', 'mar-controles'],
    ['mar-menu-bienvenida', 'mar-bienvenida'],
  ] as const) {
    await page.getByTestId('mar-logros').click();
    await page.getByTestId(item).click();
    const hoja = page.getByTestId(panel);
    await expect(hoja).toBeVisible();
    await expect(hoja.locator('li').first()).toBeVisible();
    await hoja.getByTestId(`${panel}-cerrar`).click();
    await expect(hoja).toBeHidden();
  }
  expect(errors).toEqual([]);
});

test('los enlaces de la landing, el Carnet y el Admin llevan al mar 3D', async ({ page }) => {
  await page.goto('/?intro=0');
  for (const id of ['fotos-en-barco', 'tienda-en-barco', 'pie-crear-carnet']) {
    await expect(page.getByTestId(id).first(), id).toHaveAttribute('href', /^\/mar(\?|$)/);
  }
  await tap(page, heroTickets(page));
  const tickets = page.getByRole('dialog', { name: 'Elige tu evento' });
  await expect(tickets.getByTestId('tickets-en-barco')).toHaveAttribute('href', /^\/mar(\?|$)/);

  await page.goto(eventHref(islandEvent.slug));
  await expect(page.getByTestId('evento-ir-isla')).toHaveAttribute('href', /^\/mar\?/);

  await page.goto('/carnet');
  const own = page.getByTestId('carnet-pagina');
  await expect(own.getByRole('link', { name: /Volver al mar/ })).toHaveAttribute('href', '/mar');
  await expect(own.getByRole('link', { name: 'Crear mi Carnet' })).toHaveAttribute(
    'href',
    /^\/mar\?menu=carnet/,
  );

  await page.goto('/admin');
  await expect(page.getByTestId('admin-ver-mundo')).toHaveAttribute('href', '/mar');
});
