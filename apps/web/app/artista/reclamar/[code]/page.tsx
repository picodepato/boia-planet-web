import type { Metadata } from 'next';
import { t } from '../../../../lib/i18n';
import { NOINDEX } from '../../../../lib/seo';
import { ArtistClaimLanding } from './artist-claim-landing';

export const metadata: Metadata = {
  title: t('seo.carnetTitle'),
  description: t('seo.private'),
  robots: NOINDEX, // El enlace lleva un código personal.
};

/**
 * El enlace personal para reclamar una ficha de artista (plan 031 T296):
 * «Reclama tu perfil de <nombre> en BOIA» y el alta del Carnet (o entrar).
 */
export default async function ReclamarPerfilPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <ArtistClaimLanding code={code} />;
}
