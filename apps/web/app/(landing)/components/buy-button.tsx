'use client';

import type { FunnelEventProps } from '@boia/contracts/analytics';
import { type ComponentType, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../../../lib/i18n/web';
import { CARNET_CREATE_HREF } from '../../../lib/landing/access';
import type { SandboxCheckout } from '../../../lib/ticketing/checkout';
import { CHECKOUT_COPY } from '../../../lib/ticketing/copy';
import type { BoiaEvent } from '@boia/contracts';
import { BoxOfficeDialog, BoxOfficeMessage } from '../../../lib/ticketing/box-office';

type Source = FunnelEventProps['ticket_click_out']['source'];
type Checkout = typeof SandboxCheckout;

/**
 * «Comprar entradas» de un evento con «Tickets todavía no disponibles» (plan
 * 030 T292): el mismo botón, que al tocarlo (`onTap`) dice eso en un
 * `role="status"`. No abre el checkout ni la ticketera; sin JavaScript
 * (`hydrated` falso) el aviso se despliega bajo el botón, sin enlace.
 */
export function NotYetBuy({
  eventId,
  eventName,
  hydrated,
  shown,
  onTap,
}: {
  eventId: string;
  eventName: string;
  hydrated: boolean;
  shown: boolean;
  onTap: () => void;
}) {
  // Otro testid que el de la compra: las e2e que compran esperan el de verdad.
  const id = `no-todavia-${eventId}`;
  const status = (text: string | null) => (
    <p className="event-card__note" role="status" data-testid={`${id}-aviso`}>
      {text}
    </p>
  );
  if (!hydrated) {
    return (
      <details className="event-card__box-office">
        <summary className="button button--buy" data-testid={id}>
          {t('event.buy')}
        </summary>
        {status(t('ticketing.notYet'))}
      </details>
    );
  }
  return (
    <>
      <button
        type="button"
        className="button button--buy"
        aria-label={t('ticketing.boxOffice.buyAria', { name: eventName })}
        data-testid={id}
        data-no-todavia=""
        onClick={onTap}
      >
        {t('event.buy')}
      </button>
      {status(shown ? t('ticketing.notYet') : null)}
    </>
  );
}

/** Dónde ver el sello desde la landing: Mi Carnet dentro del mar (T55). */
export const CARNET_FROM_LANDING = CARNET_CREATE_HREF;

/**
 * «Comprar entradas» de la landing y del panel de Tickets (T25): abre el
 * checkout de prueba (D-20, REQ-COM-035), que sin Carnet BOIA lleva a
 * crearlo antes de comprar (plan 019, decisión 1). Un evento «Solo en
 * puerta» abre su aviso en vez del checkout (decisión 6). El checkout y el repositorio se
 * cargan al pulsar, fuera de la ruta crítica de la landing. La analítica del
 * clic la recoge `LandingClient` por `data-track`. Sólo se pinta para
 * eventos con compra (`buyButtonShown`): un finalizado nunca llega aquí. Con
 * `notYet` (plan 030 T292) el botón sigue en su sitio, pero al tocarlo dice
 * «Tickets todavía no disponibles» y no abre nada (sin JavaScript tampoco:
 * no hay enlace a la ticketera).
 */
export function BuyButton({
  eventId,
  eventName,
  ticketUrl,
  source,
  boxOfficeOnly,
  priceCents,
  notYet = false,
}: {
  eventId: string;
  eventName: string;
  /** Enlace sin JavaScript (la ticketera de muestra hasta que haya una real). */
  ticketUrl: string | undefined;
  source: Source;
  boxOfficeOnly?: BoiaEvent['boxOfficeOnly'];
  /** Precio del evento: el de la puerta si `boxOfficeOnly` no trae otro. */
  priceCents?: BoiaEvent['priceCents'];
  /** «Tickets todavía no disponibles» (`event.ticketsNotYet`, T292). */
  notYet?: boolean;
}) {
  const [Checkout, setCheckout] = useState<ComponentType<Parameters<Checkout>[0]> | null>(null);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [notYetShown, setNotYetShown] = useState(false);
  // Sin JavaScript (o antes de hidratar) queda el enlace a la ticketera de
  // muestra, como antes (REQ-ENT-017); con JavaScript, la compra de prueba.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const track = {
    'data-track': 'ticket_click_out',
    'data-event-id': eventId,
    'data-source': source,
    'data-testid': `comprar-${eventId}`,
  };

  if (notYet) {
    return (
      <NotYetBuy
        eventId={eventId}
        eventName={eventName}
        hydrated={hydrated}
        shown={notYetShown}
        onTap={() => setNotYetShown(true)}
      />
    );
  }

  if (boxOfficeOnly) {
    const carnet = { href: CARNET_FROM_LANDING };
    const door = { boxOfficeOnly, priceCents };
    // Sin JavaScript también se puede leer el aviso, sin abrir la ticketera.
    if (!hydrated) {
      return (
        <details className="event-card__box-office">
          <summary className="button button--buy" {...track}>
            {t('event.buy')}
          </summary>
          <BoxOfficeMessage event={door} carnet={carnet} />
        </details>
      );
    }
    return (
      <>
        <button
          type="button"
          className="button button--buy"
          aria-label={t('ticketing.boxOffice.buyAria', { name: eventName })}
          aria-haspopup="dialog"
          {...track}
          onClick={() => setOpen(true)}
        >
          {t('event.buy')}
        </button>
        {open
          ? createPortal(
              <BoxOfficeDialog
                eventName={eventName}
                event={door}
                carnet={carnet}
                onClose={() => setOpen(false)}
              />,
              document.body,
            )
          : null}
      </>
    );
  }

  if (!hydrated && ticketUrl) {
    return (
      <a
        className="button button--buy"
        href={ticketUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('event.buy.aria', { name: eventName })}
        {...track}
      >
        {t('event.buy')}
      </a>
    );
  }

  const onClick = () => {
    setFailed(false);
    if (Checkout) return setOpen(true);
    import('../../../lib/ticketing/checkout')
      .then((m) => {
        setCheckout(() => m.SandboxCheckout);
        setOpen(true);
      })
      .catch((err: unknown) => {
        console.warn('[boia] no se pudo cargar la compra de prueba', err);
        setFailed(true);
      });
  };

  return (
    <>
      <button
        type="button"
        className="button button--buy"
        aria-label={CHECKOUT_COPY.buyAria(eventName)}
        aria-haspopup="dialog"
        {...track}
        onClick={onClick}
      >
        {CHECKOUT_COPY.buy}
      </button>
      {failed ? (
        <p className="event-card__note" role="alert">
          {CHECKOUT_COPY.loadFailed}
        </p>
      ) : null}
      {open && Checkout
        ? createPortal(
            <Checkout
              eventId={eventId}
              carnet={{ href: CARNET_FROM_LANDING }}
              onClose={() => setOpen(false)}
            />,
            document.body,
          )
        : null}
    </>
  );
}
