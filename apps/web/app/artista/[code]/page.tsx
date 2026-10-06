import type { Metadata } from 'next';
import { ArtistLinkLanding } from './artist-link-landing';

export const metadata: Metadata = { title: 'Carnet de artista · boia-planet' };

/** El enlace de artistas (plan 016 T186): recuerda el código y abre el alta del Carnet. */
export default async function EnlaceArtistaPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <ArtistLinkLanding code={code} />;
}
