import { canBuy, eventState, isIslandlessSatellite } from '@boia/contracts';
import { HALLOWEEN_EVENT_ID } from '@boia/store';
import { WORLD_REGISTRY } from '@boia/world';
import { expect, test, type Page } from '@playwright/test';
import { eventIslands } from '../lib/admin/world';
import { EVENTOS_COPY, FOTOS_COPY } from '../lib/landing/eventos-copy';
import { eventHref, galleryAnchor, photosHref } from '../lib/landing/eventos';
import { SAMPLE_ALBUM_CONTENT, SAMPLE_CONTENT } from '../lib/landing/sample-content';
import { marSheet, openMar } from './mar-helpers';

/**
 * Ficha de evento y «Fotos y eventos» (T42): `/eventos/<slug>` y `/fotos`
 * se abren directas, sin la entrada (REQ-ENT-011), y funcionan sin
 * JavaScript; la home enseña sólo la selección con «Ver todas»; y «Ver fotos
 * de la isla», desde la ficha de la isla en el mar 3D, abre `/fotos#<isla>`.
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

test('la ficha de BOIA Club · Halloween: cartel próximamente, satélite y su estado', async ({
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
  // Satélite sin isla: calienta para el próximo All Day (si lo hay).
  expect(isIslandlessSatellite(halloween)).toBe(true);
  await expect(ficha.getByTestId(`calienta-${halloween.id}`)).toBeVisible();
  // Compra sólo si está a la venta ahora.
  await expect(ficha.getByTestId(`comprar-${halloween.id}`)).toHaveCount(
    canBuy(halloween, now) ? 1 : 0,
  );
});

test('la home enseña sólo la selección de fotos y «Ver todas» lleva a /fotos', async ({ page }) => {
  await page.goto('/?intro=0');
  await expect(page.locator('main')).toHaveAttribute('data-contenido', 'repositorio');
  const grid = page.locator('#fotos .photo-grid > li');
  await expect(grid).toHaveCount(Math.min(selection.length, 6));
  await page.getByTestId('ver-fotos').click();
  await expect(page).toHaveURL(/\/fotos$/);
  await noIntro(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(FOTOS_COPY.pageTitle);
  await expect(page.locator('.gallery .photo-grid > li')).toHaveCount(SAMPLE_CONTENT.photos.length);
});

test('«Ver fotos de la isla» abre /fotos en la galería de esa isla', async ({ page }) => {
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
  await expect(page).toHaveURL(new RegExp(`/fotos#${island.id}$`));
  await noIntro(page);
  const gallery = page.getByTestId(`galeria-${island.id}`);
  await expect(gallery).toBeInViewport();
  // Las fotos de los álbumes de los eventos de esa isla están en su galería.
  const albums = SAMPLE_ALBUM_CONTENT.filter((a) => {
    const e = SAMPLE_CONTENT.events.find((x) => x.id === a.eventId);
    return e ? galleryAnchor(e) === island.id : a.islandId === island.id;
  });
  for (const a of albums) await expect(gallery.locator(`[data-album="${a.id}"]`)).toBeVisible();
});

test.describe('sin JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('la ficha de un evento a la venta se lee y se compra', async ({ page }) => {
    const e = SAMPLE_CONTENT.events.find((x) => canBuy(x, now) && x.islandId)!;
    await page.goto(eventHref(e.slug));
    const ficha = page.getByTestId('evento-ficha');
    await expect(ficha.getByRole('heading', { level: 1 })).toHaveText(e.name);
    await expect(ficha.getByTestId('evento-precio')).toContainText('€');
    // Sin JavaScript, el enlace a la ticketera (de muestra).
    await expect(ficha.getByTestId(`comprar-${e.id}`)).toHaveAttribute('href', e.ticketUrl!);
    await expect(ficha.getByTestId('evento-ir-isla')).toHaveAttribute('href', /^\/mar\?/);
  });

  test('una ficha finalizada no tiene compra y enseña sus recuerdos', async ({ page }) => {
    const e = SAMPLE_CONTENT.events.find((x) => eventState(x, now) === 'finished')!;
    await page.goto(eventHref(e.slug));
    const ficha = page.getByTestId('evento-ficha');
    await expect(ficha).toHaveAttribute('data-estado', 'finished');
    await expect(ficha.getByTestId('evento-recuerdos')).toBeVisible();
    await expect(ficha.locator('[data-testid^="comprar-"]')).toHaveCount(0);
  });

  test('«Fotos y eventos» enseña las galerías y su ancla', async ({ page }) => {
    await page.goto(photosHref(island.id));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(FOTOS_COPY.pageTitle);
    await expect(page.getByTestId(`galeria-${island.id}`)).toBeInViewport();
    await expect(page.locator('.gallery [role="img"]').first()).toBeVisible();
  });
});
