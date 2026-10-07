import { worldObjectSchema } from '@boia/contracts';
import { WORLD_REGISTRY } from '@boia/world';
import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { BUILTIN_TEMPLATES, type ObjectStep } from '../lib/admin/objects';
import { worldProblem } from '../lib/admin/validate';
import { EMPTY_WORLD_CONTENT } from '../lib/admin/world';
import { t } from '../lib/i18n';
import { marSheet, openMar } from './mar-helpers';

/**
 * Un objeto nuevo sin código desde el Admin de la demo (plan 017 T190), en
 * modo local: se parte de la plantilla «Isla de evento», se recorren los 10
 * pasos (un asset que no pasa la validación se rechaza; uno bueno se guarda
 * con sus variantes), se publica y la isla nueva sale en el mar 3D: el barco
 * navega hasta ella y abre su ficha. También se duplica una plantilla.
 *
 * REQ-ADM-010, REQ-ADM-011, REQ-ADM-012.
 */

test.describe.configure({ timeout: 240_000 });

const map = WORLD_REGISTRY.map;
const template = BUILTIN_TEMPLATES.find((x) => x.id === 'plantilla-isla-evento')!;
const NAME = 'Isla del Admin';
const ID = 'isla-del-admin';

/** Un sitio de agua donde la isla nueva no corta el paso: el primero que acepta el Admin. */
function freeSpot(): { x: number; y: number } {
  const s = map.spawn;
  for (let dy = 900; dy < 6000; dy += 300) {
    for (const dx of [-1200, -800, 800, 1200, -1600, 1600]) {
      const at = { x: Math.round(s.x + dx), y: Math.round(s.y - dy) };
      const o = worldObjectSchema.parse({
        ...structuredClone(template.spec),
        id: ID,
        name: NAME,
        ...at,
        status: 'published',
      });
      if (!worldProblem(WORLD_REGISTRY, { ...EMPTY_WORLD_CONTENT, objects: [o] })) return at;
    }
  }
  throw new Error('sin sitio libre');
}
const SPOT = freeSpot();

/** Un PNG de verdad (degradado) para el selector de archivos. */
function pngFile(name: string, side: number) {
  const img = new PNG({ width: side, height: side });
  for (let i = 0; i < side * side; i++) {
    img.data[i * 4] = i % 255;
    img.data[i * 4 + 1] = 120;
    img.data[i * 4 + 2] = 200;
    img.data[i * 4 + 3] = 255;
  }
  return { name, mimeType: 'image/png', buffer: PNG.sync.write(img) };
}

async function next(page: Page, step: ObjectStep) {
  const wizard = page.getByTestId('objeto-asistente');
  await expect(page.getByTestId('objeto-problema')).toHaveCount(0);
  await wizard.getByTestId('objeto-siguiente').click();
  await expect(wizard).toHaveAttribute('data-paso', step);
}

test('objeto nuevo: plantilla, 10 pasos, asset validado, publicado y en el mar', async ({
  page,
}) => {
  await page.goto('/admin#objetos');
  await expect(page.getByTestId('admin-seccion-objetos')).toBeVisible();

  // REQ-ADM-011: duplicar una plantilla de serie conserva lo suyo, con nombre propio.
  await page.getByTestId(`plantilla-duplicar-${template.id}`).click();
  await expect(page.getByTestId('plantillas')).toContainText(
    t('admin.objects.copyOf', { name: template.name }),
  );

  // 1. Añadir, desde la plantilla «Isla de evento».
  await page.getByTestId(`plantilla-usar-${template.id}`).click();
  const wizard = page.getByTestId('objeto-asistente');
  await expect(wizard).toHaveAttribute('data-paso', 'add');
  await wizard.getByTestId('objeto-nombre').fill(NAME);
  await expect(wizard.getByTestId('objeto-id')).toHaveValue(ID);

  // 2. Categoría: la de la plantilla.
  await next(page, 'category');
  await expect(wizard.getByTestId('objeto-categoria')).toHaveValue('isla');

  // 3. Asset (REQ-ADM-012): un GIF con nombre de PNG se rechaza; un PNG de verdad, no.
  await next(page, 'asset');
  const file = wizard.getByTestId('objeto-asset-archivo');
  await file.setInputFiles({
    name: 'isla.png',
    mimeType: 'image/png',
    buffer: Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0]),
  });
  await expect(wizard.getByTestId('asset-regla-format')).toHaveAttribute('data-ok', 'no');
  await expect(wizard.getByTestId('admin-error')).toBeVisible();
  await expect(wizard.getByTestId('objeto-asset-subido')).toHaveCount(0);
  await file.setInputFiles(pngFile('isla.png', 600));
  await expect(wizard.getByTestId('asset-reglas')).toHaveAttribute('data-ok', 'si');
  await expect(wizard.getByTestId('objeto-asset-subido')).toContainText('isla.png');

  // 4. Colocar en el agua.
  await next(page, 'place');
  await wizard.getByTestId('objeto-x').fill(String(SPOT.x));
  await wizard.getByTestId('objeto-y').fill(String(SPOT.y));

  // 5–8. Geometría, comportamientos, parámetros y enlaces: los de la plantilla.
  await next(page, 'geometry');
  await expect(wizard.getByTestId('objeto-huella')).toHaveValue(String(template.spec.hitbox));
  await next(page, 'behaviors');
  for (const b of template.spec.behaviors) {
    await expect(wizard.getByTestId(`objeto-comp-${b.type}`)).toBeChecked();
  }
  await next(page, 'params');
  await next(page, 'links');

  // 9. Previsualizar: el mar se sigue jugando con la isla.
  await next(page, 'preview');
  await expect(wizard.getByTestId('objeto-previa')).toHaveAttribute('data-ok', 'si', {
    timeout: 20_000,
  });

  // 10. Publicar.
  await next(page, 'save');
  await wizard.getByTestId('objeto-publicar').click();
  await expect(wizard.getByTestId('admin-ok')).toContainText(t('admin.objects.save.publishOk'));
  await expect(page.getByTestId(`objeto-${ID}`)).toHaveAttribute('data-estado', 'published');
  await expect(wizard.getByTestId('objeto-ver-mar')).toHaveAttribute('href', `/mar?ir=${ID}`);

  // En el mar 3D: el barco navega hasta la isla nueva y abre su ficha.
  await openMar(page, `?ir=${ID}`);
  await page
    .getByTestId('mar-entradas-saltar')
    .click({ timeout: 5_000 })
    .catch(() => {});
  const sheet = marSheet(page);
  await expect(sheet).toHaveAttribute('data-lugar', ID, { timeout: 60_000 });
  await expect(sheet.getByRole('heading', { name: NAME })).toBeVisible();
});
