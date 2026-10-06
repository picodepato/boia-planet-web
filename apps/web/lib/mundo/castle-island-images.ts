import type { DefenseTowerKind } from '@boia/engine/defense';

/**
 * Las imágenes de las islas de «Construir» (plan 015 T172, decisión 13): una
 * foto de frente del modelo que construye el castillo, mismo encuadre y luz
 * para todas, fondo transparente. Archivo generado por
 * `tools/islas-construir/render.ts`; no se edita a mano:
 *
 *   node --experimental-transform-types --no-warnings --import ./packages/world/scripts/ts-resolve.mjs tools/islas-construir/render.ts
 */

export interface CastleIslandImage {
  /** Ruta pública de la imagen 1× (webp, fondo transparente). */
  src: string;
  /** La misma a doble tamaño (pantallas densas). */
  src2x: string;
}

/** Lado en px de la imagen 1× (cuadrada); la 2× mide el doble. */
export const CASTLE_ISLAND_IMAGE_SIZE = 96;

export const CASTLE_ISLAND_IMAGES: Record<DefenseTowerKind, CastleIslandImage> = {
  faro: {
    src: '/castillo/islas/faro.webp',
    src2x: '/castillo/islas/faro@2x.webp',
  },
  ultima: {
    src: '/castillo/islas/ultima.webp',
    src2x: '/castillo/islas/ultima@2x.webp',
  },
  halloween: {
    src: '/castillo/islas/halloween.webp',
    src2x: '/castillo/islas/halloween@2x.webp',
  },
  cala: {
    src: '/castillo/islas/cala.webp',
    src2x: '/castillo/islas/cala@2x.webp',
  },
  tienda: {
    src: '/castillo/islas/tienda.webp',
    src2x: '/castillo/islas/tienda@2x.webp',
  },
  allday: {
    src: '/castillo/islas/allday.webp',
    src2x: '/castillo/islas/allday@2x.webp',
  },
  fotos: {
    src: '/castillo/islas/fotos.webp',
    src2x: '/castillo/islas/fotos@2x.webp',
  },
};
