import { rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MemoryStorage, STORE_KEY, createLocalRepository } from '@boia/store';
import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { encode } from 'uqr';
import { t } from '../lib/i18n';

/**
 * La puerta de la fiesta en modo local (plan 019 T218, decisión 11), sin
 * servidor (D-20):
 *
 * - el lector de la puerta (/admin/puerta) lee con la cámara el QR que lleva
 *   el Carnet (Chromium con una cámara falsa que lo enseña: un vídeo .y4m
 *   hecho aquí) y el Carnet enseña el sello de la fiesta;
 * - una foto del QR y el enlace pegado hacen lo mismo; la segunda vez, «ya
 *   lo tenía»; otro QR no sella;
 * - el Admin enseña el QR de alta (abre «Crear carnet», sin email en local)
 *   y sella un Carnet a mano, con motivo.
 *
 * Con cuentas, lo mismo va por `staff_stamp`
 * (packages/db/src/supabase/door-stamps.supabase.ts).
 */
test.describe.configure({ timeout: 180_000 });

const run = `${process.pid}-${Math.random().toString(36).slice(2, 6)}`;
const VIDEO = path.join(tmpdir(), `boia-t218-puerta-${run}.y4m`);
const NICK = 'Grumete Puerta';

test.use({
  permissions: ['camera'],
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${VIDEO}`,
    ],
  },
});

/** Los módulos del QR de `text`, a `scale` px, con su margen blanco. */
function qrPixels(text: string, scale: number) {
  const qr = encode(text, { ecc: 'M', border: 4 });
  const side = qr.size * scale;
  const dark = (x: number, y: number) => !!qr.data[Math.floor(y / scale)]![Math.floor(x / scale)];
  return { side, dark };
}

/** Un vídeo Y4M (4:2:0) de unos fotogramas con el QR de `text` en el centro. */
function qrVideo(text: string, file: string) {
  const W = 640;
  const H = 480;
  const probe = encode(text, { ecc: 'M', border: 4 });
  const { side, dark } = qrPixels(text, Math.floor(Math.min(W, H) / probe.size / 1.2));
  const ox = Math.floor((W - side) / 2);
  const oy = Math.floor((H - side) / 2);
  const y = Buffer.alloc(W * H, 235);
  for (let py = 0; py < side; py++)
    for (let px = 0; px < side; px++) if (dark(px, py)) y[(oy + py) * W + ox + px] = 16;
  const uv = Buffer.alloc((W / 2) * (H / 2) * 2, 128);
  const frame = Buffer.concat([Buffer.from('FRAME\n'), y, uv]);
  const head = Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`);
  writeFileSync(file, Buffer.concat([head, ...Array.from({ length: 10 }, () => frame)]));
}

/** Un PNG del QR de `text` (la foto que se sube al lector). */
function qrPng(text: string): Buffer {
  const { side, dark } = qrPixels(text, 8);
  const png = new PNG({ width: side, height: side });
  for (let y = 0; y < side; y++)
    for (let x = 0; x < side; x++) {
      const v = dark(x, y) ? 0 : 255;
      png.data.set([v, v, v, 255], (y * side + x) * 4);
    }
  return PNG.sync.write(png);
}

/** El Carnet de este navegador, hecho antes de abrir la página. */
let seeded: { doc: string; userId: string };

test.beforeAll(async () => {
  const storage = new MemoryStorage();
  const repo = createLocalRepository({ storage, watch: false });
  const carnet = await repo.carnet.create({ nickname: NICK });
  seeded = { doc: storage.getItem(STORE_KEY)!, userId: carnet.userId };
  // El QR del Carnet lleva su URL pública; el lector vale con cualquier dominio.
  qrVideo(`http://127.0.0.1/carnet/${carnet.userId}`, VIDEO);
});

test.afterAll(() => {
  rmSync(VIDEO, { force: true });
});

async function seed(page: Page) {
  await page.addInitScript(
    ([key, value]) => {
      try {
        if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, value);
      } catch {
        // sin almacenamiento: la prueba fallará más abajo, con su motivo
      }
    },
    [STORE_KEY, seeded.doc] as const,
  );
}

/** La URL que lleva el QR del Carnet de este navegador, leída de la tarjeta. */
async function carnetQr(page: Page): Promise<string> {
  await page.goto('/carnet');
  const qr = page.getByTestId('carnet-anverso').locator('svg[data-qr]');
  await expect(qr).toHaveCount(1);
  const url = (await qr.getAttribute('data-qr'))!;
  expect(new URL(url).pathname).toBe(`/carnet/${seeded.userId}`);
  return url;
}

/** El lector de la puerta con su fiesta elegida (la que toca). */
async function openDoor(page: Page): Promise<{ id: string; name: string }> {
  await page.goto('/admin/puerta');
  await expect(page.getByTestId('puerta')).toBeVisible();
  await expect(page.getByTestId('puerta-aviso-local')).toBeVisible();
  const select = page.getByTestId('puerta-fiesta');
  await expect(select).toBeEnabled();
  const id = await select.inputValue();
  expect(id).not.toBe('');
  const name = (await select.locator(`option[value="${id}"]`).textContent())!.split(' · ')[0]!;
  await expect(page.getByTestId('puerta-cuenta')).toHaveText(
    t('puerta.count', { n: 0, party: name }),
  );
  return { id, name };
}

async function expectStamp(page: Page, eventId: string) {
  await page.goto('/carnet');
  const card = page.getByTestId('carnet-tarjeta');
  await expect(card.getByTestId(`carnet-sello-${eventId}`)).toHaveCount(1);
  await expect(card.getByTestId('carnet-sellos')).toHaveAttribute(
    'aria-label',
    t('carnet.stamps.listAria', { n: 1 }),
  );
}

test('el lector de la puerta lee con la cámara el QR del Carnet y el Carnet enseña el sello', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await seed(page);
  await carnetQr(page);
  const party = await openDoor(page);

  await page.getByTestId('puerta-abrir-camara').click();
  await expect(page.getByTestId('puerta-camara')).toBeVisible();
  const result = page.getByTestId('puerta-resultado');
  await expect(result).toHaveAttribute('data-resultado', 'granted', { timeout: 60_000 });
  await expect(result).toHaveText(
    t('puerta.result.granted', { nickname: NICK, party: party.name }),
  );
  await expect(page.getByTestId('puerta-cuenta')).toHaveText(
    t('puerta.count', { n: 1, party: party.name }),
  );
  // El mismo QR sigue delante: no se sella dos veces.
  await page.waitForTimeout(2500);
  await expect(result).toHaveAttribute('data-resultado', 'granted');
  await page.getByTestId('puerta-cerrar-camara').click();
  await expect(page.getByTestId('puerta-camara')).toHaveCount(0);

  await expectStamp(page, party.id);
  expect(errors).toEqual([]);
});

test('una foto del QR o el enlace pegado sellan; la segunda vez, ya lo tenía; otro QR no', async ({
  page,
}) => {
  await seed(page);
  const url = await carnetQr(page);
  const party = await openDoor(page);
  const result = page.getByTestId('puerta-resultado');

  await page.getByTestId('puerta-foto').setInputFiles({
    name: 'carnet.png',
    mimeType: 'image/png',
    buffer: qrPng(url),
  });
  await expect(result).toHaveAttribute('data-resultado', 'granted');

  await page.getByTestId('puerta-enlace').fill(url);
  await page.getByTestId('puerta-enlace-sellar').click();
  await expect(result).toHaveAttribute('data-resultado', 'already');
  await expect(result).toHaveText(t('puerta.result.already', { nickname: NICK, party: party.name }));

  await page.getByTestId('puerta-foto').setInputFiles({
    name: 'otro.png',
    mimeType: 'image/png',
    buffer: qrPng('https://example.com/carta?mesa=4'),
  });
  await expect(result).toHaveAttribute('data-resultado', 'notCarnet');
  await expect(page.getByTestId('puerta-cuenta')).toHaveText(
    t('puerta.count', { n: 1, party: party.name }),
  );

  // Quien llega sin Carnet: el QR de alta, a pantalla completa.
  await page.getByTestId('qr-alta-proyectar').click();
  const big = page.getByTestId('qr-alta-proyector');
  await expect(big.locator('svg[data-qr]')).toHaveAttribute(
    'data-qr',
    new URL('/carnet?crear=1', page.url()).toString(),
  );

  await expectStamp(page, party.id);
});

test('el Admin enseña el QR de alta, abre el lector y sella un Carnet a mano', async ({ page }) => {
  await seed(page);
  await page.goto('/admin#puerta');
  const section = page.getByTestId('puerta-seccion');
  await expect(section).toBeVisible();

  // El QR de alta abre «Crear carnet» en /carnet.
  const signup = new URL('/carnet?crear=1', page.url()).toString();
  await expect(section.getByTestId('qr-alta-url')).toHaveText(signup);
  await expect(section.getByTestId('qr-alta').locator('svg[data-qr]').first()).toHaveAttribute(
    'data-qr',
    signup,
  );
  await expect(section.getByTestId('admin-puerta-abrir')).toHaveAttribute('href', '/admin/puerta');

  // Sellar a mano: la fiesta, el Carnet por su apodo y el motivo.
  const manual = section.getByTestId('sellar-a-mano');
  const options = manual.getByTestId('sellar-fiesta').locator('option');
  await expect(options.first()).toBeAttached();
  const eventId = (await options.last().getAttribute('value'))!;
  await manual.getByTestId('sellar-fiesta').selectOption(eventId);
  await manual.getByTestId('sellar-buscar').fill('grumete');
  await expect(manual.getByTestId('sellar-socio').locator('option')).toHaveText([NICK]);
  const stamp = manual.getByTestId('sellar-poner');
  await expect(stamp).toBeDisabled();
  await manual.getByTestId('sellar-motivo').fill('Vino sin móvil (e2e)');
  await stamp.click();
  await expect(manual.getByTestId('admin-ok')).toHaveText(t('puerta.manual.done'));

  await expectStamp(page, eventId);

  // Queda en la auditoría, con su motivo.
  await page.goto('/admin#auditoria');
  await expect(page.getByTestId('admin-seccion-auditoria')).toContainText('Vino sin móvil (e2e)');
});

test('el QR de alta abre «Crear carnet» directamente; en local no pide email', async ({ page }) => {
  await page.goto('/carnet?crear=1');
  const signup = page.getByTestId('carnet-alta');
  const form = signup.getByTestId('carnet-form');
  await expect(form).toBeVisible();
  await form.getByTestId('carnet-apodo-input').fill('Recién llegada');
  await form.getByTestId('carnet-guardar').click();
  await expect(signup.getByTestId('carnet-mio')).toBeVisible();
  await expect(signup.getByTestId('carnet-apodo')).toHaveText('Recién llegada');
});
