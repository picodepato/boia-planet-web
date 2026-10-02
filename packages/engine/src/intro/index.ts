/**
 * Entrada de la landing (v14 §4.4; D-19, D-21, D-24; REQ-ENT-*). Este punto de
 * entrada es puro (sin three.js ni `@boia/world`) y puede ir en la ruta
 * crítica de la landing: la puerta y el script de arranque (`entry`), las
 * piezas comunes (`config`: curvas, textos y movimiento del título), la
 * configuración y la línea de tiempo de la entrada 3D con el planeta
 * (`planet`, T57), su máquina de estados (`controller`) y el título 3D
 * (`title`). La escena three.js vive en la web y se carga bajo demanda.
 */
export * from './config';
export * from './math';
export * from './planet';
export * from './title';
export * from './entry';
export * from './controller';
