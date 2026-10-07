/**
 * El tema BOIA de la presentación (plan 018, decisión 7): los colores de la
 * web (`apps/web/app/globals.css`), fuentes seguras de Windows y Mac y las
 * medidas de la diapositiva 16:9 ancha (13,333 × 7,5 pulgadas).
 */

/** Colores en hex sin «#» (pptxgenjs se corrompe con «#» o con alfa). */
export const COLOR = {
  naranja: 'EC4F24',
  naranjaVivo: 'FF5219',
  navy: '12233F',
  azul: '36278A',
  violeta: 'B9A6FF',
  negro: '05080F',
  banda: '07101F',
  marProfundo: '0B1830',
  tarjeta: '1A3052',
  linea: '2F4A72',
  tintaSuave: 'C9D4E6',
  blanco: 'FFFFFF',
} as const;

/** Títulos anchos y pesados; texto llano. Las dos vienen con Windows, Mac y Office. */
export const FUENTE = {
  titulo: 'Arial Black',
  texto: 'Arial',
} as const;

/** Tamaños en puntos. Nunca por debajo de 14 (texto) ni de 10 (pies). */
export const PT = {
  portada: 40,
  numeroParte: 120,
  tituloParte: 44,
  titulo: 28,
  subtitulo: 18,
  texto: 16,
  lista: 15,
  tabla: 13,
  pie: 12,
  etiqueta: 11,
  kicker: 11,
} as const;

/** La diapositiva (LAYOUT_WIDE) y sus márgenes, en pulgadas. */
export const LIENZO = { w: 13.333, h: 7.5, margen: 0.6 } as const;

/** Las dos etiquetas de «qué falta» (decisión 4). */
export const ETIQUETA = {
  necesario: 'Necesario para salir',
  'puede-esperar': 'Puede esperar',
} as const;
