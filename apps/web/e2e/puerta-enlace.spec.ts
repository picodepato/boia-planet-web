import { MemoryStorage, STORE_KEY, createLocalRepository } from '@boia/store';
import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { encode } from 'uqr';
import { DOOR_LINKS_KEY, newDoorToken } from '../lib/door-links';
import { t } from '../lib/i18n';

/**
 * El enlace de la puerta en modo local (plan 034 T307), sin servidor (D-20):
 *
 * - sin sesión del Admin, el enlace abre el lector de su fiesta (el nombre y
 *   la cámara) y una foto del QR del Carnet lo sella una vez; nada de sellar
 *   por apodo;
 * - un código que no existe no abre nada;
 * - el Admin crea el enlace en «Puerta y sellos» y, al revocarlo, deja de
 *   valer.
 *
 * Con cuentas, lo mismo va por `door_link_info` y `door_link_stamp`
 * (packages/db/src/supabase/door-links.supabase.ts).
 */
test.describe.configure({ timeout: 120_000 });

const NICK = 'Grumete Enlace';
let seeded: { doc: string; userId: string; eventId: string; eventName: string };

test.beforeAll(async () => {
  const storage = new MemoryStorage();
  const repo = createLocalRepository({ storage, watch: false });
  const carnet = await repo.carnet.create({ nickname: NICK });
  const party = (await repo.content.list('events')).find(
    (e) => e.state !== 'draft' && e.state !== 'cancelled',
  )!;
  seeded = {
    doc: storage.getItem(STORE_KEY)!,
    userId: carnet.userId,
    eventId: party.id,
    eventName: party.name,
  };
});

/** Un PNG del QR de `text` (la foto que se sube al lector). */
function qrPng(text: string): Buffer {
  const qr = encode(text, { ecc: 'M', border: 4 });
  const scale = 8;
  const side = qr.size * scale;
  const png = new PNG({ width: side, height: side });
  for (let y = 0; y < side; y++)
    for (let x = 0; x < side; x++) {
      const v = qr.data[Math.floor(y / scale)]![Math.floor(x / scale)] ? 0 : 255;
      png.data.set([v, v, v, 255], (y * side + x) * 4);
    }
  return PNG.sync.write(png);
}

async function seed(page: Page, extra: Record<string, string> = {}) {
  await page.addInitScript(
    (items) => {
      try {
        for (const [key, value] of items) {
          if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, value);
        }
      } catch {
        // sin almacenamiento: la prueba fallará más abajo, con su motivo
      }
    },
    [[STORE_KEY, seeded.doc], ...Object.entries(extra)] as Array<[string, string]>,
  );
}

const carnetUrl = (page: Page) => new URL(`/carnet/${seeded.userId}`, page.url()).toString();

test.describe('sin sesión del Admin', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('el enlace abre el lector de su fiesta y sella el Carnet una vez', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const token = newDoorToken();
    await seed(page, {
      [DOOR_LINKS_KEY]: JSON.stringify([
        { token, eventId: seeded.eventId, createdAt: new Date().toISOString() },
      ]),
    });
    await page.goto(`/puerta/${token}`);
    const view = page.getByTestId('puerta-enlace-pagina');
    await expect(view).toHaveAttribute('data-estado', 'ready');
    await expect(page.getByTestId('puerta-enlace-fiesta')).toHaveText(seeded.eventName);
    await expect(page.getByTestId('puerta-aviso-local')).toBeVisible();
    // Sólo escanear: ni elegir fiesta, ni pegar enlaces, ni sellar por apodo.
    await expect(page.getByTestId('puerta-fiesta')).toHaveCount(0);
    await expect(page.getByTestId('puerta-enlace')).toHaveCount(0);
    await expect(page.getByTestId('sellar-a-mano')).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

    // El mismo lector que /admin/puerta.
    await page.getByTestId('puerta-abrir-camara').click();
    await expect(page.getByTestId('puerta-camara')).toBeVisible();
    await page.getByTestId('puerta-cerrar-camara').click();
    await expect(page.getByTestId('puerta-camara')).toHaveCount(0);

    const result = page.getByTestId('puerta-resultado');
    const photo = { name: 'carnet.png', mimeType: 'image/png', buffer: qrPng(carnetUrl(page)) };
    await page.getByTestId('puerta-foto').setInputFiles(photo);
    await expect(result).toHaveAttribute('data-resultado', 'granted');
    await expect(result).toHaveText(
      t('puerta.result.granted', { nickname: NICK, party: seeded.eventName }),
    );
    await page.getByTestId('puerta-foto').setInputFiles(photo);
    await expect(result).toHaveAttribute('data-resultado', 'already');
    expect(errors).toEqual([]);
  });

  test('un código que no existe no abre el lector', async ({ page }) => {
    await seed(page);
    await page.goto(`/puerta/${newDoorToken()}`);
    await expect(page.getByTestId('puerta-enlace-no-vale')).toHaveText(t('puerta.link.invalid'));
    await expect(page.getByTestId('puerta-abrir-camara')).toHaveCount(0);
  });
});

test('el Admin crea el enlace de la puerta y, al revocarlo, deja de valer', async ({ page }) => {
  await seed(page);
  await page.goto('/admin#puerta');
  const links = page.getByTestId('puerta-enlaces');
  await expect(links).toBeVisible();
  await links.getByTestId('puerta-enlace-fiesta-elegir').selectOption(seeded.eventId);
  await links.getByTestId('puerta-enlace-crear').click();
  const url = await links.getByTestId('puerta-enlace-url').inputValue();
  expect(new URL(url).pathname).toMatch(/^\/puerta\/[0-9a-f]{64}$/);
  await expect(links.getByTestId(`puerta-enlace-vivo-${seeded.eventId}`)).toBeVisible();

  await page.goto(url);
  await expect(page.getByTestId('puerta-enlace-fiesta')).toHaveText(seeded.eventName);
  await expect(page.getByTestId('puerta-abrir-camara')).toBeVisible();

  await page.goto('/admin#puerta');
  await page
    .getByTestId('puerta-enlaces')
    .getByTestId(`puerta-enlace-revocar-${seeded.eventId}`)
    .click();
  await expect(page.getByTestId('puerta-enlaces').getByTestId('admin-ok')).toHaveText(
    t('puerta.links.revoked'),
  );
  await page.goto(url);
  await expect(page.getByTestId('puerta-enlace-no-vale')).toBeVisible();
});
