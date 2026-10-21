'use client';

import { type ReactNode, useEffect, useId, useRef } from 'react';
import { t } from '../i18n/web';
import { boxOfficeLabel, type DoorEvent } from './box-office-label';
import type { CarnetLink } from './checkout';
import './checkout.css';

export { boxOfficeLabel } from './box-office-label';

/**
 * «Solo en puerta» (plan 019 T215, decisiones 1 y 6), muestra: no hay venta
 * online; se paga en la puerta y hace falta el Carnet BOIA, que se crea
 * desde aquí. Compartido por la landing, la ficha y el mar.
 */
export function BoxOfficeMessage({ event, carnet }: { event: DoorEvent; carnet: CarnetLink }) {
  return (
    <div data-testid="box-office-message">
      <p className="box-office__label" data-testid="box-office-label">
        <strong>{boxOfficeLabel(event)}</strong>
      </p>
      <p>{t('ticketing.boxOffice.message')}</p>
      <p className="box-office__invite">
        {t('ticketing.boxOffice.invite')}{' '}
        {'href' in carnet ? (
          <a className="checkout__secondary" href={carnet.href} data-testid="box-office-carnet">
            {t('ticketing.boxOffice.carnet')}
          </a>
        ) : (
          <button
            type="button"
            className="checkout__secondary"
            onClick={carnet.onOpen}
            data-testid="box-office-carnet"
          >
            {t('ticketing.boxOffice.carnet')}
          </button>
        )}
      </p>
    </div>
  );
}

/**
 * El diálogo de un aviso de entradas (puerta, «todavía no disponibles» o la
 * lista, plan 034 T309), sobre el checkout.css. `actions` va antes de «Cerrar».
 */
export function TicketNoticeDialog({
  title,
  onClose,
  className,
  testId,
  children,
  actions,
  closeLabel,
}: {
  title: string;
  onClose: () => void;
  className?: string | undefined;
  testId: string;
  children: ReactNode;
  actions?: ReactNode;
  closeLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
      }
    };
    const onCancel = (e: Event) => {
      e.preventDefault();
      closeRef.current();
    };
    dialog?.addEventListener('keydown', onKey);
    dialog?.addEventListener('cancel', onCancel);
    return () => {
      dialog?.removeEventListener('keydown', onKey);
      dialog?.removeEventListener('cancel', onCancel);
      if (dialog?.open) dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`checkout ${className ?? ''}`}
      aria-labelledby={titleId}
      data-testid={testId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="checkout__sheet">
        <h2 id={titleId} className="checkout__title">
          {title}
        </h2>
        {children}
        <div className="checkout__actions">
          {actions}
          <button
            type="button"
            className="checkout__secondary"
            onClick={onClose}
            data-testid={`${testId}-close`}
          >
            {closeLabel ?? t('tickets.close')}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export function BoxOfficeDialog({
  eventName,
  event,
  carnet,
  onClose,
  className,
}: {
  eventName: string;
  event: DoorEvent;
  carnet: CarnetLink;
  onClose: () => void;
  className?: string;
}) {
  return (
    <TicketNoticeDialog
      title={eventName}
      onClose={onClose}
      className={className}
      testId="box-office"
    >
      <BoxOfficeMessage event={event} carnet={carnet} />
    </TicketNoticeDialog>
  );
}

/**
 * «Tickets todavía no disponibles» (plan 030 T292): lo que abre «Comprar
 * entrada» en el mar para un evento cuyas entradas aún no se venden, en vez
 * del checkout.
 */
export function TicketsNotYetDialog({
  eventName,
  onClose,
  className,
}: {
  eventName: string;
  onClose: () => void;
  className?: string;
}) {
  return (
    <TicketNoticeDialog
      title={eventName}
      onClose={onClose}
      className={className}
      testId="tickets-not-yet"
    >
      <p role="status" data-testid="tickets-not-yet-message">
        {t('ticketing.notYet')}
      </p>
    </TicketNoticeDialog>
  );
}
