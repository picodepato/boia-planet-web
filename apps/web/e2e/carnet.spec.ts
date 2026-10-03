import { EVENT_STATE_BEHAVIOR, eventState } from '@boia/contracts';
import {
  MemoryStorage,
  SAMPLE_BOTTLES,
  SAMPLE_CREW,
  SAMPLE_EVENTS,
  STORE_KEY,
  createLocalRepository,
} from '@boia/store';
import { expect, test } from '@playwright/test';
import { t } from '../lib/i18n';
import { openMar } from './mar-helpers';

/**
 * Una botella lleva al Carnet de quien la escribió (T22; en el mar 3D desde
 * T62, D-25): se lee una botella de muestra junto a la salida y «Ver su
 * Carnet» abre el Carnet público de su autor (REQ-IDE-011, REQ-IDE-051).
 * Crear el Carnet y echar la propia botella lo prueba mar-botellas.spec.ts.
 * Corre en móvil 360×640 y en escritorio.
 */

test.describe.configure({ timeout: 120_000 });

test('leer una botella de muestra → VER SU CARNET', async ({ page }) => {
  const errors = await openMar(page);
  const seeded = page.locator('[data-testid^="mar-botella-cerca-botella-muestra-"]').first();
  await expect(seeded).toBeVisible({ timeout: 10_000 });
  const id = (await seeded.getAttribute('data-testid'))!.replace('mar-botella-cerca-', '');
  const sample = SAMPLE_BOTTLES.find((b) => b.id === id)!;
  const author = SAMPLE_CREW.find((c) => c.userId === sample.userId)!;

  await seeded.click();
  const read = page.getByTestId('mar-botella').getByTestId('botella-leida');
  await expect(read.getByTestId('botella-mensaje')).toHaveText(sample.message);
  await read.getByTestId('botella-ver-carnet').click();

  await expect(page).toHaveURL(new RegExp(`/carnet/${author.userId}`));
  await expect(page.getByTestId('carnet-apodo')).toHaveText(author.nickname);
  // T91: el Carnet público es la tarjeta ID-1 de un miembro de muestra, con su QR.
  const card = page.getByTestId('carnet-tarjeta');
  await expect(card).toHaveAttribute('data-cara', 'front');
  await expect(card.locator('[data-qr]')).toHaveAttribute(
    'data-qr',
    new RegExp(`/carnet/${encodeURIComponent(author.userId)}$`),
  );
  await expect(card).toContainText(t('carnet.card.specimen'));
  expect(errors).toEqual([]);
});

/**
 * Modo local (plan 008, T89; D-20): sin Supabase no aparece nada de la cuenta
 * con email. «Crear mi Carnet» abre el alta de siempre y guardar lo crea en
 * este navegador, sin hoja de acceso ni «Tu cuenta».
 */
test('modo local: el Carnet se crea sin pedir email', async ({ page }, info) => {
  const errors = await openMar(page);
  await page.getByTestId('mar-enlace-carnet').click();
  const carnet = page.getByTestId('mar-carnet');
  await expect(carnet.getByTestId('carnet-invitacion')).toBeVisible();
  await carnet.getByTestId('carnet-crear').click();
  await carnet.getByTestId('carnet-apodo-input').fill(`Local ${info.project.name}`);
  await carnet.getByTestId('carnet-guardar').click();
  await expect(carnet.getByTestId('carnet-apodo')).toHaveText(`Local ${info.project.name}`);
  // T91: sin servidor no hay nº de miembro ni sellos por QR («Escanear sello»).
  await expect(carnet.getByTestId('carnet-numero')).toHaveText(t('carnet.card.noNumber'));
  await expect(carnet.getByTestId('carnet-escanear')).toHaveCount(0);
  await expect(page.getByTestId('acceso')).toHaveCount(0);
  await expect(page.getByTestId('cuenta')).toHaveCount(0);
  await expect(page.locator('#boia-cuenta-capa')).toHaveCount(0);
  expect(errors).toEqual([]);
});

/**
 * El Carnet como tarjeta ID-1 (plan 008, T91, decisión 10) en modo local: el
 * anverso con el apodo, el rango y los puntos; «Ver sellos» la gira y el
 * reverso tiene el sello de la compra de prueba (como siempre, REQ-IDE-021).
 * /sello sin servidor dice que hace falta la versión con cuentas.
 */
test('la tarjeta: anverso, girar, el sello de la compra de prueba en el reverso', async ({
  page,
}, info) => {
  const now = new Date();
  const event = SAMPLE_EVENTS.find(
    (e) => e.state !== 'draft' && EVENT_STATE_BEHAVIOR[eventState(e, now)].purchasable,
  )!;
  expect(event, 'hay un evento de muestra a la venta').toBeDefined();
  const storage = new MemoryStorage();
  const repo = createLocalRepository({ storage, watch: false });
  const nickname = `Tarjeta ${info.project.name}`;
  await repo.carnet.create({ nickname });
  await repo.purchases.confirmSandbox({ purchaseId: 'compra-t91', eventId: event.id });
  await page.addInitScript(
    ([key, doc]) => {
      if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, doc);
    },
    [STORE_KEY, storage.getItem(STORE_KEY)!] as const,
  );
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/carnet');
  const card = page.getByTestId('carnet-tarjeta');
  await expect(card.getByTestId('carnet-apodo')).toHaveText(nickname);
  await expect(card).toHaveAttribute('data-cara', 'front');
  await expect(card.getByTestId('carnet-anverso')).not.toHaveAttribute('inert', /.*/);
  await expect(card.getByTestId('carnet-reverso')).toHaveAttribute('inert', /.*/);
  await expect(card.getByTestId('carnet-girar')).toHaveText(new RegExp(t('carnet.flip.toBack')));

  await card.getByTestId('carnet-girar').click();
  await expect(card).toHaveAttribute('data-cara', 'back');
  await expect(card.getByTestId('carnet-anverso')).toHaveAttribute('inert', /.*/);
  const back = card.getByTestId('carnet-reverso');
  await expect(back.getByTestId('carnet-sellos-cuenta')).toHaveText(t('carnet.stamps.countOne'));
  await expect(back.getByTestId(`carnet-sello-${event.id}`)).toBeVisible();
  await expect(back.getByTestId('carnet-sellos')).toContainText(event.name);

  // «Ver tus sellos»: la lista legible, con el nombre de la fiesta.
  await page.getByTestId('carnet-ver-sellos').click();
  await expect(page.getByTestId('carnet-tus-sellos')).toContainText(event.name);

  // Un toque en la tarjeta también la gira.
  await card.getByTestId('carnet-reverso').click({ position: { x: 20, y: 20 } });
  await expect(card).toHaveAttribute('data-cara', 'front');

  // /sello sin servidor: el aviso de la versión con cuentas.
  await page.goto('/sello?e=fiesta&c=ABCDEF123');
  await expect(page.getByTestId('sello-error')).toHaveAttribute('data-motivo', 'local');
  await expect(page.getByTestId('sello-error')).toContainText(t('sello.localOnly'));
  expect(errors).toEqual([]);
});
