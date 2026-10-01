'use client';

import { AchievementsPanel } from '../../lib/logros/panel';
import { t } from '../../lib/i18n';
import { MarHoja } from './hoja';

/**
 * El panel de logros en /mar (T37), abierto desde el icono 🏆 de la barra o
 * tocando el aviso «¡Logro completado!»: el mismo panel que el Menú de a
 * bordo del 2D, en una hoja crema por encima del mar. «Mi Carnet» abre el
 * Carnet sin salir del mar (T55).
 */
export function MarLogros({ onClose, onCarnet }: { onClose: () => void; onCarnet: () => void }) {
  return (
    <MarHoja
      title={t('mar.logros.logros2')}
      label={t('mar.logros.logros')}
      closeLabel={t('mar.logros.cerrarLogros')}
      testId="mar-logros-panel"
      closeTestId="mar-logros-cerrar"
      extra={
        <button
          type="button"
          className="mar-logros__carnet"
          data-testid="mar-logros-carnet"
          onClick={onCarnet}
        >
          {t('mar.logros.miCarnet')}
        </button>
      }
      onClose={onClose}
    >
      <AchievementsPanel />
    </MarHoja>
  );
}
