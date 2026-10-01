'use client';

import { type BoiaEvent, EVENT_STATE_BEHAVIOR, eventKicker } from '@boia/contracts';
import Link from 'next/link';
import { EVENTOS_COPY } from '../landing/eventos-copy';
import { eventHref } from '../landing/eventos';
import { CHECKOUT_COPY } from '../ticketing/copy';
import { EventDiscountBanner } from '../ticketing/discount-banner';
import { IslandMemories, IslandPhotosLink, IslandUpcoming } from './place-panels';
import { t } from '../i18n';

/**
 * Panel de evento que abre la isla por proximidad (T04). No es modal: el
 * barco sigue navegando. El resto del HUD está en minimap.tsx,
 * hud-buttons.tsx, notices.tsx y menu/ (T05).
 *
 * Enseña el estado del evento (T42, REQ-COM-003): agotado sin compra,
 * pospuesto o cancelado con su aviso y, si ya pasó, su recuerdo con el
 * cartel; debajo, los recuerdos de la isla, «Ver fotos de la isla» y sus
 * «Próximos eventos», con los satélites sin isla si es la del All Day (O7).
 * Con un código de descuento de este evento, «Tienes un código de descuento
 * para este evento» junto a la compra (T43, REQ-COM-036).
 */

function formatDate(e: BoiaEvent): string {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: e.timeZone,
  }).format(new Date(e.startsAt));
}

/** La isla ofrece compra sólo si su TICKET se activó y el evento está a la venta. */
export function islandCanBuy(event: BoiaEvent, showTicket: boolean): boolean {
  return showTicket && EVENT_STATE_BEHAVIOR[event.state].purchasable;
}

/** Aviso del estado en la isla (textos-zonas, zona 11 y 4). */
function stateNotice(event: BoiaEvent): string | null {
  switch (event.state) {
    case 'sold_out':
      return EVENTOS_COPY.island.soldOut;
    case 'postponed':
    case 'cancelled':
      return EVENTOS_COPY.stateBody[event.state];
    case 'finished':
      return EVENTOS_COPY.island.memory;
    default:
      return null;
  }
}

export function EventPanel({
  event,
  showTicket,
  onBuy,
  onClose,
  onSteer,
}: {
  /** Con su estado de ahora (`liveContent`). */
  event: BoiaEvent;
  showTicket: boolean;
  /** Abre la compra de prueba (T25, D-20). */
  onBuy: () => void;
  onClose: () => void;
  /** Pone la brújula rumbo a la isla de otro evento. */
  onSteer?: (eventId: string) => boolean;
}) {
  const buy = islandCanBuy(event, showTicket);
  const notice = stateNotice(event);
  return (
    <section
      className="juego-panel"
      data-testid="panel-evento"
      data-estado={event.state}
      aria-label={event.name}
    >
      <button
        type="button"
        className="juego-panel-close"
        onClick={onClose}
        aria-label={t('juego.worldUi.cerrar')}
      >
        ×
      </button>
      <p className="juego-panel-kicker">
        {eventKicker(event)}
        {event.sample ? t('juego.worldUi.muestra') : ''}
        {event.state !== 'on_sale' ? (
          <span className={`juego-estado is-${event.state}`} data-testid="panel-evento-estado">
            {EVENTOS_COPY.state[event.state]}
          </span>
        ) : null}
      </p>
      <h2>{event.name}</h2>
      <p className="juego-panel-meta">
        {formatDate(event)} · {event.placeLabel}
      </p>
      {notice ? (
        <p className="juego-panel-aviso" role="status" data-testid="panel-evento-aviso">
          {notice}
          {event.stateNote ? ` ${event.stateNote}` : ''}
        </p>
      ) : null}
      {event.state === 'finished' ? (
        <p className="juego-cartel-fila">
          {event.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- cartel del Admin, dominio aún sin fijar
            <img
              className="juego-cartel"
              src={event.posterUrl}
              alt={EVENTOS_COPY.posterAlt(event.name)}
            />
          ) : (
            <span
              className="juego-cartel is-texto"
              role="img"
              aria-label={EVENTOS_COPY.posterAlt(event.name)}
            >
              {event.name}
            </span>
          )}
        </p>
      ) : (
        <p>{event.description}</p>
      )}
      <p className="juego-panel-links">
        <Link href={eventHref(event.slug)} prefetch={false} data-testid="panel-evento-ficha">
          {EVENTOS_COPY.details}
        </Link>
        {event.islandId ? <IslandPhotosLink islandId={event.islandId} /> : null}
      </p>
      {buy ? <EventDiscountBanner event={event} /> : null}
      {buy ? (
        <button
          type="button"
          className="juego-panel-cta"
          data-testid="panel-evento-comprar"
          aria-haspopup="dialog"
          onClick={onBuy}
        >
          {CHECKOUT_COPY.islandBuy}
        </button>
      ) : null}
      {event.islandId ? <IslandMemories placeId={event.islandId} /> : null}
      <IslandUpcoming islandId={event.islandId} excludeId={event.id} onSteer={onSteer} />
    </section>
  );
}
