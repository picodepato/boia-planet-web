import type { Metadata } from 'next';
import { AccountGate } from '../../lib/account/sign-in-sheet';
import { CarnetPage } from './carnet-page';

export const metadata: Metadata = { title: 'Mi Carnet BOIA · boia-planet' };

/** Mi Carnet para compartir (el de este navegador). */
export default function MiCarnetPage() {
  return (
    <>
      <CarnetPage userId={null} />
      <AccountGate />
    </>
  );
}
