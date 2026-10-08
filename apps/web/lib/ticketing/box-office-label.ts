import type { BoiaEvent } from '@boia/contracts';
import { t } from '../i18n/web';

export type DoorEvent = Pick<BoiaEvent, 'boxOfficeOnly' | 'priceCents'>;

/**
 * «Solo en puerta · 5 € con carnet» (plan 019 T215, decisión 6), o sin precio
 * si no lo hay. El precio, como `doorPriceCents` de @boia/contracts, sin
 * traer sus esquemas a la landing (D-26).
 */
export function boxOfficeLabel(event: DoorEvent): string {
  const cents = event.boxOfficeOnly?.doorPriceCents ?? event.priceCents;
  if (cents === undefined) return t('ticketing.boxOffice.labelNoPrice');
  const euros = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(cents / 100);
  return t('ticketing.boxOffice.label', { euros });
}
