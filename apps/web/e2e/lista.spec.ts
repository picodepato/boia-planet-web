import { GUEST_LIST_KEY } from '@boia/store';
import { expect, test, type Page } from '@playwright/test';
import { t } from '../lib/i18n';
import { eventHref } from '../lib/landing/eventos';
import { listDoorPrice, listNotice } from '../lib/lista/model';
import { signupLine, tl } from '../lib/lista/t';
import { CHECKOUT_COPY } from '../lib/ticketing/copy';
import { seedCarnet } from './carnet-seed';
import { openTickets } from './hero-helpers';
import { openMar } from './mar-helpers';
import { GUEST_LIST_EVENTS, ONLINE_EVENT, openSales } from './online-event';

/**
 * La lista de una fiesta, del lado del socio (plan 034 T309), en la demo sin
 * servidor (D-20): Halloween va en lista y lleva «Apuntarse en la lista», con
 * el precio en la puerta y la hora de la lista, en la ficha y en /mar. Sin
 * Carnet, se crea y se vuelve a la lista; con él, el nombre (el apodo, que se
 * puede cambiar) y «Apuntarme». Al volver, la fecha y el nombre; borrarse
 * funciona. Las demás fiestas siguen con su compra.
 */

test.describe.configure({ timeout: 120_000 });

const party = GUEST_LIST_EVENTS[0]!;
const closesAt = party?.guestList?.closesAt;
const listOpen = !!party && (!closesAt || Date.now() < Date.parse(closesAt));

/** La inscripción guardada en este navegador (la demo). */
async function stored(page: Page): Promise<{ listName: string; createdAt: string }> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), GUEST_LIST_KEY);
  const doc = JSON.parse(raw ?? '{}') as {
    signups?: Record<string, Record<string, { listName: string; createdAt: string }>>;
  };
  const rows = Object.values(doc.signups?.[party.id] ?? {});
  expect(rows).toHaveLength(1);
  return rows[0]!;
}

test.beforeEach(() => {
  test.skip(!listOpen, 'no hay ninguna fiesta en lista abierta en la muestra');
});

test('ficha: sin Carnet, se crea; se apunta con otro nombre, lo vuelve a ver y se borra', async ({
  page,
}, info) => {
  await openSales(page);
  await page.goto(eventHref(party.slug));
  const ficha = page.getByTestId('evento-ficha');
  const join = ficha.getByTestId(`lista-${party.id}`);
  await expect(join).toHaveText(tl('lista.join'));
  const note = ficha.getByTestId('evento-lista').locator('.event-card__note');
  await expect(note).toContainText(listDoorPrice(party)!);
  await expect(note).toContainText(listNotice(closesAt, party.timeZone)!);
  // Nada de compra ni del aviso de la puerta.
  await expect(ficha.getByTestId(`comprar-${party.id}`)).toHaveCount(0);
  await expect(ficha.getByTestId('evento-solo-puerta')).toHaveCount(0);

  // Sin Carnet: hace falta; el alta rápida aquí mismo y vuelta a la lista.
  await join.click();
  const dialog = page.getByTestId('lista');
  await expect(dialog.getByTestId('lista-carnet')).toBeVisible({ timeout: 20_000 });
  await expect(dialog.getByTestId('lista-aviso')).toHaveText(listNotice(closesAt, party.timeZone)!);
  await dialog.getByTestId('lista-crear-carnet').click();
  const nickname = `Lista ${info.project.name}`.slice(0, 24);
  await dialog.getByTestId('checkout-carnet-apodo').fill(nickname);
  await dialog.getByTestId('checkout-carnet-guardar').click();

  // El nombre viene con el apodo; se apunta con otro.
  const name = dialog.getByTestId('lista-nombre');
  await expect(name).toHaveValue(nickname, { timeout: 20_000 });
  await name.fill('La Pepa e2e');
  await dialog.getByTestId('lista-confirmar').click();
  await expect(dialog.getByTestId('lista-apuntado')).toBeVisible();
  await expect(dialog.getByTestId('lista-mia')).toContainText('La Pepa e2e');
  await dialog.getByTestId('lista-close').click();
  await expect(dialog).toHaveCount(0);

  // Al volver: la fecha y el nombre con los que se apuntó, y el aviso.
  await page.reload();
  await ficha.getByTestId(`lista-${party.id}`).click();
  const signup = await stored(page);
  expect(signup.listName).toBe('La Pepa e2e');
  await expect(dialog.getByTestId('lista-mia')).toHaveText(signupLine(signup, party.timeZone), {
    timeout: 20_000,
  });
  await expect(dialog.getByTestId('lista-aviso')).toHaveText(listNotice(closesAt, party.timeZone)!);

  // Borrarse, con confirmación; «No» no borra nada.
  await dialog.getByTestId('lista-borrar').click();
  await expect(dialog.getByTestId('lista-borrar-pregunta')).toHaveText(tl('lista.leave.ask'));
  await dialog.getByTestId('lista-borrar-no').click();
  await expect(dialog.getByTestId('lista-borrar-pregunta')).toHaveCount(0);
  await dialog.getByTestId('lista-borrar').click();
  await dialog.getByTestId('lista-borrar-si').click();
  await expect(dialog.getByTestId('lista-borrado')).toHaveText(tl('lista.left'));
  await expect(dialog.getByTestId('lista-nombre')).toHaveValue(nickname);
  expect(
    await page.evaluate(
      ([key, id]) => Object.keys(JSON.parse(window.localStorage.getItem(key)!).signups[id]),
      [GUEST_LIST_KEY, party.id] as const,
    ),
  ).toEqual([]);

  // Otra fiesta sigue con su compra de siempre.
  await page.goto(eventHref(ONLINE_EVENT.slug));
  const other = page.getByTestId('evento-ficha');
  await expect(other.getByTestId(`comprar-${ONLINE_EVENT.id}`)).toHaveText(CHECKOUT_COPY.buy);
  await expect(other.locator('[data-testid^="lista-"]')).toHaveCount(0);

  // En el panel de Tickets de la landing, lo mismo: la lista para Halloween, la compra para la otra.
  await page.goto('/?intro=0');
  const panel = await openTickets(page);
  await expect(panel.getByTestId(`lista-${party.id}`)).toHaveText(tl('lista.join'));
  await expect(panel.locator(`[data-evento="${party.id}"]`)).toContainText(listDoorPrice(party)!);
  await expect(panel.getByTestId(`comprar-${party.id}`)).toHaveCount(0);
  await expect(panel.getByTestId(`comprar-${ONLINE_EVENT.id}`)).toHaveText(CHECKOUT_COPY.buy);
});

test('/mar: «Apuntarse en la lista» en «Elige tu evento», con el apodo, y las demás compran', async ({
  page,
}) => {
  const nickname = 'Grumete Lista';
  await seedCarnet(page, nickname);
  const errors = await openMar(page);
  await page.getByTestId('mar-entradas').click();
  const panel = page.getByTestId('mar-entradas-panel');
  const join = panel.getByTestId(`mar-entradas-comprar-${party.id}`);
  await expect(join).toHaveText(t('lista.joinMar'));
  await expect(panel.getByTestId(`mar-entradas-lista-precio-${party.id}`)).toHaveText(
    listDoorPrice(party)!,
  );
  await expect(panel.getByTestId(`mar-entradas-lista-aviso-${party.id}`)).toHaveText(
    listNotice(closesAt, party.timeZone)!,
  );
  await expect(panel.getByTestId(`mar-entradas-comprar-${ONLINE_EVENT.id}`)).toHaveText(
    t('mar.sheet.comprarEntrada'),
  );

  await join.click();
  const dialog = page.getByTestId('lista');
  await expect(dialog.getByTestId('lista-nombre')).toHaveValue(nickname, { timeout: 20_000 });
  await dialog.getByTestId('lista-confirmar').click();
  await expect(dialog.getByTestId('lista-mia')).toContainText(nickname);
  await expect(page.getByTestId('checkout')).toHaveCount(0);
  expect((await stored(page)).listName).toBe(nickname);
  expect(errors).toEqual([]);
});
