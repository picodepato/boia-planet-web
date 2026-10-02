import { SAMPLE_DISCOUNTS } from '@boia/store';
import { WORLD_REGISTRY, type WorldObject } from '@boia/world';
import { expect, test, type Page } from '@playwright/test';
import { SAMPLE_CONTENT } from '../lib/landing/sample-content';

/**
 * El mundo Arcilla en /juego (T20): el barco sale del puerto y llega, con el
 * teclado, a cada tipo de lugar: isla de evento, náufrago, descuento
 * escondido, Puerto de Fotos, tienda y salida del circuito. El mapa mide unas
 * 20 000 u y el barco va a 220 u/s: cruzarlo entero para cada lugar serían
 * más de un minuto por lugar, así que, salvo la salida del puerto, cada
 * prueba empieza con `?cerca=<lugar>` (al sur del lugar, fuera de su radio) y
 * navega hasta él. Corre en móvil 360×640 y en escritorio.
 */

test.describe.configure({ timeout: 90_000 });

const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId);
const objects = world.config.objects;
const place = (id: string): WorldObject => {
  const o = objects.find((x) => x.identity.id === id);
  if (!o) throw new Error(`falta el lugar ${id} en el mundo ${world.id}`);
  return o;
};
const paramsOf = (o: WorldObject, type: string) =>
  o.behaviors.filter((b) => b.type === type).map((b) => b.params as Record<string, unknown>);

/** El primer lugar con un comportamiento de ese tipo y ese destino (`content.target`). */
const withContent = (target: string) =>
  objects.find((o) => paramsOf(o, 'content').some((p) => p.target === target))!;
/** Descuento escondido de un lugar (su `reward` de tipo discount). */
const discountOf = (o: WorldObject) => {
  const ref = paramsOf(o, 'reward').find((p) => p.kind === 'discount')?.ref;
  return SAMPLE_DISCOUNTS.find((d) => d.id === ref)!;
};

const eventIsland = withContent('event');
const eventId = paramsOf(eventIsland, 'content').find((p) => p.target === 'event')!.ref as string;
const photos = withContent('photos');
const shop = withContent('store');
const castaway = objects.find((o) => o.identity.category === 'naufrago')!;
// El tesoro: un descuento que se recoge al pasar, en un sitio fijo.
const treasure = objects.find(
  (o) =>
    o.behaviors.some((b) => b.type === 'collectible') &&
    !o.behaviors.some((b) => b.type === 'spawn') &&
    paramsOf(o, 'reward').some((p) => p.kind === 'discount'),
)!;

async function gameRunning(page: Page) {
  await expect(page.getByTestId('hud')).toContainText(/\d+ fps/, { timeout: 30_000 });
  await expect(page.getByTestId('juego')).toHaveAttribute('data-mundo', world.id);
}

/** Abre /juego junto a un lugar (o en el puerto) con el motor ya en marcha. */
async function sailFrom(page: Page, near?: string) {
  await page.goto(near ? `/juego?cerca=${near}` : '/juego');
  await gameRunning(page);
  // El foco en el mar: el teclado mueve el barco.
  await page
    .locator('canvas:visible')
    .first()
    .focus()
    .catch(() => {});
}

/** Rumbo norte hasta que se cumpla `until`. */
async function sailNorthUntil(page: Page, until: () => Promise<void>) {
  await page.keyboard.down('ArrowUp');
  try {
    await until();
  } finally {
    await page.keyboard.up('ArrowUp');
  }
}

// /juego no pasa por la entrada (D-21: sólo `/` a secas la reproduce).
test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

test('el barco sale del puerto por la bocana y el mapa lista los lugares de Arcilla', async ({
  page,
}) => {
  await sailFrom(page);
  // El mapa ampliado: los lugares con brújula aún sin descubrir.
  await page.getByTestId('minimapa').click();
  const map = page.getByTestId('minimapa-ampliado');
  await expect(map).toBeVisible();
  await expect(map).toContainText(/por descubrir/);
  await page.keyboard.press('Escape');
  await expect(map).toBeHidden();
  // Rumbo norte desde el anillo de salida: la primera boia saluda (aviso) y el barco no choca.
  await sailFrom(page);
  await sailNorthUntil(page, () =>
    expect(page.getByTestId('hud')).toContainText(/ [1-9]\d+ u\/s/, { timeout: 10_000 }),
  );
});

test('isla de evento: su panel con el evento y la compra', async ({ page }) => {
  const event = SAMPLE_CONTENT.events.find((e) => e.id === eventId)!;
  expect(event, `el evento ${eventId} de la isla existe`).toBeDefined();
  await sailFrom(page, eventIsland.identity.id);
  const panel = page.getByTestId('panel-evento');
  await sailNorthUntil(page, () => expect(panel).toBeVisible({ timeout: 20_000 }));
  await expect(panel.getByRole('heading', { name: event.name })).toBeVisible();
});

test('náufrago: pide que lo lleven y deja su código de descuento', async ({ page }) => {
  const d = discountOf(castaway);
  await sailFrom(page, castaway.identity.id);
  const found = page.getByTestId('panel-descuento');
  await sailNorthUntil(page, () => expect(found).toBeVisible({ timeout: 20_000 }));
  await expect(found.getByTestId('descuento-codigo')).toHaveText(d.code);
  await expect(found.getByTestId('descuento-estado')).toHaveText('Activo');
});

test('descuento escondido: se copia con un toque y sólo se concede una vez', async ({ page }) => {
  const d = discountOf(treasure);
  await sailFrom(page, treasure.identity.id);
  const found = page.getByTestId('panel-descuento');
  await sailNorthUntil(page, () => expect(found).toBeVisible({ timeout: 20_000 }));
  await expect(found.getByTestId('descuento-codigo')).toHaveText(d.code);
  await found.getByTestId('descuento-copiar').click();
  await expect(found.getByTestId('descuento-copiar')).toHaveText(/Copiado|Cópialo a mano/);
  await found.getByRole('button', { name: 'Cerrar' }).click();
  await expect(found).toBeHidden();

  // Otra visita, mismo sitio: ya no se concede; sigue en el Menú, en Mis códigos.
  await sailFrom(page, treasure.identity.id);
  await sailNorthUntil(page, () => page.waitForTimeout(3_000));
  await expect(found).toBeHidden();
  await page.getByTestId('menu-ancla').click();
  const menu = page.getByTestId('menu');
  await menu.getByRole('tab', { name: 'Mis códigos', exact: true }).click();
  await expect(menu.getByTestId(`descuento-${d.id}`)).toContainText(d.code);
  await expect(menu.getByTestId('descuentos').locator('li')).toHaveCount(1);
});

test('Puerto de Fotos: abre la galería', async ({ page }) => {
  await sailFrom(page, photos.identity.id);
  const panel = page.getByTestId('panel-fotos');
  await sailNorthUntil(page, () => expect(panel).toBeVisible({ timeout: 20_000 }));
  await expect(panel.getByRole('heading', { name: photos.identity.name })).toBeVisible();
  await expect(panel.getByTestId('panel-fotos-galeria')).toHaveAttribute('href', '/fotos');
});

test('tienda: enlace externo en otra pestaña', async ({ page }) => {
  await sailFrom(page, shop.identity.id);
  const panel = page.getByTestId('panel-tienda');
  await sailNorthUntil(page, () => expect(panel).toBeVisible({ timeout: 20_000 }));
  const link = panel.getByTestId('panel-tienda-enlace');
  await expect(link).toHaveAttribute('href', /^https?:\/\//);
  await expect(link).toHaveAttribute('target', '_blank');
});

test('circuito: al llegar a la salida se ve el récord y al cruzarla empieza la cuenta atrás', async ({
  page,
}) => {
  const start = objects.find(
    (o) =>
      o.identity.category === 'circuito' && paramsOf(o, 'checkpoint').some((p) => p.order === 0),
  )!;
  await sailFrom(page, start.identity.id);
  const timer = page.getByTestId('circuito-crono');
  await sailNorthUntil(page, async () => {
    await expect(timer).toContainText('El Freu', { timeout: 20_000 });
    await expect(timer).toHaveAttribute('data-phase', /countdown|racing/, { timeout: 20_000 });
  });
});

test('los lugares de la prueba existen en el mundo por defecto', () => {
  for (const o of [eventIsland, photos, shop, castaway, treasure]) {
    expect(place(o.identity.id).identity.active).toBe(true);
  }
});
