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
import { ArtistRotator } from './artist-rotator';
import { BrandLogo } from './brand-logo';
import { EventCard } from './event-card';

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
      return (
        <section id="inicio" className="hero" aria-labelledby="hero-title" data-block={block.id}>
          {/* Con clave: `heroScene` lo crea el servidor (LandingPage) y aquí va entre hermanos. */}
          <Fragment key="hero-scene">
            {heroScene ?? <div className="hero__sea" aria-hidden="true" />}
          </Fragment>
          <div className="hero__content">
            <p className="hero__brand">{t('hero.brand')}</p>
            <h1 id="hero-title" className="hero__title">
              {block.title}
            </h1>
            <p className="hero__positioning">{block.positioning}</p>
            <div className="hero__actions">
              {/* El mundo es el planeta 3D (plan 005): el botón principal va a /mar;
                  Tickets, al lado. */}
              <a
                className="cta-explore"
                href="/mar"
                data-track="explore_start"
                data-source="hero"
                data-testid="cta-3d"
              >
                <span className="cta-explore__label">{t('hero.explore')}</span>
                <span className="cta-explore__sub">
                  {t(
                    block.hasPromotions
                      ? 'hero.explore.withPromotions'
                      : 'hero.explore.withoutPromotions',
                  )}
                </span>
              </a>
              <a className="button button--tickets" href="#tickets" data-tickets-open="hero">
                {t('hero.tickets')}
              </a>
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
            />
          </div>
        </section>
      );

    case 'upcoming_events':
      return (
        <section
          id="eventos"
          className="section section--alt"
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
            </p>
          </div>
        </section>
      );

    case 'philosophy':
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
            <ul className="link-list">
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
            <p className="site-footer__brand">
              <BrandLogo size="footer" label={t('site.title')} />
            </p>
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
                  {block.officialLinks.map((l) => (
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
