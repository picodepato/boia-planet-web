import type { QualityTier } from '@boia/engine/streaming';

/**
 * Carga por sectores en /juego (T47). Los atlas por sector los escribe
 * `tools/atlas/build.ts` en `public/atlas/` antes de `next dev` y
 * `next build`; sin ellos el motor usa los PNG de `/api/art`.
 */
export const ATLAS_URL = '/atlas/index.json';

/** `?calidad=baja|alta` fuerza la calidad del arte; sin él, la decide el dispositivo. */
export const QUALITY_PARAM = 'calidad';

/** ms que un viaje en turbo espera como mucho al arte de su primer tramo. muestra */
export const VOYAGE_WAIT_MS = 1000;

export function requestedQuality(search: string): QualityTier | null {
  const q = new URLSearchParams(search).get(QUALITY_PARAM);
  return q === 'baja' || q === 'alta' ? q : null;
}
