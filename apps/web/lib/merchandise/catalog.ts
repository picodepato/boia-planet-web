/** Concept photos only. No stock, price or online purchase is implied. */
export const MERCHANDISE_PATH = '/tienda';
export const MERCHANDISE_NOTICE = 'Solo se vende en mano en la fiesta';
export const MERCHANDISE_SAMPLE_NOTICE =
  'Fotos y diseños de muestra. Los productos finales pueden cambiar.';
export const MERCHANDISE_PRODUCTS = [
  {
    id: 'camiseta',
    name: 'Camisetas',
    image: '/contenido/tienda/camiseta-muestra.webp',
    alt: 'Diseño de muestra: camiseta blanca con BOIA y su mascota',
    description: 'Para llevar un poco de BOIA contigo.',
  },
  {
    id: 'tote',
    name: 'Tote bags',
    image: '/contenido/tienda/tote-muestra.webp',
    alt: 'Diseño de muestra: tote bag de algodón con el logo BOIA',
    description: 'Para lo que te llevas de la fiesta.',
  },
  {
    id: 'pegatinas',
    name: 'Packs de pegatinas',
    image: '/contenido/tienda/pegatinas-muestra.webp',
    alt: 'Diseños de muestra: pegatinas del logo y la mascota BOIA',
    description: 'La boia también viaja fuera del mar.',
  },
] as const;
