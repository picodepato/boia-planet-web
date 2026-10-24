import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { eventSchema } from '@boia/contracts';
import { HOME_PHOTOS_LIMIT, SAMPLE_EVENTS } from '@boia/store';
import { WORLD_REGISTRY } from '@boia/world';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { eventIslands, islandEvent } from '../lib/admin/world';
import { t, type MessageKey } from '../lib/i18n';
import { es } from '../lib/i18n/es';
import { SAMPLE_CONTENT } from '../lib/landing/sample-content';
import { marSheet, openMar } from './mar-helpers';

/**
 * Las fotos de una isla desde el Admin de la demo (plan 017 T189, decisión
 * 4), en modo local: se elige la isla y su evento, se sube un archivo de
 * verdad, se marca el evento como pasado y la isla del mar 3D lo enseña como
 * recuerdo con la foto; «Fotos y eventos» la tiene en la galería de la isla.
 *
 * REQ-AVE-014, REQ-ADM-019, REQ-COM-005, REQ-COM-031.
 *
 * `T189_SHOTS=<carpeta>` guarda las capturas para Hernán.
 */

test.describe.configure({ timeout: 240_000 });

/** La isla de evento que abre hoy un evento de la muestra, y ese evento. */
const now = new Date();
const events = SAMPLE_EVENTS.map((e) => eventSchema.parse(e));
const island = eventIslands(WORLD_REGISTRY.map).find((p) => islandEvent(p.id, events, now))!;
const event = islandEvent(island.id, events, now)!;
/** El nombre que enseña el Admin (el del mundo principal). */
const placeName =
  WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).places.find((p) => p.id === island.id)?.name ??
  island.id;
// El nombre del mapa es una clave de i18n (`mapa.…`); el Admin enseña su texto.
const islandName = placeName in es ? t(placeName as MessageKey) : placeName;
const ALT = 'Fotos de prueba en la isla';

/** Un PNG de verdad (degradado) para el selector de archivos. */
function photoFile(width: number, height: number) {
  const img = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (width * y + x) << 2;
      img.data[i] = Math.round((255 * x) / width);
      img.data[i + 1] = Math.round((180 * y) / height);
      img.data[i + 2] = 160;
      img.data[i + 3] = 255;
    }
  }
  return { name: 'isla.png', mimeType: 'image/png', buffer: PNG.sync.write(img) };
}

async function shot(target: Page | Locator, name: string, project: string) {
  const dir = process.env.T189_SHOTS;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await target.screenshot({ path: join(dir, `${name}-${project}.png`) });
}

/** Espera a que una imagen se haya pintado de verdad (no el hueco). */
async function expectPainted(img: Locator) {
  await expect(img).toBeVisible({ timeout: 15_000 });
  // `loading="lazy"`: sólo se carga cerca de la vista.
  await img.scrollIntoViewIfNeeded();
  await expect
    .poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth), { timeout: 15_000 })
    .toBeGreaterThan(0);
}

test('subir fotos a una isla y marcar el evento pasado: la isla lo enseña como recuerdo con su galería', async ({
  page,
}, info) => {
  expect(island, 'una isla de la muestra abre un evento hoy').toBeDefined();

  // 1. Admin: Fotos y vídeos → Fotos de una isla.
  await page.goto('/admin');
  await page.getByTestId('admin-nav-fotos').click();
  const form = page.getByTestId('fotos-isla');
  await expect(form).toBeVisible();
  await form.getByTestId('fotos-isla-isla').selectOption(island.id);
  await expect(form.getByTestId('fotos-isla-evento')).toHaveValue(event.id);
  await expect(form.getByTestId('fotos-isla-pasado')).toBeChecked();

  // Un archivo que no es imagen se rechaza con su nombre.
  await form.getByTestId('fotos-isla-archivos').setInputFiles({
    name: 'nota.png',
    mimeType: 'image/png',
    buffer: Buffer.from('no soy una foto'),
  });
  await form.getByTestId('fotos-isla-alt').fill(ALT);
  await form.getByTestId('fotos-isla-subir').click();
  await expect(form).toContainText(t('admin.photos.upload.problem.type', { file: 'nota.png' }));

  // 2. Una foto de verdad: se sube y el evento pasa a recuerdo.
  await form.getByTestId('fotos-isla-archivos').setInputFiles(photoFile(2400, 1600));
  await form.getByTestId('fotos-isla-subir').click();
  await expect(form).toContainText(
    t('admin.photos.upload.donePast1', { n: 1, island: islandName, event: event.name }),
    { timeout: 20_000 },
  );
  const row = page.locator('[data-testid^="foto-foto-"]').filter({ has: page.locator('img') });
  await expect(row).toHaveCount(1, { timeout: 10_000 });
  const thumb = row.locator('img.admin-photo-thumb');
  await expectPainted(thumb);
  // La copia es WebP y de 1600 px de lado largo como mucho (2400 × 1600 → 1600 × 1067).
  const copy = await thumb.evaluate(async (el) => {
    const img = el as HTMLImageElement;
    const blob = await fetch(img.src).then((r) => r.blob());
    return { type: blob.type, w: img.naturalWidth, h: img.naturalHeight };
  });
  expect(copy).toEqual({ type: 'image/webp', w: 1600, h: 1067 });
  await shot(page, 'admin-lista', info.project.name);
  await form.scrollIntoViewIfNeeded();
  await shot(form, 'admin-subida', info.project.name);

  // En Eventos, la isla ya lo tiene en sus recuerdos.
  await page.getByTestId('admin-nav-eventos').click();
  await expect(page.getByTestId(`isla-${island.id}`)).toContainText(event.name);
  await expect(page.getByTestId(`isla-${island.id}`)).not.toContainText(
    t('admin.events.abreAhora', { v1: event.name }),
  );

  // 3. El mar 3D: la isla abre su panel con el recuerdo y la foto.
  await openMar(page, `?ir=${island.id}`);
  await page
    .getByTestId('mar-entradas-saltar')
    .click({ timeout: 5_000 })
    .catch(() => {});
  const sheet = marSheet(page);
  await expect(sheet).toHaveAttribute('data-lugar', island.id, { timeout: 30_000 });
  if ((await sheet.getAttribute('data-expandida')) !== 'si') {
    await sheet.getByTestId('mar-ficha-mas').click();
  }
  await expect(sheet).toHaveAttribute('data-expandida', 'si');
  const memories = sheet.getByTestId('panel-recuerdos');
  await expect(memories).toContainText(event.name);
  await expect(sheet.getByTestId('mar-comprar')).toHaveCount(0);
  const gallery = memories.getByTestId(`recuerdo-fotos-${event.id}`);
  const photo = gallery.getByRole('img', { name: ALT });
  await expectPainted(photo);
  await gallery.scrollIntoViewIfNeeded();
  await shot(sheet, 'isla-recuerdo', info.project.name);

  // 4. «Fotos y eventos»: la galería de la isla la tiene.
  await page.goto(`/galeria#${island.id}`);
  await expectPainted(page.getByTestId(`galeria-${island.id}`).getByRole('img', { name: ALT }));
});

/**
 * Portada, orden y borrar desde el Admin de la demo (plan 048 T329): quitar
 * una pieza de la portada, poner otra, subir una en el orden y borrar otra
 * (con confirmación) se ve en la portada de la landing y en la Galería.
 *
 * REQ-ADM-044, REQ-ADM-019.
 */
test('portada, orden y borrar desde el Admin: la landing y la Galería lo reflejan', async ({
  page,
}) => {
  const home = SAMPLE_CONTENT.photos.filter((p) => p.selection).slice(0, HOME_PHOTOS_LIMIT);
  const [off, second, third, gone] = home.map((p) => p.id);
  const extra = SAMPLE_CONTENT.photos.find((p) => !p.selection)!.id;
  expect(off && second && third && gone && extra).toBeTruthy();

  await page.goto('/admin');
  await page.getByTestId('admin-nav-fotos').click();
  const list = page.getByTestId('fotos-piezas');
  await expect(list).toBeVisible();
  const rows = list.locator('li[data-testid^="foto-"]');
  const row = (id: string) => list.getByTestId(`foto-${id}`);
  // Todas las piezas, con su miniatura.
  await expect(rows).toHaveCount(SAMPLE_CONTENT.photos.length);
  await expect(row(off!).locator('img.admin-photo-thumb')).toHaveCount(1);
  await expect(row(off!)).toHaveAttribute('data-portada', 'si');

  // 1. Fuera de la portada una; dentro otra.
  await row(off!).getByTestId(`foto-portada-${off}`).uncheck();
  await expect(row(off!)).toHaveAttribute('data-portada', 'no');
  await row(extra).getByTestId(`foto-portada-${extra}`).check();
  await expect(row(extra)).toHaveAttribute('data-portada', 'si');

  // 2. La tercera sube un puesto: pasa delante de la segunda.
  const listed = () =>
    rows.evaluateAll((els) =>
      els.map((el) => ({
        id: el.getAttribute('data-testid')!.slice('foto-'.length),
        home: el.getAttribute('data-portada') === 'si',
      })),
    );
  const before = (await listed()).map((r) => r.id);
  await row(third!).getByTestId(`foto-subir-${third}`).click();
  await expect
    .poll(async () => (await listed()).map((r) => r.id))
    .toEqual(before.map((id) => (id === third ? second : id === second ? third : id)));

  // 3. Borrar pide confirmación; cancelada no borra; confirmada, sí.
  await row(gone!).getByTestId(`foto-borrar-${gone}`).click();
  await row(gone!).getByRole('button', { name: t('admin.photos.pieces.cancel') }).click();
  await expect(row(gone!)).toHaveCount(1);
  await row(gone!).getByTestId(`foto-borrar-${gone}`).click();
  await row(gone!).getByTestId(`foto-borrar-confirmar-${gone}`).click();
  await expect(row(gone!)).toHaveCount(0);
  await expect(rows).toHaveCount(SAMPLE_CONTENT.photos.length - 1);

  // La portada es la de la lista del Admin: las marcadas, en su orden, hasta el tope.
  const expected = (await listed())
    .filter((r) => r.home)
    .map((r) => r.id)
    .slice(0, HOME_PHOTOS_LIMIT);
  expect(expected).toContain(extra);
  expect(expected).not.toContain(off);
  expect(expected).not.toContain(gone);
  expect(expected.indexOf(third!)).toBeLessThan(expected.indexOf(second!));

  // La landing.
  await page.goto('/?intro=0');
  await expect(page.locator('main')).toHaveAttribute('data-contenido', 'repositorio');
  const grid = page.locator('#fotos [data-pieza]');
  await expect
    .poll(() => grid.evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.pieza)))
    .toEqual(expected);

  // La Galería: sin la borrada, con todas las demás y en el orden del Admin.
  await page.goto('/galeria');
  const pieces = page.locator('.galeria [data-pieza]');
  await expect(pieces).toHaveCount(SAMPLE_CONTENT.photos.length - 1);
  await expect(page.locator(`.galeria [data-pieza="${gone}"]`)).toHaveCount(0);
  const gallery = await pieces.evaluateAll((els) =>
    els.map((el) => (el as HTMLElement).dataset.pieza),
  );
  expect(gallery.indexOf(third)).toBeLessThan(gallery.indexOf(second));
});
