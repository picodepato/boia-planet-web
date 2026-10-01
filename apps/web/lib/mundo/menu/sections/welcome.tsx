import type { MenuSection } from '../types';
import { t } from '../../../i18n';

/** ⚓ Welcome Aboard (REQ-IDE-035): consultable; el tutorial nunca la abre solo. Borrador. */
export const welcomeSection: MenuSection = {
  id: 'welcome',
  icon: '⚓',
  label: t('menu.welcome'),
  group: 'progress',
  Component: function Welcome() {
    return (
      <>
        <p>{t('juego.welcome.boiaPlanetEsEl')}</p>
        <p>
          <strong>{t('juego.welcome.tuObjetivo')}</strong> {t('juego.welcome.encontrarALaBoia')}
        </p>
        <ul>
          <li>{t('welcome.tip.sail')}</li>
          <li>{t('juego.welcome.acercateAUnaIsla')}</li>
          <li>{t('welcome.tip.compass')}</li>
        </ul>
        <p className="juego-muted">{t('juego.welcome.textoDeMuestraPendiente')}</p>
      </>
    );
  },
};
