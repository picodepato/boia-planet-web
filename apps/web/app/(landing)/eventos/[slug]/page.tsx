import type { Metadata } from 'next';
import '../../components/paginas.css';
import Link from 'next/link';
import { t } from '../../../../lib/i18n';
import { EVENTOS_COPY } from '../../../../lib/landing/eventos-copy';
import { ogEventImage, publicPage } from '../../../../lib/seo';
import { eventHref, eventPageView, publicEventSlugs } from '../../../../lib/landing/eventos';
import { SAMPLE_ALBUM_CONTENT, SAMPLE_CONTENT } from '../../../../lib/landing/sample-content';
import { BrandLogo } from '../../components/brand-logo';
import { LiveEvent } from '../../components/live-event';

/**
 * Ficha compartible de un evento (REQ-COM-012, REQ-ENT-036), sin motor: se
 * abre directa, sin la entrada (REQ-ENT-011), y funciona sin JavaScript. El
 * servidor la pinta con la muestra; el estado sale de las fechas en el
 * momento de pintar (REQ-COM-004), así que se vuelve a generar cada pocos
 * minutos. Los eventos que sólo existen en el Admin de este navegador (D-20)
 * se pintan en el cliente (`LiveEvent`).
 */

export const revalidate = 300;
export const dynamicParams = true;

export function generateStaticParams() {
  return publicEventSlugs(SAMPLE_CONTENT.events).map((slug) => ({ slug }));
}

type Props = { params: Promise<{ slug: string }> };

const sampleView = (slug: string) =>
  eventPageView({ ...SAMPLE_CONTENT, albums: SAMPLE_ALBUM_CONTENT }, slug, new Date());

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = decodeURIComponent((await params).slug);
  const view = sampleView(slug);
  if (!view) return {};
  return {
    title: view.event.name,
    ...publicPage(
      eventHref(slug),
      view.event.description || `${view.kicker} · ${view.event.placeLabel}`,
      {
        title: `${view.event.name} · ${t('site.title')}`,
        // Su imagen para compartir (T286): nombre y fecha sobre el planeta.
        image: ogEventImage(slug),
        imageAlt: t('seo.ogEventAlt', { name: view.event.name, date: view.kicker }),
      },
    ),
  };
}

export default async function EventPage({ params }: Props) {
  const slug = decodeURIComponent((await params).slug);
  return (
    <main id="contenido" className="section event-page-wrap" aria-labelledby="evento-title">
      <div className="section__inner">
        <nav className="page-nav" aria-label={t('nav.label')}>
          <Link href="/" className="page-nav__brand" aria-label={t('nav.home')} prefetch={false}>
            <BrandLogo />
          </Link>
          <Link href="/" prefetch={false}>
            {EVENTOS_COPY.back}
          </Link>
          {/* Carga completa: el panel de Tickets es un ancla de la landing. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/#tickets">{EVENTOS_COPY.allTickets}</a>
        </nav>
        <LiveEvent slug={slug} initial={sampleView(slug)} />
      </div>
    </main>
  );
}
