'use client';

import { CarnetPanel } from '../../carnet/carnet-panel';
import type { MenuContext, MenuSection } from '../types';
import { t } from '../../../i18n';

/** 🪪 Mi Carnet en el Menú de a bordo (REQ-IDE-011): el panel compartido (`CarnetPanel`). */
function Carnet({ ctx }: { ctx: MenuContext }) {
  return (
    <CarnetPanel
      onTop={() => document.getElementById('menu-panel')?.scrollTo({ top: 0 })}
      onBottles={ctx.openBottles}
    />
  );
}

export const carnetSection: MenuSection = {
  id: 'carnet',
  icon: '🪪',
  label: t('nav.carnet'),
  group: 'progress',
  Component: Carnet,
};
