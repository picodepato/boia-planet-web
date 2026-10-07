'use client';

import type { BoiaEvent } from '@boia/contracts';
import { useEffect, useId, useRef } from 'react';
import { t } from '../i18n/web';
import type { CarnetLink } from './checkout';
import './checkout.css';

type Rule = NonNullable<BoiaEvent['boxOfficeOnly']>;

/** Decisión 8 (T199), muestra. Compartido por la landing y el mar. */
export function BoxOfficeMessage({ rule, carnet }: { rule: Rule; carnet: CarnetLink }) {
  const euros = new Intl.NumberFormat('es-ES').format(rule.carnetDiscountCents / 100);
  return (
    <div data-testid="box-office-message">
      <p>{t('ticketing.boxOffice.message', { euros })}</p>
      <p>
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

export function BoxOfficeDialog({
  eventName,
  rule,
  carnet,
  onClose,
  className,
}: {
  eventName: string;
  rule: Rule;
  carnet: CarnetLink;
  onClose: () => void;
  className?: string;
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
      data-testid="box-office"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="checkout__sheet">
        <h2 id={titleId} className="checkout__title">{eventName}</h2>
        <BoxOfficeMessage rule={rule} carnet={carnet} />
        <div className="checkout__actions">
          <button type="button" className="checkout__secondary" onClick={onClose} data-testid="box-office-close">
            {t('tickets.close')}
          </button>
        </div>
      </div>
    </dialog>
  );
}
