import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { SITE_URL } from '../lib/seo';
import { t } from '../lib/i18n';
import { fuentesClassName } from '../lib/fonts';
import { PWA_THEME_COLOR } from '../lib/pwa/theme';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: t('seo.homeTitle'), template: `%s · ${t('site.title')}` },
  description: t('site.description'),
  // App instalable (plan 027 T264): el manifiesto lo enlaza Next desde
  // app/manifest.ts; esto es lo que lee Safari en iPhone («Añadir a pantalla
  // de inicio»), con el icono de app/apple-icon.png.
  applicationName: t('site.title'),
  appleWebApp: { capable: true, title: t('site.title'), statusBarStyle: 'black' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: PWA_THEME_COLOR,
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
