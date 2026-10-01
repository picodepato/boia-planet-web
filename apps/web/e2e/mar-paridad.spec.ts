import { SAMPLE_DISCOUNTS } from '@boia/store';
import { WORLD_REGISTRY, type WorldObject } from '@boia/world';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marWorld } from '../app/mar/engine/compact';
import { SAMPLE_CONTENT } from '../lib/landing/sample-content';

/**
 * El mar 3D con lo que el plan 004 trajo a /juego (T51): el código del
 * náufrago con «Ir a la isla» (el barco navega solo) y, al llegar, «Tienes
 * un código de descuento para este evento» junto a la compra, que lo aplica
 * (T43); la ficha de una isla con «Ver fotos de la isla» hacia «Fotos y
 * eventos» (T42); el cambio de mundo por el agujero negro con el barco
 * quieto (T41), también con movimiento reducido; y una boia informativa con
 * su diálogo, su aviso «Boia encontrada» y su modelo de Blender (T45, T39).
 * Todo sale del mapa, de la muestra y del registro de mundos.
 *
 * Con RECORD_T51=1 deja en docs/informes/img/ p004-t51-*.png (390×844).
 */

test.describe.configure({ timeout: 120_000 });

const first = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId);
const second = WORLD_REGISTRY.get(WORLD_REGISTRY.ids().find((id) => id !== first.id)!);
const objects = first.config.objects;
const castaway = objects.find((o) => o.identity.category === 'naufrago')!;
const rewardRef = (o: WorldObject) =>
  o.behaviors.flatMap((b) =>
    b.type === 'reward' && b.params.kind === 'discount' && b.params.ref ? [b.params.ref] : [],
  )[0];
const discount = SAMPLE_DISCOUNTS.find((d) => d.id === rewardRef(castaway))!;
const event = SAMPLE_CONTENT.events.find((e) => e.id === discount.eventId)!;
/** Una isla con su relato (CONTENIDO de información), sin evento. */
const infoIsland = objects.find(
  (o) =>
    o.identity.category === 'isla' &&
    o.behaviors.some((b) => b.type === 'content' && b.params.target === 'info'),
)!;
/** Una boia informativa (O12): habla y cuenta para el logro de las boies. */
const infoBoia = objects.find(
  (o) =>
    o.identity.category === 'boia' &&
    o.identity.id.startsWith('boia-') &&
    o.behaviors.some((b) => b.type === 'dialogue'),
)!;
const boiaLine = (() => {
  const b = infoBoia.behaviors.find((x) => x.type === 'dialogue');
  return b?.type === 'dialogue' ? b.params.lines[0]!.text : '';
})();

const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../docs/informes/img',
);
const recording = () => test.info().project.name === 'mobile' && !!process.env.RECORD_T51;

async function snap(page: Page, name: string) {
  if (!recording()) return;
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, name) });
}

const mar = (page: Page) => page.locator('main.mar');

async function openMar(page: Page, query = '') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`/mar${query}`);
  await expect(page.getByTestId('mar-canvas')).toBeVisible();
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 30_000 });
  await expect(mar(page)).toHaveAttribute('data-barco', /\d/);
  return errors;
}

async function sailNorthUntil(page: Page, until: () => Promise<void>) {
  await page.keyboard.down('ArrowUp');
  try {
    await until();
  } finally {
    await page.keyboard.up('ArrowUp');
  }
}

/** Dónde queda el barco cuando deja de moverse (tras arrancar, puede asentarse un poco). */
async function shipSettled(page: Page) {
  let last = '';
  await expect
    .poll(
      async () => {
        const now = (await mar(page).getAttribute('data-barco')) ?? '';
        const same = now === last;
        last = now;
        return same;
      },
      { intervals: [500], timeout: 15_000 },
    )
    .toBe(true);
  return last;
}

/** El barco ahora (u de motor del mar 3D). */
async function shipAt(page: Page) {
  const [x, y] = ((await mar(page).getAttribute('data-barco')) ?? '0,0').split(',').map(Number);
  return { x: x!, y: y! };
}

/**
 * Gobierna con las flechas hacia un lugar del mar 3D (su sitio en el mundo
 * compacto) hasta que `done` se cumpla: el náufrago da su código al arrimarse.
 */
async function steerTo(page: Page, id: string, done: () => Promise<boolean>) {
  const target = marWorld(first.config).objects.find((o) => o.identity.id === id)!.position;
  const held = new Set<string>();
  const hold = async (keys: string[]) => {
    for (const k of [...held]) {
      if (keys.includes(k)) continue;
      await page.keyboard.up(k);
      held.delete(k);
    }
    for (const k of keys) {
      if (held.has(k)) continue;
      await page.keyboard.down(k);
      held.add(k);
    }
  };
  try {
    const until = Date.now() + 25_000;
    while (Date.now() < until && !(await done())) {
      const s = await shipAt(page);
      const dx = target.x - s.x;
      const dy = target.y - s.y;
      const d = Math.hypot(dx, dy) || 1;
      const keys: string[] = [];
      if (dx / d > 0.35) keys.push('ArrowRight');
      if (dx / d < -0.35) keys.push('ArrowLeft');
      if (dy / d > 0.35) keys.push('ArrowDown');
      if (dy / d < -0.35) keys.push('ArrowUp');
      await hold(keys);
      await page.waitForTimeout(150);
    }
  } finally {
    await hold([]);
  }
}

const sheetIs = (page: Page, kind: string) => async () =>
  (await page.locator(`[data-testid="mar-ficha"][data-tipo="${kind}"]`).count()) > 0;

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

// Un teléfono en vertical (390×844), como en las capturas del plan.
test.use({ viewport: { width: 390, height: 844 } });

test('el náufrago da su código, «Ir a la isla» navega solo y la isla lo aplica', async ({
  page,
}) => {
  expect(discount, 'el náufrago esconde un código de la muestra').toBeDefined();
  expect(event?.islandId, 'el código es de un evento con isla').toBeTruthy();
  const errors = await openMar(page, `?cerca=${castaway.identity.id}`);

  const sheet = page.getByTestId('mar-ficha');
  await steerTo(page, castaway.identity.id, sheetIs(page, 'discount'));
  await expect(sheet).toHaveAttribute('data-tipo', 'discount');
  // La tarjeta pequeña (T53) enseña el código; tocarla la despliega.
  await expect(sheet).toContainText(discount.code);
  await sheet.getByTestId('mar-ficha-mas').click();
  const card = sheet.getByTestId('mar-descuento');
  await expect(card.getByTestId('descuento-codigo')).toHaveText(discount.code);
  await expect(card.getByTestId('descuento-estado')).toHaveText('Activo');
  await snap(page, 'p004-t51-descuento.png');

  // «Ir a la isla»: turbo hasta la isla del evento, con «Saltar» a mano.
  await card.getByTestId('descuento-ir-isla').click();
  const trip = page.getByTestId('mar-viaje');
  await expect(trip).toHaveAttribute('data-lugar', event.islandId!);
  await expect(page.getByTestId('mar-entradas-saltar')).toBeVisible();
  await page.waitForTimeout(1200);
  await snap(page, 'p004-t51-ir-a-la-isla.png');

  // Llega (o se salta al rato) y se abre la ficha del evento con el aviso.
  await expect(sheet).toHaveAttribute('data-tipo', 'event', { timeout: 30_000 });
  await expect(trip).not.toHaveAttribute('data-lugar', /.+/);
  await expect(sheet.getByRole('heading', { name: event.name })).toBeVisible();
  await sheet.getByTestId('mar-ficha-mas').click();
  const banner = sheet.getByTestId('banner-descuento');
  await expect(banner).toContainText('Tienes un código de descuento para este evento');
  await expect(banner.getByTestId('banner-descuento-codigo')).toHaveText(discount.code);
  await expect(banner.getByTestId('banner-descuento-ahorro')).toContainText('€');
  await snap(page, 'p004-t51-banner-descuento.png');

  // Comprar: el checkout de prueba lo aplica.
  await sheet.getByTestId('mar-comprar').click();
  const checkout = page.getByTestId('checkout');
  await expect(checkout.getByTestId('checkout-evento')).toHaveText(event.name);
  await expect(checkout.getByTestId('checkout-descuento')).toHaveAttribute(
    'data-discount-id',
    discount.id,
  );
  await checkout.getByTestId('checkout-confirmar').click();
  await expect(checkout.getByTestId('checkout-resultado')).toBeVisible();
  await checkout.getByTestId('checkout-cerrar').click();
  await expect(checkout).toBeHidden();

  // Después de comprar, la invitación a crear el Carnet (T44), sin tapar la ficha abierta.
  const invite = page.getByTestId('invitacion-carnet');
  await expect(invite).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(invite).toHaveAttribute('data-motivo', 'purchase');
  await snap(page, 'p004-t51-invitacion.png');
  await invite.getByTestId('invitacion-ahora-no').click();
  await expect(invite).toHaveCount(0);

  // «Mis códigos» del menú: ya usado, y sin «Ir a la isla».
  await page.getByTestId('mar-barra-menu').click();
  await page.getByTestId('mar-mis-codigos').click();
  const mine = page.getByTestId('mar-codigos').getByTestId(`descuento-${discount.id}`);
  await expect(mine.getByTestId('descuento-estado')).toHaveText('Usado');
  await expect(mine.getByTestId('descuento-ir-isla')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('«Saltar» lleva a la isla de un salto', async ({ page }) => {
  await openMar(page, `?cerca=${castaway.identity.id}`);
  const sheet = page.getByTestId('mar-ficha');
  await steerTo(page, castaway.identity.id, sheetIs(page, 'discount'));
  await expect(sheet).toHaveAttribute('data-tipo', 'discount');
  await sheet.getByTestId('descuento-ir-isla').click();
  await page.getByTestId('mar-entradas-saltar').click();
  await expect(sheet).toHaveAttribute('data-tipo', 'event');
  await expect(sheet).toHaveAttribute('data-lugar', event.islandId!);
  await sheet.getByTestId('mar-ficha-mas').click();
  await expect(sheet.getByTestId('banner-descuento')).toBeVisible();
});

test('la ficha de una isla: recuerdos, «Próximos eventos» y «Ver fotos de la isla»', async ({
  page,
}) => {
  const errors = await openMar(page, `?cerca=${infoIsland.identity.id}`);
  const sheet = page.getByTestId('mar-ficha');
  await sailNorthUntil(page, () =>
    expect(sheet).toHaveAttribute('data-tipo', 'info', { timeout: 20_000 }),
  );
  await expect(sheet).toHaveAttribute('data-lugar', infoIsland.identity.id);
  await expect(sheet.getByRole('heading', { name: infoIsland.identity.name })).toBeVisible();
  await sheet.getByTestId('mar-ficha-mas').click();
  await expect(sheet.getByTestId('panel-proximos')).toBeVisible();
  const photos = sheet.getByTestId('ver-fotos-isla');
  await expect(photos).toHaveText('Ver fotos de la isla');
  await expect(photos).toHaveAttribute('href', `/fotos#${infoIsland.identity.id}`);
  await snap(page, 'p004-t51-isla.png');
  await photos.click();
  await expect(page).toHaveURL(new RegExp(`/fotos#${infoIsland.identity.id}$`));
  expect(errors).toEqual([]);
});

test('«Mundos»: el mar cae al agujero negro y vuelve con el barco en su sitio', async ({
  page,
}) => {
  const errors = await openMar(page, `?cerca=${infoIsland.identity.id}`);
  await expect(mar(page)).toHaveAttribute('data-mundo', first.id);
  const ship = await shipSettled(page);

  await page.getByTestId('mar-barra-menu').click();
  await page.getByTestId(`mundo-${second.id}`).click();
  // El menú se cierra para ver el vórtice; mientras dura, nada responde.
  await expect(page.locator('.mar-menu')).toHaveCount(0);
  await expect(mar(page)).toHaveAttribute('data-cambio-mundo', 'vortice');
  await expect(page.getByTestId('cambio-mundo')).toBeVisible();
  await page.waitForTimeout(700);
  await snap(page, 'p004-t51-agujero-negro.png');
  // Acelerar durante la transición no mueve el barco.
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowUp');

  await expect(mar(page)).toHaveAttribute('data-mundo', second.id, { timeout: 20_000 });
  await expect(mar(page)).not.toHaveAttribute('data-cambio-mundo', /.+/, { timeout: 20_000 });
  await expect(page.getByTestId('cambio-mundo')).toHaveCount(0);
  expect(await mar(page).getAttribute('data-barco')).toBe(ship);
  // El nombre del mundo va en la cabecera del menú (T53).
  await page.getByTestId('mar-barra-menu').click();
  await expect(page.locator('.mar-menu__world')).toContainText(second.theme.name);
  await page.getByTestId('mar-barra-menu').click();
  await expect(page.locator('.mar-menu')).toHaveCount(0);
  await snap(page, 'p004-t51-otro-mundo.png');

  // Y la entrada vuelve: ahora el barco sí navega.
  await page.keyboard.down('ArrowUp');
  await expect.poll(() => mar(page).getAttribute('data-barco'), { timeout: 10_000 }).not.toBe(ship);
  await page.keyboard.up('ArrowUp');
  expect(errors).toEqual([]);
});

test.describe('con movimiento reducido', () => {
  test.use({ reducedMotion: 'reduce' });

  test('el cambio de mundo es un fundido', async ({ page }) => {
    await openMar(page);
    const ship = await shipSettled(page);
    const seen: string[] = [];
    await page.exposeFunction('__cambio', (v: string) => seen.push(v));
    await page.evaluate(() => {
      const el = document.querySelector('main.mar')!;
      new MutationObserver(() => {
        const v = el.getAttribute('data-cambio-mundo');
        if (v) (window as unknown as { __cambio: (v: string) => void }).__cambio(v);
      }).observe(el, { attributes: true, attributeFilter: ['data-cambio-mundo'] });
    });
    await page.getByTestId('mar-barra-menu').click();
    await page.getByTestId(`mundo-${second.id}`).click();
    await expect(mar(page)).toHaveAttribute('data-mundo', second.id, { timeout: 20_000 });
    await expect(mar(page)).not.toHaveAttribute('data-cambio-mundo', /.+/, { timeout: 20_000 });
    expect([...new Set(seen)]).toEqual(['fundido']);
    expect(await mar(page).getAttribute('data-barco')).toBe(ship);
  });
});

test('una boia informativa habla, cuenta como boia encontrada y lleva la mascota de Blender', async ({
  page,
}) => {
  const errors = await openMar(page, `?cerca=${infoBoia.identity.id}`);
  // La mascota de Blender (T39) llega por distancia: cerca, al menos un modelo puesto.
  await expect
    .poll(async () => Number(await mar(page).getAttribute('data-modelos')), {
      timeout: 20_000,
    })
    .toBeGreaterThan(0);
  const bubble = page.getByTestId('mar-bocadillo');
  await sailNorthUntil(page, () => expect(bubble).toBeVisible({ timeout: 15_000 }));
  await expect(bubble).toContainText(boiaLine);
  await expect(page.getByTestId('mar-aviso').filter({ hasText: /Boia encontrada/ })).toBeVisible({
    timeout: 10_000,
  });
  await snap(page, 'p004-t51-boia-info.png');
  expect(errors).toEqual([]);
});

test('el delfín sale en mar abierto y guía (O15)', async ({ page }) => {
  // `?delfin=1`: sale tras 1 s de mar abierto (fuera de los radios de todo).
  await openMar(page, '?delfin=1');
  await expect(mar(page)).not.toHaveAttribute('data-delfin', /.+/);
  await page.keyboard.down('ArrowLeft');
  try {
    await expect(mar(page)).toHaveAttribute('data-delfin', 'guiando', { timeout: 20_000 });
  } finally {
    await page.keyboard.up('ArrowLeft');
  }
});

test('al recargar, el barco sigue donde estaba (REQ-IDE-004)', async ({ page }) => {
  await openMar(page);
  const start = await shipSettled(page);
  await page.keyboard.down('ArrowUp');
  await expect
    .poll(() => mar(page).getAttribute('data-barco'), { timeout: 10_000 })
    .not.toBe(start);
  await page.waitForTimeout(800);
  await page.keyboard.up('ArrowUp');
  await shipSettled(page);
  const before = await shipAt(page);
  // Se guarda cada poco mientras se navega y al irse.
  await page.waitForTimeout(2500);
  await page.reload();
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 30_000 });
  await expect(mar(page)).toHaveAttribute('data-barco', /\d/);
  const after = await shipAt(page);
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(60);
  expect(`${after.x},${after.y}`).not.toBe(start);
});
