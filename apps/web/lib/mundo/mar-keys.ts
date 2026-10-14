/**
 * Claves de /mar en el almacenamiento del dispositivo, fuera de `mar-client.tsx`
 * para que «Cerrar sesión» (T284) y sus pruebas las conozcan sin cargar el mar.
 */

/** El momento del día elegido en el menú (día, tarde o noche): preferencia del dispositivo. */
export const MOOD_STORAGE_KEY = 'boia:mar3d:momento';

/** El último día cuyo horóscopo boiero se enseñó en el Puerto (T272): del juego. */
export const HOROSCOPO_STORAGE_KEY = 'boia.horoscopo.dia';
