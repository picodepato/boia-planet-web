'use client';

import type { ShipCatalog } from '../../lib/barco/catalog';
import { BarcoShop } from '../../lib/barco/shop';
import type { ShipLook } from '../../lib/barco/shop-model';
import { t } from '../../lib/i18n';
import { MarHoja } from './hoja';

/**
 * La tienda «Barco» en /mar (T40), abierta desde el menú: la misma tienda que
 * la sección «Barco» del Menú de a bordo del 2D, en una hoja crema por
 * encima del mar (`MarHoja`). Mientras está abierta el barco no se mueve.
 */
export function MarTienda({
  catalog,
  current,
  pending,
  onEquip,
  onClose,
}: {
  catalog: ShipCatalog | null;
  current: ShipLook | null;
  pending: boolean;
  onEquip: (look: ShipLook) => void;
  onClose: () => void;
}) {
  return (
    <MarHoja
      title={t('mar.tienda.barco2')}
      label={t('mar.tienda.barco')}
      closeLabel={t('mar.tienda.cerrarLaTiendaDel')}
      testId="mar-tienda"
      closeTestId="mar-tienda-cerrar"
      onClose={onClose}
    >
      <BarcoShop catalog={catalog} current={current} pending={pending} onEquip={onEquip} />
    </MarHoja>
  );
}
