import type { MetadataRoute } from 'next';
import { t } from '../lib/i18n';
import { PWA_THEME_COLOR } from '../lib/pwa/theme';

/**
 * Manifiesto de la app instalable (plan 027 T264): `/manifest.webmanifest`,
 * estático (se genera al construir, igual en Vercel y en Cloudflare). Colores
 * de marca de `globals.css`: el azul noche del mar (`--boia-navy`, el mismo
 * `themeColor` del layout) de fondo y barra. Iconos: `public/icons/`, sacados
 * del logo por `scripts/pwa-icons.mjs`.
 */
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: t('site.title'),
    short_name: t('pwa.shortName'),
    description: t('site.description'),
    lang: 'es',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: PWA_THEME_COLOR,
    theme_color: PWA_THEME_COLOR,
    categories: ['music', 'entertainment', 'events'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
