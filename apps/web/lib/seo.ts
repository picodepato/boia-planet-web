import type { Metadata } from 'next';
import { t } from './i18n';

/**
 * Host público canónico (plan 030 T285). Vercel sirve la misma construcción,
 * así que toda página apunta aquí para no duplicar contenido.
 */
export const SITE_URL = 'https://boiaplanet.net';

/** Canónica de una ruta (absoluta, sobre el host público). */
export const canonicalOf = (path: string): string => new URL(path, SITE_URL).toString();

/** Para páginas que nunca deben indexarse (Admin, enlaces privados, sellos). */
export const NOINDEX: Metadata['robots'] = { index: false, follow: false };

/**
 * Imágenes para compartir (plan 030 T286): archivos estáticos de `public/og/`
 * que deja `scripts/og-images.mjs` en el build. 1200 × 630.
 */
export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_SITE_IMAGE = '/og/planeta.png';
/** La imagen de un evento público (una por evento, de su nombre y su fecha). */
export const ogEventImage = (slug: string): string => `/og/eventos/${slug}.png`;

export interface ShareOptions {
  /** Título al compartir (por defecto, el de la página según el buscador). */
  title?: string;
  /** Ruta de la imagen en `public/` (por defecto, la del planeta). */
  image?: string;
  /** Texto alternativo de la imagen. */
  imageAlt?: string;
}

/**
 * `og:*` y `twitter:*` de una página: imagen grande, nombre del sitio y
 * `es_ES` (sin `path`, los de por defecto del layout). Las rutas son relativas; `metadataBase` (app/layout.tsx) las hace
 * absolutas sobre boiaplanet.net.
 */
export function sharing(
  path: string | undefined,
  description: string | undefined,
  { title, image = OG_SITE_IMAGE, imageAlt = t('seo.ogAlt') }: ShareOptions = {},
): Pick<Metadata, 'openGraph' | 'twitter'> {
  const images = [{ url: image, ...OG_SIZE, alt: imageAlt }];
  return {
    openGraph: {
      type: 'website',
      siteName: t('site.title'),
      locale: 'es_ES',
      ...(path ? { url: path } : {}),
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      images,
    },
    twitter: {
      card: 'summary_large_image',
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      images,
    },
  };
}

/** Metadatos de una página pública: canónica relativa (la resuelve `metadataBase`) y lo de compartir. */
export const publicPage = (
  path: string,
  description: string,
  share: ShareOptions = {},
): Pick<Metadata, 'description' | 'alternates' | 'openGraph' | 'twitter'> => ({
  description,
  alternates: { canonical: path },
  ...sharing(path, description, share),
});
