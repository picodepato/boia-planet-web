import {
  type Discount,
  EVENT_STATE_BEHAVIOR,
  discountSchema,
  discountStatus,
  eventState,
} from '@boia/contracts';
import {
  SAMPLE_CARNET_DISCOUNT,
  SAMPLE_DISCOUNTS,
  SAMPLE_EVENTS,
  createLocalRepository,
} from '@boia/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CapturedEvent } from '../analytics';
import {
  applicableDiscount,
  bestDiscount,
  carnetDiscountFor,
  discountBannerFor,
  discountCents,
  quoteFor,
  samplePriceCents,
} from './pricing';
import { createSandboxTicketing } from './sandbox';

/**
 * El Carnet que vale la pena (T66, decisión del 2026-10-02): tener Carnet
 * BOIA da un -10 % (`muestra`) en la entrada, que no se suma a los códigos
 * del mundo: la compra aplica el mejor descuento de los dos y dice cuál. Sin
 * Carnet, la compra ofrece crearlo sólo si ahorraría más. Todo sale de la
 * muestra: ni precios ni porcentajes escritos a mano.
 */

const carnetDiscount = discountSchema.parse(SAMPLE_CARNET_DISCOUNT);
const codes = SAMPLE_DISCOUNTS.map((d) => discountSchema.parse(d)).filter(
  (d) => d.scope === 'event',
);
const onSale = SAMPLE_EVENTS.filter((e) => EVENT_STATE_BEHAVIOR[e.state].purchasable);
// «Ahora»: cuando todos los códigos de entradas de la muestra valen.
const NOW = new Date(
  Math.min(...codes.flatMap((d) => (d.endsAt ? [Date.parse(d.endsAt) - 24 * 3600 * 1000] : []))),
);
const owned = (d: Discount) => ({ discount: d, usedAt: null });
const WITH = { has: true, discount: carnetDiscount };
const WITHOUT = { has: false, discount: carnetDiscount };

/** Pares (código, evento) de la muestra en los que el código vale. */
const pairs = codes.flatMap((code) =>
  onSale
    .filter((e) => eventState(e, NOW) === 'on_sale')
    .filter((e) => applicableDiscount(e.id, [owned(code)], samplePriceCents(e), NOW))
    .map((event) => ({ code, event })),
);

/** Un descuento de entradas a medida, para los casos que la muestra no tiene. */
function code(id: string, kind: 'percent' | 'amount', value: number, priority = 0): Discount {
  return discountSchema.parse({ id, code: id.toUpperCase(), label: id, kind, value, priority });
}

describe('el mejor descuento entre el Carnet y los códigos del mundo, sin sumarse', () => {
  it('la muestra tiene el del Carnet vigente y códigos que valen', () => {
    expect(discountStatus(carnetDiscount, NOW)).toBe('active');
    expect(carnetDiscount.scope).toBe('event');
    expect(pairs.length).toBeGreaterThan(0);
  });

  it('con Carnet y sin códigos, se aplica el del Carnet', () => {
    const event = onSale[0]!;
    const price = samplePriceCents(event);
    const q = quoteFor(event, [], NOW, 1, WITH);
    expect(q.discount).toMatchObject({ id: carnetDiscount.id, kind: 'carnet' });
    expect(q.discount!.cents).toBe(discountCents(carnetDiscount, price));
    expect(q.totalCents).toBe(price - discountCents(carnetDiscount, price));
    expect(q.skipped).toBeUndefined();
    expect(q.carnetOffer).toBeUndefined();
  });

  it('en cada código de la muestra gana el que más ahorra y el total nunca suma los dos', () => {
    for (const { code: c, event } of pairs) {
      const price = samplePriceCents(event);
      const codeCents = discountCents(c, price);
      const carnetCents = discountCents(carnetDiscount, price);
      const q = quoteFor(event, [owned(c)], NOW, 1, WITH);
      const winner = carnetCents >= codeCents ? 'carnet' : 'code';
      expect(q.discount?.kind, `${c.id} en ${event.id}`).toBe(winner);
      expect(q.skipped?.kind).toBe(winner === 'carnet' ? 'code' : 'carnet');
      expect(q.totalCents).toBe(price - Math.max(codeCents, carnetCents));
      expect(q.totalCents).toBeGreaterThan(price - codeCents - carnetCents);
    }
  });

  it('un código mejor gana al Carnet; uno peor, no; a igual ahorro, el Carnet (el código queda)', () => {
    const event = onSale[0]!;
    const price = samplePriceCents(event);
    const carnetCents = discountCents(carnetDiscount, price);
    const better = code('mejor', 'amount', carnetCents + 1);
    const worse = code('peor', 'amount', carnetCents - 1);
    const same = code('igual', 'amount', carnetCents);
    expect(bestDiscount(event.id, [owned(better)], price, NOW, WITH).discount?.id).toBe('mejor');
    expect(bestDiscount(event.id, [owned(worse)], price, NOW, WITH).discount?.id).toBe(
      carnetDiscount.id,
    );
    const tie = bestDiscount(event.id, [owned(same)], price, NOW, WITH);
    expect(tie.discount?.kind).toBe('carnet');
    expect(tie.skipped?.id).toBe('igual');
  });

  it('la prioridad elige entre códigos; contra el Carnet cuenta lo que se ahorra', () => {
    const event = onSale[0]!;
    const price = samplePriceCents(event);
    const carnetCents = discountCents(carnetDiscount, price);
    // Un código prioritario que ahorra menos que el Carnet: gana el Carnet.
    const priority = code('prioritario', 'amount', Math.max(1, carnetCents - 1), 10);
    const plain = code('normal', 'amount', price);
    expect(applicableDiscount(event.id, [owned(priority), owned(plain)], price, NOW)?.id).toBe(
      'prioritario',
    );
    expect(
      bestDiscount(event.id, [owned(priority), owned(plain)], price, NOW, WITH).discount?.id,
    ).toBe(carnetDiscount.id);
  });

  it('el código de mayor prioridad de la muestra (el de la Fiestera) sigue ganando al Carnet', () => {
    const top = [...codes].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0]!;
    for (const event of onSale.filter((e) => eventState(e, NOW) === 'on_sale')) {
      const price = samplePriceCents(event);
      if (!applicableDiscount(event.id, [owned(top)], price, NOW)) continue;
      if (discountCents(top, price) <= discountCents(carnetDiscount, price)) continue;
      const others = codes.filter((c) => c.id !== top.id).map(owned);
      const q = quoteFor(event, [owned(top), ...others], NOW, 1, WITH);
      expect(q.discount?.id).toBe(top.id);
      expect(q.skipped?.kind).toBe('carnet');
    }
  });

  it('sin Carnet: el código y, si el Carnet ahorraría más, la oferta de crearlo', () => {
    const event = onSale[0]!;
    const price = samplePriceCents(event);
    const carnetCents = discountCents(carnetDiscount, price);
    const none = quoteFor(event, [], NOW, 1, WITHOUT);
    expect(none.discount).toBeNull();
    expect(none.carnetOffer).toMatchObject({ kind: 'carnet', cents: carnetCents });
    expect(none.carnetOffer?.percent).toBe(carnetDiscount.value);
    const worse = quoteFor(
      event,
      [owned(code('peor', 'amount', carnetCents - 1))],
      NOW,
      1,
      WITHOUT,
    );
    expect(worse.discount?.id).toBe('peor');
    expect(worse.carnetOffer?.cents).toBe(carnetCents);
    const same = quoteFor(event, [owned(code('igual', 'amount', carnetCents))], NOW, 1, WITHOUT);
    expect(same.carnetOffer).toBeUndefined();
    const better = quoteFor(event, [owned(code('mejor', 'amount', price))], NOW, 1, WITHOUT);
    expect(better.carnetOffer).toBeUndefined();
  });

  it('sin descuento de Carnet (o caducado) todo sigue como antes', () => {
    const event = onSale[0]!;
    const price = samplePriceCents(event);
    expect(quoteFor(event, [], NOW, 1, { has: true, discount: null }).discount).toBeNull();
    const old = { ...carnetDiscount, endsAt: new Date(NOW.getTime() - 1000).toISOString() };
    expect(carnetDiscountFor(old, price, NOW)).toBeNull();
  });

  it('el aviso de la isla y del panel dice el descuento que se aplicará', () => {
    const { code: c, event } = pairs[0]!;
    const price = samplePriceCents(event);
    const info = discountBannerFor(event, [owned(c)], NOW, WITH)!;
    const winner =
      discountCents(carnetDiscount, price) >= discountCents(c, price) ? 'carnet' : 'code';
    expect(info.kind).toBe(winner);
    expect(discountBannerFor(event, [], NOW, WITH)?.kind).toBe('carnet');
    expect(discountBannerFor(event, [], NOW, WITHOUT)).toBeNull();
  });
});

describe('la compra de prueba con Carnet', () => {
  type FakeWindow = { location: { pathname: string }; __boiaAnalytics?: CapturedEvent[] };
  afterEach(() => vi.unstubAllGlobals());

  function setup() {
    const repo = createLocalRepository({ storage: null, now: () => NOW });
    let n = 0;
    const tickets = createSandboxTicketing(repo, {
      now: () => NOW,
      newPurchaseId: (id) => `t66-${id}-${++n}`,
    });
    return { repo, tickets };
  }

  it('sin Carnet ofrece crearlo; con Carnet aplica el suyo y la analítica dice cuál', async () => {
    const win: FakeWindow = { location: { pathname: '/' } };
    vi.stubGlobal('window', win);
    const { repo, tickets } = setup();
    const event = onSale.find((e) => eventState(e, NOW) === 'on_sale')!;
    const before = await tickets.start(event.id);
    if (!before.ok) throw new Error(before.reason);
    expect(before.session.quote.discount).toBeNull();
    expect(before.session.quote.carnetOffer?.kind).toBe('carnet');

    await repo.carnet.create({ nickname: 'Grumete T66' });
    const after = await tickets.start(event.id);
    if (!after.ok) throw new Error(after.reason);
    expect(after.session.quote.discount).toMatchObject({ id: carnetDiscount.id, kind: 'carnet' });
    expect(after.session.quote.carnetOffer).toBeUndefined();
    await tickets.confirm!(after.session);
    const [purchase] = await repo.purchases.list();
    // El del Carnet no es un código: no se gasta ni se guarda como tal.
    expect(purchase).toMatchObject({
      discountId: null,
      amountCents: after.session.quote.totalCents,
    });
    const confirmed = win.__boiaAnalytics?.find((e) => e.event === 'purchase_confirmed');
    expect(confirmed?.properties).toMatchObject({
      discountId: carnetDiscount.id,
      discountKind: 'carnet',
    });
  });

  it('cuando gana el Carnet, el código encontrado queda sin usar para otra compra', async () => {
    vi.stubGlobal('window', { location: { pathname: '/' } } satisfies FakeWindow);
    const pair = pairs.find(
      ({ code: c, event }) =>
        discountCents(carnetDiscount, samplePriceCents(event)) >=
        discountCents(c, samplePriceCents(event)),
    );
    if (!pair) return; // la muestra no tiene ninguno peor que el Carnet
    const { repo, tickets } = setup();
    await repo.carnet.create({ nickname: 'Grumete T66' });
    await repo.progress.findDiscount(pair.code.id);
    const r = await tickets.start(pair.event.id);
    if (!r.ok) throw new Error(r.reason);
    expect(r.session.quote.discount?.kind).toBe('carnet');
    expect(r.session.quote.skipped?.id).toBe(pair.code.id);
    await tickets.confirm!(r.session);
    const found = (await repo.progress.discounts()).find((f) => f.discount.id === pair.code.id);
    expect(found?.usedAt ?? null).toBeNull();
  });

  it('cuando gana un código, se gasta y la analítica lo dice', async () => {
    const win: FakeWindow = { location: { pathname: '/' } };
    vi.stubGlobal('window', win);
    const pair = pairs.find(
      ({ code: c, event }) =>
        discountCents(c, samplePriceCents(event)) >
        discountCents(carnetDiscount, samplePriceCents(event)),
    )!;
    expect(pair, 'la muestra tiene un código mejor que el Carnet').toBeDefined();
    const { repo, tickets } = setup();
    await repo.carnet.create({ nickname: 'Grumete T66' });
    await repo.progress.findDiscount(pair.code.id);
    const r = await tickets.start(pair.event.id);
    if (!r.ok) throw new Error(r.reason);
    expect(r.session.quote.discount).toMatchObject({ id: pair.code.id, kind: 'code' });
    await tickets.confirm!(r.session);
    const [purchase] = await repo.purchases.list();
    expect(purchase?.discountId).toBe(pair.code.id);
    const confirmed = win.__boiaAnalytics?.find((e) => e.event === 'purchase_confirmed');
    expect(confirmed?.properties).toMatchObject({ discountId: pair.code.id, discountKind: 'code' });
  });
});
