import { ZARPAR_HREF } from '../../../lib/intro/zarpar';
import { ACCESS_COPY, CARNET_PAGE, RANKING_PAGE } from '../../../lib/landing/access';
import { t, type MessageKey } from '../../../lib/landing/texts';
import { BrandLogo } from './brand-logo';
import { SoundToggle } from './sound-toggle';
import { LandingSignOutLazy } from './landing-sign-out-lazy';

const SECONDARY: ReadonlyArray<[MessageKey, string]> = [
  ['nav.artists', '#artistas'],
  ['nav.philosophy', '#filosofia'],
  ['nav.store', '#tienda'],
  ['nav.photos', '#fotos'],
];

/**
 * Cabecera fija: el logo (mascota y wordmark, T50), Tickets siempre a mano y el
 * resto de accesos, con Mi Carnet, el Ranking (T188), el sonido del juego e Instagram (T44,
 * REQ-ENT-029, O13). En móvil lo secundario va en un menú plegable que
 * funciona sin JavaScript; el sonido sólo aparece con JavaScript.
 */
export function SiteHeader({
  sections,
  instagram = null,
}: {
  sections: ReadonlySet<string>;
  /** Enlace oficial de Instagram (URL `muestra`, P15). */
  instagram?: string | null;
}) {
  const links = SECONDARY.filter(([, href]) => sections.has(href.slice(1)));
  const items = (
    <>
      {links.map(([key, href]) => (
        <li key={href}>
          <a href={href}>{t(key)}</a>
        </li>
      ))}
      <li>
        <a href={CARNET_PAGE} data-testid="cabecera-carnet">
          {ACCESS_COPY.carnet}
        </a>
      </li>
      <LandingSignOutLazy />
      <li>
        <a href={RANKING_PAGE} data-testid="cabecera-ranking">
          {ACCESS_COPY.ranking}
        </a>
      </li>
      {instagram ? (
        <li>
          <a
            href={instagram}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={ACCESS_COPY.instagramAria}
          >
            {ACCESS_COPY.instagram} ↗
          </a>
        </li>
      ) : null}
    </>
  );
  return (
    <header className="site-header">
      <a className="skip-link" href="#contenido">
        {t('nav.skipToContent')}
      </a>
      <div className="site-header__inner">
        <a className="site-header__brand" href="#inicio" aria-label={t('nav.home')}>
          <BrandLogo variant="wordmark" />
        </a>
        <nav className="site-header__nav" aria-label={t('nav.label')}>
          <ul className="site-header__links">{items}</ul>
          <SoundToggle className="sound-toggle--bar" />
          <a className="button button--tickets-small" href="#tickets" data-tickets-open="header">
            {t('nav.tickets')}
          </a>
          {/* «Zarpar» after the hero (T77 §13.3): to /mar with the veil, no dive. */}
          <a className="button button--zarpar-small" href={ZARPAR_HREF} data-zarpar="header">
            {t('nav.zarpar')}
          </a>
          <details className="site-header__menu">
            <summary className="button button--ghost">{t('nav.menu')}</summary>
            <ul className="site-header__menu-list">
              {items}
              <li className="site-header__menu-sound">
                <SoundToggle className="sound-toggle--menu" />
              </li>
            </ul>
          </details>
        </nav>
      </div>
    </header>
  );
}
