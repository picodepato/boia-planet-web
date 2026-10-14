/**
 * «Sácate el Carnet» de la landing (plan 030 T288), después de los próximos
 * eventos. Van en su propio archivo, como `es-pwa.ts`: el bloque es un trozo
 * perezoso (`carnet-invite.tsx`) y sus textos no entran en la ruta crítica de
 * la landing (presupuesto de 200 KB). También entran en el catálogo entero
 * (`es.ts`) y el Admin los deja cambiar en «Textos y música»
 * (`CARNET_BLOCK_KEYS`). Todo `muestra` hasta que Álvaro lo apruebe.
 */
export const esCarnetBloque = {
  'carnetBlock.heading': 'Sácate el Carnet',
  'carnetBlock.lead':
    'Sin Carnet BOIA no se entra en una fiesta BOIA: sácatelo antes de comprar tu entrada. Es gratis.',
  // Con cuentas: las noticias que se aceptan al crear el Carnet (también en el aviso de la compra).
  'carnetBlock.news.accounts':
    'Si lo aceptas al crearlo, te avisamos por email de las próximas fiestas.',
  // Modo local (D-20): sin email, las noticias van por el WhatsApp.
  'carnetBlock.news.local': 'Las próximas fiestas se anuncian antes en el WhatsApp de BOIA.',
  'carnetBlock.perks': 'Con tu Carnet',
  'carnetBlock.perk.stamps': 'Un sello por cada fiesta.',
  'carnetBlock.perk.discounts': 'Descuentos escondidos en el mar.',
  'carnetBlock.cta': 'Sacarme el Carnet',
} as const;

export type CarnetBlockKey = keyof typeof esCarnetBloque;

/** Las claves que el Admin deja cambiar junto a las de la landing. */
export const CARNET_BLOCK_KEYS = Object.keys(esCarnetBloque) as CarnetBlockKey[];
