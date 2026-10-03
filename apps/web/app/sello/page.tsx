import type { Metadata } from 'next';
import { AccountGate } from '../../lib/account/sign-in-sheet';
import { t } from '../../lib/i18n';
import { SelloPage } from './sello-page';

export const metadata: Metadata = {
  title: t('sello.metaTitle'),
  // El enlace lleva el código de la fiesta: que no lo indexe nadie.
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

/**
 * Lo que abre la cámara del móvil al leer el QR de una fiesta (plan 008, T91,
 * decisión 9): `/sello?e=<fiesta>&c=<código>`.
 */
export default function Sello() {
  return (
    <>
      <SelloPage />
      <AccountGate />
    </>
  );
}
