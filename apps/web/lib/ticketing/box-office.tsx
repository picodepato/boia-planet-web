'use client';

import { t } from '../i18n/web';
import { boxOfficeLabel, type DoorEvent } from './box-office-label';
import type { CarnetLink } from './checkout';
import './checkout.css';

export { boxOfficeLabel } from './box-office-label';
// Los diálogos, aparte (`./box-office-dialog`): la landing los carga al pulsar (plan 034 T311).

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
