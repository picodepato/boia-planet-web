import { expect, test, type Page } from '@playwright/test';
import { PHOTOS_PLACE_ID, PHOTOS_SAIL_HREF } from '../lib/landing/access';
import { INVITE_COPY } from '../lib/landing/invitations';
import { SETTINGS_KEY } from '@boia/engine/ui';
import { headerTickets, openTickets, pastHero, tap } from './hero-helpers';

/**
 * La landing que te lleva en barco (T44, T55): Fotos, Tienda y Tickets abren
 * el mar 3D con el barco navegando a su isla y su ficha al llegar
 * (REQ-ENT-034, REQ-AVE-022); cabecera con Mi Carnet y sonido (REQ-ENT-029);
 * pie con la invitación al Carnet y al WhatsApp, e Instagram (REQ-ENT-032,
 * O13); la invitación al Carnet al cerrar la galería, con «Ahora no»
 * respetado (REQ-IDE-008/009). La posición del barco tras recargar el mar
 * (REQ-IDE-004) la prueba mar-paridad.spec.ts. Corre en móvil 360×640 y en
 * escritorio.
 */

test.describe.configure({ timeout: 120_000 });

const LANDING = '/?intro=0';

/** El mar 3D (T55): la landing lleva allí con el barco navegando a su isla. */
const mar = (page: Page) => page.locator('main.mar');
const marSheet = (page: Page) => page.getByTestId('mar-ficha');

test('Fotos desde la landing lleva el barco al Puerto de Fotos y abre la galería', async ({
  page,
}) => {
  await page.goto(LANDING);
  const sail = page.getByTestId('fotos-en-barco');
  await expect(sail).toBeVisible();
  await expect(sail).toHaveAttribute('href', /^\/mar\?/);
  await sail.click();

  // El mar 3D, con el barco navegando hasta el puerto y su galería al llegar.
  await expect(page).toHaveURL(/\/mar/);
  await expect(mar(page)).toHaveAttribute('data-llegada', PHOTOS_PLACE_ID, { timeout: 60_000 });
  await expect(marSheet(page)).toHaveAttribute('data-tipo', 'photos');
  await expect(marSheet(page)).toHaveAttribute('data-lugar', PHOTOS_PLACE_ID);
  expect(new URL(page.url()).searchParams.has('ir')).toBe(false);

  // Cerrar la galería invita (una vez) a crear el Carnet.
  await marSheet(page).getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(marSheet(page)).toBeHidden();
  const invite = page.getByTestId('invitacion-carnet');
  await expect(invite).toBeVisible();
  await expect(invite).toHaveAttribute('data-motivo', 'gallery');
  await expect(invite).toContainText(INVITE_COPY.gallery.title);
  await expect(invite.getByTestId('aviso-progreso-local')).toHaveText(INVITE_COPY.localLimit);

  // «Ahora no»: no vuelve, ni cerrando otra vez la galería en otra visita.
  await invite.getByTestId('invitacion-ahora-no').click();
  await expect(invite).toBeHidden();
  await page.goto(PHOTOS_SAIL_HREF);
  await expect(mar(page)).toHaveAttribute('data-llegada', PHOTOS_PLACE_ID, { timeout: 60_000 });
  await marSheet(page).getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(marSheet(page)).toBeHidden();
  await page.waitForTimeout(1000);
  await expect(invite).toHaveCount(0);
});

test('Tickets: el panel HTML sigue y «Ver su isla en el mar» abre la isla del evento', async ({
  page,
}) => {
  await page.goto(LANDING);
  await openTickets(page);
  const panel = page.getByRole('dialog', { name: 'Elige tu evento' });
  await expect(panel).toBeVisible();
  const sail = panel.getByTestId('tickets-en-barco');
  await expect(sail).toHaveAttribute('href', /^\/mar\?/);
  const href = await sail.getAttribute('href');
  const island = new URL(href!, 'http://x').searchParams.get('ir')!;
  expect(island).toBeTruthy();
  await sail.click();
  await expect(mar(page)).toHaveAttribute('data-llegada', island, { timeout: 60_000 });
  await expect(marSheet(page)).toHaveAttribute('data-tipo', 'event');
  await expect(marSheet(page)).toHaveAttribute('data-lugar', island);
});

test('«Zarpar» se ve sin scroll a 360×640 y la cabecera nueva lleva «Entradas»', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile', 'sólo el móvil de 360×640');
  await page.goto(LANDING);
  const vp = page.viewportSize()!;
  expect(vp).toEqual({ width: 360, height: 640 });
  // Decision 4 of 2026-10-08: only «Zarpar» in the hero.
  const zarpar = page.getByTestId('cta-3d');
  await expect(zarpar).toBeVisible();
  const box = (await zarpar.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  // La cabecera no se desborda (sale al dejar el hero, T79).
  await pastHero(page);
  await expect(headerTickets(page)).toBeVisible();
  const header = (await page.locator('.site-header__inner').boundingBox())!;
  expect(header.x + header.width).toBeLessThanOrEqual(vp.width);
});

test('cabecera con Mi Carnet y sonido; pie con Carnet, WhatsApp e Instagram', async ({
  page,
}, info) => {
  await page.goto(LANDING);
  // La cabecera sale al dejar el hero (T79).
  await pastHero(page);
  const header = page.locator('.site-header');
  if (info.project.name === 'mobile') {
    await tap(page, header.getByText('Menú', { exact: true }));
  }
  const carnet = header.getByTestId('cabecera-carnet').filter({ visible: true });
  await expect(carnet).toHaveAttribute('href', '/carnet');
  await expect(
    header.getByRole('link', { name: /instagram/i }).filter({ visible: true }),
  ).toBeVisible();

  const sound = header.getByTestId('cabecera-sonido').filter({ visible: true });
  await expect(sound).toHaveAttribute('aria-pressed', 'true');
  await tap(page, sound);
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
  const saved = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k) ?? '{}'),
    SETTINGS_KEY,
  );
  expect(saved).toMatchObject({ music: { enabled: false }, sfx: { enabled: false } });

  const footer = page.locator('.site-footer');
  const invite = footer.getByTestId('pie-invitacion');
  await expect(invite.getByTestId('pie-crear-carnet')).toHaveAttribute(
    'href',
    /^\/mar\?menu=carnet/,
  );
  await expect(invite.getByTestId('pie-whatsapp')).toHaveAttribute('href', /whatsapp/);
  await expect(footer.getByRole('link', { name: /instagram/i })).toHaveCount(1);
  // Sin formulario de suscripción (REQ-ENT-032).
  await expect(footer.locator('form, input')).toHaveCount(0);
});
