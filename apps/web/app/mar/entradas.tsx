'use client';

import { eventKicker } from '@boia/contracts';
import { formatEventDate, t } from '../../lib/i18n';
import { CHECKOUT_COPY } from '../../lib/ticketing/copy';
import { EventDiscountBanner } from '../../lib/ticketing/discount-banner';
import type { WorldTicket, WorldTickets } from './entradas-model';
import { MarHoja } from './hoja';
import { StateTag } from './sheet';
import './entradas.css';

/**
 * «Elige tu evento» dentro del mar 3D (T58, REQ-ENT-037): el botón «Entradas»
 * de la barra abre aquí, en la hoja crema de abajo del HUD (`MarHoja`), los
 * mismos eventos que el panel de Tickets de la landing. «Comprar entrada»
 * abre el checkout de prueba encima, sin salir del mundo (con el código
 * encontrado navegando, si vale para ese evento); «Ir a su isla» vuela o
 * navega hasta ella y abre la compra al llegar. Textos `muestra`.
 */
export function MarEntradas({
  tickets,
  onBuy,
  onSail,
  onClose,
}: {
  tickets: WorldTickets;
  onBuy: (eventId: string) => void;
  onSail: (eventId: string) => void;
  onClose: () => void;
}) {
  const islands = tickets.entries.some((x) => x.placeId && x.buyable);
  return (
    <MarHoja
      title={`🎟️ ${t('tickets.heading')}`}
      label={t('tickets.heading')}
      closeLabel={t('mar.hoja.cerrar', { title: t('tickets.heading') })}
      testId="mar-entradas-panel"
      closeTestId="mar-entradas-cerrar"
      onClose={onClose}
    >
      {tickets.entries.length > 0 ? (
        <ul className="mar-entradas">
          {tickets.entries.map((x) => (
            <li key={x.event.id}>
              <Ticket ticket={x} onBuy={onBuy} onSail={onSail} />
            </li>
          ))}
        </ul>
      ) : null}
      {!tickets.onSale ? (
        <p className="mar-entradas__empty" data-testid="mar-entradas-vacio">
          {t('tickets.empty')}
        </p>
      ) : null}
      {islands ? <p className="juego-muted">{t('tickets.islandInvite')}</p> : null}
    </MarHoja>
  );
}

function Ticket({
  ticket: { event: e, featured, buyable, placeId },
  onBuy,
  onSail,
}: {
  ticket: WorldTicket;
  onBuy: (eventId: string) => void;
  onSail: (eventId: string) => void;
}) {
  return (
    <article
      className={featured ? 'mar-entrada is-featured' : 'mar-entrada'}
      data-testid={`mar-entrada-${e.id}`}
      data-estado={e.state}
    >
      {featured ? <p className="mar-entrada__featured">{t('tickets.featured')}</p> : null}
      <p className="mar-sheet__kicker">
        {eventKicker(e)}
        {e.sample ? t('mar.sheet.muestra') : ''}
        <StateTag event={e} />
      </p>
      <h3 className="mar-entrada__name">{e.name}</h3>
      <p className="mar-sheet__meta">
        {formatEventDate(e.startsAt, e.timeZone)} · {e.placeLabel}
      </p>
      {buyable ? <EventDiscountBanner event={e} /> : null}
      {buyable ? (
        <div className="mar-sheet__actions">
          <button
            type="button"
            className="mar-btn mar-btn--primary"
            data-testid={`mar-entradas-comprar-${e.id}`}
            aria-label={CHECKOUT_COPY.buyAria(e.name)}
            aria-haspopup="dialog"
            onClick={() => onBuy(e.id)}
          >
            {t('mar.sheet.comprarEntrada')}
          </button>
          {placeId ? (
            <button
              type="button"
              className="mar-btn"
              data-testid={`mar-entradas-isla-${e.id}`}
              onClick={() => onSail(e.id)}
            >
              <span aria-hidden="true">⛵</span> {t('tickets.sailToIsland')}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
