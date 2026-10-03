import type { Artist } from '@boia/contracts';
import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { ADMIN_PATH } from '../../../lib/admin/paths';
import {
  ACCESS_COPY,
  CARNET_CREATE_HREF,
  PHOTOS_SAIL_HREF,
  STORE_SAIL_HREF,
} from '../../../lib/landing/access';
import { PHOTOS_HOME_COPY } from '../../../lib/landing/card-copy';
import { t } from '../../../lib/landing/texts';
import type { ResolvedBlock, SocialLinks } from '../../../lib/landing/resolve';
import { ZARPAR_HREF } from '../../../lib/intro/zarpar';
import { ArtistRotator } from './artist-rotator';
import { BrandLogo } from './brand-logo';
import { EventCard } from './event-card';
import { HeroStills } from './hero-stills';

/** Lista completa de artistas (v14 §18.1). */
export const ARTISTS_PAGE = '/artistas';
/** «Fotos y eventos» (T42): todas las fotos por isla y por evento. */
export const PHOTOS_PAGE = '/fotos';

/**
 * Lista de bloques ya resueltos (`resolveHome`), en el orden configurado. Un
 * bloque oculto, fuera de programación o sin contenido útil no llega aquí.
 * Este módulo no resuelve nada: así la landing no carga zod ni los esquemas
 * de `@boia/contracts` en su ruta crítica (T29).
 */
export function HomeBlocks({
  blocks,
  artists,
  buyable,
  heroScene,
  social,
}: {
  blocks: readonly ResolvedBlock[];
  artists: readonly Artist[];
  /** ids de los eventos con compra disponible. */
  buyable: ReadonlySet<string>;
  heroScene?: ReactNode;
  /** WhatsApp para la invitación del pie (REQ-ENT-032). */
  social?: SocialLinks | undefined;
}) {
  return (
    <>
      {blocks.map((b) => (
        <BlockView
          // El hero lleva la escena de la entrada: con clave fija, un hero que
          // llega del repositorio con otro id no la desmonta (T57).
          key={b.type === 'hero' ? 'hero' : b.id}
          block={b}
          artists={artists}
          buyable={buyable}
          heroScene={heroScene}
          social={social}
        />
      ))}
    </>
  );
}

/**
 * «Ir en barco» (T44, REQ-ENT-034): la misma sección, en su isla del mar. Es
 * un enlace normal a /mar (T55); sin JavaScript no se ve (el mar lo necesita)
 * y la sección sigue siendo el camino. Cuenta como `explore_start`.
 */
function SailLink({
  href,
  label,
  testId,
  source,
}: {
  href: string;
  label: string;
  testId: string;
  source: 'photos' | 'store';
}) {
  return (
    <a
      className="sail-link"
      href={href}
      data-testid={testId}
      data-track="explore_start"
      data-source={source}
    >
      <span aria-hidden="true">⛵ </span>
      {label}
    </a>
  );
}

/** Los párrafos y los verbos de la Filosofía (sola o dentro de Contacto). */
function PhilosophyBody({
  block,
}: {
  block: { paragraphs: string[]; verbs: { verb: string; text: string }[] };
}) {
  return (
    <>
      {block.paragraphs.map((p) => (
        <p key={p} className="philosophy__text">
          {p}
        </p>
      ))}
      {block.verbs.length > 0 && (
        <ul className="philosophy__verbs">
          {block.verbs.map((v) => (
            <li key={v.verb}>
              <strong className="philosophy__verb">{v.verb}</strong> {v.text}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Pinta un bloque ya resuelto de la home. */
export function BlockView({
  block,
  artists,
  buyable,
  heroScene,
  social,
}: {
  block: ResolvedBlock;
  artists: readonly Artist[];
  buyable: ReadonlySet<string>;
  heroScene?: ReactNode;
  social?: SocialLinks | undefined;
}) {
  switch (block.type) {
    case 'hero':
      // Plan 007 T79 (T77 §5): the hero track. The scene is fixed under the
      // page; the UI sticks for the first screen of scroll and fades out as
      // the camera dives. The h1 is the Admin's title (read by screen
      // readers); «BOIA» on screen is the wordmark, with the 3D letters. The
      // h1 stays visible to assistive tech when the UI fades out (landing.css,
      // T81).
      return (
        <section
          id="inicio"
          className="hero"
          aria-labelledby="hero-title"
          data-block={block.id}
          data-scroll-phase="rest"
        >
          {/* Con clave: `heroScene` lo crea el servidor (LandingPage) y aquí va entre hermanos. */}
          <Fragment key="hero-scene">
            {heroScene ?? (
              <div className="hero__scene hero__scene--still" aria-hidden="true">
                <HeroStills />
              </div>
            )}
          </Fragment>
          <div className="hero__ui">
            <h1 id="hero-title" className="visually-hidden">
              {block.title}
            </h1>
            <p className="hero__wordmark" aria-hidden="true">
              {t('intro.logoAlt')}
              <canvas className="intro-title3d" aria-hidden="true" />
            </p>
            <div className="hero__actions">
              {/* «Zarpar» enters the game (D-24): a plain link, the dive with JavaScript. */}
              <a className="cta-explore" href={ZARPAR_HREF} data-zarpar="hero" data-testid="cta-3d">
                <span className="cta-explore__label">{t('hero.explore')}</span>
              </a>
              <a
                className="button button--tickets"
                href="#tickets"
                data-tickets-open="hero"
                data-intro-skip=""
              >
                {t('hero.tickets')}
              </a>
            </div>
            <button type="button" className="hero__hint" data-hero-hint="">
              {t('hero.scrollHint')}
              <span className="hero__hint-line" aria-hidden="true" />
            </button>
            <p className="hero__corner hero__corner--place">{t('hero.place')}</p>
            <div className="hero__corner hero__corner--bottom">
              <p>{t('hero.coords')}</p>
              <p className="hero__corner-line">{block.positioning}</p>
            </div>
          </div>
        </section>
      );

    case 'priority_event':
      return (
        <section className="section" aria-labelledby="priority-title" data-block={block.id}>
          <div className="section__inner">
            <h2 id="priority-title" className="section__title">
              {t('priority.heading')}
            </h2>
            <EventCard
              event={block.event}
              artists={artists}
              buyable={buyable.has(block.event.id)}
              source="priority_event"
              featured
              display
              poster
            />
          </div>
        </section>
      );

    case 'upcoming_events':
      return (
        <section
          id="eventos"
          className="section"
          aria-labelledby="upcoming-title"
          data-block={block.id}
        >
          <div className="section__inner">
            <h2 id="upcoming-title" className="section__title">
              {t('upcoming.heading')}
            </h2>
            <ul className="card-grid">
              {block.events.map((e) => (
                <li key={e.id}>
                  <EventCard
                    event={e}
                    artists={artists}
                    buyable={buyable.has(e.id)}
                    source="upcoming_events"
                  />
                </li>
              ))}
            </ul>
          </div>
        </section>
      );

    case 'artists':
      return (
        <section
          id="artistas"
          className="section"
          aria-labelledby="artists-title"
          data-block={block.id}
        >
          <div className="section__inner">
            <h2 id="artists-title" className="section__title">
              {t('artists.heading')}
            </h2>
            <p className="section__lead">{block.intro ?? t('artists.intro')}</p>
            <ArtistRotator
              artists={block.rotation}
              rotationMs={block.rotationMs}
              labels={{
                pause: t('artists.pause'),
                resume: t('artists.resume'),
                genres: t('artists.genres'),
              }}
            />
            {/* La lista completa es una página: enlazable y sin JS ni WebGL (T12). */}
            <p className="artists-all">
              <Link
                className="button button--ghost"
                href={ARTISTS_PAGE}
                prefetch={false}
                data-testid="ver-artistas"
              >
                {t('artists.all')}
              </Link>
              {/* BOIA's playlist (plan 007 T79): a plain link, no player, nothing from Spotify. */}
              {social?.spotify ? (
                <a
                  className="listen-link"
                  href={social.spotify}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t('artists.spotify.aria')}
                  data-testid="artistas-spotify"
                >
                  {t('artists.spotify')} <span aria-hidden="true">↗</span>
                </a>
              ) : null}
            </p>
          </div>
        </section>
      );

    case 'philosophy':
      // Sola sólo sin bloque Contacto (T65: normalmente va dentro de él).
      return (
        <section
          id="filosofia"
          className="section section--alt"
          aria-labelledby="philosophy-title"
          data-block={block.id}
        >
          <div className="section__inner">
            <h2 id="philosophy-title" className="section__title">
              {t('philosophy.heading')}
            </h2>
            <PhilosophyBody block={block} />
          </div>
        </section>
      );

    case 'photos':
      return (
        <section
          id="fotos"
          className="section"
          aria-labelledby="photos-title"
          data-block={block.id}
        >
          <div className="section__inner">
            <h2 id="photos-title" className="section__title">
              {t('photos.heading')}
            </h2>
            <p className="section__display">{t('photos.display')}</p>
            <ul className="photo-grid">
              {block.photos.map((p, i) => (
                <li key={p.id}>
                  {p.src ? (
                    // eslint-disable-next-line @next/next/no-img-element -- fotos del Admin, dominio aún sin fijar
                    <img src={p.src} alt={p.alt} width={p.width} height={p.height} loading="lazy" />
                  ) : (
                    <div
                      className={`photo-placeholder photo-placeholder--${i % 3}`}
                      role="img"
                      aria-label={p.alt}
                      style={{ aspectRatio: `${p.width} / ${p.height}` }}
                    >
                      <span aria-hidden="true">{t('photos.placeholder')}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {/* Sólo la selección; todas, por isla y por evento, en su página (REQ-COM-031). */}
            <p className="photos-all">
              <Link
                className="button button--ghost"
                href={PHOTOS_PAGE}
                prefetch={false}
                aria-label={PHOTOS_HOME_COPY.allAria}
                data-testid="ver-fotos"
              >
                {PHOTOS_HOME_COPY.all}
              </Link>
              <SailLink
                href={PHOTOS_SAIL_HREF}
                label={ACCESS_COPY.sailPhotos}
                testId="fotos-en-barco"
                source="photos"
              />
            </p>
          </div>
        </section>
      );

    case 'store':
      return (
        <section
          id="tienda"
          className="section section--alt"
          aria-labelledby="store-title"
          data-block={block.id}
        >
          <div className="section__inner">
            <h2 id="store-title" className="section__title">
              {t('store.heading')}
            </h2>
            <p className="section__lead">{t('store.intro')}</p>
            <ul className="chip-list">
              {block.products.map((p) => (
                <li key={p} className="chip">
                  {p}
                </li>
              ))}
            </ul>
            <a
              className="button button--secondary"
              href={block.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('store.cta.aria')}
            >
              {t('store.cta')}
            </a>
            <p className="sail-row">
              <SailLink
                href={STORE_SAIL_HREF}
                label={ACCESS_COPY.sailStore}
                testId="tienda-en-barco"
                source="store"
              />
            </p>
          </div>
        </section>
      );

    case 'contact':
      return (
        <section
          id="contacto"
          className="section"
          aria-labelledby="contact-title"
          data-block={block.id}
        >
          <div className="section__inner">
            <h2 id="contact-title" className="section__title">
              {t('contact.heading')}
            </h2>
            {/* La Filosofía, dentro de Contacto (T65): «Contacto» del juego lleva a las dos. */}
            {block.philosophy ? (
              <div
                id="filosofia"
                className="contact__philosophy"
                data-block={block.philosophy.id}
                data-testid="contacto-filosofia"
              >
                <h3 id="philosophy-title" className="contact__subtitle">
                  {t('philosophy.heading')}
                </h3>
                <PhilosophyBody block={block.philosophy} />
              </div>
            ) : null}
            {block.email || block.links.length > 0 ? (
              <h3 className="contact__subtitle">{t('contact.data')}</h3>
            ) : null}
            <ul className="link-list" data-testid="contacto-datos">
              {block.email && (
                <li>
                  <a href={`mailto:${block.email}`}>
                    {t('contact.email')}: {block.email}
                  </a>
                </li>
              )}
              {block.links.map((l) => (
                <li key={l.url}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer">
                    {l.label} <span className="visually-hidden">{t('common.newTab')}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      );

    case 'footer':
      return (
        <footer className="site-footer" data-block={block.id}>
          <div className="section__inner site-footer__inner">
            {/* The BOIA wordmark, large on the night sea (plan 007 T79, Hernán). */}
            <p className="site-footer__brand">
              <BrandLogo size="footer" variant="wordmark" label={t('intro.logoAlt')} />
            </p>
            {social?.spotify ? (
              <p className="site-footer__listen">
                <a
                  className="listen-link"
                  href={social.spotify}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t('artists.spotify.aria')}
                  data-testid="pie-spotify"
                >
                  {t('artists.spotify')} <span aria-hidden="true">↗</span>
                </a>
              </p>
            ) : null}
            {/* Invitación voluntaria, sin formulario (REQ-ENT-032, T44). */}
            <section
              className="footer-invite"
              aria-label={ACCESS_COPY.footerInviteLabel}
              data-testid="pie-invitacion"
            >
              <p className="footer-invite__item">
                {ACCESS_COPY.footerCarnet}{' '}
                <a href={CARNET_CREATE_HREF} data-testid="pie-crear-carnet">
                  {ACCESS_COPY.footerCarnetCta}
                </a>
              </p>
              {social?.whatsapp ? (
                <p className="footer-invite__item">
                  {ACCESS_COPY.footerWhatsapp}{' '}
                  <a
                    href={social.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={ACCESS_COPY.whatsappAria}
                    data-testid="pie-whatsapp"
                  >
                    {ACCESS_COPY.whatsappCta} ↗
                  </a>
                </p>
              ) : null}
            </section>
            {block.officialLinks.length > 0 && (
              <nav aria-label={t('footer.official')}>
                <ul className="link-list link-list--inline">
                  {/* The playlist has its own line above, when it is there. */}
                  {block.officialLinks
                    .filter((l) => !(social?.spotify && l.url === social.spotify))
                    .map((l) => (
                      <li key={l.url}>
                        <a href={l.url} target="_blank" rel="noopener noreferrer">
                          {l.label} <span className="visually-hidden">{t('common.newTab')}</span>
                        </a>
                      </li>
                    ))}
                </ul>
              </nav>
            )}
            <nav aria-label={t('footer.legal')}>
              <ul className="link-list link-list--inline">
                <li>
                  <Link href="/legal/privacidad" prefetch={false}>
                    {t('footer.privacy')}
                  </Link>
                </li>
                <li>
                  <Link href="/legal/aviso-legal" prefetch={false}>
                    {t('footer.legalNotice')}
                  </Link>
                </li>
                <li>
                  <Link href="/legal/cookies" prefetch={false}>
                    {t('footer.cookies')}
                  </Link>
                </li>
              </ul>
            </nav>
            <p className="site-footer__small">
              {/* Carga completa a propósito: la entrada la decide el script de arranque. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/?intro=1">{t('footer.replayIntro')}</a>
            </p>
            <p className="site-footer__small">
              {/* Versión de prueba (D-20, REQ-ADM-039): el Admin sin login. */}
              <Link
                href={ADMIN_PATH}
                prefetch={false}
                data-testid="probar-admin"
                title={t('footer.tryAdmin.hint')}
              >
                {t('footer.tryAdmin')}
              </Link>
            </p>
            <p className="site-footer__small">{t('footer.copyright')}</p>
            <p className="site-footer__small">{t('site.sampleNotice')}</p>
          </div>
        </footer>
      );
  }
}
