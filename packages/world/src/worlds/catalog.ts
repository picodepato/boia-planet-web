import { ACUARELA_SKIN } from './acuarela';
import { ARCILLA_MAP, ARCILLA_SKIN, ARCILLA_WORLD_ID } from './arcilla';
import { WorldRegistry } from './registry';

/**
 * Los mundos que se juegan hoy, sobre el mapa compartido de T20 (sacado de
 * `mundos/arcilla/mapa.json`): Arcilla (B05, el por defecto) y Acuarela
 * (B02, T24). Los dos tienen piel para cada lugar; el orden es el del
 * selector «Mundos» del menú y del Admin. El mundo de muestra de plan 001
 * (`SAMPLE_MAP`) sigue en `sample-world.ts` para las pruebas y la entrada
 * (hasta T28).
 */
export const WORLD_REGISTRY = new WorldRegistry(
  ARCILLA_MAP,
  [ARCILLA_SKIN, ACUARELA_SKIN],
  ARCILLA_WORLD_ID,
  // Acuarela (mundo 2) sigue en código y datos para una actualización futura,
  // pero nadie puede alcanzarla (Hernán, 2026-10-04): un mundo, Arcilla.
  [ACUARELA_SKIN.id],
);
