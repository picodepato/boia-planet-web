import { type BoiaEvent, type Discount, discountStatus } from '@boia/contracts';
import { SAMPLE_CONTENT } from '../landing/sample-content';
import type { AppliedDiscount, Quote } from './adapter';

/**
 * Precios de la compra de prueba, en céntimos. El precio es del evento
 * (`priceCents`, T42; antes vivía aquí en una tabla) y es `muestra` hasta que
 * lo ponga la ticketera que contrate Álvaro (D-06). Un evento sin precio usa
 * `DEFAULT_SAMPLE_PRICE_CENTS`.
 */
export const DEFAULT_SAMPLE_PRICE_CENTS = 2000;

type Priced = Pick<BoiaEvent, 'id' | 'priceCents'>;

/** Precio de un evento; con sólo el id, el del evento de la muestra. */
export function samplePriceCents(event: Priced | string): number {
  const e = typeof event === 'string' ? SAMPLE_CONTENT.events.find((x) => x.id === event) : event;
  return e?.priceCents ?? DEFAULT_SAMPLE_PRICE_CENTS;
}

/** Lo que descuenta un código sobre un precio, sin pasar de ese precio. */
export function discountCents(discount: Discount, priceCents: number): number {
  const off =
    discount.kind === 'percent'
      ? Math.round((priceCents * Math.min(discount.value, 100)) / 100)
      : discount.value;
  return Math.max(0, Math.min(priceCents, off));
}

/** Un código encontrado, tal como lo da `repo.progress.discounts()`. */
export interface OwnedDiscount {
  discount: Discount;
  /** Ya se aplicó en una compra: no vale otra vez (T43). */
  usedAt?: string | null | undefined;
}

/**
 * El descuento que se aplica a la compra de un evento, o null. Sólo vale un
 * código que el visitante haya encontrado (la lista es la de sus hallazgos),
 * de entradas (no de la tienda, O8), vigente ahora, sin usar y de ese evento
 * (o sin evento). Si hay varios, el de más prioridad y, a igual prioridad, el
 * que más descuenta (REQ-COM-020).
 */
export function applicableDiscount(
  eventId: string,
  found: readonly OwnedDiscount[],
  priceCents: number,
  now: Date,
): AppliedDiscount | null {
  let best: AppliedDiscount | null = null;
  let bestPriority = -1;
  for (const { discount, usedAt } of found) {
    if (discount.scope === 'store' || usedAt) continue;
    if (discount.eventId !== undefined && discount.eventId !== eventId) continue;
    if (discountStatus(discount, now) !== 'active') continue;
    const cents = discountCents(discount, priceCents);
    if (cents <= 0) continue;
    const priority = discount.priority ?? 0;
    if (best && (bestPriority > priority || (bestPriority === priority && best.cents >= cents)))
      continue;
    best = { id: discount.id, code: discount.code, label: discount.label, cents, kind: 'code' };
    bestPriority = priority;
  }
  return best;
}

/** Lo que enseña el aviso «Tienes un código de descuento para este evento» (REQ-COM-036). */
export interface DiscountBannerInfo {
  kind: AppliedDiscount['kind'];
  discountId: string;
  code: string;
  label: string;
  /** Lo que se ahorra en una entrada, en céntimos. */
  savingCents: number;
}

/**
 * El aviso de descuento al comprar en la isla o la ficha de un evento
 * (D-23, puntos 5 y 6): sólo si la compra aplicaría un código encontrado (el
 * mismo criterio que `applicableDiscount`); si no, null. El Carnet ya no
 * descuenta (plan 019, decisión 1): es el requisito para comprar.
 */
export function discountBannerFor(
  event: Priced | string,
  found: readonly OwnedDiscount[],
  now: Date,
): DiscountBannerInfo | null {
  const eventId = typeof event === 'string' ? event : event.id;
  const d = applicableDiscount(eventId, found, samplePriceCents(event), now);
  return d ? bannerInfo(d) : null;
}

/** El aviso de un descuento ya elegido. */
export function bannerInfo(d: AppliedDiscount): DiscountBannerInfo {
  return { kind: d.kind, discountId: d.id, code: d.code, label: d.label, savingCents: d.cents };
}

export function quoteFor(
  event: Priced | string,
  found: readonly OwnedDiscount[],
  now: Date,
  quantity = 1,
): Quote {
  const eventId = typeof event === 'string' ? event : event.id;
  const unitCents = samplePriceCents(event);
  const discount = applicableDiscount(eventId, found, unitCents, now);
  const totalCents = Math.max(0, unitCents * quantity - (discount?.cents ?? 0));
  return { currency: 'EUR', unitCents, quantity, discount, totalCents, sample: true };
}

const EUR = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

export function formatEuros(cents: number): string {
  return EUR.format(cents / 100);
}
