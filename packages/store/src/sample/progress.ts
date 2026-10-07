import type { AreaInput } from '../schema';

/** El circuito Los Rápidos, antes El Freu (id de `@boia/world`, CIRCUIT_ID: no cambia). */
const FREU = 'el-freu';

/**
 * «Rayo de Los Rápidos»: la carrera de tres vueltas por debajo de la plata del
 * trazado de T73 (`CIRCUIT_MEDALS.silver` de `@boia/world`, 74 s, menos 0,6 s).
 * Antes, 43,6 s en el trazado corto de T61. muestra
 */
export const FAST_LAP_MS = 73_400;

/**
 * «Rápido» (plan 015 T176, decisión 16): la regata de tres vueltas en menos
 * de 80 s. Medido con el piloto de las pruebas (`botRace`, 67,3 s a fondo y
 * sin turbo) y un modelo de jugador normal que apunta con un error que
 * aprende de un intento a otro (`apps/web/app/mar/race-rapido.test.ts`):
 * la mediana lo consigue en el intento 4 (3–5 la mayoría). Más fácil que
 * «Rayo de Los Rápidos» (`FAST_LAP_MS`), que sigue siendo el reto de arriba.
 * muestra
 */
export const RACE_FAST_MS = 80_000;

/** El minijuego del castillo en las señales de logro (`win_minigame`). */
export const CASTLE_GAME = 'castillo';
/** La duración de la partida larga del castillo, la del logro del vórtice (min). */
export const CASTLE_LONG_RUN_MIN = 10;

// Economía de la decisión 2026-10-02 (T72): en unos 10 minutos de juego normal
// se desbloquean 3 barcos y alguna skin (lo prueba
// `apps/web/lib/mundo/economy.test.ts`). muestra

/**
 * La mascota minikraken (logro `canon-kraken`, T153): el premio queda en el
 * libro como cosmético; el objeto, su ranura «Mascota» y cómo se ve en
 * cubierta los hace T154. muestra
 */
export const MINIKRAKEN = 'mascota-minikraken';

/**
 * Los premios de plan 015 (decisión 16; T175 los modela y dibuja, T176 los
 * concede con sus logros): dos mascotas más y una estela. El atajo de
 * desarrollo (`apps/web/app/mar/mascota-dev.ts`) las da por su logro.
 * Nombres y diseños `muestra`.
 */
export const CANONCITO = 'mascota-canoncito';
export const TORTUGA_TURBO = 'mascota-tortuga-turbo';
export const ESTELA_VORTICE = 'estela-vortice';
/** Los logros que los regalan (T176). */
export const CASTLE_STORM_ACHIEVEMENT = 'castillo-tormenta';
export const CASTLE_VORTEX_ACHIEVEMENT = 'castillo-vortice';
export const RACE_FAST_ACHIEVEMENT = 'regata-rapida';

/** El barco que regala el Carnet BOIA: ni de base, ni de misión, ni de otro logro. */
export const CARNET_SHIP = 'barco-low-poly';
/** Puntos (umbral, no se gastan) del barco Semi-realista «El Veterano». */
export const VETERAN_POINTS = 600;
/** Precio del barco Cartoon años 30, el que queda a la venta. */
export const CARTOON_SHIP_PRICE = 120;

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
    id: 'whatsapp',
    title: 'La tripulación BOIA',
    description: 'Abre la invitación al grupo de WhatsApp.',
    trigger: 'complete_encounter',
    triggerParams: { encounter: 'whatsapp' },
    points: 300,
    coins: 50,
    sample: true,
  },
  {
    id: 'primera-boia',
    title: 'Primera boia',
    description: 'Habla con tu primera boia.',
    trigger: 'find_buoy',
    triggerParams: { count: 1 },
    points: 20,
    coins: 10,
    sample: true,
  },
  {
    id: 'boies-3',
    title: 'Coro de boies',
    description: 'Habla con 3 boies distintas.',
    trigger: 'find_buoy',
    triggerParams: { count: 3 },
    points: 40,
    coins: 20,
    sample: true,
  },
  {
    // Las seis boies del mapa compartido: la primera y las cinco informativas (O12, T45).
    id: 'boies-6',
    title: 'Las seis boies',
    description: 'Habla con las 6 boies del mar.',
    trigger: 'find_buoy',
    triggerParams: { count: 6 },
    points: 80,
    coins: 40,
    sample: true,
  },
  {
    id: 'islas-3',
    title: 'Isla a isla',
    description: 'Descubre 3 islas.',
    trigger: 'visit_island',
    triggerParams: { count: 3 },
    points: 40,
    coins: 20,
    sample: true,
  },
  {
    // Id estable (el libro lo guarda); desde T67 el mapa tiene 8 islas y pide las 8.
    id: 'islas-7',
    title: 'Cartógrafa',
    description: 'Descubre las 8 islas del mapa.',
    trigger: 'visit_island',
    triggerParams: { count: 8 },
    points: 120,
    coins: 40,
    sample: true,
  },
  {
    id: 'fiestera-rescatada',
    title: 'Boia Fiestera rescatada',
    description: 'Saca a la Boia Fiestera de entre los cocodrilos.',
    trigger: 'rescue_character',
    triggerParams: { character: 'boia-fiestera' },
    points: 80,
    coins: 40,
    sample: true,
  },
  {
    id: 'fiestera-entregada',
    title: 'Hasta el amanecer',
    description: 'Lleva a la Boia Fiestera a la Isla de Nochevieja.',
    trigger: 'deliver_character',
    triggerParams: { character: 'boia-fiestera' },
    points: 200,
    coins: 0,
    sample: true,
  },
  {
    // Id estable; desde plan 015 T176 es «Primera regata» (decisión 16): la
    // misma condición, terminar por primera vez la regata de tres vueltas.
    id: 'circuito',
    title: 'Primera regata',
    description: 'Termina tu primera regata en Los Rápidos.',
    trigger: 'complete_circuit',
    triggerParams: { circuit: FREU },
    points: 60,
    coins: 30,
    sample: true,
  },
  {
    id: 'circuito-atajo',
    title: '¿Atajo? Atajo.',
    description: 'Termina una vuelta por el atajo.',
    trigger: 'complete_circuit',
    triggerParams: { circuit: FREU, via: 'circuito-cp-a' },
    points: 60,
    coins: 0,
    sample: true,
  },
  {
    id: 'circuito-rapido',
    title: 'Rayo de Los Rápidos',
    description: 'Haz las tres vueltas en menos de 73,4 s.',
    trigger: 'complete_circuit',
    triggerParams: { circuit: FREU, maxMs: FAST_LAP_MS },
    points: 120,
    coins: 0,
    cosmeticKey: 'estela-rayo',
    sample: true,
  },
  {
    // Plan 015 T176 (decisión 16): una regata decente regala la mascota que nada detrás del barco.
    id: RACE_FAST_ACHIEVEMENT,
    title: 'Rápido',
    description: 'Termina la regata de tres vueltas en menos de 80 s.',
    trigger: 'complete_circuit',
    triggerParams: { circuit: FREU, maxMs: RACE_FAST_MS },
    points: 80,
    coins: 40,
    cosmeticKey: TORTUGA_TURBO,
    sample: true,
  },
  // «Defensa del Castillo» (plan 015 T176, decisión 16): ganar es aguantar
  // la partida entera (oro o plata), de cualquier duración, en cada
  // dificultad; Tormenta regala el Cañoncito y Tormenta de 10 min, la Estela
  // del vórtice. Sólo cuentan las partidas que valen: ni las de un atajo de
  // desarrollo ni las acabadas con «Terminar partida». muestra (P14)
  {
    id: 'castillo-tranquila',
    title: 'Castillo en calma',
    description: 'Gana una partida del castillo en Tranquila.',
    trigger: 'win_minigame',
    triggerParams: { game: CASTLE_GAME, difficulty: 'tranquila' },
    points: 40,
    coins: 20,
    sample: true,
  },
  {
    id: 'castillo-normal',
    title: 'Muralla firme',
    description: 'Gana una partida del castillo en Normal.',
    trigger: 'win_minigame',
    triggerParams: { game: CASTLE_GAME, difficulty: 'normal' },
    points: 60,
    coins: 30,
    sample: true,
  },
  {
    id: CASTLE_STORM_ACHIEVEMENT,
    title: 'Castillo en la tormenta',
    description: 'Gana una partida del castillo en Tormenta.',
    trigger: 'win_minigame',
    triggerParams: { game: CASTLE_GAME, difficulty: 'tormenta' },
    points: 120,
    coins: 50,
    cosmeticKey: CANONCITO,
    sample: true,
  },
  {
    id: CASTLE_VORTEX_ACHIEVEMENT,
    title: 'Ojo del vórtice',
    description: 'Gana la partida de 10 minutos del castillo en Tormenta.',
    trigger: 'win_minigame',
    triggerParams: { game: CASTLE_GAME, difficulty: 'tormenta', runMin: CASTLE_LONG_RUN_MIN },
    points: 150,
    coins: 50,
    cosmeticKey: ESTELA_VORTICE,
    sample: true,
  },
  // Los logros del Cañón definitivo (plan 013 T153, §9 del diseño de
  // referencia; sin el acto 3: ni `canon-capitan` ni «El Apagón»). Sólo
  // cuentan las partidas que valen: ni las de un atajo de desarrollo ni las
  // acabadas con «Terminar partida». muestra (P14)
  {
    id: 'canon-zarpa',
    title: 'Zafarrancho',
    description: 'Juega una partida del Cañón.',
    trigger: 'play_minigame',
    triggerParams: { game: 'canon' },
    points: 20,
    coins: 10,
    sample: true,
  },
  {
    // Id estable: el de la beta («Ni un tiburón»); ganar es bronce o más.
    id: 'canon',
    title: 'Hasta que amanezca',
    description: 'Sobrevive una partida del Cañón: llega al amanecer o vence a su boss.',
    trigger: 'win_minigame',
    triggerParams: { game: 'canon' },
    points: 60,
    coins: 30,
    sample: true,
  },
  {
    id: 'canon-fantasma',
    title: 'Exorcista',
    description: 'Vence al Barco Fantasma en el Cañón.',
    trigger: 'defeat_boss',
    triggerParams: { boss: 'fantasma' },
    points: 80,
    coins: 0,
    sample: true,
  },
  {
    // La mascota la construye T154; el premio ya queda en el libro.
    id: 'canon-kraken',
    title: 'Rompetentáculos',
    description: 'Vence al Kraken en el Cañón.',
    trigger: 'defeat_boss',
    triggerParams: { boss: 'kraken' },
    points: 120,
    coins: 0,
    cosmeticKey: MINIKRAKEN,
    sample: true,
  },
  {
    // En el diseño, el Capitán en Tormenta; sin acto 3, el último boss: el Kraken.
    id: 'canon-tormenta',
    title: 'Ojo del huracán',
    description: 'Vence al Kraken en Tormenta.',
    trigger: 'defeat_boss',
    triggerParams: { boss: 'kraken', difficulty: 'tormenta' },
    points: 150,
    coins: 50,
    secret: true,
    sample: true,
  },
  {
    // Versión 2 (T153): antes pedía ganar los dos minijuegos; desde entonces
    // basta con jugar el Cañón, para que nadie se quede sin el barco por su
    // dispositivo. Versión 3 (plan 014 T157): sin el minijuego del faro, sólo
    // eso, jugar una partida del Cañón. muestra
    id: 'guardacostas',
    version: 3,
    title: 'Guardacostas',
    description: 'Juega una partida del Cañón.',
    trigger: 'play_minigame',
    triggerParams: { game: 'canon' },
    points: 150,
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
    points: 120,
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
    points: 50,
    coins: 0,
    cosmeticKey: 'estela-burbujas',
    sample: true,
  },
  {
    // Las botellas sólo están en /juego (D-22; catálogo, punto 5).
    id: 'botellas-3',
    title: 'Correo del mar',
    description: 'Lee 3 botellas.',
    trigger: 'read_bottle',
    triggerParams: { count: 3 },
    points: 30,
    coins: 20,
    sample: true,
  },
  {
    id: 'botella-propia',
    title: 'Mensaje al mar',
    description: 'Echa tu propia botella.',
    trigger: 'throw_bottle',
    triggerParams: { count: 1 },
    points: 20,
    coins: 10,
    sample: true,
  },
  {
    // El premio del Carnet (decisión 2026-10-02, T72): 300 puntos y el barco
    // Low-poly, que llegan al crearlo, sin «Reclamar» (`grantCarnetReward` de la web).
    id: 'carnet',
    title: 'Con Carnet',
    description: 'Crea tu Carnet BOIA.',
    trigger: 'create_carnet',
    triggerParams: {},
    points: 300,
    coins: 0,
    cosmeticKey: CARNET_SHIP,
    sample: true,
  },
  {
    id: 'carnet-preguntas',
    title: 'Libro abierto',
    description: 'Responde las 5 preguntas del Carnet.',
    trigger: 'answer_question',
    triggerParams: { count: 5 },
    points: 60,
    coins: 30,
    sample: true,
  },
  {
    id: 'minutos-5',
    title: 'Cinco minutos a bordo',
    description: 'Navega 5 minutos.',
    trigger: 'time_played',
    triggerParams: { minutes: 5 },
    points: 30,
    coins: 15,
    sample: true,
  },
  {
    id: 'minutos-20',
    title: 'Veinte minutos a bordo',
    description: 'Navega 20 minutos.',
    trigger: 'time_played',
    triggerParams: { minutes: 20 },
    points: 60,
    coins: 30,
    sample: true,
  },
  {
    id: 'minutos-60',
    title: 'Lobo de mar',
    description: 'Navega una hora (en varias visitas).',
    trigger: 'time_played',
    triggerParams: { minutes: 60 },
    points: 150,
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
    points: 40,
    coins: 20,
    sample: true,
  },
  {
    // El rescate y su descuento completan el objetivo (decisión T115). muestra
    id: 'naufrago-fiesta',
    title: 'Náufrago de fiesta',
    description: 'Rescata al náufrago y recibe su descuento para una fiesta de BOIA.',
    trigger: 'rescue_character',
    triggerParams: { character: 'naufrago' },
    points: 80,
    coins: 40,
    sample: true,
  },
];

/** Precio de cada skin de barco (O5; 50 desde la decisión 2026-10-02). muestra */
export const SKIN_PRICE = 50;
const SOLD_SKINS = [
  ['noche', 'Noche'],
  ['fiesta', 'Fiesta'],
] as const;
/** Barcos con skins a la venta: cosmético, estilo y nombre corto. */
const SHIP_SKIN_OWNERS = [
  ['barco-arcilla', 'arcilla', 'Botijo'],
  ['barco-acuarela', 'acuarela', 'Acuarela'],
  ['barco-low-poly', 'low-poly', 'Low-poly'],
  ['barco-semi-realista', 'semi-realista', 'Semi-realista'],
  ['barco-cartoon-30', 'cartoon-30', 'Cartoon años 30'],
  ['barco-cel-shaded', 'cel-shaded', 'Cel-shaded'],
  ['barco-pixel-art', 'pixel-art', 'Pixel art'],
] as const;

export const SAMPLE_COSMETICS: AreaInput<'cosmetics'>[] = [
  { id: 'estela-naranja', name: 'Estela naranja', slot: 'wake', priceCoins: 30, sample: true },
  { id: 'farolillo', name: 'Farolillo de proa', slot: 'accessory', priceCoins: 25, sample: true },
  {
    id: 'estela-burbujas',
    name: 'Estela de burbujas',
    slot: 'wake',
    priceCoins: null,
    sample: true,
  },
  { id: 'estela-rayo', name: 'Estela de rayo', slot: 'wake', priceCoins: null, sample: true },
  // La primera mascota (T153 la concede con `canon-kraken`; T154 la pone en cubierta).
  { id: MINIKRAKEN, name: 'Minikraken', slot: 'mascot', priceCoins: null, sample: true },
  // Los premios del castillo y de la carrera (plan 015 T175; sus logros, T176). No se venden.
  { id: CANONCITO, name: 'Cañoncito', slot: 'mascot', priceCoins: null, sample: true },
  { id: TORTUGA_TURBO, name: 'Tortuga turbo', slot: 'mascot', priceCoins: null, sample: true },
  { id: ESTELA_VORTICE, name: 'Estela del vórtice', slot: 'wake', priceCoins: null, sample: true },
  // Barcos de estilo (T40, D-23 punto 1 y O5; precios `muestra`, rebajados el
  // 2026-10-02). Primero los que se ganan con un logro (D-22, T36: bloqueados
  // hasta reclamarlo).
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
  // Boia Fiestera en la Isla de Nochevieja. Arte: el de Arcilla en fiesta, teñido
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
    name: 'Botijo, maqueta',
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
  // El regalo del Carnet BOIA (logro `carnet`, decisión 2026-10-02): antes se vendía.
  {
    id: CARNET_SHIP,
    name: 'Low-poly',
    slot: 'ship',
    priceCoins: null,
    assetKey: 'low-poly',
    sample: true,
  },
  // En la tienda, con monedas.
  {
    id: 'barco-cartoon-30',
    name: 'Cartoon años 30',
    slot: 'ship',
    priceCoins: CARTOON_SHIP_PRICE,
    assetKey: 'cartoon-30',
    sample: true,
  },
  // Con puntos: al llegar al umbral (los puntos no se gastan).
  {
    id: 'barco-semi-realista',
    name: 'Semi-realista «El Veterano»',
    slot: 'ship',
    priceCoins: null,
    assetKey: 'semi-realista',
    unlockPoints: VETERAN_POINTS,
    sample: true,
  },
  // Skins noche y fiesta de cada barco, a SKIN_PRICE cada una (B01 Boceto a
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
