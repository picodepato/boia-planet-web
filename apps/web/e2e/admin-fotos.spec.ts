import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { eventSchema } from '@boia/contracts';
import { SAMPLE_EVENTS } from '@boia/store';
import { WORLD_REGISTRY } from '@boia/world';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { eventIslands, islandEvent } from '../lib/admin/world';
import { t } from '../lib/i18n';
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
const islandName =
  WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).places.find((p) => p.id === island.id)?.name ??
  island.id;
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
