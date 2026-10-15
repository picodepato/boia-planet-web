/**
 * Pasos del embudo (D-04, REQ-ARQ-019), en orden. Desde el plan 032 T301 se
 * cuentan en nuestros propios contadores diarios (Supabase
 * `private.funnel_counts`, sin terceros) y el panel «Embudo» del Admin los
 * pinta en este orden. Los nombres son contrato: la base de datos sólo
 * acepta estos.
 */
export const FUNNEL_EVENTS = [
  'landing_view',
  'explore_start',
  'discount_found',
  'tickets_panel_open',
  'ticket_click_out',
  'purchase_confirmed',
] as const;

export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

/** Dónde se compró: dentro del mundo 3D (T58). */
export type PurchaseSource = 'world';

/**
 * De dónde sale el descuento de una compra: un código encontrado en el mundo.
 * El de tener Carnet (T66) se fue con el plan 019 (decisión 1): el Carnet es
 * el requisito para comprar, no un descuento.
 */
export type DiscountKind = 'code';

/** Propiedades de cada evento. Nunca datos personales. */
export interface FunnelEventProps {
  landing_view: { intro: 'played' | 'skipped' | 'none' };
  /**
   * `photos`/`store`: «Ir en barco» de Fotos y Tienda en la landing (T55).
   * `intro`: «Zarpar» de la entrada, que lleva directa al mar 3D (T64).
   */
  explore_start: {
    source: 'hero' | 'hero_3d' | 'tickets_panel' | 'event' | 'photos' | 'store' | 'intro';
  };
  discount_found: { discountId: string; eventId?: string };
  /** `world`: «Entradas» de la barra del mar 3D (T58). */
  tickets_panel_open: { source: 'hero' | 'header' | 'deep_link' | 'event' | 'world' };
  ticket_click_out: {
    eventId: string;
    /**
     * `island`: «Comprar entrada» en la isla del evento, en el mar (T43).
     * `world`: «Comprar» en el panel de «Entradas» del mar 3D (T58).
     */
    source:
      'priority_event' | 'upcoming_events' | 'tickets_panel' | 'event_page' | 'island' | 'world';
  };
  purchase_confirmed: {
    eventId: string;
    provider: string;
    orderRef: string;
    /** Descuento aplicado, si lo hubo (T43). */
    discountId?: string;
    /** Qué descuento se aplicó: un código del mundo. */
    discountKind?: DiscountKind;
    /** `world`: la compra se hizo dentro del mar 3D (T58); sin él, en la web. */
    source?: PurchaseSource;
  };
}

/**
 * `purchase_confirmed` sólo lo emite el servidor, desde el webhook verificado
 * de la ticketera (REQ-COM-017). El cliente no puede ni tiparlo.
 */
export type ServerOnlyFunnelEvent = 'purchase_confirmed';
export type ClientFunnelEvent = Exclude<FunnelEvent, ServerOnlyFunnelEvent>;

export const CLIENT_FUNNEL_EVENTS = FUNNEL_EVENTS.filter(
  (e): e is ClientFunnelEvent => e !== 'purchase_confirmed',
);
