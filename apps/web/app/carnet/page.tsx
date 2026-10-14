import type { Metadata } from 'next';
import { AccountGate } from '../../lib/account/sign-in-sheet';
import { t } from '../../lib/i18n';
import { NOINDEX } from '../../lib/seo';
import { CarnetPage } from './carnet-page';

export const metadata: Metadata = {
  title: t('seo.carnetTitle'),
  description: t('seo.carnet'),
  robots: NOINDEX, // Mi Carnet: el de este navegador, privado.
};

/** Mi Carnet para compartir (el de este navegador). */
export default function MiCarnetPage() {
  return (
    <>
      <CarnetPage userId={null} />
      <AccountGate />
    </>
  );
}
