import type { Metadata } from 'next';
import Link from 'next/link';
import { publicPage } from '../../../lib/seo';
import { t } from '../../../lib/i18n';
import { SAMPLE_CONTENT } from '../../../lib/landing/sample-content';
import { LiveArtists } from '../components/live-artists';

/**
 * Todos los artistas (v14 §18.1), de la A a la Z, con avatar neutro mientras
 * no haya foto aprobada (REQ-COM-027). Es una página estática: se enlaza
 * directamente (/artistas) y funciona sin JavaScript y sin WebGL. Como la
 * home, el servidor pinta la muestra y el navegador, el repositorio con los
 * cambios del Admin de la demo (T26).
 */

export const metadata: Metadata = {
  title: t('artists.page.title'),
  ...publicPage('/artistas', t('artists.intro')),
};

export default function ArtistsPage() {
  return (
    <main id="contenido" className="section artists-page" aria-labelledby="artistas-title">
      <div className="section__inner">
        <p>
          <Link href="/#artistas">{t('artists.page.back')}</Link>
        </p>
        <LiveArtists initial={SAMPLE_CONTENT.artists} />
      </div>
    </main>
  );
}
