import { EVENT_STATE_BEHAVIOR, discountSchema, eventState } from '@boia/contracts';
import {
  type CarnetMember,
  MemoryStorage,
  SAMPLE_CARNET_DISCOUNT,
  SAMPLE_DISCOUNTS,
  SAMPLE_EVENTS,
  STORE_KEY,
  createLocalRepository,
} from '@boia/store';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { pickMember, seededRandom } from '../lib/mundo/discover';
import { t } from '../lib/i18n';
import { CHECKOUT_COPY } from '../lib/ticketing/copy';
import {
  applicableDiscount,
  discountCents,
  formatEuros,
  samplePriceCents,
} from '../lib/ticketing/pricing';

/**
 * Un Carnet que vale la pena (T66, decisión del 2026-10-02):
 * - Sin Carnet, comprar enseña antes «¿Tienes Carnet BOIA? Créalo en 30 s y
 *   ahorra un 10 %»; «Crear Carnet» lo crea y vuelve a la compra con el 10 %
 *   aplicado (en la landing, aquí mismo; en /mar, con Mi Carnet del mundo).
 * - No se suma a los códigos: con un código mejor, se aplica el código y la
 *   compra lo dice.
 * - El ranking enseña el apodo propio y «Descubrir a un BOIERO» abre un
 *   Carnet al azar (miembros y artistas), con una semilla fija.
 * Todo sale de la muestra: precios, porcentaje y códigos.
 */

test.describe.configure({ timeout: 120_000 });

const carnetDiscount = discountSchema.parse(SAMPLE_CARNET_DISCOUNT);
const codes = SAMPLE_DISCOUNTS.map((d) => discountSchema.parse(d)).filter(
  (d) => d.scope === 'event',
);
const now = new Date();
const onSale = SAMPLE_EVENTS.filter(
  (e) => EVENT_STATE_BEHAVIOR[eventState(e, now)].purchasable && e.state !== 'draft',
);
const carnetCents = (e: (typeof SAMPLE_EVENTS)[number]) =>
  discountCents(carnetDiscount, samplePriceCents(e));
/** Un evento a la venta y un código suyo que ahorra más que el Carnet. */
const better = onSale.flatMap((event) =>
  codes
    .filter((c) => c.eventId === event.id)
    .filter((c) => applicableDiscount(event.id, [{ discount: c }], samplePriceCents(event), now))
    .filter((c) => discountCents(c, samplePriceCents(event)) > carnetCents(event))
    .map((code) => ({ event, code })),
)[0];
/** Un evento a la venta en el que el Carnet ahorra (sin código). */
const plain = onSale.find((e) => carnetCents(e) > 0)!;

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
  await page.locator('.hero').getByRole('link', { name: 'Tickets', exact: true }).click();
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

async function expectCarnetApplied(checkout: Locator, event: (typeof SAMPLE_EVENTS)[number]) {
  const line = checkout.getByTestId('checkout-descuento');
  await expect(line).toHaveAttribute('data-kind', 'carnet', { timeout: 20_000 });
  await expect(line).toHaveAttribute('data-discount-id', carnetDiscount.id);
  await expect(line).toContainText(CHECKOUT_COPY.carnet.line);
  const price = samplePriceCents(event);
  await expect(checkout.getByTestId('checkout-total')).toHaveText(
    formatEuros(price - carnetCents(event)),
  );
  await expect(checkout.getByTestId('checkout-oferta-carnet')).toHaveCount(0);
}

async function expectOffer(checkout: Locator, event: (typeof SAMPLE_EVENTS)[number]) {
  const offer = checkout.getByTestId('checkout-oferta-carnet');
  await expect(offer).toBeVisible({ timeout: 20_000 });
  await expect(offer).toContainText(CHECKOUT_COPY.carnet.offerTitle);
  await expect(offer).toContainText(CHECKOUT_COPY.carnet.offerPercent(carnetDiscount.value));
  await expect(offer).toHaveAttribute('data-ahorro', String(carnetCents(event)));
  // Antes de elegir, no se compra todavía.
  await expect(checkout.getByTestId('checkout-confirmar')).toHaveCount(0);
  await expect(checkout.getByTestId('checkout-crear-carnet')).toHaveText(
    CHECKOUT_COPY.carnet.create,
  );
  await expect(checkout.getByTestId('checkout-sin-carnet')).toHaveText(CHECKOUT_COPY.carnet.skip);
}

test('landing: sin Carnet la compra lo ofrece; «Crear Carnet» vuelve con el 10 % aplicado', async ({
  page,
}, info) => {
  expect(plain, 'hay un evento a la venta en el que el Carnet ahorra').toBeDefined();
  const panel = await openLandingTickets(page);
  await panel.getByRole('button', { name: CHECKOUT_COPY.buyAria(plain.name) }).click();
  const checkout = page.getByTestId('checkout');
  await expectOffer(checkout, plain);

  // «Seguir sin Carnet»: la compra de siempre, sin descuento.
  await checkout.getByTestId('checkout-sin-carnet').click();
  await expect(checkout.getByTestId('checkout-confirmar')).toBeVisible();
  await expect(checkout.getByTestId('checkout-sin-descuento')).toBeVisible();
  await checkout.getByTestId('checkout-cerrar').click();
  await expect(checkout).toBeHidden();

  // Otra vez: «Crear Carnet» lo crea aquí mismo y la compra sigue con el descuento.
  await panel.getByRole('button', { name: CHECKOUT_COPY.buyAria(plain.name) }).click();
  await expectOffer(checkout, plain);
  await checkout.getByTestId('checkout-crear-carnet').click();
  await checkout.getByTestId('checkout-carnet-apodo').fill(`Ahorradora ${info.project.name}`);
  await checkout.getByTestId('checkout-carnet-guardar').click();
  await expectCarnetApplied(checkout, plain);
  await expect(checkout.getByTestId('banner-descuento')).toHaveAttribute('data-kind', 'carnet');
  await checkout.getByTestId('checkout-confirmar').click();
  await expect(checkout.getByTestId('checkout-resultado')).toBeVisible();
  expect(await analytics(page)).toContainEqual(
    expect.objectContaining({
      event: 'purchase_confirmed',
      eventId: plain.id,
      discountId: carnetDiscount.id,
      discountKind: 'carnet',
    }),
  );
  expect(new URL(page.url()).pathname).toBe('/');
});

test('landing: con Carnet y un código mejor, se aplica el código y lo dice', async ({ page }) => {
  expect(better, 'la muestra tiene un código que ahorra más que el Carnet').toBeDefined();
  await seed(page, async (repo) => {
    await repo.carnet.create({ nickname: 'Grumete Códigos' });
    await repo.progress.findDiscount(better!.code.id);
  });
  const panel = await openLandingTickets(page);
  await panel.getByRole('button', { name: CHECKOUT_COPY.buyAria(better!.event.name) }).click();
  const checkout = page.getByTestId('checkout');
  const line = checkout.getByTestId('checkout-descuento');
  await expect(line).toHaveAttribute('data-kind', 'code', { timeout: 20_000 });
  await expect(line).toHaveAttribute('data-discount-id', better!.code.id);
  await expect(checkout.getByTestId('checkout-no-se-suman')).toHaveText(
    CHECKOUT_COPY.carnet.skippedCarnet(better!.code.code),
  );
  const price = samplePriceCents(better!.event);
  await expect(checkout.getByTestId('checkout-total')).toHaveText(
    formatEuros(price - discountCents(better!.code, price)),
  );
  await expect(checkout.getByTestId('checkout-oferta-carnet')).toHaveCount(0);
  await checkout.getByTestId('checkout-confirmar').click();
  await expect(checkout.getByTestId('checkout-resultado')).toBeVisible();
  expect(await analytics(page)).toContainEqual(
    expect.objectContaining({
      event: 'purchase_confirmed',
      discountId: better!.code.id,
      discountKind: 'code',
    }),
  );
});

test('/mar: sin Carnet la compra lo ofrece; «Crear Carnet» usa Mi Carnet del mundo y vuelve con el 10 %', async ({
  page,
}, info) => {
  const errors = await openMar(page);
  await page.getByTestId('mar-entradas').click();
  const panel = page.getByTestId('mar-entradas-panel');
  await panel.getByTestId(`mar-entradas-comprar-${plain.id}`).click();
  const checkout = page.getByTestId('checkout');
  await expectOffer(checkout, plain);

  // «Crear Carnet»: Mi Carnet dentro del mar, ya en el alta.
  await checkout.getByTestId('checkout-crear-carnet').click();
  await expect(checkout).toHaveCount(0);
  const carnet = page.getByTestId('mar-carnet');
  await expect(carnet).toBeVisible();
  await carnet.getByTestId('carnet-apodo-input').fill(`Marinera ${info.project.name}`);
  await carnet.getByTestId('carnet-guardar').click();

  // Vuelve a la compra del mismo evento, con el descuento del Carnet.
  await expect(carnet).toHaveCount(0);
  await expect(checkout.getByTestId('checkout-evento')).toHaveText(plain.name, {
    timeout: 20_000,
  });
  await expectCarnetApplied(checkout, plain);
  await checkout.getByTestId('checkout-confirmar').click();
  await expect(checkout.getByTestId('checkout-resultado')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/mar');
  expect(await analytics(page)).toContainEqual(
    expect.objectContaining({
      event: 'purchase_confirmed',
      eventId: plain.id,
      discountKind: 'carnet',
      source: 'world',
    }),
  );
  expect(errors).toEqual([]);
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
