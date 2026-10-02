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

/**
 * El Carnet de quien compra, para el precio (T66): si lo tiene y el
 * descuento de tenerlo (`repo.content.carnetDiscount()`, -10 % `muestra`).
 */
export interface CarnetPricing {
  has: boolean;
  discount: Discount | null;
}

/** Lo que descuenta tener Carnet en una entrada de `priceCents`, o null si no descuenta. */
export function carnetDiscountFor(
  discount: Discount | null,
  priceCents: number,
  now: Date,
): AppliedDiscount | null {
  if (!discount || discount.scope === 'store') return null;
  if (discountStatus(discount, now) !== 'active') return null;
  const cents = discountCents(discount, priceCents);
  if (cents <= 0) return null;
  return {
    id: discount.id,
    code: discount.code,
    label: discount.label,
    cents,
    kind: 'carnet',
    ...(discount.kind === 'percent' ? { percent: Math.min(discount.value, 100) } : {}),
  };
}

/**
 * El mejor descuento de una compra (T66, decisión del 2026-10-02): el código
 * del mundo que vale (`applicableDiscount`) o el de tener Carnet. No se
 * suman: va el que más ahorra; si ahorran lo mismo, el del Carnet (así el
 * código, que vale una vez, queda para otra compra). `skipped` es el otro,
 * el que valía y no se aplica, para decirlo en el checkout. Sin Carnet,
 * `carnetOffer` es lo que ahorraría con él si fuera el mejor: el aviso
 * «Créalo en 30 s y ahorra un 10 %» sólo sale entonces.
 */
export function bestDiscount(
  eventId: string,
  found: readonly OwnedDiscount[],
  priceCents: number,
  now: Date,
  carnet: CarnetPricing | null = null,
): {
  discount: AppliedDiscount | null;
  skipped: AppliedDiscount | null;
  carnetOffer: AppliedDiscount | null;
} {
  const code = applicableDiscount(eventId, found, priceCents, now);
  const perk = carnet ? carnetDiscountFor(carnet.discount, priceCents, now) : null;
  if (!perk) return { discount: code, skipped: null, carnetOffer: null };
  const perkWins = !code || perk.cents >= code.cents;
  if (!carnet?.has) {
    // Sin Carnet: el código (si hay); el Carnet, sólo como oferta si ahorraría más.
    return {
      discount: code,
      skipped: null,
      carnetOffer: !code || perk.cents > code.cents ? perk : null,
    };
  }
  return perkWins
    ? { discount: perk, skipped: code, carnetOffer: null }
    : { discount: code, skipped: perk, carnetOffer: null };
}

/** Lo que enseña el aviso «Tienes un código de descuento para este evento» (REQ-COM-036). */
export interface DiscountBannerInfo {
  /** `carnet`: el descuento de tener Carnet BOIA (T66), no un código encontrado. */
  kind: AppliedDiscount['kind'];
  discountId: string;
  code: string;
  label: string;
  /** Lo que se ahorra en una entrada, en céntimos. */
  savingCents: number;
}

/**
 * El aviso de descuento al comprar en la isla o la ficha de un evento
 * (D-23, puntos 5 y 6): sólo si la compra aplicaría un descuento (el mismo
 * criterio que `bestDiscount`): un código encontrado o, con Carnet, el de
 * tenerlo (T66); si no, null.
 */
export function discountBannerFor(
  event: Priced | string,
  found: readonly OwnedDiscount[],
  now: Date,
  carnet: CarnetPricing | null = null,
): DiscountBannerInfo | null {
  const eventId = typeof event === 'string' ? event : event.id;
  const d = bestDiscount(eventId, found, samplePriceCents(event), now, carnet).discount;
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
  carnet: CarnetPricing | null = null,
): Quote {
  const eventId = typeof event === 'string' ? event : event.id;
  const unitCents = samplePriceCents(event);
  const { discount, skipped, carnetOffer } = bestDiscount(eventId, found, unitCents, now, carnet);
  const totalCents = Math.max(0, unitCents * quantity - (discount?.cents ?? 0));
  return {
    currency: 'EUR',
    unitCents,
    quantity,
    discount,
    totalCents,
    sample: true,
    ...(skipped ? { skipped } : {}),
    ...(carnetOffer ? { carnetOffer } : {}),
  };
}

const EUR = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

export function formatEuros(cents: number): string {
  return EUR.format(cents / 100);
}
