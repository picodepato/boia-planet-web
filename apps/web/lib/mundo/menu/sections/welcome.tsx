import type { ReactNode } from 'react';
import type { MenuSection } from '../types';
import { t } from '../../../i18n';

/** Los consejos de Welcome Aboard: sólo los dos primeros (decisión del 2026-10-02). */
export const WELCOME_TIPS = ['welcome.tip.sail', 'welcome.tip.island'] as const;

/**
 * El texto de Welcome Aboard (REQ-IDE-035), corto (decisión de Hernán y
 * Álvaro del 2026-10-02): el título en negrita, una frase, el objetivo y los
 * dos primeros consejos. `title` cambia lo que va con el título (en el mar,
 * la boia de la entrada a su lado). Borrador.
 */
export function WelcomeBody({ title }: { title?: ReactNode }) {
  return (
    <>
      {title ?? (
        <p>
          <strong>{t('mar.bienvenida.titulo')}</strong>
        </p>
      )}
      <p data-testid="bienvenida-texto">{t('mar.bienvenida.texto')}</p>
      <p data-testid="bienvenida-objetivo">{t('mar.bienvenida.objetivo')}</p>
      <ul data-testid="bienvenida-consejos">
        {WELCOME_TIPS.map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ul>
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
