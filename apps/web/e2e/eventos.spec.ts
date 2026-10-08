import { canBuy, eventState, isIslandlessSatellite } from '@boia/contracts';
import { eventSailHref } from '../lib/world-handoff';
import { HALLOWEEN_EVENT_ID } from '@boia/store';
import { WORLD_REGISTRY } from '@boia/world';
import { expect, test, type Page } from '@playwright/test';
import { eventIslands } from '../lib/admin/world';
import { EVENTOS_COPY, FOTOS_COPY } from '../lib/landing/eventos-copy';
import { eventHref, galleryAnchor, photosHref } from '../lib/landing/eventos';
import { CARNET_CREATE_HREF } from '../lib/landing/access';
import { SAMPLE_ALBUM_CONTENT, SAMPLE_CONTENT } from '../lib/landing/sample-content';
import { marSheet, openMar } from './mar-helpers';

/**
 * Ficha de evento y la Galería (T42, T216): `/eventos/<slug>` y `/galeria`
 * se abren directas, sin la entrada (REQ-ENT-011), y funcionan sin
 * JavaScript; la home enseña sólo la selección con «Ver todas»; y «Ver fotos
 * de la isla», desde la ficha de la isla en el mar 3D, abre `/galeria#<isla>`.
 * Corre en móvil 360×640 y en escritorio.
 */

test.describe.configure({ timeout: 90_000 });

const now = new Date();
const halloween = SAMPLE_CONTENT.events.find((e) => e.id === HALLOWEEN_EVENT_ID)!;
// El evento que abre ahora la isla de evento del mapa (la del All Day).
const map = WORLD_REGISTRY.map;
const island = eventIslands(map).find((p) =>
  p.behaviors.some((b) => b.type === 'content' && b.params.target === 'event'),
)!;
const selection = SAMPLE_CONTENT.photos.filter((p) => p.selection);

/** Sin la entrada: ni el guion de arranque ni la escena de la intro. */
async function noIntro(page: Page) {
  await expect(page.locator('.intro-overlay')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveAttribute('data-intro', /.+/);
}

test('la ficha de Halloween: el cartel que falta, su isla, su estado y «Solo en puerta»', async ({
  page,
}) => {
  await page.goto(eventHref(halloween.slug));
  await noIntro(page);
  const ficha = page.getByTestId('evento-ficha');
  await expect(ficha.getByRole('heading', { level: 1 })).toHaveText(halloween.name);
  await expect(ficha).toHaveAttribute('data-estado', eventState(halloween, now));
  await expect(ficha.getByTestId('evento-cartel')).toContainText(EVENTOS_COPY.posterSoon);
  await expect(ficha).toContainText('BOIA Club');
  await expect(ficha).toContainText(halloween.placeLabel);
  // Desde T67 tiene isla propia (la Isla de Halloween): «Ir a su isla» y nada de «calienta».
  expect(isIslandlessSatellite(halloween)).toBe(false);
  expect(halloween.islandId).toBe('halloween');
  await expect(ficha.getByTestId('evento-ir-isla')).toHaveAttribute(
    'href',
    eventSailHref(halloween.id),
  );
  await expect(ficha.getByTestId(`calienta-${halloween.id}`)).toHaveCount(0);
  // «Solo en puerta» (plan 019 T215): nunca hay compra online; mientras está
  // a la venta, el aviso de la puerta con el Carnet.
  await expect(ficha.getByTestId(`comprar-${halloween.id}`)).toHaveCount(0);
  await expect(ficha.getByTestId('evento-solo-puerta')).toHaveCount(
    canBuy(halloween, now) ? 1 : 0,
  );
});

test('la home enseña sólo la selección de fotos y «Ver todas» lleva a la Galería', async ({
  page,
}) => {
  await page.goto('/?intro=0');
  await expect(page.locator('main')).toHaveAttribute('data-contenido', 'repositorio');
  const grid = page.locator('#fotos .photo-grid > li');
  await expect(grid).toHaveCount(Math.min(selection.length, 6));
  await page.getByTestId('ver-fotos').click();
  // El enlace de la home es /fotos, que lleva a /galeria (T216).
  await expect(page).toHaveURL(/\/galeria$/);
  await noIntro(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(FOTOS_COPY.pageTitle);
  await expect(page.locator('.galeria [data-pieza]')).toHaveCount(SAMPLE_CONTENT.photos.length);
});

test('«Ver fotos de la isla» abre la Galería en el grupo de esa isla', async ({ page }) => {
  await openMar(page, `?ir=${island.id}`);
  await page
    .getByTestId('mar-entradas-saltar')
    .click({ timeout: 5_000 })
    .catch(() => {});
  const panel = marSheet(page);
  await expect(panel).toHaveAttribute('data-lugar', island.id, { timeout: 30_000 });
  if ((await panel.getAttribute('data-expandida')) !== 'si') {
    await panel.getByTestId('mar-ficha-mas').click();
  }
  const link = panel.getByTestId('ver-fotos-isla');
  await expect(link).toHaveAttribute('href', photosHref(island.id));
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/galeria#${island.id}$`));
  await noIntro(page);
  const gallery = page.getByTestId(`galeria-${island.id}`);
  await expect(gallery).toBeInViewport();
  // Las fotos de los álbumes de los eventos de esa isla están en su galería.
  const albums = SAMPLE_ALBUM_CONTENT.filter((a) => {
    const e = SAMPLE_CONTENT.events.find((x) => x.id === a.eventId);
    return e ? galleryAnchor(e) === island.id : a.islandId === island.id;
  });
  for (const a of albums)
    await expect(gallery.locator(`[data-album="${a.id}"]`).first()).toBeVisible();
});

test.describe('sin JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('la ficha de un evento a la venta se lee y se compra', async ({ page }) => {
    // Uno con checkout online (Halloween y SONIDO van a taquilla, T199).
    const e = SAMPLE_CONTENT.events.find((x) => canBuy(x, now) && x.islandId && !x.boxOfficeOnly)!;
    await page.goto(eventHref(e.slug));
    const ficha = page.getByTestId('evento-ficha');
    await expect(ficha.getByRole('heading', { level: 1 })).toHaveText(e.name);
    await expect(ficha.getByTestId('evento-precio')).toContainText('€');
    // Sin JavaScript, el enlace a la ticketera (de muestra).
    await expect(ficha.getByTestId(`comprar-${e.id}`)).toHaveAttribute('href', e.ticketUrl!);
    await expect(ficha.getByTestId('evento-ir-isla')).toHaveAttribute('href', /^\/mar\?/);
  });

  test('Halloween: la ficha dice «Solo en puerta» y lleva al Carnet, sin JavaScript', async ({
    page,
  }) => {
    test.skip(!halloween.boxOfficeOnly || !canBuy(halloween, now), 'Halloween no está a la venta');
    await page.goto(eventHref(halloween.slug));
    const ficha = page.getByTestId('evento-ficha');
    const message = ficha.getByTestId('box-office-message');
    await expect(message).toBeVisible();
    await expect(message.getByTestId('box-office-carnet')).toHaveAttribute(
      'href',
      CARNET_CREATE_HREF,
    );
    await expect(ficha.locator(`a[href="${halloween.ticketUrl}"]`)).toHaveCount(0);
  });

  test('una ficha finalizada no tiene compra y enseña sus recuerdos', async ({ page }) => {
    const e = SAMPLE_CONTENT.events.find((x) => eventState(x, now) === 'finished')!;
    await page.goto(eventHref(e.slug));
    const ficha = page.getByTestId('evento-ficha');
    await expect(ficha).toHaveAttribute('data-estado', 'finished');
    await expect(ficha.getByTestId('evento-recuerdos')).toBeVisible();
    await expect(ficha.locator('[data-testid^="comprar-"]')).toHaveCount(0);
  });

  test('la Galería enseña el collage y su ancla', async ({ page }) => {
    await page.goto(photosHref(island.id));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(FOTOS_COPY.pageTitle);
    await expect(page.getByTestId(`galeria-${island.id}`)).toBeInViewport();
    await expect(page.locator('.galeria [role="img"]').first()).toBeVisible();
  });
});
