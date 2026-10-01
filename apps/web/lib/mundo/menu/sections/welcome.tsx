import type { MenuSection } from '../types';
import { t } from '../../../i18n';

/**
 * El texto de Welcome Aboard (REQ-IDE-035), igual en el 2D y en el mar 3D
 * (T55); `tips` cambia los consejos (los controles no son los mismos). Borrador.
 */
export function WelcomeBody({ tips }: { tips?: readonly string[] }) {
  const list = tips ?? [
    t('welcome.tip.sail'),
    t('juego.welcome.acercateAUnaIsla'),
    t('welcome.tip.compass'),
  ];
  return (
    <>
      <p>{t('juego.welcome.boiaPlanetEsEl')}</p>
      <p>
        <strong>{t('juego.welcome.tuObjetivo')}</strong> {t('juego.welcome.encontrarALaBoia')}
      </p>
      <ul>
        {list.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
      <p className="juego-muted">{t('juego.welcome.textoDeMuestraPendiente')}</p>
    </>
  );
}

/** ⚓ Welcome Aboard (REQ-IDE-035): consultable; el tutorial nunca la abre solo. Borrador. */
export const welcomeSection: MenuSection = {
  id: 'welcome',
  icon: '⚓',
  label: t('menu.welcome'),
  group: 'progress',
  Component: function Welcome() {
    return <WelcomeBody />;
  },
};
