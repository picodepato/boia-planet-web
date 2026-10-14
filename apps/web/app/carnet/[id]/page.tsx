import type { Metadata } from 'next';
import { t } from '../../../lib/i18n';
import { NOINDEX } from '../../../lib/seo';
import { CarnetPage } from '../carnet-page';

/**
 * Sin indexar (plan 030 T285): con cuentas, cada Carnet enseña el apodo y la
 * foto de una persona real. Tampoco entra en el sitemap; robots.txt no lo
 * bloquea, para que los buscadores puedan leer este `noindex`.
 */
export const metadata: Metadata = {
  title: t('seo.carnetTitle'),
  description: t('seo.carnet'),
  robots: NOINDEX,
};

/** El Carnet de un miembro por su id (desde su botella o un enlace compartido). */
export default async function CarnetDeMiembroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let userId = id;
  try {
    userId = decodeURIComponent(id);
  } catch {
    // ya venía decodificado
  }
  return <CarnetPage userId={userId} />;
}
