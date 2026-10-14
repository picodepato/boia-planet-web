import type { MetadataRoute } from 'next';
import { eventHref, publicEventSlugs } from '../lib/landing/eventos';
import { SAMPLE_CONTENT } from '../lib/landing/sample-content';
import { LEGAL_DOCS } from '../lib/legal/docs';
import { canonicalOf } from '../lib/seo';

export const dynamic = 'force-static';

/** Rutas públicas fijas; las fichas de evento y las legales salen de sus fuentes. */
export const PUBLIC_PATHS = ['/', '/mar', '/galeria', '/artistas', '/tienda', '/ranking'];

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    ...PUBLIC_PATHS,
    ...publicEventSlugs(SAMPLE_CONTENT.events).map(eventHref),
    ...Object.keys(LEGAL_DOCS).map((d) => `/legal/${d}`),
  ];
  return paths.map((p) => ({ url: canonicalOf(p) }));
}
