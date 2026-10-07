import { eventSchema, worldObjectSchema } from '@boia/contracts';
import { SAMPLE_EVENTS } from '@boia/store';
import { WORLD_REGISTRY } from '@boia/world';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { BUILTIN_TEMPLATES } from '../../lib/admin/objects';
import { worldProblem } from '../../lib/admin/validate';
import { EMPTY_WORLD_CONTENT, eventIslands, islandEvent } from '../../lib/admin/world';
import { t } from '../../lib/i18n';
import { shot } from './deck-helpers';

/**
 * Capturas de la parte 7 (Admin), en escritorio (1440×900): el Admin se usa
 * en un ordenador (decisión 5). El proyecto `escritorio` entra con la sesión
 * del Admin de la demo (Carnet 000) ya puesta; la puerta se captura sin ella.
 * Modo local (D-20) y contenido de muestra de hoy. Los paneles que piden
 * cuentas (Fiestas y QR, Socios, Rankings, Seguridad) no se pueden abrir
 * aquí: la parte los explica en una diapositiva de texto (decisión 8).
 */

test.describe.configure({ timeout: 180_000 });

/** Abre una sección del Admin por su ancla y espera a que esté. */
async function seccion(page: Page, id: string): Promise<Locator> {
  await page.goto(`/admin#${id}`);
  const main = page.getByTestId(`admin-seccion-${id}`);
  await expect(main).toBeVisible({ timeout: 30_000 });
  return main;
}

/** Sube el elemento al principio de la pantalla, por debajo del aviso fijo de la demo. */
async function alPrincipio(loc: Locator, margen = 64) {
  await loc.evaluate((el, m) => {
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - m);
  }, margen);
}

test.describe('sin sesión', () => {
  test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1100, height: 640 } });

  test('entrada', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByTestId('admin-login')).toBeVisible();
    await page.getByTestId('admin-login-carnet').fill('000');
    await shot(page, '07', 'entrada');
  });
});

/** Un cambio en el borrador de la home: el texto del botón «Zarpar». */
async function cambiarBoton(page: Page) {
  const main = await seccion(page, 'inicio');
  const portada = main.getByTestId('portada');
  await portada.locator('summary').click();
  await portada.getByTestId('cta-explorar').fill('Zarpar al mar');
  await portada.getByTestId('portada-guardar').click();
  await expect(portada).toContainText(t('admin.home.guardadoEnElBorrador'));
  return main;
}

test('inicio', async ({ page }) => {
  await cambiarBoton(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, '07', 'inicio');
});

test('vista-previa', async ({ page }) => {
  await cambiarBoton(page);
  await page.goto('/admin/vista-previa');
  const previa = page.getByTestId('vista-previa-borrador');
  await expect(previa.getByRole('link', { name: 'Zarpar al mar' }).or(previa.getByRole('button', { name: 'Zarpar al mar' })).first()).toBeVisible({ timeout: 30_000 });
  await shot(page, '07', 'vista-previa', { respiro: 1500 });
});

/** La isla de evento que abre hoy un evento de la muestra (como admin-fotos.spec.ts). */
function islaConEvento() {
  const now = new Date();
  const events = SAMPLE_EVENTS.map((e) => eventSchema.parse(e));
  const island = eventIslands(WORLD_REGISTRY.map).find((p) => islandEvent(p.id, events, now));
  if (!island) throw new Error('ninguna isla de la muestra abre un evento hoy');
  return island;
}

test('fotos-isla', async ({ page }) => {
  const island = islaConEvento();
  await seccion(page, 'fotos');
  const form = page.getByTestId('fotos-isla');
  await expect(form).toBeVisible();
  await form.getByTestId('fotos-isla-isla').selectOption(island.id);
  await expect(form.getByTestId('fotos-isla-pasado')).toBeChecked();
  await form.getByTestId('fotos-isla-alt').fill('La pista llena al atardecer');
  await alPrincipio(form);
  await shot(page, '07', 'fotos-isla');
});

test('eventos', async ({ page }) => {
  await seccion(page, 'eventos');
  await shot(page, '07', 'eventos');
});

test('mundo', async ({ page }) => {
  const main = await seccion(page, 'mundo');
  const id = islaConEvento().id;
  await main.locator(`select:has(option[value="${id}"])`).selectOption(id);
  await expect(main.getByTestId('lugar-editor')).toBeVisible();
  await shot(page, '07', 'mundo', { respiro: 1000 });
});

/** Un sitio de agua donde el cofre nuevo no corta el paso (como admin-objeto.spec.ts). */
function sitioLibre(spec: Record<string, unknown>): { x: number; y: number } {
  const map = WORLD_REGISTRY.map;
  const s = map.spawn;
  for (let dy = 900; dy < 6000; dy += 300) {
    for (const dx of [-1200, -800, 800, 1200, -1600, 1600]) {
      const at = { x: Math.round(s.x + dx), y: Math.round(s.y - dy) };
      const o = worldObjectSchema.parse({
        ...structuredClone(spec),
        id: 'cofre-del-admin',
        name: 'Cofre del Admin',
        ...at,
        status: 'published',
      });
      if (!worldProblem(WORLD_REGISTRY, { ...EMPTY_WORLD_CONTENT, objects: [o] })) return at;
    }
  }
  throw new Error('sin sitio libre');
}

test('objetos', async ({ page }) => {
  const plantilla = BUILTIN_TEMPLATES.find((x) => x.id === 'plantilla-cofre')!;
  const sitio = sitioLibre(plantilla.spec as unknown as Record<string, unknown>);
  await seccion(page, 'objetos');
  await page.getByTestId(`plantilla-usar-${plantilla.id}`).click();
  const wizard = page.getByTestId('objeto-asistente');
  await expect(wizard).toHaveAttribute('data-paso', 'add');
  await wizard.getByTestId('objeto-nombre').fill('Cofre del Admin');
  for (const paso of ['category', 'asset', 'place']) {
    await expect(page.getByTestId('objeto-problema')).toHaveCount(0);
    await wizard.getByTestId('objeto-siguiente').click();
    await expect(wizard).toHaveAttribute('data-paso', paso);
  }
  await wizard.getByTestId('objeto-x').fill(String(sitio.x));
  await wizard.getByTestId('objeto-y').fill(String(sitio.y));
  await expect(page.getByTestId('objeto-problema')).toHaveCount(0);
  await alPrincipio(wizard);
  await shot(page, '07', 'objetos', { respiro: 1000 });
});

test('moderacion', async ({ page }) => {
  await seccion(page, 'moderacion');
  await shot(page, '07', 'moderacion');
});
