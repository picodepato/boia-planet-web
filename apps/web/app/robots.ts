import type { MetadataRoute } from 'next';
import { canonicalOf } from '../lib/seo';

export const dynamic = 'force-static';

/** Rutas que ningún buscador debe rastrear: Admin, API y enlaces privados. */
export const PRIVATE_PATHS = ['/admin', '/api', '/sello', '/artista/'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: PRIVATE_PATHS }],
    sitemap: canonicalOf('/sitemap.xml'),
  };
}
