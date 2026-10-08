/**
 * Adaptador de ticketera (REQ-COM-015, D-06). La web sólo habla con esta
 * interfaz: hoy la implementa el sandbox de la versión de prueba (D-20,
 * REQ-COM-035, `sandbox.ts`); cuando Álvaro contrate la ticketera, otra
 * implementación la sustituye sin tocar la landing ni las islas.
 *
 * Cómo encaja una ticketera real (Fourvenues como candidata):
 * - `start` crea la compra pendiente con su id interno y devuelve un flujo
 *   `redirect` a su checkout, con ese id como `metadata.internal_id`.
 * - No implementa `confirm`: la compra la confirma sólo su webhook verificado
 *   (`payment.success`), en el servidor, que concede el sello y el logro con
 *   la misma idempotencia por id de compra (REQ-COM-017, REQ-IDE-021).
 */

import type { DiscountKind, PurchaseSource } from '@boia/contracts/analytics';

export type TicketingProvider = 'sandbox' | 'fourvenues';

/** Lo que la web cuenta de una compra al prepararla (T58). */
export interface StartOptions {
  /** `world`: se compra dentro del mar 3D; la analítica de la compra lo dice. */
  source?: PurchaseSource;
}

export interface TicketingAdapter {
  readonly provider: TicketingProvider;
  /** Compras de prueba: la interfaz lo rotula siempre (REQ-COM-035). */
  readonly isTest: boolean;
  /**
   * Prepara la compra de un evento: precio, descuento aplicable e id de
   * compra estable. Si el evento no se puede comprar, lo dice con su motivo.
   */
  start(eventId: string, opts?: StartOptions): Promise<CheckoutStart>;
  /**
   * Confirma una compra preparada con `start`. Sólo el sandbox la expone;
   * repetirla con la misma sesión no duplica sello ni logro.
   */
  confirm?(session: CheckoutSession): Promise<PurchaseOutcome>;
}

export type CheckoutStart =
  | { ok: true; session: CheckoutSession }
  | {
      ok: false;
      /**
       * `carnet_required`: hace falta el Carnet BOIA para comprar (plan 019,
       * decisión 1); el checkout lleva a crearlo y vuelve a la compra.
       */
      reason: 'not_found' | 'not_on_sale' | 'carnet_required';
      event: CheckoutEvent | null;
    };

export interface CheckoutEvent {
  id: string;
  name: string;
  format: string;
  startsAt: string;
  timeZone: string;
  placeLabel: string;
}

export interface CheckoutSession {
  /** Id de compra estable (en Fourvenues, `metadata.internal_id`). */
  purchaseId: string;
  event: CheckoutEvent;
  quote: Quote;
  /** `inline`: se confirma aquí (sandbox). `redirect`: checkout del proveedor. */
  flow: { kind: 'inline' } | { kind: 'redirect'; url: string };
  /** Dónde se compra (T58): viaja con la compra hasta su `purchase_confirmed`. */
  source?: PurchaseSource;
}

export interface AppliedDiscount {
  id: string;
  code: string;
  label: string;
  /** Céntimos que descuenta sobre el precio. */
  cents: number;
  /** `code`: un código encontrado en el mundo (el único que hay desde el plan 019). */
  kind: DiscountKind;
}

export interface Quote {
  currency: 'EUR';
  /** Precio de una entrada, en céntimos. `muestra` hasta que Álvaro lo fije. */
  unitCents: number;
  quantity: number;
  discount: AppliedDiscount | null;
  totalCents: number;
  /** Precio de muestra, no real. */
  sample: boolean;
}

export interface PurchaseOutcome {
  purchaseId: string;
  eventId: string;
  /** false si esta misma compra ya se había confirmado. */
  firstConfirmation: boolean;
  /**
   * `granted`: el sello se acaba de añadir al Carnet. `duplicate`: esta compra
   * ya lo había dado. `already_stamped`: otra compra de ese evento ya lo dio.
   */
  stamp: 'granted' | 'duplicate' | 'already_stamped';
  /** El logro de la entrada: id y si se acaba de conseguir. null si el catálogo no lo tiene. */
  achievement: { id: string; title: string; granted: boolean } | null;
}
