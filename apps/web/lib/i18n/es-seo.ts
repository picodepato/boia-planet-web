/**
 * Títulos y descripciones para buscadores (plan 030 T285). Sólo los leen los
 * metadatos del servidor, así que van fuera de `es-web.ts` (lo que viaja al
 * navegador en la landing) y entran sólo en el catálogo entero (`es.ts`).
 * Todo `muestra` hasta que Álvaro lo apruebe.
 */
export const esSeo = {
  'seo.homeTitle': 'BOIA.PLANET — música underground de Alicante, entradas y un planeta en barco',
  'seo.mar':
    'Navega en barco por el planeta de BOIA: islas de eventos, descuentos escondidos y tu Carnet BOIA.',
  'seo.marTitle': 'Mar 3D',
  'seo.ranking':
    'Los rankings de BOIA: quién navega más, quién responde mejor y quién suma más Carnet.',
  'seo.rankingTitle': 'Ranking',
  'seo.carnet': 'El Carnet BOIA: tu pasaporte para las fiestas y el planeta de BOIA.',
  'seo.carnetTitle': 'Carnet BOIA',
  'seo.legal': 'Información legal de BOIA.PLANET.',
  'seo.private': 'Página privada de BOIA.PLANET.',
} as const;
