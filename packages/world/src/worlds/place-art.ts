import type { CoastArt } from '../schema';

/**
 * El arte de cada lugar del mapa compartido en un mundo (T20, T24). Todos
 * los mundos dan las mismas piezas con los mismos ids (el catálogo de
 * `tools/blender/lugares.json`, T18/T19) en `art/mundos/<mundo>/<lugar>/`,
 * así que la correspondencia lugar del mapa → pieza de arte es una sola y
 * sólo cambia la carpeta del mundo.
 */

/** Ref de una pieza de lugar: `mundos/<mundo>/<lugar>#<pieza>[@variante]`. */
export function placePart(worldId: string, place: string, part = place, variant?: string): string {
  return `mundos/${worldId}/${place}#${part}${variant ? `@${variant}` : ''}`;
}

/** Lugares del mapa con su pieza (lugar, pieza, variante); los que siguen un patrón, abajo. */
const PARTS: Record<string, [string, string?, string?]> = {
  puerto: ['puerto'],
  'puerto-anillo': ['puerto', 'anillo'],
  'puerto-escollera_oeste': ['puerto', 'escollera_oeste'],
  'puerto-escollera_este': ['puerto', 'escollera_este'],
  'puerto-baliza_verde': ['puerto', 'baliza_verde'],
  'puerto-baliza_roja': ['puerto', 'baliza_roja'],
  // Las boias son la mascota de BOIA (T39, D-23): la primera, la de WhatsApp y las informativas.
  'puerto-boia': ['boias', 'primera'],
  'puerto-whatsapp': ['boias', 'whatsapp'],
  'boia-espacio': ['boias', 'info_1'],
  'boia-descubrir': ['boias', 'info_2'],
  'boia-pertenecer': ['boias', 'info_3'],
  'boia-allday': ['boias', 'info_4'],
  'boia-secretos': ['boias', 'info_5'],
  cala: ['cala'],
  allday: ['allday', 'allday', 'venta'],
  fotos: ['fotos'],
  tienda: ['tienda'],
  ultima: ['ultima'],
  faro: ['faro'],
  canon: ['canon'],
  fiestera: ['fiestera'],
  'fiestera-posidonia': ['fiestera', 'posidonia'],
  naufrago: ['naufrago'],
  delfin: ['delfin'],
  remolino: ['remolino'],
  circuito: ['circuito', 'salida'],
  'circuito-cp1': ['circuito', 'cp1'],
  'circuito-cp-s': ['circuito', 'cp-s'],
  'circuito-cp-a': ['circuito', 'cp-a'],
  'circuito-cp2': ['circuito', 'cp2'],
  'circuito-meta': ['circuito', 'meta'],
  'circuito-semaforo': ['circuito', 'semaforo'],
  'circuito-cartel': ['circuito', 'cartel'],
  'circuito-dents': ['circuito', 'dents'],
  'circuito-freu': ['circuito', 'freu'],
  'circuito-roca': ['circuito', 'roca'],
  'circuito-medusa': ['circuito', 'medusa'],
  'circuito-cocodrilo': ['circuito', 'cocodrilo', 'derecha'],
};

const RESTOS_VARIANTS = ['a', 'b', 'c'];

/**
 * El asset de un lugar del mapa (`id`, en la posición `i` del mapa) en un
 * mundo. Los secretos llevan todos el mismo marcador brillante de T39
 * (`secreto#secreto`). Un id que nadie conoce es un error: un lugar nuevo del
 * mapa tiene que decir aquí qué pieza lo dibuja.
 */
export function sharedPlaceAsset(worldId: string, id: string, i: number): string {
  const art = (place: string, part?: string, variant?: string) =>
    placePart(worldId, place, part, variant);
  const fixed = PARTS[id];
  if (fixed) return art(...fixed);
  let m = /^fiestera-(cocodrilo|roca)_(\d)$/.exec(id);
  if (m) return art('fiestera', `${m[1]}_${m[2]}`);
  m = /^restos-(\d+)$/.exec(id);
  if (m) return art('restos', 'restos', RESTOS_VARIANTS[Number(m[1]) % RESTOS_VARIANTS.length]);
  if (id.startsWith('cofre-')) return art('cofres', 'cofre');
  if (id.startsWith('circuito-carril-')) return art('circuito', 'boia_carril', i % 2 ? 'b' : 'a');
  if (id.startsWith('secreto-')) return art('secreto', 'secreto');
  throw new Error(`${worldId}: lugar sin arte asignado: ${id}`);
}

/** Las losas y esquinas de costa de un mundo (T18/T19: las mismas piezas en cada mundo). */
export function sharedCoastArt(worldId: string): CoastArt {
  return {
    west: placePart(worldId, 'costa_oeste'),
    east: placePart(worldId, 'costa_este'),
    south: placePart(worldId, 'costa_sur'),
    cornerWest: placePart(worldId, 'costa_sur', 'esquina_oeste'),
    cornerEast: placePart(worldId, 'costa_sur', 'esquina_este'),
  };
}
