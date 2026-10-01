'use client';

import { ClaimBadge, claimLabel } from '../../../logros/claim-badge';
import { AchievementsPanel } from '../../../logros/panel';
import { useReadyCount } from '../../../logros/use-logros';
import type { MenuSection } from '../types';
import { t } from '../../../i18n';

/**
 * 🏅 Logros (REQ-IDE-024…028, T37): el panel de logros compartido con /mar
 * (`lib/logros`): «X de Y logros», barra y «te queda…» de cada uno, los
 * ocultos como «???» y «Reclamar» en los completados. Debajo, lo descubierto
 * en esta visita. Títulos y premios son `muestra`.
 */
function LogrosIcon() {
  const ready = useReadyCount();
  return (
    <span className="juego-menu-icon-wrap" title={claimLabel(t('juego.logros.logros'), ready)}>
      🏅
      <ClaimBadge count={ready} testId="menu-logros-contador" />
    </span>
  );
}

export const logrosSection: MenuSection = {
  id: 'logros',
  icon: <LogrosIcon />,
  label: t('juego.logros.logros'),
  group: 'progress',
  Component: function Logros({ ctx }) {
    return (
      <>
        <AchievementsPanel />
        {ctx.discovered.length > 0 ? (
          <>
            <h3>{t('juego.logros.descubiertoEnEstaVisita')}</h3>
            <ul data-testid="logros-sesion">
              {ctx.discovered.map((d) => (
                <li key={d.id}>🧭 {d.name}</li>
              ))}
            </ul>
          </>
        ) : null}
      </>
    );
  },
};
