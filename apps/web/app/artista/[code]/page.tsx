import type { Metadata } from 'next';
import { t } from '../../../lib/i18n';
import { NOINDEX } from '../../../lib/seo';
import { ArtistLinkLanding } from './artist-link-landing';

export const metadata: Metadata = {
  title: t('seo.carnetTitle'),
  description: t('seo.private'),
  robots: NOINDEX, // El enlace lleva un código de artista.
};

/** El enlace de artistas (plan 016 T186): recuerda el código y abre el alta del Carnet. */
export default async function EnlaceArtistaPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <ArtistLinkLanding code={code} />;
}
