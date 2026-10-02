import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { fuentesClassName } from '../lib/fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'boia-planet · demo',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#12233f',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // El script de arranque de la landing marca <html data-entry/data-intro>
    // antes de hidratar (entrada cinemática, T03).
    <html lang="es" className={fuentesClassName} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
