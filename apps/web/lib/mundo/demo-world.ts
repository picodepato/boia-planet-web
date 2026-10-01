import {
  SAMPLE_WORLD,
  WORLD_REGISTRY,
  type WorldConfig,
  type WorldRegistry,
  parseWorldConfig,
} from '@boia/world';

/**
 * Mundos del juego (T17): un mapa compartido y una skin por mundo, de
 * `@boia/world`. Desde T20 el mapa es el de `mundos/arcilla/mapa.json` y el
 * mundo por defecto, Arcilla; desde T24, también Acuarela.
 * Cuando exista el editor vendrán de la revisión publicada.
 */
export const worlds: WorldRegistry = WORLD_REGISTRY;

/**
 * El mundo de muestra de plan 001, pequeño: lo usan la sonda de la esfera
 * (`/sphere-probe`) y algunas pruebas. La entrada juega desde T28 el mundo
 * activo (`lib/intro/active.ts`) y `/juego` elige el suyo con `world-choice.ts`.
 */
export const demoWorld: WorldConfig = parseWorldConfig(SAMPLE_WORLD);
