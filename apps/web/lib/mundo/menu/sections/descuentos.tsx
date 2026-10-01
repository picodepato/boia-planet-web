'use client';

import { foundDiscountState } from '@boia/contracts';
import { DiscountCard } from '../../place-panels';
import { useRepoData } from '../../repo';
import type { MenuSection } from '../types';
import { t } from '../../../i18n';

/** Orden de «Mis códigos»: primero los que valen, luego los usados y al final los caducados. */
const ORDER = { active: 0, upcoming: 1, used: 2, expired: 3 } as const;

/**
 * 🏷️ Mis códigos (T20, T43; REQ-COM-021/022/036): los códigos encontrados en
 * el mar siguen aquí con su estado (activo, usado, caducado), su evento,
 * fecha y condiciones; se copian con un toque y cada uno lleva a su isla (el
 * barco navega solo) o a la tienda. Viven en este navegador (D-20). El id
 * `descuentos` se queda (`?menu=descuentos`).
 */
export const descuentosSection: MenuSection = {
  id: 'descuentos',
  icon: '🏷️',
  label: t('menu.discounts'),
  group: 'progress',
  Component: function Descuentos({ ctx }) {
    const { data } = useRepoData((r) => r.progress.discounts());
    if (data === undefined) return <p className="juego-muted">{t('empty.loading')}</p>;
    if (data.length === 0) {
      return <p data-testid="descuentos-vacio">{t('discount.empty')}</p>;
    }
    return (
      <ul className="juego-descuentos" data-testid="descuentos">
        {[...data]
          .sort(
            (a, b) =>
              ORDER[foundDiscountState(a)] - ORDER[foundDiscountState(b)] ||
              b.foundAt.localeCompare(a.foundAt),
          )
          .map((f) => (
            <li key={f.discount.id}>
              <DiscountCard
                found={f}
                testId={`descuento-${f.discount.id}`}
                onGoToIsland={ctx.goToIsland}
              />
            </li>
          ))}
      </ul>
    );
  },
};
