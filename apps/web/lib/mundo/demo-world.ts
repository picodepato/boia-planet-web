import { WORLD_REGISTRY, type WorldRegistry } from '@boia/world';

/**
 * Mundos del juego (T17): un mapa compartido y una skin por mundo, de
 * `@boia/world`. Desde T20 el mapa es el de `mundos/arcilla/mapa.json` y el
 * mundo por defecto, Arcilla; desde T24, también Acuarela. El mar elige el
 * suyo con `world-choice.ts`.
 * Cuando exista el editor vendrán de la revisión publicada.
 */
export const worlds: WorldRegistry = WORLD_REGISTRY;
