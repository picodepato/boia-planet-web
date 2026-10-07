'use client';

import type { FunnelEventProps } from '@boia/contracts/analytics';
import { type ComponentType, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../../../lib/i18n/web';
import { CARNET_CREATE_HREF } from '../../../lib/landing/access';
import type { SandboxCheckout } from '../../../lib/ticketing/checkout';
import { CHECKOUT_COPY } from '../../../lib/ticketing/copy';
import type { BoiaEvent } from '@boia/contracts';
import { BoxOfficeDialog, BoxOfficeMessage } from '../../../lib/ticketing/box-office';

type Source = FunnelEventProps['ticket_click_out']['source'];
type Checkout = typeof SandboxCheckout;

/** Dónde ver el sello desde la landing: Mi Carnet dentro del mar (T55). */
export const CARNET_FROM_LANDING = CARNET_CREATE_HREF;

/**
 * «Comprar entradas» de la landing y del panel de Tickets (T25): abre el
 * checkout de prueba (D-20, REQ-COM-035). El checkout y el repositorio se
 * cargan al pulsar, fuera de la ruta crítica de la landing. La analítica del
 * clic la recoge `LandingClient` por `data-track`. Sólo se pinta para
 * eventos comprables (`canBuy`): un finalizado nunca llega aquí.
 */
export function BuyButton({
  eventId,
  eventName,
  ticketUrl,
  source,
  boxOfficeOnly,
}: {
  eventId: string;
  eventName: string;
  /** Enlace sin JavaScript (la ticketera de muestra hasta que haya una real). */
  ticketUrl: string | undefined;
  source: Source;
  boxOfficeOnly?: BoiaEvent['boxOfficeOnly'];
}) {
  const [Checkout, setCheckout] = useState<ComponentType<Parameters<Checkout>[0]> | null>(null);
  const [open, setOpen] = useState(false);
  // Tras comprar, la invitación al Carnet (T44, REQ-IDE-008), cargada al cerrar.
  const purchased = useRef(false);
  const [Invite, setInvite] = useState<ComponentType<{ onDone: () => void }> | null>(null);
  const [failed, setFailed] = useState(false);
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

  if (boxOfficeOnly) {
    const carnet = { href: CARNET_FROM_LANDING };
    // Sin JavaScript también se puede leer el aviso, sin abrir la ticketera.
    if (!hydrated) {
      return (
        <details className="event-card__box-office">
          <summary className="button button--buy" {...track}>
            {t('event.buy')}
          </summary>
          <BoxOfficeMessage rule={boxOfficeOnly} carnet={carnet} />
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
                rule={boxOfficeOnly}
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
              onConfirmed={() => {
                purchased.current = true;
              }}
              onClose={() => {
                setOpen(false);
                if (!purchased.current) return;
                purchased.current = false;
                import('./purchase-invite')
                  .then((m) => setInvite(() => m.PurchaseInvite))
                  .catch((err: unknown) =>
                    console.warn('[boia] no se pudo cargar la invitación al Carnet', err),
                  );
              }}
            />,
            document.body,
          )
        : null}
      {Invite ? createPortal(<Invite onDone={() => setInvite(null)} />, document.body) : null}
    </>
  );
}
