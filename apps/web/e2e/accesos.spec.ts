import { WORLD_REGISTRY, type WorldObject } from '@boia/world';
import { expect, test, type Page } from '@playwright/test';
import { approachPoint } from '../lib/mundo/arrival';
import { PHOTOS_PLACE_ID } from '../lib/landing/access';
import { INVITE_COPY } from '../lib/landing/invitations';
import { SETTINGS_KEY } from '@boia/engine/ui';
import { SHIP_POSITION_KEY } from '../lib/mundo/ship-position';

/**
 * La landing que te lleva en barco (T44): Fotos, Tienda y Tickets abren el
 * mar con el barco llegando a su isla y su panel abierto (REQ-ENT-034,
 * REQ-AVE-022); cabecera con Mi Carnet y sonido (REQ-ENT-029); pie con la
 * invitación al Carnet y al WhatsApp, e Instagram (REQ-ENT-032, O13); la
 * invitación al Carnet al cerrar la galería, con «Ahora no» respetado
 * (REQ-IDE-008/009); y la posición del barco tras recargar (REQ-IDE-004).
 * Corre en móvil 360×640 y en escritorio.
 */

test.describe.configure({ timeout: 90_000 });

const LANDING = '/?intro=0';
const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId);
const place = (id: string): WorldObject => world.config.objects.find((o) => o.identity.id === id)!;

async function gameRunning(page: Page) {
  await expect(page.getByTestId('hud')).toContainText(/\d+ fps/, { timeout: 30_000 });
}

/** Posición del barco (u) que publica /juego en `data-barco`. */
async function shipAt(page: Page): Promise<{ x: number; y: number }> {
  const v = await page.getByTestId('juego').getAttribute('data-barco');
  const [x, y] = (v ?? 'NaN,NaN').split(',').map(Number);
  return { x: x!, y: y! };
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

test('Fotos desde la landing lleva el barco al Puerto de Fotos y abre la galería', async ({
  page,
}) => {
  await page.goto(LANDING);
  const sail = page.getByTestId('fotos-en-barco');
  await expect(sail).toBeVisible();
  await sail.click();

  await expect(page).toHaveURL(/\/juego/);
  const juego = page.getByTestId('juego');
  await expect(juego).toHaveAttribute('data-llegada', PHOTOS_PLACE_ID, { timeout: 30_000 });
  await expect(page.getByTestId('panel-fotos')).toBeVisible();
  // En su punto seguro, junto al puerto y fuera de su radio; sin `?ir=` en la URL.
  const safe = approachPoint(place(PHOTOS_PLACE_ID));
  await expect.poll(async () => dist(await shipAt(page), safe)).toBeLessThan(60);
  expect(new URL(page.url()).searchParams.has('ir')).toBe(false);

  // Cerrar la galería deja el barco allí e invita (una vez) a crear el Carnet.
  await page.getByTestId('panel-fotos').getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByTestId('panel-fotos')).toBeHidden();
  const invite = page.getByTestId('invitacion-carnet');
  await expect(invite).toBeVisible();
  await expect(invite).toHaveAttribute('data-motivo', 'gallery');
  await expect(invite).toContainText(INVITE_COPY.gallery.title);
  await expect(invite.getByTestId('aviso-progreso-local')).toHaveText(INVITE_COPY.localLimit);
  expect(dist(await shipAt(page), safe)).toBeLessThan(60);

  // «Ahora no»: no vuelve, ni cerrando otra vez la galería en otra visita.
  await invite.getByTestId('invitacion-ahora-no').click();
  await expect(invite).toBeHidden();
  await page.goto(`/juego?ir=${PHOTOS_PLACE_ID}`);
  await expect(juego).toHaveAttribute('data-llegada', PHOTOS_PLACE_ID, { timeout: 30_000 });
  await page.getByTestId('panel-fotos').getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByTestId('panel-fotos')).toBeHidden();
  await page.waitForTimeout(1000);
  await expect(invite).toHaveCount(0);
});

test('Tickets: el panel HTML sigue y «Ver su isla en el mar» abre la isla del evento', async ({
  page,
}) => {
  await page.goto(LANDING);
  await page.locator('.hero').getByRole('link', { name: 'Tickets', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Elige tu evento' });
  await expect(panel).toBeVisible();
  const sail = panel.getByTestId('tickets-en-barco');
  const href = await sail.getAttribute('href');
  const island = new URL(href!, 'http://x').searchParams.get('ir')!;
  expect(island).toBeTruthy();
  await sail.click();
  await expect(page.getByTestId('juego')).toHaveAttribute('data-llegada', island, {
    timeout: 30_000,
  });
  await expect(page.getByTestId('panel-evento')).toBeVisible();
  await expect
    .poll(async () => dist(await shipAt(page), approachPoint(place(island))))
    .toBeLessThan(60);
});

test('Tickets se ve sin scroll a 360×640 con el CTA 3D y la cabecera nueva', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile', 'sólo el móvil de 360×640');
  await page.goto(LANDING);
  const vp = page.viewportSize()!;
  expect(vp).toEqual({ width: 360, height: 640 });
  const hero = page.locator('.hero');
  await expect(page.getByTestId('cta-3d')).toBeVisible();
  const tickets = hero.getByRole('link', { name: 'Tickets', exact: true });
  await expect(tickets).toBeVisible();
  const box = (await tickets.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  // La cabecera no se desborda.
  const header = (await page.locator('.site-header__inner').boundingBox())!;
  expect(header.x + header.width).toBeLessThanOrEqual(vp.width);
});

test('cabecera con Mi Carnet y sonido; pie con Carnet, WhatsApp e Instagram', async ({
  page,
}, info) => {
  await page.goto(LANDING);
  const header = page.locator('.site-header');
  if (info.project.name === 'mobile') {
    await header.getByText('Menú', { exact: true }).click();
  }
  const carnet = header.getByTestId('cabecera-carnet').filter({ visible: true });
  await expect(carnet).toHaveAttribute('href', '/carnet');
  await expect(
    header.getByRole('link', { name: /instagram/i }).filter({ visible: true }),
  ).toBeVisible();

  const sound = header.getByTestId('cabecera-sonido').filter({ visible: true });
  await expect(sound).toHaveAttribute('aria-pressed', 'true');
  await sound.click();
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
  const saved = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k) ?? '{}'),
    SETTINGS_KEY,
  );
  expect(saved).toMatchObject({ music: { enabled: false }, sfx: { enabled: false } });

  const footer = page.locator('.site-footer');
  const invite = footer.getByTestId('pie-invitacion');
  await expect(invite.getByTestId('pie-crear-carnet')).toHaveAttribute('href', /menu=carnet/);
  await expect(invite.getByTestId('pie-whatsapp')).toHaveAttribute('href', /whatsapp/);
  await expect(footer.getByRole('link', { name: /instagram/i })).toHaveCount(1);
  // Sin formulario de suscripción (REQ-ENT-032).
  await expect(footer.locator('form, input')).toHaveCount(0);
});

test('recargar /juego deja el barco donde estaba', async ({ page }) => {
  await page.goto('/juego');
  await gameRunning(page);
  const start = await shipAt(page);
  await page
    .locator('canvas:visible')
    .first()
    .focus()
    .catch(() => {});
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => dist(await shipAt(page), start)).toBeGreaterThan(70);
  await page.keyboard.up('ArrowUp');
  // Parado: la posición guardada es la de ahora.
  await expect
    .poll(async () => {
      const a = await shipAt(page);
      await page.waitForTimeout(400);
      return dist(a, await shipAt(page));
    })
    .toBeLessThan(2);
  const before = await shipAt(page);

  await page.reload();
  await gameRunning(page);
  const saved = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k) ?? 'null'),
    SHIP_POSITION_KEY,
  );
  expect(saved).not.toBeNull();
  await expect.poll(async () => dist(await shipAt(page), before)).toBeLessThan(30);
  expect(dist(await shipAt(page), start)).toBeGreaterThan(40);
});
