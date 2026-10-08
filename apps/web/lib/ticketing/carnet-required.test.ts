import { type Discount, discountSchema, eventState } from '@boia/contracts';
import { SAMPLE_DISCOUNTS, SAMPLE_EVENTS, createLocalRepository } from '@boia/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CapturedEvent } from '../analytics';
import { applicableDiscount, discountBannerFor, quoteFor, samplePriceCents } from './pricing';
import { CarnetRequiredError, createSandboxTicketing } from './sandbox';

/**
 * El Carnet BOIA es el requisito para comprar (plan 019 T215, decisión 1):
 * sin él, la compra de prueba no se prepara (`carnet_required`) ni se
 * confirma; con él, sigue. El Carnet ya no descuenta: el único descuento es
 * el código encontrado en el mundo. Todo sale de la muestra.
 */

const codes = SAMPLE_DISCOUNTS.map((d) => discountSchema.parse(d)).filter(
  (d) => d.scope === 'event',
);
// «Ahora»: cuando todos los códigos de entradas de la muestra valen.
const NOW = new Date(
  Math.min(...codes.flatMap((d) => (d.endsAt ? [Date.parse(d.endsAt) - 24 * 3600 * 1000] : []))),
);
const onSale = SAMPLE_EVENTS.filter((e) => eventState(e, NOW) === 'on_sale');
const online = onSale.filter((e) => !e.boxOfficeOnly);
const doorOnly = SAMPLE_EVENTS.filter((e) => e.boxOfficeOnly);
const owned = (d: Discount) => ({ discount: d, usedAt: null });

/** Pares (código, evento) de la muestra en los que el código vale. */
const pairs = codes.flatMap((code) =>
  online
    .filter((e) => applicableDiscount(e.id, [owned(code)], samplePriceCents(e), NOW))
    .map((event) => ({ code, event })),
);

type FakeWindow = { location: { pathname: string }; __boiaAnalytics?: CapturedEvent[] };

function setup(now = NOW) {
  const repo = createLocalRepository({ storage: null, now: () => now });
  let n = 0;
  const tickets = createSandboxTicketing(repo, {
    now: () => now,
    newPurchaseId: (id) => `t215-${id}-${++n}`,
  });
  return { repo, tickets };
}

describe('sin descuento por tener Carnet', () => {
  it('sin código, el precio es el del evento; con código, sólo el código', () => {
    const { code, event } = pairs[0]!;
    const price = samplePriceCents(event);
    const plain = quoteFor(event, [], NOW);
    expect(plain.discount).toBeNull();
    expect(plain.totalCents).toBe(price);
    const q = quoteFor(event, [owned(code)], NOW);
    expect(q.discount).toMatchObject({ id: code.id, kind: 'code' });
    expect(q).not.toHaveProperty('carnetOffer');
    expect(q).not.toHaveProperty('skipped');
  });

  it('el aviso de descuento sale sólo con un código encontrado', () => {
    const { code, event } = pairs[0]!;
    expect(discountBannerFor(event, [], NOW)).toBeNull();
    expect(discountBannerFor(event, [owned(code)], NOW)).toMatchObject({
      kind: 'code',
      code: code.code,
    });
  });
});

describe('comprar pide el Carnet BOIA', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sin Carnet no se prepara la compra; al crearlo, sí, y se confirma', async () => {
    const win: FakeWindow = { location: { pathname: '/' } };
    vi.stubGlobal('window', win);
    const { repo, tickets } = setup();
    const event = online[0]!;
    const before = await tickets.start(event.id);
    expect(before).toMatchObject({ ok: false, reason: 'carnet_required' });
    expect(before.ok ? null : before.event?.id).toBe(event.id);

    await repo.carnet.create({ nickname: 'Grumete T215' });
    const after = await tickets.start(event.id);
    if (!after.ok) throw new Error(after.reason);
    expect(after.session.quote.totalCents).toBe(samplePriceCents(event));
    const outcome = await tickets.confirm!(after.session);
    expect(outcome.firstConfirmation).toBe(true);
    expect(await repo.purchases.list()).toHaveLength(1);
  });

  it('confirmar sin Carnet se niega (aunque la sesión ya estuviera preparada)', async () => {
    vi.stubGlobal('window', { location: { pathname: '/' } } satisfies FakeWindow);
    const { repo, tickets } = setup();
    await repo.carnet.create({ nickname: 'Grumete T215' });
    const r = await tickets.start(online[0]!.id);
    if (!r.ok) throw new Error(r.reason);
    const other = setup();
    await expect(other.tickets.confirm!(r.session)).rejects.toBeInstanceOf(CarnetRequiredError);
    expect(await other.repo.purchases.list()).toEqual([]);
  });

  it('con Carnet y un código, se gasta el código y la analítica lo dice', async () => {
    const win: FakeWindow = { location: { pathname: '/' } };
    vi.stubGlobal('window', win);
    const { code, event } = pairs[0]!;
    const { repo, tickets } = setup();
    await repo.carnet.create({ nickname: 'Grumete T215' });
    await repo.progress.findDiscount(code.id);
    const r = await tickets.start(event.id);
    if (!r.ok) throw new Error(r.reason);
    expect(r.session.quote.discount).toMatchObject({ id: code.id, kind: 'code' });
    await tickets.confirm!(r.session);
    const [purchase] = await repo.purchases.list();
    expect(purchase?.discountId).toBe(code.id);
    const confirmed = win.__boiaAnalytics?.find((e) => e.event === 'purchase_confirmed');
    expect(confirmed?.properties).toMatchObject({ discountId: code.id, discountKind: 'code' });
  });

  it('un evento «Solo en puerta» no se vende aquí, ni con Carnet', async () => {
    expect(doorOnly.length).toBeGreaterThan(0);
    for (const e of doorOnly) {
      // La víspera: a la venta por fechas, pero sólo en la puerta.
      const eve = new Date(Date.parse(e.startsAt) - 24 * 3600 * 1000);
      expect(eventState(e, eve)).toBe('on_sale');
      const { repo, tickets } = setup(eve);
      await repo.carnet.create({ nickname: 'Grumete T215' });
      expect(await tickets.start(e.id)).toMatchObject({ ok: false, reason: 'not_on_sale' });
    }
  });
});
