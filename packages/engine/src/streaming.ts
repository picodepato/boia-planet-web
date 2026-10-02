/**
 * Carga por sectores sin Pixi ni DOM (T47): se importa como
 * `@boia/engine/streaming` desde las herramientas de Node (atlas por sector,
 * presupuesto de bytes antes de jugar) y desde las pruebas.
 */
export * from './world/sectors';
export * from './world/art-plan';
export * from './world/atlas-index';
export * from './world/atlas-pack';
