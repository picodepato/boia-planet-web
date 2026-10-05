import { BarcoShop } from '../../../barco/shop';
import type { MenuSection } from '../types';
import { t } from '../../../i18n';

/**
 * ⛵ Barco (REQ-IDE-030/031, T12, T40): la tienda del barco. Los estilos de
 * T11 y sus skins, la estela y la mascota; al empezar sólo B05 Arcilla y B02
 * Acuarela (hoy oculta) son tuyos, el resto se compra con monedas, se desbloquea con puntos
 * o se gana con un logro. Equipar cambia el barco al momento, sin recargar, y
 * se guarda en el repositorio. Sólo cambia cómo se ve.
 */
export const barcoSection: MenuSection = {
  id: 'barco',
  icon: '⛵',
  label: t('juego.barco.barco'),
  group: 'progress',
  Component: function Barco({ ctx }) {
    return (
      <BarcoShop
        catalog={ctx.ship.catalog}
        current={ctx.ship.current}
        pending={ctx.ship.pending || !ctx.ready}
        onEquip={ctx.ship.choose}
      />
    );
  },
};
