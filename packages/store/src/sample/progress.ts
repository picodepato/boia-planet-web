import type { AreaInput } from '../schema';

/** El circuito de El Freu (id de `@boia/world`, CIRCUIT_ID). */
const FREU = 'el-freu';

/**
 * «Rayo del Freu»: 80 % de una vuelta limpia por la ruta segura con el barco
 * base (54,5 s medidos en T36 con el runtime del motor, `DEFAULT_SHIP_CONFIG`,
 * saliendo parado en «¡Ya!»). muestra
 */
export const FAST_LAP_MS = 43_600;

/**
 * Catálogo de logros de MUESTRA, el aprobado por Hernán el 2026-09-29
 * (docs/propuestas/logros-catalogo.md, D-22 punto 5; pendiente Álvaro, P14).
 * Cada logro da puntos; por defecto también monedas, y en su lugar una
 * insignia del Carnet (`badgeKey`), un barco de estilo (cosmético de la
 * ranura `ship`) o un cosmético del barco (`cosmeticKey`). El premio llega
 * al reclamarlo. Los ids son estables: el juego los completa por señal (T21,
 * T36) y el libro los guarda.
 */
export const SAMPLE_ACHIEVEMENTS: AreaInput<'achievements'>[] = [
  {
    id: 'primera-boia',
    title: 'Primera boia',
    description: 'Habla con tu primera boia.',
    trigger: 'find_buoy',
    triggerParams: { count: 1 },
    points: 10,
    coins: 5,
    sample: true,
  },
  {
    id: 'boies-3',
    title: 'Coro de boies',
    description: 'Habla con 3 boies distintas.',
    trigger: 'find_buoy',
    triggerParams: { count: 3 },
    points: 30,
    coins: 10,
    sample: true,
  },
  {
    // Las seis boies del mapa compartido: la primera y las cinco informativas (O12, T45).
    id: 'boies-6',
    title: 'Las seis boies',
    description: 'Habla con las 6 boies del mar.',
    trigger: 'find_buoy',
    triggerParams: { count: 6 },
    points: 60,
    coins: 20,
    sample: true,
  },
  {
    id: 'islas-3',
    title: 'Isla a isla',
    description: 'Descubre 3 islas.',
    trigger: 'visit_island',
    triggerParams: { count: 3 },
    points: 30,
    coins: 10,
    sample: true,
  },
  {
    id: 'islas-7',
    title: 'Cartógrafa',
    description: 'Descubre todas las islas del mapa.',
    trigger: 'visit_island',
    triggerParams: { count: 7 },
    points: 80,
    coins: 20,
    sample: true,
  },
  {
    id: 'fiestera-rescatada',
    title: 'Boia Fiestera rescatada',
    description: 'Saca a la Boia Fiestera de entre los cocodrilos.',
    trigger: 'rescue_character',
    triggerParams: { character: 'boia-fiestera' },
    points: 50,
    coins: 20,
    sample: true,
  },
  {
    id: 'fiestera-entregada',
    title: 'Hasta el amanecer',
    description: 'Lleva a la Boia Fiestera a la última isla.',
    trigger: 'deliver_character',
    triggerParams: { character: 'boia-fiestera' },
    points: 150,
    coins: 0,
    cosmeticKey: 'bandera-fiestera',
    sample: true,
  },
  {
    id: 'circuito',
    title: 'Por El Freu',
    description: 'Termina una vuelta al circuito.',
    trigger: 'complete_circuit',
    triggerParams: { circuit: FREU },
    points: 40,
    coins: 15,
    sample: true,
  },
  {
    id: 'circuito-atajo',
    title: '¿Atajo? Atajo.',
    description: 'Termina una vuelta por el atajo.',
    trigger: 'complete_circuit',
    triggerParams: { circuit: FREU, via: 'circuito-cp-a' },
    points: 40,
    coins: 0,
    cosmeticKey: 'bandera-cuadros',
    secret: true,
    sample: true,
  },
  {
    id: 'circuito-rapido',
    title: 'Rayo del Freu',
    description: 'Haz una vuelta en menos de 43,6 s.',
    trigger: 'complete_circuit',
    triggerParams: { circuit: FREU, maxMs: FAST_LAP_MS },
    points: 100,
    coins: 0,
    cosmeticKey: 'estela-rayo',
    sample: true,
  },
  {
    id: 'faro',
    title: 'Vigía del faro',
    description: 'Gana Vigilancia del faro.',
    trigger: 'win_minigame',
    triggerParams: { game: 'faro' },
    points: 40,
    coins: 15,
    sample: true,
  },
  {
    id: 'canon',
    title: 'Ni un tiburón',
    description: 'Gana Cañón contra tiburones.',
    trigger: 'win_minigame',
    triggerParams: { game: 'canon' },
    points: 40,
    coins: 15,
    sample: true,
  },
  {
    id: 'guardacostas',
    title: 'Guardacostas',
    description: 'Gana los dos minijuegos.',
    trigger: 'win_minigame',
    triggerParams: { count: 2 },
    points: 100,
    coins: 0,
    cosmeticKey: 'barco-cel-shaded',
    sample: true,
  },
  {
    id: 'secretos',
    title: 'Ojo de marinera',
    description: 'Encuentra los 4 secretos del mapa.',
    trigger: 'collect_objects',
    triggerParams: { category: 'secreto', count: 4 },
    points: 80,
    coins: 0,
    cosmeticKey: 'barco-boceto-lapiz',
    secret: true,
    sample: true,
  },
  {
    id: 'delfin',
    title: 'Amiga del delfín',
    description: 'Sigue al delfín hasta el final de sus saltos.',
    trigger: 'complete_encounter',
    triggerParams: { encounter: 'delfin' },
    points: 30,
    coins: 0,
    cosmeticKey: 'estela-burbujas',
    secret: true,
    sample: true,
  },
  {
    // Las botellas sólo están en /juego (D-22; catálogo, punto 5).
    id: 'botellas-3',
    title: 'Correo del mar',
    description: 'Lee 3 botellas.',
    trigger: 'read_bottle',
    triggerParams: { count: 3 },
    points: 20,
    coins: 10,
    sample: true,
  },
  {
    id: 'botella-propia',
    title: 'Mensaje al mar',
    description: 'Echa tu propia botella.',
    trigger: 'throw_bottle',
    triggerParams: { count: 1 },
    points: 10,
    coins: 5,
    sample: true,
  },
  {
    id: 'carnet',
    title: 'Con Carnet',
    description: 'Crea tu Carnet BOIA.',
    trigger: 'create_carnet',
    triggerParams: {},
    points: 20,
    coins: 10,
    sample: true,
  },
  {
    id: 'carnet-preguntas',
    title: 'Libro abierto',
    description: 'Responde las 5 preguntas del Carnet.',
    trigger: 'answer_question',
    triggerParams: { count: 5 },
    points: 40,
    coins: 20,
    sample: true,
  },
  {
    id: 'minutos-5',
    title: 'Cinco minutos a bordo',
    description: 'Navega 5 minutos.',
    trigger: 'time_played',
    triggerParams: { minutes: 5 },
    points: 10,
    coins: 5,
    sample: true,
  },
  {
    id: 'minutos-20',
    title: 'Veinte minutos a bordo',
    description: 'Navega 20 minutos.',
    trigger: 'time_played',
    triggerParams: { minutes: 20 },
    points: 30,
    coins: 10,
    sample: true,
  },
  {
    id: 'minutos-60',
    title: 'Lobo de mar',
    description: 'Navega una hora (en varias visitas).',
    trigger: 'time_played',
    triggerParams: { minutes: 60 },
    points: 100,
    coins: 0,
    cosmeticKey: 'barco-pixel-art',
    sample: true,
  },
  {
    id: 'entrada',
    title: 'Con entrada',
    description: 'Compra una entrada para un evento de BOIA.',
    trigger: 'buy_ticket',
    triggerParams: { count: 1 },
    points: 100,
    coins: 0,
    badgeKey: 'con-entrada',
    sample: true,
  },
  {
    id: 'entradas-3',
    title: 'Fiel a BOIA',
    description: 'Ten entradas de 3 eventos distintos.',
    trigger: 'buy_ticket',
    triggerParams: { count: 3 },
    points: 150,
    coins: 0,
    badgeKey: 'fiel-a-boia',
    sample: true,
  },
  {
    id: 'mundos-2',
    title: 'Entre dos mundos',
    description: 'Navega en Arcilla y en Acuarela.',
    trigger: 'visit_world',
    triggerParams: { count: 2 },
    points: 30,
    coins: 15,
    sample: true,
  },
  {
    // Se podrá completar cuando el náufrago tenga su misión de llevarlo a una
    // fiesta (hoy sólo deja su código al arrimarse, REQ-AVE-020).
    id: 'naufrago-fiesta',
    title: 'Náufrago de fiesta',
    description: 'Lleva al náufrago a una fiesta de BOIA.',
    trigger: 'deliver_character',
    triggerParams: { character: 'naufrago' },
    points: 50,
    coins: 20,
    sample: true,
  },
];

/** Precio de cada skin de barco (O5). muestra */
export const SKIN_PRICE = 150;
const SOLD_SKINS = [
  ['noche', 'Noche'],
  ['fiesta', 'Fiesta'],
] as const;
/** Barcos con skins a la venta: cosmético, estilo y nombre corto. */
const SHIP_SKIN_OWNERS = [
  ['barco-arcilla', 'arcilla', 'Arcilla'],
  ['barco-acuarela', 'acuarela', 'Acuarela'],
  ['barco-low-poly', 'low-poly', 'Low-poly'],
  ['barco-semi-realista', 'semi-realista', 'Semi-realista'],
  ['barco-cartoon-30', 'cartoon-30', 'Cartoon años 30'],
  ['barco-cel-shaded', 'cel-shaded', 'Cel-shaded'],
  ['barco-pixel-art', 'pixel-art', 'Pixel art'],
] as const;

export const SAMPLE_COSMETICS: AreaInput<'cosmetics'>[] = [
  { id: 'bandera-boia', name: 'Bandera BOIA', slot: 'flag', priceCoins: 30, sample: true },
  { id: 'estela-naranja', name: 'Estela naranja', slot: 'wake', priceCoins: 50, sample: true },
  { id: 'farolillo', name: 'Farolillo de proa', slot: 'accessory', priceCoins: 40, sample: true },
  {
    id: 'bandera-fiestera',
    name: 'Bandera de la Fiestera',
    slot: 'flag',
    priceCoins: null,
    sample: true,
  },
  {
    id: 'bandera-cuadros',
    name: 'Bandera a cuadros',
    slot: 'flag',
    priceCoins: null,
    sample: true,
  },
  {
    id: 'estela-burbujas',
    name: 'Estela de burbujas',
    slot: 'wake',
    priceCoins: null,
    sample: true,
  },
  { id: 'estela-rayo', name: 'Estela de rayo', slot: 'wake', priceCoins: null, sample: true },
  // Barcos de estilo (T40, D-23 punto 1 y O5; precios `muestra`). Primero los
  // que se ganan con un logro (D-22, T36: bloqueados hasta reclamarlo).
  {
    id: 'barco-cel-shaded',
    name: 'Cel-shaded cómic',
    slot: 'ship',
    priceCoins: null,
    assetKey: 'cel-shaded',
    sample: true,
  },
  {
    id: 'barco-boceto-lapiz',
    name: 'Boceto a lápiz',
    slot: 'ship',
    priceCoins: null,
    assetKey: 'boceto-lapiz',
    sample: true,
  },
  {
    id: 'barco-pixel-art',
    name: 'Pixel art',
    slot: 'ship',
    priceCoins: null,
    assetKey: 'pixel-art',
    sample: true,
  },
  // El premio de la misión central (T59): exclusivo de quien entrega a la
  // Boia Fiestera en la última isla. Arte: el de Arcilla en fiesta, teñido
  // (variante de `docs/barcos/barcos.json`, sin arte nuevo). muestra
  {
    id: 'barco-fiestera',
    name: 'La Fiestera',
    slot: 'ship',
    priceCoins: null,
    assetKey: 'fiestera',
    unlockMission: 'fiestera',
    sample: true,
  },
  // Los dos de los mundos iniciales: de todos desde el principio.
  {
    id: 'barco-arcilla',
    name: 'Arcilla, maqueta',
    slot: 'ship',
    priceCoins: null,
    assetKey: 'arcilla',
    base: true,
    sample: true,
  },
  {
    id: 'barco-acuarela',
    name: 'Acuarela ilustrada',
    slot: 'ship',
    priceCoins: null,
    assetKey: 'acuarela',
    base: true,
    sample: true,
  },
  // En la tienda, con monedas.
  {
    id: 'barco-low-poly',
    name: 'Low-poly',
    slot: 'ship',
    priceCoins: 300,
    assetKey: 'low-poly',
    sample: true,
  },
  {
    id: 'barco-cartoon-30',
    name: 'Cartoon años 30',
    slot: 'ship',
    priceCoins: 400,
    assetKey: 'cartoon-30',
    sample: true,
  },
  // Con puntos: al llegar a 1500 (umbral; los puntos no se gastan).
  {
    id: 'barco-semi-realista',
    name: 'Semi-realista «El Veterano»',
    slot: 'ship',
    priceCoins: null,
    assetKey: 'semi-realista',
    unlockPoints: 1500,
    sample: true,
  },
  // Skins noche y fiesta de cada barco: 150 monedas cada una (B01 Boceto a
  // lápiz es monocromo: sólo base).
  ...SHIP_SKIN_OWNERS.flatMap(([ship, style, label]) =>
    SOLD_SKINS.map(([skin, skinLabel]): AreaInput<'cosmetics'> => ({
      id: `skin-${style}-${skin}`,
      name: `${label} · ${skinLabel}`,
      slot: 'skin',
      priceCoins: SKIN_PRICE,
      assetKey: skin,
      forShip: ship,
      sample: true,
    })),
  ),
];

/** Rangos lúdicos, no jerarquía (REQ-IDE-012, REQ-IDE-028). */
export const SAMPLE_RANKS: AreaInput<'ranks'>[] = [
  { id: 'grumete', name: 'Grumete', minPoints: 0, sample: true },
  { id: 'marinera', name: 'Marinera', minPoints: 100, sample: true },
  { id: 'timonel', name: 'Timonel', minPoints: 300, sample: true },
  { id: 'capitana', name: 'Capitana de la fiesta', minPoints: 600, sample: true },
];
