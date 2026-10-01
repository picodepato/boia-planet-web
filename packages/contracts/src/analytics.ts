/**
 * Eventos del embudo en PostHog UE (D-04, REQ-ARQ-019). Los nombres son
 * contrato: el panel de PostHog se construye sobre ellos.
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

/** Propiedades de cada evento. Nunca datos personales. */
export interface FunnelEventProps {
  landing_view: { intro: 'played' | 'skipped' | 'none' };
  /** `photos`/`store`: «Ir en barco» de Fotos y Tienda en la landing (T55). */
  explore_start: { source: 'hero' | 'hero_3d' | 'tickets_panel' | 'event' | 'photos' | 'store' };
  discount_found: { discountId: string; eventId?: string };
  tickets_panel_open: { source: 'hero' | 'header' | 'deep_link' | 'event' };
  ticket_click_out: {
    eventId: string;
    /** `island`: «Comprar entrada» en la isla del evento, en el mar (T43). */
    source: 'priority_event' | 'upcoming_events' | 'tickets_panel' | 'event_page' | 'island';
  };
  purchase_confirmed: {
    eventId: string;
    provider: string;
    orderRef: string;
    /** Descuento aplicado, si lo hubo (T43). */
    discountId?: string;
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
