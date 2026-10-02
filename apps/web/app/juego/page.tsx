import type { Metadata, Viewport } from 'next';
import { loadShipCatalog } from '../../lib/barco/load';
import { GameCanvas } from './game-canvas';
import { t } from '../../lib/i18n';

export const metadata: Metadata = { title: t('juego.juego.boiaPlanetJuego') };

// Sólo aquí se bloquea el zoom: en el juego un pellizco es un segundo dedo.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#12233f',
};

export default function JuegoPage() {
  // Estilos y skins del barco para la sección «Barco»: se leen de art/ y docs/barcos al construir.
  return <GameCanvas shipCatalog={loadShipCatalog()} />;
}
