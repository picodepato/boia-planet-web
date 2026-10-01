import { canBuy } from '@boia/contracts';
import { READABLE_MIN_MS } from '@boia/engine/ui';
import { WORLD_REGISTRY } from '@boia/world';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { marWorld, seaRoute } from '../app/mar/engine/compact';
import { startZoom } from '../app/mar/engine/framing';
import { periodOf, planetRect, shortest } from '../app/mar/engine/wrap';
import { SAMPLE_CONTENT } from '../lib/landing/sample-content';

/**
 * El mar 3D (/mar): arranca sin errores, pasa a la vista de mapa tocando el
 * minimapa redondo (el planeta girando, T34), el rótulo
 * de la isla del evento abre su ficha y «Navegar aquí» fija el rumbo. Y la
 * landing lo enlaza junto a EXPLORAR. El botón «Entradas» siempre a la vista
 * (REQ-ENT-040) y los bocadillos que se leen y se cierran (REQ-AVE-002).
 * El mar es un planeta que da la vuelta (D-22, REQ-MUN-038), compacto y con
 * una ruta de marcas en el agua que une las islas (T50; sin boyas desde T59). Móvil y escritorio.
 */

const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config;
// El evento vigente del mar: el que se vende en una isla (el All Day de la demo).
const islandEvent = SAMPLE_CONTENT.events.find((e) => canBuy(e) && e.islandId)!;
const islandName = world.objects.find((o) => o.identity.id === islandEvent.islandId)!.identity.name;
// La primera boia con diálogo (la del tutorial) y su primera línea.
const talkingBoia = world.objects.find(
  (o) => o.identity.category === 'boia' && o.behaviors.some((b) => b.type === 'dialogue'),
)!;
const firstLine = (() => {
  const b = talkingBoia.behaviors.find((x) => x.type === 'dialogue');
  return b?.type === 'dialogue' ? b.params.lines[0]!.text : '';
})();

async function openMar(page: Page, query = '') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`/mar${query}`);
  await expect(page.getByTestId('mar-canvas')).toBeVisible();
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 30_000 });
  return errors;
}

/** Visible, entero en pantalla y encima de todo en su centro (nada lo tapa). */
async function expectOnTop(el: Locator) {
  await expect(el).toBeVisible();
  await expect(el).toBeInViewport({ ratio: 1 });
  const onTop = await el.evaluate((node) => {
    const r = node.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && node.contains(hit);
  });
  expect(onTop, 'nada tapa el botón').toBe(true);
}

const checkoutEvent = (page: Page) => page.getByTestId('checkout').getByTestId('checkout-evento');

/** El minimapa redondo: tocarlo abre el mapa grande (y lo cierra). */
const minimap = (page: Page) => page.getByTestId('mar-minimapa');

test('el mar 3D arranca, pasa a mapa por el minimapa y fija rumbo a la isla del evento', async ({
  page,
}) => {
  const errors = await openMar(page);
  await minimap(page).click();
  await expect(minimap(page)).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-pin="allday"]').click();
  await expect(page.getByTestId('mar-ficha')).toContainText('Navegar');
  // La ficha se abre pequeña (T53): tocarla la despliega.
  await page.getByTestId('mar-ficha-mas').click();
  await expect(page.getByTestId('mar-volar')).toBeVisible();
  await page.getByTestId('mar-rumbo').click();
  await expect(page.getByTestId('mar-rumbo-activo')).toBeVisible();
  expect(errors).toEqual([]);
});

test('«Ir en nave» desde la ficha: despega, vuela y se posa sin abrir la compra', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const errors = await openMar(page);
  await minimap(page).click();
  await expect(minimap(page)).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-pin="allday"]').click();
  // La ficha se abre pequeña (T53): tocarla la despliega.
  await page.getByTestId('mar-ficha-mas').click();
  await page.getByTestId('mar-volar').click();
  const main = page.locator('main.mar');
  await expect(main).toHaveAttribute('data-flight', 'lift');
  await expect(page.getByTestId('mar-ficha')).toHaveCount(0);
  await expect(main).toHaveAttribute('data-flight', 'cruise', { timeout: 10_000 });
  await expect(main).not.toHaveAttribute('data-flight', /./, { timeout: 20_000 });
  await expect(page.getByTestId('mar-rumbo-activo')).toHaveCount(0);
  await expect(page.getByTestId('checkout')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('la landing enlaza el mar 3D', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('cta-3d')).toHaveAttribute('href', '/mar');
});

/**
 * «Entradas» abre «Elige tu evento» dentro del mar (T58); su «Ir a su isla»
 * arranca el viaje en turbo (o el vuelo) hasta la isla del evento.
 */
async function sailToTickets(page: Page) {
  await page.getByTestId('mar-entradas').click();
  const panel = page.getByTestId('mar-entradas-panel');
  await expect(panel).toBeVisible();
  await panel.getByTestId(`mar-entradas-isla-${islandEvent.id}`).click();
  await expect(panel).toHaveCount(0);
}

test('«Entradas» se ve de cerca, en el mapa y con la ficha; «Saltar» abre el checkout', async ({
  page,
}) => {
  test.setTimeout(60_000);
  expect(islandEvent, 'hay un evento a la venta con isla').toBeDefined();
  const errors = await openMar(page);
  const button = page.getByTestId('mar-entradas');

  // De cerca (cubierta), en el mapa y con la ficha de una isla abierta.
  await expectOnTop(button);
  await minimap(page).click();
  await expect(minimap(page)).toHaveAttribute('aria-pressed', 'true');
  await expectOnTop(button);
  await page.locator('[data-pin="allday"]').click();
  await expect(page.getByTestId('mar-ficha')).toBeVisible();
  await expectOnTop(button);

  // Tocarlo abre «Elige tu evento» (T58); «Ir a su isla» vuela a la isla del
  // evento (experimento), de vuelta a la vista del barco.
  await sailToTickets(page);
  await expect(button).toContainText(`Volando a ${islandName}`);
  await expect(page.locator('main.mar')).toHaveAttribute('data-flight', /lift|cruise/);
  await expect(page.getByTestId('mar-rumbo-activo')).toContainText(islandName);
  await expect(page.getByTestId('mar-turbo')).toHaveClass(/is-on/);
  await expect(minimap(page)).toHaveAttribute('aria-pressed', 'false');
  await expectOnTop(button);

  // «Saltar»: el checkout del evento vigente al momento.
  await page.getByTestId('mar-entradas-saltar').click();
  await expect(checkoutEvent(page)).toHaveText(islandEvent.name, { timeout: 20_000 });
  await expect(page.getByTestId('mar-entradas-saltar')).toHaveCount(0);
  await expect(page.getByTestId('mar-rumbo-activo')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('«Entradas»: otro toque abre el checkout ya; el vuelo llega y lo abre', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = await openMar(page);
  const button = page.getByTestId('mar-entradas');

  // Pulsar «Entradas» durante el viaje a la isla abre el checkout al momento.
  await sailToTickets(page);
  await expect(page.getByTestId('mar-entradas-saltar')).toBeVisible();
  await button.click();
  await expect(checkoutEvent(page)).toHaveText(islandEvent.name, { timeout: 20_000 });
  await page.getByTestId('checkout-cerrar').click();
  await expect(page.getByTestId('checkout')).toHaveCount(0);

  // Sin tocar nada más: despega, vuela solo y, al posarse, se abre el
  // checkout del evento. («Saltar» ya lo dejó posado junto a la isla: el
  // vuelo es corto, pero pasa por sus fases.)
  await sailToTickets(page);
  await expect(page.locator('main.mar')).toHaveAttribute('data-flight', /cruise|land/, {
    timeout: 10_000,
  });
  await expect(checkoutEvent(page)).toHaveText(islandEvent.name, { timeout: 40_000 });
  await expect(page.getByTestId('mar-entradas-saltar')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('«Ir a su isla» con movimiento reducido abre el checkout directo', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openMar(page);
  await sailToTickets(page);
  await expect(checkoutEvent(page)).toHaveText(islandEvent.name, { timeout: 20_000 });
  await expect(page.getByTestId('mar-entradas-saltar')).toHaveCount(0);
  await expect(page.getByTestId('mar-rumbo-activo')).toHaveCount(0);
});

test('un bocadillo tiene botón de cerrar y sigue a la vista pasados 2,5 s', async ({ page }) => {
  expect(READABLE_MIN_MS).toBeGreaterThan(2500);
  const errors = await openMar(page, `?cerca=${talkingBoia.identity.id}`);
  const bubble = page.getByTestId('mar-bocadillo');
  // Rumbo norte hasta la boia: saluda con su primera línea.
  await page.keyboard.down('ArrowUp');
  await expect(bubble).toBeVisible({ timeout: 15_000 });
  await page.keyboard.up('ArrowUp');
  await expect(bubble).toContainText(firstLine);
  const close = page.getByTestId('mar-bocadillo-cerrar');
  await expect(close).toBeVisible();
  await expect(close).toHaveAttribute('aria-label', 'Cerrar diálogo');

  await page.waitForTimeout(2500);
  await expect(bubble).toBeVisible();
  await expect(bubble).toContainText(firstLine);

  // Tocar el texto sigue avanzando; el × lo cierra al momento.
  await bubble.locator('.mar-bubble__text').click();
  await expect(bubble).not.toContainText(firstLine);
  await close.click();
  await expect(bubble).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('el planeta da la vuelta: desde la cueva del oeste, El Freu (al este) queda a un paso', async ({
  page,
}) => {
  // Las posiciones del mar 3D salen del mapa compartido, como en el motor.
  const sea = marWorld(world);
  const at = (id: string) => sea.objects.find((o) => o.identity.id === id)!;
  const cave = at('secreto-cueva');
  const freu = at('circuito');
  const reach = Math.max(
    cave.geometry.proximityRadius ?? 0,
    cave.geometry.activation?.radius ?? 0,
    cave.geometry.collision?.radius ?? 0,
  );
  // `?cerca=` deja el barco al sur del lugar (Mar3D.startNear).
  const start = { x: cave.position.x, y: cave.position.y + reach + 90 };
  const flat = Math.hypot(freu.position.x - start.x, freu.position.y - start.y) * 0.25;
  const { dx, dy } = shortest(start, freu.position, periodOf(planetRect(sea.bounds)));
  const around = Math.hypot(dx, dy) * 0.25;
  expect(around, 'dando la vuelta está mucho más cerca').toBeLessThan(flat / 2);

  const errors = await openMar(page, '?cerca=secreto-cueva');
  await minimap(page).click();
  // En el móvil el rótulo de El Freu queda bajo la barra del zoom: el toque va al rótulo.
  await page.locator('[data-pin="circuito"]').dispatchEvent('click');
  const ficha = page.getByTestId('mar-ficha');
  await expect(ficha).toContainText(' m');
  const meters = Number(
    ((await ficha.locator('.mar-sheet__kicker').textContent()) ?? '').match(/(\d+) m/)?.[1],
  );
  expect(meters).toBeGreaterThan(around * 0.8);
  expect(meters).toBeLessThan(around * 1.2);
  // Y el rumbo va por ahí: la distancia que queda es la corta.
  await page.getByTestId('mar-rumbo').click();
  await expect(page.getByTestId('mar-rumbo-activo')).toBeVisible();
  const left = Number(
    ((await page.getByTestId('mar-rumbo-activo').textContent()) ?? '').match(/(\d+) m/)?.[1],
  );
  expect(left).toBeLessThan(flat / 2);
  expect(errors).toEqual([]);
});

test('el mundo compacto: marcas en el agua (sin boyas de ruta) y la isla del evento a unos segundos del puerto', async ({
  page,
}) => {
  test.setTimeout(90_000);
  // El mundo de /mar y su ruta, como los calcula el motor.
  const sea = marWorld(world);
  const route = seaRoute(sea);
  const errors = await openMar(page);
  // T59: ya no hay boyas que unan las islas; guían las marcas en el agua.
  await expect(page.getByTestId('mar-canvas')).toHaveAttribute(
    'data-route-marks',
    String(route.dashes.length),
  );
  await expect(page.getByTestId('mar-canvas')).not.toHaveAttribute('data-route-buoys', /.*/);

  // Rumbo a la isla del evento desde el anillo: la distancia es la del mundo
  // compacto por el camino corto, hasta su orilla (Mar3D.setCourse).
  const allday = sea.objects.find((o) => o.identity.id === 'allday')!;
  const spawn = sea.spawn!;
  const { dx, dy } = shortest(spawn, allday.position, periodOf(planetRect(sea.bounds)));
  const reach =
    Math.max(allday.geometry.collision?.radius ?? 0, allday.geometry.activation?.radius ?? 0) +
    18 +
    40;
  const expected = (Math.hypot(dx, dy) - reach) * 0.25;
  await minimap(page).click();
  await page.locator('[data-pin="allday"]').click();
  await page.getByTestId('mar-rumbo').click();
  const chip = page.getByTestId('mar-rumbo-activo');
  await expect(chip).toBeVisible();
  const meters = Number(((await chip.textContent()) ?? '').match(/(\d+) m/)?.[1]);
  expect(meters).toBeGreaterThan(expected * 0.9);
  expect(meters).toBeLessThan(expected * 1.1);
  // Y llega sola, a velocidad normal (sin turbo), en unos segundos.
  await expect(chip).toHaveCount(0, { timeout: 45_000 });
  expect(errors).toEqual([]);
});

test('el minimapa: redondo, girando con el planeta y sin tapar «Entradas»', async ({ page }) => {
  const errors = await openMar(page);
  const map = minimap(page);
  const canvas = map.locator('canvas');
  await expectOnTop(map);

  // Redondo y semitransparente, con el lienzo del globo dentro.
  const shape = await map.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const c = getComputedStyle(el.querySelector('canvas')!);
    return { w: r.width, h: r.height, radius: cs.borderRadius, canvasRadius: c.borderRadius };
  });
  expect(shape.w).toBeGreaterThanOrEqual(72);
  expect(shape.h).toBe(shape.w);
  expect(shape.radius).toBe('50%');
  expect(shape.canvasRadius).toBe('50%');

  // No tapa «Entradas» (ni a la inversa).
  const a = (await map.boundingBox())!;
  const b = (await page.getByTestId('mar-entradas').boundingBox())!;
  const apart =
    a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
  expect(apart, 'el minimapa y «Entradas» no se pisan').toBe(true);
  await expectOnTop(page.getByTestId('mar-entradas'));

  // Se repinta a ritmo bajo con las islas del mar y la del evento destacada.
  const frames = async () => Number((await canvas.getAttribute('data-frames')) ?? 0);
  const first = await frames();
  await expect.poll(frames).toBeGreaterThan(first + 2);
  expect(Number(await canvas.getAttribute('data-pins'))).toBeGreaterThan(5);
  await expect(canvas).toHaveAttribute('data-accent', islandEvent.islandId!);
  expect(errors).toEqual([]);
});

test('el minimapa abre el mapa grande; «Cerrar», tocarlo otra vez y la M lo cierran', async ({
  page,
  hasTouch,
}) => {
  // La vista de mapa es lo más lento de pintar en el Chromium sin GPU de las e2e.
  test.setTimeout(60_000);
  const errors = await openMar(page);
  const map = minimap(page);

  // Tocarlo (con el dedo en el móvil) abre el mapa grande; «Cerrar» vuelve a cubierta.
  if (hasTouch) await map.tap();
  else await map.click();
  await expect(map).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.mar-maphint')).toBeVisible();
  await expectOnTop(page.getByTestId('mar-entradas'));
  await page.getByTestId('mar-mapa-cerrar').click();
  await expect(map).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('mar-mapa-cerrar')).toHaveCount(0);

  // La tecla M sigue abriéndolo; tocar el minimapa otra vez también cierra.
  await page.keyboard.press('m');
  await expect(map).toHaveAttribute('aria-pressed', 'true');
  await map.click();
  await expect(map).toHaveAttribute('aria-pressed', 'false');
  expect(errors).toEqual([]);
});

test.describe('la cámara en un móvil en vertical (390×844)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('el barco va en el centro de lo que se ve, también navegando, y sale con su zoom', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const errors = await openMar(page);
    const canvas = page.getByTestId('mar-canvas');
    // Lo que se ve del mar: entre la barra de arriba y «Entradas».
    const offCentre = async () => {
      const top = (await page.locator('.mar-top').boundingBox())!;
      const tickets = (await page.getByTestId('mar-entradas').boundingBox())!;
      const width = page.viewportSize()!.width;
      const [x, y] = ((await canvas.getAttribute('data-ship-screen')) ?? 'NaN,NaN')
        .split(',')
        .map(Number) as [number, number];
      const from = top.y + top.height;
      return {
        dx: Math.abs(x - width / 2) / width,
        dy: Math.abs(y - (from + tickets.y) / 2) / (tickets.y - from),
      };
    };
    await expect(canvas).toHaveAttribute('data-ship-screen', /\d+,\d+/);
    const still = await offCentre();
    expect(still.dx).toBeLessThan(0.1);
    expect(still.dy).toBeLessThan(0.1);

    // Zoom de salida del móvil en vertical (la barra del zoom lo enseña).
    await expect(page.locator('.mar-zoom span')).toHaveAttribute(
      'style',
      `height: ${Math.round((1 - startZoom(390 / 844)) * 100)}%;`,
    );

    // Navegando (el viaje de «Entradas», rápido): sigue centrado.
    await sailToTickets(page);
    await expect(page.getByTestId('mar-entradas-saltar')).toBeVisible();
    await page.waitForTimeout(1500);
    const sailing = await offCentre();
    expect(sailing.dx).toBeLessThan(0.1);
    expect(sailing.dy).toBeLessThan(0.1);
    expect(errors).toEqual([]);
  });
});
