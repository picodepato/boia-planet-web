/**
 * Entrada de la landing (v14 §4.4; D-19, D-21; REQ-ENT-*). Este punto de
 * entrada es puro (sin three.js, Pixi ni `@boia/world`) y puede ir en la ruta
 * crítica de la landing: la puerta y el script de arranque (`entry`), la
 * configuración y la línea de tiempo de la entrada 3D con el planeta
 * (`planet`, T57), su máquina de estados (`controller`) y el título 3D
 * (`title`). La escena three.js vive en la web y se carga bajo demanda.
 *
 * `config`, `assets`, `sphere` y `port` son de la entrada 2D «mini-mundo»
 * anterior (T14–T28): sólo los usan la sonda de la esfera y los datos de
 * entrada de cada mundo, y se van con el mundo 2D (T62).
 */
export * from './config';
export * from './assets';
export * from './math';
export * from './sphere';
export * from './planet';
export * from './title';
export * from './entry';
export * from './controller';
export * from './port';
