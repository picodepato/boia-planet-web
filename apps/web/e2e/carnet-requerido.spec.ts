import { EVENT_STATE_BEHAVIOR, discountSchema, eventState } from '@boia/contracts';
import {
  type CarnetMember,
  HALLOWEEN_EVENT_ID,
  MemoryStorage,
  SAMPLE_DISCOUNTS,
  SAMPLE_EVENTS,
  STORE_KEY,
  createLocalRepository,
} from '@boia/store';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { pickMember, seededRandom } from '../lib/mundo/discover';
import { t } from '../lib/i18n';
import { CARNET_CREATE_HREF } from '../lib/landing/access';
import { CHECKOUT_COPY } from '../lib/ticketing/copy';
import { boxOfficeLabel } from '../lib/ticketing/box-office-label';
import {
  applicableDiscount,
  discountCents,
  formatEuros,
  samplePriceCents,
} from '../lib/ticketing/pricing';
import { openTickets } from './hero-helpers';

/**
 * El Carnet BOIA es el requisito para comprar (plan 019 T215, decisión 1):
 * - Sin Carnet, «Comprar» dice que hace falta y lleva a crearlo (en la
 *   landing, aquí mismo; en /mar, con Mi Carnet del mundo) y la compra sigue.
 * - Con Carnet, se compra; el único descuento es el código del mundo.
 * - Halloween es «Solo en puerta · 5 € con carnet»: sin checkout (decisión 6).
 * - El ranking enseña el apodo propio y «Descubrir a un BOIERO» abre un
 *   Carnet al azar (miembros y artistas), con una semilla fija.
 * Todo sale de la muestra: precios y códigos.
 */

test.describe.configure({ timeout: 120_000 });

const codes = SAMPLE_DISCOUNTS.map((d) => discountSchema.parse(d)).filter(
  (d) => d.scope === 'event',
);
const now = new Date();
const onSale = SAMPLE_EVENTS.filter(
  (e) =>
    EVENT_STATE_BEHAVIOR[eventState(e, now)].purchasable && e.state !== 'draft' && !e.boxOfficeOnly,
);
/** Un evento a la venta online. */
const plain = onSale[0]!;
/** Un evento a la venta y un código suyo que vale ahora. */
const withCode = onSale.flatMap((event) =>
  codes
    .filter((c) => applicableDiscount(event.id, [{ discount: c }], samplePriceCents(event), now))
    .map((code) => ({ event, code })),
)[0];
const halloween = SAMPLE_EVENTS.find((e) => e.id === HALLOWEEN_EVENT_ID)!;

type Captured = { event: string } & Record<string, unknown>;
const analytics = (page: Page): Promise<Captured[]> =>
  page.evaluate(() =>
    (window.__boiaAnalytics ?? []).map((e) => ({ event: e.event, ...e.properties })),
  );

/** Deja en este navegador un repositorio preparado (Carnet, códigos) antes de cargar. */
async function seed(
  page: Page,
  prepare: (repo: ReturnType<typeof createLocalRepository>) => Promise<unknown>,
) {
  const storage = new MemoryStorage();
  const repo = createLocalRepository({ storage, watch: false });
  await prepare(repo);
  const json = storage.getItem(STORE_KEY)!;
  await page.addInitScript(
    ([key, doc]) => {
      try {
        if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, doc);
      } catch {
        // sin almacenamiento: la prueba fallará más abajo, con su motivo
      }
    },
    [STORE_KEY, json] as const,
  );
}

async function openLandingTickets(page: Page) {
  await page.goto('/?intro=0');
  await openTickets(page);
  const panel = page.getByRole('dialog', { name: 'Elige tu evento' });
  await expect(panel).toBeVisible();
  return panel;
}

async function openMar(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/mar');
  await expect(page.getByTestId('mar-canvas')).toBeVisible();
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 30_000 });
  return errors;
}

async function expectRequired(checkout: Locator) {
  const notice = checkout.getByTestId('checkout-carnet-requerido');
  await expect(notice).toBeVisible({ timeout: 20_000 });
  await expect(notice).toContainText(CHECKOUT_COPY.carnet.requiredTitle);
  // Sin Carnet no se compra: ni botón de confirmar ni «seguir sin Carnet».
  await expect(checkout.getByTestId('checkout-confirmar')).toHaveCount(0);
  await expect(checkout.getByTestId('checkout-sin-carnet')).toHaveCount(0);
  await expect(checkout.getByTestId('checkout-crear-carnet')).toHaveText(
    CHECKOUT_COPY.carnet.create,
  );
}

async function expectFullPrice(checkout: Locator, event: (typeof SAMPLE_EVENTS)[number]) {
  await expect(checkout.getByTestId('checkout-total')).toHaveText(
    formatEuros(samplePriceCents(event)),
    { timeout: 20_000 },
  );
  await expect(checkout.getByTestId('checkout-descuento')).toHaveCount(0);
}

test('landing: sin Carnet «Comprar» lleva a crearlo y la compra sigue, sin descuento por el Carnet', async ({
  page,
}, info) => {
  expect(plain, 'hay un evento a la venta online').toBeDefined();
  const panel = await openLandingTickets(page);
  await panel.getByRole('button', { name: CHECKOUT_COPY.buyAria(plain.name) }).click();
  const checkout = page.getByTestId('checkout');
  await expectRequired(checkout);

  // «Crear Carnet» lo crea aquí mismo y la compra sigue, al precio entero.
  await checkout.getByTestId('checkout-crear-carnet').click();
  await checkout.getByTestId('checkout-carnet-apodo').fill(`Compradora ${info.project.name}`);
  await checkout.getByTestId('checkout-carnet-guardar').click();
  await expectFullPrice(checkout, plain);
  await expect(checkout.getByTestId('checkout-carnet-requerido')).toHaveCount(0);
  await checkout.getByTestId('checkout-confirmar').click();
  await expect(checkout.getByTestId('checkout-resultado')).toBeVisible();
  const confirmed = (await analytics(page)).find((e) => e.event === 'purchase_confirmed');
  expect(confirmed).toMatchObject({ eventId: plain.id });
  expect(confirmed).not.toHaveProperty('discountId');
  expect(new URL(page.url()).pathname).toBe('/');
});

test('landing: con Carnet se compra directamente; con un código, se aplica el código', async ({
  page,
}) => {
  expect(withCode, 'la muestra tiene un código que vale ahora').toBeDefined();
  await seed(page, async (repo) => {
    await repo.carnet.create({ nickname: 'Grumete Códigos' });
    await repo.progress.findDiscount(withCode!.code.id);
  });
  const panel = await openLandingTickets(page);
  await panel.getByRole('button', { name: CHECKOUT_COPY.buyAria(withCode!.event.name) }).click();
  const checkout = page.getByTestId('checkout');
  const line = checkout.getByTestId('checkout-descuento');
  await expect(line).toHaveAttribute('data-kind', 'code', { timeout: 20_000 });
  await expect(line).toHaveAttribute('data-discount-id', withCode!.code.id);
  await expect(checkout.getByTestId('checkout-carnet-requerido')).toHaveCount(0);
  const price = samplePriceCents(withCode!.event);
  await expect(checkout.getByTestId('checkout-total')).toHaveText(
    formatEuros(price - discountCents(withCode!.code, price)),
  );
  await checkout.getByTestId('checkout-confirmar').click();
  await expect(checkout.getByTestId('checkout-resultado')).toBeVisible();
  expect(await analytics(page)).toContainEqual(
    expect.objectContaining({
      event: 'purchase_confirmed',
      discountId: withCode!.code.id,
      discountKind: 'code',
    }),
  );
});

test('/mar: sin Carnet la compra lo pide; «Crear Carnet» usa Mi Carnet del mundo y vuelve a la compra', async ({
  page,
}, info) => {
  const errors = await openMar(page);
  await page.getByTestId('mar-entradas').click();
  const panel = page.getByTestId('mar-entradas-panel');
  await panel.getByTestId(`mar-entradas-comprar-${plain.id}`).click();
  const checkout = page.getByTestId('checkout');
  await expectRequired(checkout);

  // «Crear Carnet»: Mi Carnet dentro del mar, ya en el alta.
  await checkout.getByTestId('checkout-crear-carnet').click();
  await expect(checkout).toHaveCount(0);
  const carnet = page.getByTestId('mar-carnet');
  await expect(carnet).toBeVisible();
  await carnet.getByTestId('carnet-apodo-input').fill(`Marinera ${info.project.name}`);
  await carnet.getByTestId('carnet-guardar').click();

  // Vuelve a la compra del mismo evento, ya con Carnet.
  await expect(carnet).toHaveCount(0);
  await expect(checkout.getByTestId('checkout-evento')).toHaveText(plain.name, {
    timeout: 20_000,
  });
  await expectFullPrice(checkout, plain);
  await checkout.getByTestId('checkout-confirmar').click();
  await expect(checkout.getByTestId('checkout-resultado')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/mar');
  expect(await analytics(page)).toContainEqual(
    expect.objectContaining({ event: 'purchase_confirmed', eventId: plain.id, source: 'world' }),
  );
  expect(errors).toEqual([]);
});

test('Halloween: «Solo en puerta · 5 € con carnet», sin checkout, y lleva a crear el Carnet', async ({
  page,
}) => {
  test.skip(
    !EVENT_STATE_BEHAVIOR[eventState(halloween, now)].purchasable,
    'Halloween ya pasó: no hay nada que comprar',
  );
  await page.goto(`/eventos/${halloween.slug}`);
  const ficha = page.getByTestId('evento-ficha');
  const door = ficha.getByTestId('evento-solo-puerta');
  await expect(door).toBeVisible();
  await expect(door.getByTestId('box-office-label')).toHaveText(boxOfficeLabel(halloween));
  await expect(door.getByTestId('box-office-label')).toHaveText('Solo en puerta · 5 € con carnet');
  await expect(ficha.getByTestId(`comprar-${halloween.id}`)).toHaveCount(0);
  await expect(ficha.getByTestId('evento-descuento')).toHaveCount(0);
  await expect(page.getByTestId('checkout')).toHaveCount(0);
  await expect(door.getByTestId('box-office-carnet')).toHaveAttribute('href', CARNET_CREATE_HREF);

  // En el panel de Tickets de la landing, «Comprar» abre el aviso, no el checkout.
  const panel = await openLandingTickets(page);
  await panel.getByTestId(`comprar-${halloween.id}`).click();
  const dialog = page.getByTestId('box-office');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('box-office-label')).toHaveText(boxOfficeLabel(halloween));
  await expect(page.getByTestId('checkout')).toHaveCount(0);
});

test('/mar: el ranking enseña el apodo propio y «Descubrir a un BOIERO» abre Carnets al azar', async ({
  page,
}) => {
  const nickname = 'Grumete Ranking';
  // Los Carnets que se pueden descubrir, del mismo repositorio que usa la web.
  const members: CarnetMember[] = await createLocalRepository({ storage: null }).carnet.members();
  // Una semilla cuyas dos primeras salidas son un miembro y un artista.
  const series = (seed: number) => {
    const rand = seededRandom(seed);
    const first = pickMember(members, rand)!;
    const second = pickMember(members, rand, first.userId)!;
    return [first, second] as const;
  };
  const seedValue = Array.from({ length: 500 }, (_, i) => i + 1).find((s) => {
    const kinds = new Set(series(s).map((m) => m.kind));
    return kinds.has('member') && kinds.has('artist');
  })!;
  expect(seedValue, 'hay una semilla con un miembro y un artista').toBeDefined();
  const [first, second] = series(seedValue);

  await seed(page, (repo) => repo.carnet.create({ nickname }));
  await page.addInitScript((s) => {
    window.__boiaDiscoverSeed = s;
  }, seedValue);
  const errors = await openMar(page);
  // El menú del juego, con el botón de la izquierda (T65).
  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-menu').getByTestId('mar-ranking-abrir').click();
  const ranking = page.getByTestId('mar-ranking').getByTestId('ranking');

  // La fila propia lleva el apodo del Carnet.
  await expect(ranking.getByTestId('ranking-fila-mia')).toContainText(nickname);

  // «Descubrir a un BOIERO»: el Carnet que dice la semilla; otro toque, el siguiente.
  const discover = ranking.getByTestId('ranking-descubrir');
  await expect(discover).toHaveText(t('lib.ranking.descubrir'));
  await discover.click();
  const shown = ranking.getByTestId('ranking-descubierto');
  await expect(shown).toHaveAttribute('data-user-id', first.userId);
  await expect(shown).toHaveAttribute('data-kind', first.kind);
  await expect(shown.getByTestId('carnet-apodo')).toHaveText(first.nickname);
  await expect(discover).toHaveText(t('lib.ranking.descubrirOtro'));
  await discover.click();
  await expect(shown).toHaveAttribute('data-user-id', second.userId);
  await expect(shown).toHaveAttribute('data-kind', second.kind);
  await expect(shown.getByTestId('carnet-apodo')).toHaveText(second.nickname);
  // El de un artista dice sus géneros.
  const artist = [first, second].find((m) => m.kind === 'artist')!;
  if (second.userId === artist.userId)
    await expect(shown.getByTestId('carnet-generos')).toBeVisible();
  expect(errors).toEqual([]);
});
