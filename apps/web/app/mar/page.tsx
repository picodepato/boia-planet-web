import type { Metadata, Viewport } from 'next';
import { loadShipCatalog } from '../../lib/barco/load';
import { MarClient } from './mar-client';
import { t } from '../../lib/i18n';

export const metadata: Metadata = { title: t('mar.mar.boiaPlanetMar3d') };

// Como en el 2D: en el mar un pellizco es el zoom de la cámara, no el de la página.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#231a5c',
};

export default function MarPage() {
  // Miniaturas y nombres de los barcos para la tienda «Barco» (T40), leídos de art/ al construir.
  return <MarClient shipCatalog={loadShipCatalog()} />;
}
