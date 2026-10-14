import type { Metadata } from 'next';

/**
 * Host público canónico (plan 030 T285). Vercel sirve la misma construcción,
 * así que toda página apunta aquí para no duplicar contenido.
 */
export const SITE_URL = 'https://boiaplanet.net';

/** Canónica de una ruta (absoluta, sobre el host público). */
export const canonicalOf = (path: string): string => new URL(path, SITE_URL).toString();

/** Para páginas que nunca deben indexarse (Admin, enlaces privados, sellos). */
export const NOINDEX: Metadata['robots'] = { index: false, follow: false };

/** Metadatos de una página pública: canónica relativa (la resuelve `metadataBase`). */
export const publicPage = (
  path: string,
  description: string,
): Pick<Metadata, 'description' | 'alternates'> => ({
  description,
  alternates: { canonical: path },
});
