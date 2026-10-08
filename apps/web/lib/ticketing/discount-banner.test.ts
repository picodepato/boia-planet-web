import {
  type Discount,
  EVENT_STATE_BEHAVIOR,
  discountSchema,
  discountStatus,
  foundDiscountState,
} from '@boia/contracts';
import { SAMPLE_DISCOUNTS, SAMPLE_EVENTS, createLocalRepository } from '@boia/store';
import { describe, expect, it } from 'vitest';
import { applicableDiscount, discountBannerFor, discountCents, samplePriceCents } from './pricing';
import { createSandboxTicketing } from './sandbox';

/**
 * «Tienes un código de descuento para este evento» (T43, D-23, REQ-COM-036):
 * el aviso sólo sale con un código válido de ese evento en tu poder; uno
 * caducado se ve como caducado y no se aplica; uno usado ya no vuelve a
 * valer; uno de tienda nunca descuenta una entrada. Todo sale de la muestra,
 * sin fechas ni cantidades escritas a mano.
 */

const DAY = 24 * 3600 * 1000;
const discounts = SAMPLE_DISCOUNTS.map((d) => discountSchema.parse(d));
const onSale = SAMPLE_EVENTS.filter((e) => EVENT_STATE_BEHAVIOR[e.state].purchasable);
/** Un código de entradas de un evento a la venta, con fecha de caducidad. */
const code = discounts.find(
  (d) => d.scope === 'event' && d.endsAt && onSale.some((e) => e.id === d.eventId),
)!;
const event = onSale.find((e) => e.id === code.eventId)!;
const other = onSale.find((e) => e.id !== event.id)!;
/**
 * Un código de tienda (O8). Desde T59 la muestra ya no esconde uno en el
 * mundo; el Admin puede crearlo, y así se crea aquí.
 */
const shop: Discount = discountSchema.parse({
  id: 'dto-tienda-prueba',
  code: 'TIENDAPRUEBA',
  label: 'Código de la tienda',
  scope: 'store',
  kind: 'percent',
  value: 15,
  endsAt: code.endsAt,
  sample: true,
});
const VALID = new Date(Date.parse(code.endsAt!) - 7 * DAY);
const EXPIRED = new Date(Date.parse(code.endsAt!) + DAY);
const owned = (d: Discount, usedAt: string | null = null) => ({ discount: d, usedAt });

function setup(now: Date) {
  const repo = createLocalRepository({ storage: null, now: () => now });
  let n = 0;
  // Comprar pide el Carnet BOIA (plan 019, decisión 1): estas pruebas compran con él.
  const ready = repo.carnet.create({ nickname: 'Grumete' });
  const sandbox = createSandboxTicketing(repo, {
    now: () => now,
    newPurchaseId: (id) => `t43-${id}-${++n}`,
  });
  const tickets: typeof sandbox = {
    ...sandbox,
    start: async (...args) => {
      await ready;
      return sandbox.start(...args);
    },
  };
  return { repo, tickets };
}

describe('aviso de descuento al comprar (REQ-COM-036)', () => {
  it('la muestra tiene un código de evento (y la prueba, uno de tienda)', () => {
    expect(code).toBeDefined();
    expect(event).toBeDefined();
    expect(other).toBeDefined();
    expect(shop).toBeDefined();
  });

  it('sale sólo con un código válido de ese evento en tu poder', () => {
    const price = samplePriceCents(event);
    expect(discountBannerFor(event, [], VALID)).toBeNull();
    expect(discountBannerFor(other, [owned(code)], VALID)).toBeNull();
    expect(discountBannerFor(event, [owned(code)], EXPIRED)).toBeNull();
    expect(discountBannerFor(event, [owned(code, VALID.toISOString())], VALID)).toBeNull();
    expect(discountBannerFor(event, [owned(shop)], VALID)).toBeNull();
    expect(discountBannerFor(event, [owned(code)], VALID)).toEqual({
      kind: 'code',
      discountId: code.id,
      code: code.code,
      label: code.label,
      savingCents: discountCents(code, price),
    });
  });

  it('con varios, gana la prioridad y, a igual prioridad, el que más ahorra', () => {
    const base: Discount = { ...code, startsAt: undefined, endsAt: undefined };
    const small = { ...base, id: 'poco', kind: 'amount' as const, value: 100, priority: 9 };
    const big = { ...base, id: 'mucho', kind: 'amount' as const, value: 900, priority: 0 };
    const bigger = { ...big, id: 'mas', value: 1000 };
    expect(applicableDiscount(event.id, [owned(big), owned(small)], 2000, VALID)?.id).toBe('poco');
    expect(applicableDiscount(event.id, [owned(big), owned(bigger)], 2000, VALID)?.id).toBe('mas');
  });

  it('encontrado en el mar, el aviso y la compra de prueba lo aplican; después queda usado', async () => {
    const { repo, tickets } = setup(VALID);
    await repo.progress.findDiscount(code.id);
    const [found] = await repo.progress.discounts();
    expect(foundDiscountState(found!)).toBe('active');
    expect(discountBannerFor(event, [found!], VALID)?.code).toBe(code.code);

    const r = await tickets.start(event.id);
    if (!r.ok) throw new Error(r.reason);
    expect(r.session.quote.discount?.code).toBe(code.code);
    await tickets.confirm!(r.session);

    const [after] = await repo.progress.discounts();
    expect(after?.usedIn).toBe(r.session.purchaseId);
    expect(foundDiscountState(after!)).toBe('used');
    expect(discountBannerFor(event, [after!], VALID)).toBeNull();
    const again = await tickets.start(event.id);
    if (!again.ok) throw new Error(again.reason);
    expect(again.session.quote.discount).toBeNull();
    // El repositorio tampoco lo acepta dos veces.
    await expect(
      repo.purchases.confirmSandbox({
        purchaseId: 'otra-compra',
        eventId: event.id,
        discountId: code.id,
      }),
    ).rejects.toMatchObject({ code: 'invalid' });
  });

  it('un código caducado se ve caducado y no se aplica', async () => {
    const { repo, tickets } = setup(EXPIRED);
    const f = await repo.progress.findDiscount(code.id);
    expect(discountStatus(f.discount, EXPIRED)).toBe('expired');
    expect(foundDiscountState(f)).toBe('expired');
    const r = await tickets.start(event.id);
    if (!r.ok) throw new Error(r.reason);
    expect(r.session.quote.discount).toBeNull();
    expect(r.session.quote.totalCents).toBe(samplePriceCents(event));
    await expect(
      repo.purchases.confirmSandbox({
        purchaseId: 'caducado',
        eventId: event.id,
        discountId: code.id,
      }),
    ).rejects.toMatchObject({ code: 'invalid' });
  });

  it('un código de tienda se guarda pero nunca descuenta una entrada', async () => {
    const { repo, tickets } = setup(VALID);
    await repo.admin.upsert('discounts', shop);
    await repo.progress.findDiscount(shop.id);
    const r = await tickets.start(event.id);
    if (!r.ok) throw new Error(r.reason);
    expect(r.session.quote.discount).toBeNull();
    await expect(
      repo.purchases.confirmSandbox({
        purchaseId: 'tienda',
        eventId: event.id,
        discountId: shop.id,
      }),
    ).rejects.toMatchObject({ code: 'invalid' });
  });
});
