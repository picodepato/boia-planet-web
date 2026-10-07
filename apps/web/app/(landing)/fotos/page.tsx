import { worlds } from '../../../lib/mundo/demo-world';
import type { Metadata } from 'next';
import '../components/paginas.css';
import Link from 'next/link';
import { eventIslands } from '../../../lib/admin/world';
import { t } from '../../../lib/i18n';
import { FOTOS_COPY } from '../../../lib/landing/eventos-copy';
import { type GalleryIsland, photoGalleries } from '../../../lib/landing/eventos';
import { SAMPLE_ALBUM_CONTENT, SAMPLE_CONTENT } from '../../../lib/landing/sample-content';
import { BrandLogo } from '../components/brand-logo';
import { LivePhotoGalleries } from '../components/photo-galleries';

/**
 * «Fotos y eventos» (REQ-COM-031, D-23 punto 7): todas las fotos, una galería
 * por isla o evento con su ancla. Se llega desde «Ver todas» de la home y
 * desde «Ver fotos de la isla» de cada isla (`/fotos#<isla>`). HTML sin motor:
 * se abre directa, sin la entrada (REQ-ENT-011), y funciona sin JavaScript.
 */

export const metadata: Metadata = {
  title: `${FOTOS_COPY.pageTitle} · ${t('site.title')}`,
  description: FOTOS_COPY.pageLead,
};

/** Las islas de evento del mapa compartido, con su nombre en el mundo por defecto. */
function galleryIslands(): GalleryIsland[] {
  const places = worlds.get(worlds.defaultId).places;
  return eventIslands(worlds.map).map((p) => ({
    id: p.id,
    name: places.find((x) => x.id === p.id)?.name ?? p.id,
  }));
}

export default function PhotosPage() {
  const islands = galleryIslands();
  const initial = photoGalleries(
    { events: SAMPLE_CONTENT.events, albums: SAMPLE_ALBUM_CONTENT, photos: SAMPLE_CONTENT.photos },
    islands,
  );
  return (
    <main id="contenido" className="section photos-page" aria-labelledby="fotos-title">
      <div className="section__inner">
        <nav className="page-nav" aria-label={t('nav.label')}>
          <Link href="/" className="page-nav__brand" aria-label={t('nav.home')} prefetch={false}>
            <BrandLogo />
          </Link>
          <Link href="/" prefetch={false}>
            {FOTOS_COPY.back}
          </Link>
        </nav>
        <h1 id="fotos-title" className="section__title">
          {FOTOS_COPY.pageTitle}
        </h1>
        <p className="section__lead">{FOTOS_COPY.pageLead}</p>
        <LivePhotoGalleries initial={initial} islands={islands} />
        <p className="site-footer__small">{t('site.sampleNotice')}</p>
      </div>
    </main>
  );
}
