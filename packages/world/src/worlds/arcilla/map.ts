import type { BehaviorInput } from '../../behaviors';
import { GROUND_Y_SCALE, HEIGHT_SCALE } from '../../iso';
import type { PlaceInput, SharedMapInput } from '../map';
import { type Maq, POS, U, at, ellipseCollision, near, proximity, size } from './units';

/**
 * El mapa compartido de la versión de prueba (T20, D-20), sacado de
 * `mundos/arcilla/mapa.json`: todos los mundos (Arcilla, Acuarela…) juegan
 * sobre estos lugares y sólo cambian su piel. Los números de la maqueta van
 * tal cual (u_maq) y `./units` los pasa al motor; `source` dice de qué
 * entrada de mapa.json (o de qué pieza de arte de T18) sale cada lugar, y la
 * prueba `arcilla.test.ts` lo comprueba contra el archivo.
 *
 * Textos, radios, premios y descuentos son `muestra` [pendiente Álvaro].
 * Los textos propios de cada mundo (bocadillos, nombres) van en su skin; aquí
 * sólo los comunes.
 */

export const SHARED_MAP_ID = 'boia-mapa';

/**
 * Las tres islas con entradas (decisión de Hernán y Álvaro del 2026-10-02) y
 * el id de su evento en el contenido (`@boia/store`): BOIA Halloween en la
 * Isla de Halloween, SONIDO en la Isla del Sonido (`allday`) y BOIA
 * Nochevieja en la Isla de Nochevieja (`ultima`, donde se entrega la Boia
 * Fiestera). Se llaman igual en todos los mundos (D-20).
 */
export const TICKET_ISLAND_EVENTS = {
  halloween: 'halloween-2026',
  allday: 'sonido-2026',
  ultima: 'nochevieja-2026',
} as const;

/** Id del evento ligado a la isla `allday`, la Isla del Sonido (el de la landing y de `@boia/store`). */
export const ALLDAY_EVENT_ID = TICKET_ISLAND_EVENTS.allday;

/**
 * Plan 014 T157 (decisiones 1 y 3 del 2026-10-05): el faro deja su minijuego
 * y se muda al sitio del castillo de Santa Bárbara, junto a la salida, donde
 * hace de tablón («Tablón del faro»: el Cañón, el Castillo y la carrera); el
 * castillo pasa a ser la isla del minijuego «Defensa del Castillo», junto a
 * la Boia 7. Ninguno de los dos sitios está en mapa.json: su fuente es el plan.
 */
const T157 = 'plan:T157';
/** El faro (Tabarca): id estable de siempre (descubrimientos y logros de visita). */
export const LIGHTHOUSE_PLACE_ID = 'faro';
/** La referencia de contenido del faro: su ficha es el «Tablón del faro». */
export const BOARD_REF = 'tablon';
/**
 * Dónde está el faro: en /mar cae justo donde estaba el decorado del castillo
 * (28 de escena al oeste y 10 al norte del anillo de salida; el faro es su
 * propia zona, así que en /mar queda en sus posiciones × 0,2). muestra
 */
export const LIGHTHOUSE_CENTER: Maq = [-6.0046, 21.7423];
/**
 * Radio de la isla del faro (u_maq): en /mar, × 2,4 ≈ 137 u (8,6 de escena),
 * donde el faro de Tabarca de T166 pesa en la vista como el castillo de antes
 * (13 de escena) sin pisar los restos ni el náufrago vecinos. muestra
 */
export const LIGHTHOUSE_RADIUS = 2.3;
/** La isla del castillo y el id de su minijuego (`start_minigame`). */
export const CASTLE_PLACE_ID = 'castillo';
export const CASTLE_GAME_ID = 'castillo';
/**
 * Dónde está el castillo: al suroeste de la Boia 7 (`circuito-delfin`), por
 * fuera de la curva de la carrera (a más de su radio más la carretera de los
 * tramos Boia 6 → 7 y 7 → 8), con mar abierto hacia el suroeste para la
 * arena del juego. muestra
 */
export const CASTLE_CENTER: Maq = [-14.48, 14.21];
/** Radio de la isla (u_maq): en /mar, × 2,4 = 208 u, el del decorado del castillo. */
const CASTLE_RADIUS = 3.485;

/** La Isla de Halloween (T67): sin maqueta en mapa.json, su fuente es el plan. */
export const HALLOWEEN_PLACE_ID = 'halloween';
/** Dónde está: mar libre en el centro, entre el remanso de la Fiestera, Ibiza y la Isla del Sonido. muestra */
export const HALLOWEEN_CENTER: Maq = [-1.0, 1.5];

/**
 * El Puerto de Alicante (T108; antes la Cala Cantalar): el puerto donde se
 * cambia de barco. Conserva el id `cala` (descubrimientos, logros y premios
 * guardados) y su sitio de `mapa.json`. muestra
 */
export const HARBOR_PLACE_ID = 'cala';
/** La referencia de contenido de un puerto: su ficha ofrece cambiar de barco («Barco»). */
export const HARBOR_REF = 'barcos';

/**
 * Id del circuito para checkpoints y récords (REQ-AVE-033 añade la versión).
 * Desde T67 el circuito se llama Los Rápidos; el id sigue siendo el de El
 * Freu para no perder récords ni logros.
 */
export const CIRCUIT_ID = 'el-freu';
/**
 * Versión del trazado (REQ-AVE-033): `mapa.json` → `circuito.version` era la
 * 1; el circuito cerrado de tres vueltas de T61 es la 2 y el trazado largo de
 * T73, por todo el mapa, la 3 (récords y fantasmas desde cero).
 */
export const CIRCUIT_VERSION = 3;

/**
 * Premios del mar vivo (decisión 2026-10-02, T72): cada resto flotante da 10
 * monedas y el Cofre fugaz 40 monedas y 20 puntos, una vez por visita cada
 * uno. muestra
 */
export const RESTOS_COINS = 10;
export const COFRE_COINS = 40;
export const COFRE_POINTS = 20;

const TAGS = ['muestra'];

// --- Anclas de las composiciones locales -------------------------------------

/** El anillo de salida (`zonas/puerto/lugares/salida`): ancla del puerto. */
export const PORT_ANCHOR: Maq = [0, 25.3];
/** La Boia Fiestera (`zonas/fiestera/lugares/fiestera`): ancla del remanso. */
export const FIESTERA_ANCHOR: Maq = [-3.8, 7.6];
/** La Isla de Nochevieja, antes «la última isla» (`zonas/ultima/islas/isla`), y el nicho de la Fiestera (`zonas/ultima/lugares/nicho`). */
export const ULTIMA_CENTER: Maq = [4.4, -27.4];
const NICHO: Maq = [4.0, -28.2];
/** Semieje menor y altura de la isla (`zonas/ultima/islas/isla`: `b`, `alto`). */
const ULTIMA_B = 2.1;
const ULTIMA_ALTO = 0.55;
/** Arco de salida del circuito (`circuito/salida`): ancla del semáforo. */
export const CIRCUIT_START: Maq = [12.6, 5.6];

/**
 * Dónde se queda la Fiestera en la última isla: el nicho, sobre la isla. La
 * isla se dibuja a 1:1 alrededor de su centro, así el nicho queda a su
 * distancia 1:1 del centro. Para que se pinte delante de la isla (el orden
 * de dibujo va por `y`), el punto baja al borde sur de la isla por la
 * vertical de pantalla del nicho y `z` lo vuelve a subir hasta él, más la
 * altura de la isla. muestra
 */
export const NICHO_DROP = (() => {
  const c = at(ULTIMA_CENTER);
  const nx = c.x + (NICHO[0] - ULTIMA_CENTER[0]) * U;
  const ny = c.y + (NICHO[1] - ULTIMA_CENTER[1]) * U;
  const y = c.y + (ULTIMA_B + 0.3) * U;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return {
    x: r2(nx),
    y: r2(y),
    z: r2(((y - ny) * GROUND_Y_SCALE) / HEIGHT_SCALE + ULTIMA_ALTO * U),
  };
})();

// --- Costas y límites ----------------------------------------------------------

/**
 * Datos de las losas de T18 (`art/mundos/arcilla/costa_*`, en px del arte a
 * 88,2759 px/u_maq; en vertical, sobre el agua, la mitad): dónde cae la línea
 * de mapa.json y dónde se para el casco. El motor pone la línea de colisión
 * sobre el límite del mundo.
 */
const ART_PPU = 88.2759;
const COAST = {
  west: { mapLinePx: 441, collisionPx: 549 },
  east: { mapLinePx: 199, collisionPx: 166 },
  south: { mapLinePx: 96, collisionPx: 87.88 },
  /** Periodo de la losa del paseo y dónde empieza su columna 0 (u_maq). */
  southPeriod: 8.7,
  southPhase: 6.3,
};

/**
 * Semiancho del mar entre las líneas de costa (u). Sale de ±15 u_maq ×
 * factor, redondeado para que las losas del paseo, que empiezan en x = 0 cada
 * 8,70 u_maq, lleguen a las dos esquinas en la misma fase que en la maqueta
 * (la esquina oeste empieza 6,30 u_maq antes de una columna): 0,5 % menos.
 */
export const COAST_HALF_WIDTH = (() => {
  const period = COAST.southPeriod * U;
  const phase = COAST.southPhase * U;
  const k = Math.round((15 * POS - phase) / period);
  return Math.round((phase + k * period) * 100) / 100;
})();

/** La costa sur (el paseo) queda a 2,5 u_maq del anillo, a 1:1 como el arte del puerto. */
export const SOUTH_COAST_Y = near(PORT_ANCHOR, [0, 27.8]).y;

const px = (v: number) => (v / ART_PPU) * U;
export const ARCILLA_BOUNDS = {
  left: Math.round((-COAST_HALF_WIDTH + px(COAST.west.collisionPx - COAST.west.mapLinePx)) * 100) / 100,
  right: Math.round((COAST_HALF_WIDTH - px(COAST.east.mapLinePx - COAST.east.collisionPx)) * 100) / 100,
  top: at([0, -31.5]).y,
  bottom:
    Math.round((SOUTH_COAST_Y - 2 * px(COAST.south.mapLinePx - COAST.south.collisionPx)) * 100) /
    100,
};

// --- Ayudas --------------------------------------------------------------------

const prox = (): BehaviorInput => ({ type: 'proximity' });
const block = (): BehaviorInput => ({ type: 'collision', params: { mode: 'block' } });
const bounce = (intensity = 0.45): BehaviorInput => ({
  type: 'collision',
  params: { mode: 'bounce', intensity },
});
const slow = (intensity: number, duration: number): BehaviorInput => ({
  type: 'collision',
  params: { mode: 'slow', intensity, duration },
});
const deco = (animation = 'idle'): BehaviorInput => ({ type: 'decorative', params: { animation } });
const visit = (): BehaviorInput => ({ type: 'achievement', params: { trigger: 'visit_island' } });
const points = (
  amount: number,
  on?: 'proximity_enter' | 'contact' | 'collect',
  frequency: 'once' | 'session' = 'once',
): BehaviorInput => ({
  type: 'reward',
  params: { kind: 'points', amount, frequency, ...(on ? { on } : {}) },
});
const coins = (
  amount: number,
  frequency: 'once' | 'session' = 'once',
  on?: 'proximity_enter' | 'contact' | 'collect',
): BehaviorInput => ({
  type: 'reward',
  params: { kind: 'coins', amount, frequency, ...(on ? { on } : {}) },
});
const discount = (ref: string, on?: 'proximity_enter' | 'contact' | 'collect'): BehaviorInput => ({
  type: 'reward',
  params: { kind: 'discount', ref, amount: 1, frequency: 'once', ...(on ? { on } : {}) },
});
const content = (target: 'event' | 'photos' | 'store' | 'info', ref: string): BehaviorInput => ({
  type: 'content',
  params: { target, ref },
});
const talk = (lines: string[], once = false): BehaviorInput => ({
  type: 'dialogue',
  params: { lines, once },
});

/** Una isla con entradas: abre su evento y lo vende (CONTENIDO y TICKET). */
const tickets = (eventId: string): BehaviorInput[] => [
  content('event', eventId),
  { type: 'ticket', params: { eventId } },
];

/** Isla con colisión elíptica, proximidad amplia y primera llegada. */
function island(
  id: string,
  name: string,
  src: string,
  c: Maq,
  a: number,
  b: number,
  giro: number,
  radio: number,
  behaviors: BehaviorInput[],
  source: string[] = [],
): PlaceInput {
  return {
    id,
    name,
    category: 'isla',
    tags: TAGS,
    position: { ...at(c), zone: id },
    geometry: { ...ellipseCollision(a, b, giro), proximityRadius: proximity(radio, 'isla') },
    behaviors: [block(), prox(), ...behaviors],
    source: [src, ...source],
  };
}

// --- El Varadero: el puerto de salida (composición local) ---------------------

const port = (part: Maq) => near(PORT_ANCHOR, part);

/** Primera boia: diálogo tutorial común (REQ-AVE-001…004). [pendiente Álvaro] */
const TUTORIAL: BehaviorInput = {
  type: 'dialogue',
  params: {
    once: true,
    lines: [
      '¡Plop! Bienvenido a BOIA.PLANET.',
      'Toca en cualquier sitio y arrastra: el barco va hacia donde apuntes.',
      'Tu misión: encontrar a la Boia Fiestera y llevarla hasta la Isla de Nochevieja.',
      'Por el mar hay descuentos, monedas y secretos. Mira bien al navegar.',
      {
        text: 'Arriba tienes el minimapa: tócalo para ampliar, mantenlo pulsado para moverlo.',
        cue: 'pulse_minimap',
      },
      { text: 'Y en el ancla está el Menú de a bordo. ¡Buen viaje!', cue: 'pulse_menu' },
    ],
  },
};

const PORT: PlaceInput[] = [
  {
    id: 'puerto',
    name: 'Puerto de salida',
    category: 'puerto',
    tags: TAGS,
    // El paseo central: su orilla es la costa sur.
    position: { ...port([0, 30.6]), zone: 'puerto' },
    geometry: {},
    behaviors: [deco()],
    source: [
      'art:puerto#puerto',
      'zonas/puerto',
      'zonas/puerto/islas/paseo',
      'zonas/puerto/lugares/caseta',
    ],
  },
  {
    id: 'puerto-anillo',
    name: 'Anillo de salida',
    category: 'decorado',
    tags: TAGS,
    appearance: { layer: 'water' },
    position: { ...port([0, 25.3]), zone: 'puerto' },
    geometry: {},
    behaviors: [deco()],
    source: ['zonas/puerto/lugares/salida'],
  },
  ...(
    [
      ['oeste', -3.9, -64.3],
      ['este', 3.9, 64.3],
    ] as const
  ).map(
    ([side, x, giro]): PlaceInput => ({
      id: `puerto-escollera_${side}`,
      name: 'Escollera',
      category: 'obstaculo',
      tags: TAGS,
      position: { ...port([x, 25.1]), zone: 'puerto' },
      geometry: ellipseCollision(3.0, 0.55, giro),
      behaviors: [bounce(0.15)],
      source: [`zonas/puerto/islas/escollera_${side}`],
    }),
  ),
  ...(
    [
      ['verde', -2.6],
      ['roja', 2.6],
    ] as const
  ).map(
    ([color, x]): PlaceInput => ({
      id: `puerto-baliza_${color}`,
      name: `Baliza ${color}`,
      category: 'obstaculo',
      tags: TAGS,
      position: { ...port([x, 22.4]), zone: 'puerto' },
      geometry: { collision: { shape: 'circle', radius: size(0.22) } },
      behaviors: [bounce(0.3)],
      source: [`art:puerto#baliza_${color}`, 'zonas/puerto/lugares/bocana'],
    }),
  ),
  {
    id: 'puerto-boia',
    name: 'La boia de la entrada',
    category: 'boia',
    tags: TAGS,
    position: { ...port([0, 20.4]), zone: 'puerto' },
    geometry: {
      collision: { shape: 'circle', radius: size(0.55) },
      proximityRadius: proximity(3.2, 'encuentro'),
    },
    behaviors: [
      bounce(0.3),
      prox(),
      TUTORIAL,
      { type: 'achievement', params: { trigger: 'find_boia' } },
    ],
    source: ['zonas/puerto/lugares/boia', 'zonas/puerto/proximidad/boia'],
  },
  {
    id: 'puerto-whatsapp',
    name: 'Boia de WhatsApp',
    category: 'boia',
    tags: TAGS,
    position: { ...port([-3.4, 18.8]), zone: 'puerto' },
    geometry: {
      collision: { shape: 'circle', radius: size(0.32) },
      proximityRadius: proximity(3.2, 'encuentro'),
    },
    // REQ-AVE-023: acceso voluntario al WhatsApp de BOIA [provisional].
    behaviors: [bounce(0.3), prox(), content('info', 'whatsapp')],
    source: ['zonas/puerto/lugares/whatsapp', 'zonas/puerto/proximidad/whatsapp'],
  },
];

// --- Islas -----------------------------------------------------------------------

const ISLANDS: PlaceInput[] = [
  // El Puerto de Alicante (T108): donde se cambia de barco; el id sigue siendo `cala`.
  island(
    HARBOR_PLACE_ID,
    'Puerto de Alicante',
    'zonas/cala/islas/isla',
    [8.5, 13.0],
    3.1,
    2.1,
    45,
    4.6,
    [content('info', HARBOR_REF), points(20), visit()],
    [
      'zonas/cala',
      'zonas/cala/proximidad/isla',
      ...['horno', 'chiringuito', 'paella', 'pista', 'embarcadero', 'amarre', 'torno'].map(
        (l) => `zonas/cala/lugares/${l}`,
      ),
    ],
  ),
  // Islas con entradas: sólo el nombre común, igual en todos los mundos (D-20).
  island(
    'allday',
    'Isla del Sonido',
    'zonas/allday/islas/isla',
    [1.2, -15.6],
    4.6,
    3.4,
    12,
    6.4,
    [...tickets(ALLDAY_EVENT_ID), points(20), visit()],
    [
      'zonas/allday',
      'zonas/allday/proximidad/isla',
      ...['escenario', 'taquilla', 'barra', 'arco', 'muelle', 'dj'].map(
        (l) => `zonas/allday/lugares/${l}`,
      ),
    ],
  ),
  island(
    'fotos',
    'Isla de Benidorm',
    'zonas/fotos/islas/isla',
    [-9.4, -9.9],
    2.6,
    1.9,
    -20,
    4.0,
    // REQ-AVE-022: la galería como lugar del mundo.
    [content('photos', 'album-muestra'), points(20), visit()],
    [
      'zonas/fotos',
      'zonas/fotos/proximidad/isla',
      ...['camara', 'marco', 'tendedero', 'cuarto'].map((l) => `zonas/fotos/lugares/${l}`),
    ],
  ),
  island(
    'tienda',
    'Ibiza',
    'zonas/tienda/islas/isla',
    [6.6, -1.2],
    1.9,
    1.5,
    45,
    3.2,
    // REQ-COM-033: escaparate de la tienda externa.
    [content('store', 'tienda'), points(15), visit()],
    [
      'zonas/tienda',
      'zonas/tienda/proximidad/isla',
      ...['kiosco', 'tendedero', 'cartel'].map((l) => `zonas/tienda/lugares/${l}`),
    ],
  ),
  {
    // La Isla de Nochevieja: destino de la misión de la Fiestera (T21) y,
    // desde T67, isla con entradas (BOIA Nochevieja).
    ...island(
      'ultima',
      'Isla de Nochevieja',
      'zonas/ultima/islas/isla',
      ULTIMA_CENTER,
      2.7,
      2.1,
      -10,
      4.4,
      [...tickets(TICKET_ISLAND_EVENTS.ultima), points(30), visit()],
      [
        'zonas/ultima',
        'zonas/ultima/proximidad/isla',
        ...['nicho', 'muelle', 'hoguera', 'amigas'].map((l) => `zonas/ultima/lugares/${l}`),
      ],
    ),
    params: {
      missionDestination: 'fiestera',
      // Dónde se queda la Fiestera al bajar (el nicho de la isla) y el premio grande
      // de la entrega (REQ-AVE-008) [pendiente Álvaro]: puntos, monedas y el
      // código de entradas de la Fiestera (T59; el barco exclusivo lo da la
      // misión completada, `unlockMission`).
      missionDrop: NICHO_DROP,
      missionReward: { points: 100, coins: 100, discount: 'dto-fiestera' },
    },
  },
  // La Isla de Halloween (T67): mar libre del centro, sin maqueta (la modela T69).
  island(
    HALLOWEEN_PLACE_ID,
    'Isla de Halloween',
    'plan:T67',
    HALLOWEEN_CENTER,
    2.4,
    1.9,
    20,
    4.0,
    [...tickets(TICKET_ISLAND_EVENTS.halloween), points(20), visit()],
  ),
  // El faro (Tabarca) desde el plan 014 T157: sin minijuego, en el sitio del
  // antiguo castillo junto a la salida; al acercarse abre el «Tablón del faro».
  // Isla redonda (T166): su modelo de Blender (tools/blender/islas/faro.py) se
  // escala por este radio y el juego del castillo lo normaliza por él, así que
  // el casco es un solo círculo; más grande que la elipse de antes (1,9 × 1,3)
  // para que el faro pese a la entrada como pesaba el castillo, y a más de su
  // radio de los restos y el náufrago vecinos. muestra
  island(
    LIGHTHOUSE_PLACE_ID,
    'Tabarca',
    T157,
    LIGHTHOUSE_CENTER,
    LIGHTHOUSE_RADIUS,
    LIGHTHOUSE_RADIUS,
    0,
    // Proximidad algo menor que la de antes (3,4): junto a la salida, el tablón no
    // se abre desde el anillo ni pisa la ficha de la boia de WhatsApp. muestra
    2.8,
    [content('info', BOARD_REF), visit()],
    ['minijuegos/faro/isla', 'minijuegos/faro'],
  ),
  // Islas de los minijuegos (T23): INICIAR_MINIJUEGO con `canon` y, desde el plan 014, `castillo`.
  island('canon', "L'Illeta dels Banyets", 'minijuegos/canon/isla', [-9.0, -18.6], 1.5, 1.1, -15, 3.0, [
    { type: 'start_minigame', params: { gameId: 'canon' } },
    visit(),
  ], ['minijuegos/canon']),
  // «Defensa del Castillo» (plan 014): el castillo de Santa Bárbara, ahora isla
  // de minijuego junto a la Boia 7, fuera de la carrera. Isla redonda del radio
  // de su decorado (13 de escena = 208 u en /mar, el `castle.radius` de
  // `@boia/engine/defense`).
  island(
    CASTLE_PLACE_ID,
    'Castillo de Santa Bárbara',
    T157,
    CASTLE_CENTER,
    CASTLE_RADIUS,
    CASTLE_RADIUS,
    0,
    4.0,
    [{ type: 'start_minigame', params: { gameId: CASTLE_GAME_ID } }, visit()],
  ),
];

// --- El Remanso de los Cocodrilos (composición local; la misión es de T21) ------

/** Radio en que los cocodrilos se sumergen (`zonas/fiestera/proximidad/cocodrilos`). */
const CROC_RADIUS = proximity(4.0, 'encuentro');

const remanso = (p: Maq) => near(FIESTERA_ANCHOR, p);

const CROCS: [number, number, number][] = [
  [-5.4139, 7.9431, 0.5175],
  [-4.6214, 6.2855, 0.4725],
  [-2.8249, 6.2074, 0.495],
  [-2.0783, 8.5155, 0.45],
];
const ROCKS: [number, number, number][] = [
  [-6.5, 6.3, 0.399],
  [-1.2, 5.7, 0.336],
  [-1.6, 9.5, 0.294],
];

const FIESTERA: PlaceInput[] = [
  {
    id: 'fiestera',
    name: 'La Boia Fiestera',
    category: 'encuentro',
    tags: TAGS,
    position: { ...remanso(FIESTERA_ANCHOR), zone: 'fiestera' },
    geometry: {
      collision: { shape: 'circle', radius: size(0.48) },
      proximityRadius: proximity(2.6, 'encuentro'),
    },
    behaviors: [
      bounce(0.3),
      // Pide ayuda en bocadillos desde que los cocodrilos empiezan a sumergirse (REQ-AVE-005);
      // sube a bordo en el radio de rescate, el de `geometry.proximityRadius`.
      { type: 'proximity', params: { radius: CROC_RADIUS } },
      talk([
        '¡Eh, barquito! Estos señores no me dejan ir a la fiesta.',
        '¿Me llevas a la Isla de Nochevieja? Te lo pagaré bailando.',
      ]),
    ],
    // La misión (T21): rescate en el radio de proximidad, cocodrilos en `crocRadius`.
    params: { mission: 'fiestera', character: 'boia-fiestera', crocRadius: CROC_RADIUS },
    source: [
      'zonas/fiestera/lugares/fiestera',
      'zonas/fiestera',
      'zonas/fiestera/proximidad/rescate',
      'zonas/fiestera/proximidad/cocodrilos',
    ],
  },
  {
    id: 'fiestera-posidonia',
    name: 'Posidonia',
    category: 'decorado',
    tags: TAGS,
    appearance: { layer: 'water' },
    position: { ...remanso(FIESTERA_ANCHOR), zone: 'fiestera' },
    geometry: {},
    behaviors: [deco()],
    source: ['art:fiestera#posidonia'],
  },
  ...CROCS.map(
    ([x, y, r], i): PlaceInput => ({
      id: `fiestera-cocodrilo_${i + 1}`,
      name: 'Cocodrilo',
      category: 'cocodrilo',
      tags: TAGS,
      position: { ...remanso([x, y]), zone: 'fiestera' },
      // Pesados, no malos: ralentizan un 60 % durante 2 s (REQ-AVE-005, REQ-AVE-030).
      geometry: { collision: { shape: 'circle', radius: size(r) } },
      behaviors: [slow(0.6, 2), deco()],
      source: [`art:fiestera#cocodrilo_${i + 1}`, ...(i === 0 ? ['zonas/fiestera/lugares/cocodrilos'] : [])],
    }),
  ),
  ...ROCKS.map(
    ([x, y, r], i): PlaceInput => ({
      id: `fiestera-roca_${i + 1}`,
      name: 'Roca',
      category: 'obstaculo',
      tags: TAGS,
      position: { ...remanso([x, y]), zone: 'fiestera' },
      geometry: { collision: { shape: 'circle', radius: size(r) } },
      behaviors: [bounce(0.3)],
      source: [`art:fiestera#roca_${i + 1}`],
    }),
  ),
];

// --- Mar vivo -------------------------------------------------------------------

/**
 * Restos flotantes (`zonas/marvivo/restos`): monedas que vuelven en otra
 * visita. Desde T59 ya no guardan códigos (los descuentos del mundo son tres:
 * el náufrago, el ánfora y el premio de la Fiestera).
 */
const RESTOS: Maq[] = [
  [-3.4, 18.4],
  [-8.8, 12.4],
  [-12.8, 6.2],
  [-6.4, -3.2],
  [2.4, 16.0],
  [3.2, -7.6],
  [-1.6, -21.6],
  [10.2, 21.4],
];
/** u de reaparición semialeatoria de los restos alrededor de su sitio. muestra */
const RESTOS_JITTER = 40;

const jitter = (p: { x: number; y: number }) =>
  [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].map(([dx, dy]) => ({ x: p.x + dx! * RESTOS_JITTER, y: p.y + dy! * RESTOS_JITTER }));

const MAR_VIVO: PlaceInput[] = [
  {
    // REQ-AVE-020: pide que lo acerquen a una fiesta y deja un código de entradas.
    id: 'naufrago',
    name: 'El náufrago',
    category: 'naufrago',
    tags: TAGS,
    position: { ...at([-5.6, 16.4]), zone: 'marvivo' },
    geometry: {
      ...ellipseCollision(1.3, 0.85, 20),
      proximityRadius: proximity(2.2, 'isla'),
    },
    behaviors: [
      block(),
      prox(),
      talk([
        '¡Llevo tres fiestas esperando aquí! Acércame a una de BOIA y te dejo un regalo.',
        'Arrima el barco al banco y subo de un salto.',
      ]),
      // Al arrimarse: sube a bordo y deja su código (una vez).
      discount('dto-naufrago', 'contact'),
      points(20, 'contact'),
    ],
    source: [
      'zonas/marvivo/islas/banco_naufrago',
      'zonas/marvivo',
      'zonas/marvivo/lugares/naufrago',
      'zonas/marvivo/proximidad/naufrago',
    ],
  },
  ...RESTOS.map((p, i): PlaceInput => {
    const id = `restos-${i + 1}`;
    const pos = at(p);
    return {
      id,
      name: 'Restos flotantes',
      category: 'restos',
      tags: [...TAGS, 'sin-brujula'],
      position: { ...pos, zone: 'marvivo' },
      geometry: { activation: { shape: 'circle', radius: 36 } },
      // REQ-AVE-016: se recogen al pasar, dan monedas y vuelven en otra visita.
      behaviors: [
        { type: 'collectible', params: {} },
        { type: 'spawn', params: { positions: jitter(pos) } },
        coins(RESTOS_COINS, 'session'),
      ],
      source: [`zonas/marvivo/restos/${i}`],
    };
  }),
  ...(
    [
      // El primero se apartó en T157 (estaba en [-12,6; 13,8]): ahí está la isla del castillo.
      [-10.6, 15.2],
      [-5.4, -1.8],
    ] as Maq[]
  ).map((p, i): PlaceInput => {
    const pos = at(p);
    return {
      id: `cofre-${i + 1}`,
      name: 'Cofre fugaz',
      category: 'cofre',
      tags: [...TAGS, 'sin-brujula'],
      position: { ...pos, zone: 'marvivo' },
      geometry: { activation: { shape: 'circle', radius: 30 } },
      // REQ-AVE-017: 20 s a la vista, luego se esconde y vuelve a salir. muestra
      behaviors: [
        { type: 'collectible', params: {} },
        {
          type: 'spawn',
          params: {
            probability: 0.8,
            lifetime: 20,
            every: 25,
            positions: [pos, { x: pos.x + 180, y: pos.y - 120 }, { x: pos.x - 160, y: pos.y + 140 }],
          },
        },
        coins(COFRE_COINS, 'session'),
        points(COFRE_POINTS, undefined, 'session'),
      ],
      source: [
        ...(i === 0 ? [T157] : []),
        `zonas/marvivo/lugares/cofre_${i + 1}`,
        `zonas/marvivo/proximidad/cofre_${i + 1}`,
      ],
    };
  }),
  {
    // REQ-AVE-018 (O15, T45): no se queda aquí; aparece junto al barco en mar abierto
    // y guía hacia algo sin descubrir (la lógica, en la web). Este es su sitio de
    // descanso: ni en el minimapa ni en la brújula.
    id: 'delfin',
    name: 'Delfín',
    category: 'delfin',
    tags: [...TAGS, 'oculto'],
    position: { ...at([-10.8, 8.6]), zone: 'marvivo' },
    geometry: { proximityRadius: proximity(2.0, 'isla') },
    behaviors: [prox(), deco('salto')],
    params: {
      trail: [at([-9.6, 6.9]), at([-10.9, 4.9]), at([-9.4, 2.9])],
      rewardCoins: 25,
    },
    source: ['zonas/marvivo/lugares/delfin', 'zonas/marvivo/proximidad/delfin'],
  },
  {
    // REQ-AVE-019: reto de control; la fuerza de giro la pone el motor (`swirl`).
    id: 'remolino',
    name: 'Remolino',
    category: 'remolino',
    tags: TAGS,
    appearance: { layer: 'water' },
    position: { ...at([-10.2, 0.6]), zone: 'marvivo' },
    geometry: { proximityRadius: proximity(1.7, 'isla') },
    behaviors: [prox(), deco('giro')],
    params: { swirl: { strength: 110, pull: 25 } },
    source: ['zonas/marvivo/lugares/remolino', 'zonas/marvivo/proximidad/remolino'],
  },
];

/**
 * Sitios de las botellas del mapa (`zonas/marvivo/lugares/botella_*`). Las
 * botellas no son lugares (T22: viven en el repositorio); las de muestra se
 * ponen aquí. El primer sitio es la bocana del puerto, para leer una nada
 * más salir.
 */
export const BOTTLE_SPOTS: { id: string; x: number; y: number; source: string[] }[] = [
  { id: 'bocana', ...port([1.6, 21.6]), source: ['zonas/puerto/lugares/bocana'] },
  ...(
    [
      [-8.2, 4.4],
      [-2.8, 13.4],
      [-13.2, -2.4],
    ] as Maq[]
  ).map((p, i) => ({
    id: `botella_${i + 1}`,
    ...at(p),
    source: [
      `zonas/marvivo/lugares/botella_${i + 1}`,
      `zonas/marvivo/proximidad/botella_${i + 1}`,
    ],
  })),
];

// --- Los Rápidos (antes El Freu): el circuito (a escala de posiciones) --------

/*
 * Desde T61 (entrevista del 2026-10-01) el circuito es cerrado: tres vueltas
 * marcadas por boias que hay que pasar en orden, con la salida como meta.
 * T73 (decisiones del 2026-10-02) lo alarga y lo reparte por el mapa: sube
 * por el este, pasa entre Els Dents y las Rocas del Freu (el atajo de la
 * maqueta), gira al norte, cruza el centro por debajo de la Isla del Sonido,
 * baja por el oeste junto al acantilado, vuelve por el sur hacia El Varadero
 * y cierra entre el Puerto de Alicante y la Isla de Halloween. Las boias quedan
 * lejos de las islas (en /mar, fuera de su radio de proximidad: abrir su
 * panel anularía la carrera). Impulsos y rampas de salto van siempre en
 * mitad de un tramo, apuntando a la boia siguiente; las rocas y medusas
 * nuevas, a un lado del tramo. El checkpoint 2 y la meta de la maqueta
 * quedan fuera del trazado (inactivos), como el cartel del atajo. Las piezas
 * nuevas no están en `mapa.json`: su fuente es `plan:T61` o `plan:T73`.
 * Posiciones, vueltas y medallas son `muestra`.
 */

/** Fuente de las piezas del circuito que añadieron T61 y T73 (no están en la maqueta). */
const T61 = 'plan:T61';
const T73 = 'plan:T73';

/**
 * Boias del circuito (orden ≥ 1) por orden de paso: id, nombre, punto,
 * fuentes. Las que vienen de la maqueta y se movieron (T73) llevan primero
 * `plan:T73` y después su entrada de `mapa.json`.
 */
const RACE_BUOYS: { id: string; name: string; p: Maq; source: string[] }[] = [
  { id: 'circuito-cp1', name: 'Boia 1', p: [12.5, -4.0], source: [T73, 'circuito/checkpoints/0'] },
  { id: 'circuito-cp-a', name: 'Boia 2', p: [12.9, -12.0], source: ['circuito/checkpoints/2'] },
  { id: 'circuito-giro', name: 'Boia 3', p: [11.4, -17.4], source: [T73, T61] },
  { id: 'circuito-cp-s', name: 'Boia 4', p: [5.6, -7.5], source: [T73, 'circuito/checkpoints/1'] },
  { id: 'circuito-poniente', name: 'Boia 5', p: [-4.0, -7.2], source: [T73] },
  { id: 'circuito-acantilado', name: 'Boia 6', p: [-11.8, -0.8], source: [T73] },
  { id: 'circuito-delfin', name: 'Boia 7', p: [-11.0, 9.4], source: [T73] },
  { id: 'circuito-regreso', name: 'Boia 8', p: [-0.8, 16.5], source: [T73, T61] },
  { id: 'circuito-recta', name: 'Boia 9', p: [4.8, 6.4], source: [T73, T61] },
];

/** Vueltas de una carrera. muestra */
export const CIRCUIT_LAPS = 3;
/**
 * Medallas: tiempo total máximo (ms) de las tres vueltas para el oro, la
 * plata y el bronce. Un piloto que va derecho a cada boia, sin turbo, hace
 * unos 66 s, plata (`app/mar/race.test.ts` lo mide); el oro pide turbo,
 * impulsos y rampas. muestra
 */
export const CIRCUIT_MEDALS = { gold: 60_000, silver: 74_000, bronze: 98_000 } as const;

/** El trazado de una vuelta: de la salida por cada boia y de vuelta a la salida. */
const COURSE: Maq[] = [CIRCUIT_START, ...RACE_BUOYS.map((b) => b.p), CIRCUIT_START];

/** El tramo `leg` (de la boia `leg` a la `leg + 1`; la 0 es la salida): origen, dirección y largo. */
function legOf(leg: number): { a: Maq; dx: number; dy: number; len: number } {
  const a = COURSE[leg]!;
  const b = COURSE[leg + 1]!;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return { a, dx: (b[0] - a[0]) / len, dy: (b[1] - a[1]) / len, len };
}

const r2m = (v: number) => Math.round(v * 100) / 100;

/**
 * Un punto del tramo `leg` a la fracción `t` de su largo y `side` u_maq a la
 * derecha de la marcha (negativo: a la izquierda).
 */
function onLeg(leg: number, t: number, side = 0): Maq {
  const { a, dx, dy, len } = legOf(leg);
  return [r2m(a[0] + dx * len * t - dy * side), r2m(a[1] + dy * len * t + dx * side)];
}

/** Rumbo (rad) de `p` a la boia que cierra el tramo `leg`: hacia donde apunta lo que va en él. */
function towardNext(leg: number, p: Maq): number {
  const b = COURSE[leg + 1]!;
  return Math.round(Math.atan2(b[1] - p[1], b[0] - p[0]) * 1000) / 1000;
}

const gate = (
  id: string,
  name: string,
  p: Maq,
  order: number,
  boost: number,
  source: string[],
): PlaceInput => ({
  id,
  name,
  category: 'circuito',
  tags: [...TAGS, 'sin-brujula'],
  position: { ...at(p), zone: 'circuito' },
  // La boia se pasa rozándola: cuenta dentro de ~1,8 u_maq.
  geometry: { activation: { shape: 'circle', radius: size(1.8) } },
  behaviors: [
    { type: 'checkpoint', params: { circuitId: CIRCUIT_ID, order, boost, on: 'contact' } },
  ],
  source,
});

/** Una pieza de la maqueta que ya no forma parte del circuito (se conserva, inactiva). */
const retired = (p: PlaceInput): PlaceInput => ({
  ...p,
  active: false,
  geometry: {},
  behaviors: [deco()],
});

/**
 * Impulsos (flechas en el agua) y rampas de salto (T73): en qué tramo y a
 * qué fracción de él. Siempre en mitad del tramo, nunca junto a una boia.
 * muestra
 */
const BOOST_SPOTS: { leg: number; t: number }[] = [
  { leg: 0, t: 0.5 },
  { leg: 3, t: 0.55 },
  { leg: 6, t: 0.5 },
  { leg: 8, t: 0.45 },
];
const RAMP_SPOTS: { leg: number; t: number }[] = [
  { leg: 4, t: 0.5 },
  { leg: 7, t: 0.5 },
  { leg: 9, t: 0.5 },
];

/**
 * El salto de una rampa: altura (u de motor) y s en el aire. Sólo se ve; la
 * rampa además impulsa como un impulso flojo. muestra
 */
export const RAMP_JUMP = { height: 40, duration: 1.1 } as const;

/** Impulsos y rampas: punto y rumbo hacia la boia siguiente. */
const BOOST_PADS = BOOST_SPOTS.map(({ leg, t }) => {
  const p = onLeg(leg, t);
  return { p, heading: towardNext(leg, p) };
});
const RAMPS = RAMP_SPOTS.map(({ leg, t }) => {
  const p = onLeg(leg, t);
  return { p, heading: towardNext(leg, p) };
});

/**
 * Rocas y medusas de T73 por el camino: a un lado del tramo (u_maq), de modo
 * que quien va derecho las roza y quien se abre choca. muestra
 */
const RACE_OBSTACLES: { kind: 'roca' | 'medusa'; leg: number; t: number; side: number }[] = [
  { kind: 'roca', leg: 0, t: 0.3, side: 0.75 },
  { kind: 'medusa', leg: 4, t: 0.3, side: -0.7 },
  { kind: 'roca', leg: 5, t: 0.35, side: 0.7 },
  { kind: 'roca', leg: 5, t: 0.65, side: -0.7 },
  { kind: 'medusa', leg: 6, t: 0.75, side: 0.65 },
  { kind: 'roca', leg: 7, t: 0.25, side: -0.75 },
  { kind: 'medusa', leg: 7, t: 0.75, side: 0.7 },
  { kind: 'roca', leg: 8, t: 0.7, side: 0.75 },
];

/**
 * Carriles: boias de decorado por fuera del trazado (no bloquean). Cada rama
 * de la maqueta marca unos tramos.
 */
const LANES: { rama: string; from: number; to: number }[] = [
  { rama: 'comun', from: 0, to: 1 },
  { rama: 'atajo', from: 1, to: 3 },
  { rama: 'segura', from: 3, to: 4 },
  { rama: 'final', from: 9, to: 10 },
];
/** u_maq entre boies de carril y del trazado a ellas. muestra */
const LANE_STEP = 2.4;
const LANE_OFFSET = 1.5;

/** Lo que una boia de carril no debe pisar (u_maq): rocas, arcos, boias, impulsos, rampas, islas. */
const LANE_KEEP_OUT: { p: Maq; r: number }[] = [
  { p: [10.7, -11.6], r: 1.8 },
  { p: [14.6, -12.0], r: 1.3 },
  { p: [13.4, -8.0], r: 0.8 },
  { p: [12.95, -15.3], r: 0.8 },
  { p: [7.1, -12.9], r: 1.0 },
  { p: [8.7, -12.9], r: 1.0 },
  { p: [7.9, -12.9], r: 1.0 },
  ...COURSE.map((p) => ({ p, r: 1.2 })),
  ...[...BOOST_PADS, ...RAMPS].map(({ p }) => ({ p, r: 1.0 })),
  ...RACE_OBSTACLES.map(({ leg, t, side }) => ({ p: onLeg(leg, t, side), r: 0.8 })),
  { p: [6.6, -1.2], r: 2.5 },
  { p: [8.5, 13.0], r: 3.5 },
];

/** Boies de carril por fuera de cada tramo del trazado (decorado: no bloquean). */
function laneBuoys(): PlaceInput[] {
  const out: PlaceInput[] = [];
  for (const lane of LANES) {
    let n = 0;
    for (let i = lane.from; i < lane.to; i++) {
      const steps = Math.max(1, Math.round(legOf(i).len / LANE_STEP));
      for (let k = 1; k < steps; k++) {
        // Por fuera: a la derecha de la marcha.
        const [x, y] = onLeg(i, k / steps, LANE_OFFSET);
        if (LANE_KEEP_OUT.some((o) => Math.hypot(x - o.p[0], y - o.p[1]) < o.r)) continue;
        n++;
        out.push({
          id: `circuito-carril-${lane.rama}-${n}${n % 2 ? 'd' : 'i'}`,
          name: 'Boia de carril',
          category: 'carril',
          tags: [...TAGS, 'sin-brujula'],
          position: { ...at([x, y]), zone: 'circuito' },
          geometry: {},
          behaviors: [deco()],
          source: [`circuito/${lane.rama}`],
        });
      }
    }
  }
  return out;
}

/** Impulsos en el agua del circuito: dan velocidad al pasar por encima (no bloquean). */
function boostPads(): PlaceInput[] {
  return BOOST_PADS.map(({ p, heading }, i) => ({
    id: `circuito-impulso-${i + 1}`,
    name: 'Impulso',
    category: 'impulso',
    tags: [...TAGS, 'sin-brujula'],
    position: { ...at(p), zone: 'circuito' },
    geometry: { activation: { shape: 'circle', radius: size(1.0) } },
    behaviors: [
      { type: 'collision', params: { mode: 'boost', intensity: 0.5, duration: 1.5, solid: false } },
    ],
    params: { heading },
    source: [i === 0 ? T61 : T73],
  }));
}

/**
 * Rampas de salto (T73): una plataforma con flechas hacia arriba. Pasar por
 * encima impulsa un poco y lanza el barco al aire (`params.jump`); al caer,
 * chapuzón. No bloquean.
 */
function ramps(): PlaceInput[] {
  return RAMPS.map(({ p, heading }, i) => ({
    id: `circuito-rampa-${i + 1}`,
    name: 'Rampa',
    category: 'rampa',
    tags: [...TAGS, 'sin-brujula'],
    position: { ...at(p), zone: 'circuito' },
    geometry: { activation: { shape: 'circle', radius: size(1.1) } },
    behaviors: [
      { type: 'collision', params: { mode: 'boost', intensity: 0.3, duration: 1.2, solid: false } },
    ],
    params: { heading, jump: { ...RAMP_JUMP } },
    source: [T73],
  }));
}

/** Las rocas (rebotan) y medusas (ralentizan) que T73 pone por el camino. */
function raceObstacles(): PlaceInput[] {
  const n = { roca: 1, medusa: 1 };
  return RACE_OBSTACLES.map(({ kind, leg, t, side }) => {
    const i = ++n[kind];
    return {
      id: `circuito-${kind}-${i}`,
      name: kind === 'roca' ? 'Roca' : 'Medusa',
      category: 'obstaculo',
      tags: TAGS,
      position: { ...at(onLeg(leg, t, side)), zone: 'circuito' },
      geometry: { collision: { shape: 'circle', radius: size(kind === 'roca' ? 0.6 : 0.45) } },
      // Medusa: ralentiza un 40 % durante 1,5 s, como la de T61 [provisional].
      behaviors: [kind === 'roca' ? bounce(0.45) : slow(0.4, 1.5)],
      source: [T73],
    };
  });
}

const CIRCUIT: PlaceInput[] = [
  {
    ...gate('circuito', 'Salida de Los Rápidos', CIRCUIT_START, 0, 0, [
      'circuito/salida',
      'zonas/circuito',
      'zonas/circuito/lugares/salida',
    ]),
    // Al acercarse se ve el récord (REQ-AVE-028: antes y después, no durante).
    geometry: {
      activation: { shape: 'circle', radius: size(1.8) },
      proximityRadius: proximity(4, 'isla'),
    },
    behaviors: [
      prox(),
      { type: 'checkpoint', params: { circuitId: CIRCUIT_ID, order: 0, boost: 0, on: 'contact' } },
    ],
    params: {
      circuit: CIRCUIT_ID,
      version: CIRCUIT_VERSION,
      laps: CIRCUIT_LAPS,
      medals: { ...CIRCUIT_MEDALS },
      destination: 'ultima',
    },
    tags: TAGS,
  },
  ...RACE_BUOYS.map((b, i) => gate(b.id, b.name, b.p, i + 1, 0.6, b.source)),
  retired(gate('circuito-cp2', 'Checkpoint 2', [11.4, -22.0], 0, 0, ['circuito/checkpoints/3'])),
  retired(
    gate('circuito-meta', 'Meta de Los Rápidos', [8.8, -25.0], 0, 0, [
      'circuito/meta',
      'zonas/circuito/lugares/meta',
    ]),
  ),
  ...boostPads(),
  ...ramps(),
  {
    id: 'circuito-semaforo',
    name: 'Semáforo de salida',
    category: 'decorado',
    tags: TAGS,
    position: { ...near(CIRCUIT_START, [14.95, 5.25]), zone: 'circuito' },
    geometry: {},
    behaviors: [deco()],
    source: ['art:circuito#semaforo', 'zonas/circuito/lugares/grada'],
  },
  // Sin ramas desde T61, el cartel del atajo ya no señala nada: queda inactivo.
  retired({
    id: 'circuito-cartel',
    name: 'Cartel ATAJO →',
    category: 'obstaculo',
    tags: TAGS,
    position: { ...at([12.3, -4.68]), zone: 'circuito' },
    geometry: { collision: { shape: 'circle', radius: size(0.38) } },
    behaviors: [bounce(0.3)],
    source: ['art:circuito#cartel', 'circuito/cartel_atajo', 'zonas/circuito/lugares/atajo'],
  }),
  {
    id: 'circuito-dents',
    name: 'Els Dents',
    category: 'obstaculo',
    tags: TAGS,
    position: { ...at([10.7, -11.6]), zone: 'circuito' },
    geometry: ellipseCollision(1.5, 1.15, 80),
    behaviors: [block()],
    source: ['zonas/circuito/islas/dents'],
  },
  {
    id: 'circuito-freu',
    name: 'Rocas del Freu',
    category: 'obstaculo',
    tags: TAGS,
    position: { ...at([14.6, -12.0]), zone: 'circuito' },
    geometry: ellipseCollision(1.0, 0.7, 90),
    behaviors: [block()],
    source: ['zonas/circuito/islas/freu'],
  },
  // Los tres obstáculos de la maqueta (REQ-AVE-030).
  {
    id: 'circuito-roca',
    name: 'Roca',
    category: 'obstaculo',
    tags: TAGS,
    position: { ...at([13.4, -8.0]), zone: 'circuito' },
    geometry: { collision: { shape: 'circle', radius: size(0.4) } },
    behaviors: [bounce(0.45)],
    source: ['circuito/obstaculos/0'],
  },
  {
    id: 'circuito-medusa',
    name: 'Medusa',
    category: 'obstaculo',
    tags: TAGS,
    position: { ...at([12.95, -15.3]), zone: 'circuito' },
    geometry: { collision: { shape: 'circle', radius: size(0.35) } },
    // Ralentiza un 40 % durante 1,5 s [provisional].
    behaviors: [slow(0.4, 1.5)],
    source: ['circuito/obstaculos/1'],
  },
  {
    id: 'circuito-cocodrilo',
    name: 'Cocodrilo',
    category: 'cocodrilo',
    tags: TAGS,
    position: { ...at([7.9, -12.9]), zone: 'circuito' },
    geometry: { collision: { shape: 'circle', radius: size(0.55) } },
    behaviors: [slow(0.6, 2), deco()],
    // Vaivén entre dos puntos (el motor lo mueve: `patrol`); cruza el tramo de la boia 3 a la 4.
    params: { patrol: { points: [at([7.1, -12.9]), at([8.7, -12.9])], period: 7 } },
    source: ['circuito/obstaculos/2'],
  },
  ...raceObstacles(),
  ...laneBuoys(),
];

// --- Secretos (con el marcador de T39: `art:secreto#secreto`) --------------------

const secret = (
  id: string,
  name: string,
  p: Maq,
  i: number,
  behaviors: BehaviorInput[],
  zone: string,
): PlaceInput => ({
  id: `secreto-${id}`,
  name,
  category: 'secreto',
  // Ni en el minimapa ni en la brújula: se insinúan en el mar (REQ-AVE-015).
  tags: [...TAGS, 'oculto'],
  position: { ...at(p), zone },
  geometry: { proximityRadius: size(3), activation: { shape: 'circle', radius: 40 } },
  behaviors: [prox(), ...behaviors, { type: 'achievement', params: { trigger: 'collect_objects' } }],
  source: [`secretos/${i}`],
});

const SECRETS: PlaceInput[] = [
  secret('cueva', 'La cueva del acantilado', [-14.8, 4.2], 0, [coins(25), points(30)], 'marvivo'),
  {
    // El tesoro: un descuento (REQ-AVE-021) y monedas, al recogerla.
    ...secret('anfora', 'El ánfora de Agost', [8.1, 9.5], 1, [], 'cala'),
    behaviors: [
      { type: 'collectible', params: {} },
      discount('dto-cofre'),
      coins(25),
      { type: 'achievement', params: { trigger: 'collect_objects' } },
    ],
    geometry: { activation: { shape: 'circle', radius: 40 } },
  },
  secret('campana', 'La campana hundida', [-13.2, -16.0], 2, [points(40)], 'fotos'),
  secret('circulo', 'El círculo de las boies dormidas', [-5.0, -27.0], 3, [coins(30), points(40)], 'ultima'),
];

// --- Las cinco boies informativas (O12, D-23; T45) ----------------------------------

/**
 * Cinco boies que hablan por proximidad a lo largo de la ruta principal
 * (`mapa.json` → `rutas.principal`), como la primera boia: con ella son seis
 * y cuentan para los logros de las boies (`find_boia`). Ids y temas de
 * `docs/propuestas/textos-zonas.md` (zona 23); cada mundo pone su nombre y
 * sus dos bocadillos en su skin. mapa.json no las tiene: su sitio lo decide
 * T45 junto a un punto de la ruta y dentro del sector de su tramo. Su arte es
 * la mascota de BOIA (`art:boias#info_<n>`, T39). muestra
 */
export const INFO_BOIES: {
  id: string;
  name: string;
  at: Maq;
  zone: string;
  lines: string[];
  /**
   * Lo que señala al terminar de hablar (T59): el id de la misión central, de
   * un sitio con descuento, de un minijuego o del «Tablón del faro» (T157).
   * Si ya está hecho, la web manda a lo pendiente más cercano. muestra
   */
  guide: string;
}[] = [
  {
    // Entre la bocana y la primera isla (ruta principal [1,5; 19,8]).
    id: 'boia-espacio',
    name: 'La boia del espacio',
    at: [1.7, 19.6],
    zone: 'puerto',
    guide: 'naufrago',
    lines: [
      '¡Plop! ¿Sabes por qué existe BOIA?',
      'Para dar espacio a artistas nuevos y a gente con algo que contar.',
    ],
  },
  {
    // Entre la primera isla y el encuentro de la Fiestera ([2,2; 9,6] → [-0,9; 7,8]).
    id: 'boia-descubrir',
    name: 'La boia de descubrir',
    at: [1.3, 9.0],
    zone: 'fiestera',
    guide: 'fiestera',
    lines: [
      'Aquí nadie te pregunta qué música te gusta.',
      'En BOIA suenan muchos géneros el mismo día.',
    ],
  },
  {
    // Entre la tienda y el Puerto de Fotos ([2,4; -2,6] → [-2,2; -5,4]).
    id: 'boia-pertenecer',
    name: 'La boia de pertenecer',
    at: [-2.0, -5.1],
    zone: 'allday',
    guide: 'secreto-anfora',
    lines: [
      'No vienes simplemente a BOIA: formas parte.',
      'Tu Carnet guarda tus sellos, tus respuestas y tu barco.',
    ],
  },
  {
    // Antes de la isla del escenario ([-3,2; -9,2] → [-0,2; -10,4]).
    id: 'boia-allday',
    name: 'La boia del All Day',
    at: [-0.4, -11.2],
    zone: 'allday',
    guide: 'canon',
    lines: [
      'Ahí delante está el escenario del All Day.',
      'Un All Day es un día entero de música, comida y gente.',
    ],
  },
  {
    // Cerca de la salida del circuito, antes de la última isla.
    id: 'boia-secretos',
    name: 'La boia de los secretos',
    at: [6.6, -24.4],
    zone: 'ultima',
    // Desde el plan 014 (T157), el faro es el «Tablón del faro»: manda al tablón.
    guide: LIGHTHOUSE_PLACE_ID,
    lines: ['Psst. No todo sale en el minimapa.', 'BOIA premia la curiosidad. Desvíate un poco.'],
  },
];

const INFO: PlaceInput[] = INFO_BOIES.map((b, i) => ({
  id: b.id,
  name: b.name,
  category: 'boia',
  tags: TAGS,
  position: { ...at(b.at), zone: b.zone },
  geometry: {
    // La huella de la mascota (`art:boias#info_<n>` → hitbox 0,47 u_maq).
    collision: { shape: 'circle', radius: size(0.47) },
    proximityRadius: proximity(3.2, 'encuentro'),
  },
  behaviors: [
    bounce(0.3),
    prox(),
    talk(b.lines, true),
    { type: 'achievement', params: { trigger: 'find_boia' } },
  ],
  params: { guide: b.guide },
  source: [`art:boias#info_${i + 1}`],
}));

// --- Zonas como sectores ----------------------------------------------------------

/** Rectángulo que envuelve el contorno de cada zona (`zonas[].contorno`). */
const ZONES: [string, string, number, number, number, number][] = [
  ['puerto', 'Puerto de salida', -7, 7, 19.2, 31],
  ['cala', 'Puerto de Alicante', 3, 15, 8, 19.2],
  ['fiestera', 'Encuentro de la Boia Fiestera', -7, 1.5, 3.5, 11],
  ['allday', 'Isla del Sonido', -6, 7, -21.5, -4.5],
  ['fotos', 'Isla de Benidorm', -15, -3, -15.5, -4.5],
  ['tienda', 'Ibiza', 1.5, 9.8, -4.5, 8],
  ['marvivo', 'Mar vivo', -15, -2, -4.5, 19.2],
  ['circuito', 'Los Rápidos', 7, 15, -25.8, 8],
  ['ultima', 'Isla de Nochevieja', -2, 15, -31.5, -21.5],
];

const clampY = (y: number) => Math.min(Math.max(y, ARCILLA_BOUNDS.top), ARCILLA_BOUNDS.bottom);

/** El mapa compartido, listo para `WorldRegistry`. */
export const ARCILLA_MAP: SharedMapInput = {
  id: SHARED_MAP_ID,
  version: 1,
  bounds: ARCILLA_BOUNDS,
  spawn: { ...port(PORT_ANCHOR), heading: -Math.PI / 2 },
  port: { ...port(PORT_ANCHOR), place: 'puerto' },
  // Aterrizaje de la entrada: el puerto (D-20, punto 6; T28 hace el encuadre).
  introLanding: port([0, 22.4]),
  sectors: ZONES.map(([id, name, x0, x1, y0, y1]) => ({
    id,
    name,
    area: {
      left: Math.max(at([x0, 0]).x, ARCILLA_BOUNDS.left),
      right: Math.min(at([x1, 0]).x, ARCILLA_BOUNDS.right),
      top: clampY(at([0, y0]).y),
      bottom: clampY(id === 'puerto' ? ARCILLA_BOUNDS.bottom : at([0, y1]).y),
    },
  })),
  // Las boies informativas van al final: así no cambia el orden de los demás lugares.
  places: [...PORT, ...ISLANDS, ...FIESTERA, ...MAR_VIVO, ...CIRCUIT, ...SECRETS, ...INFO],
};

/** Las anclas de las composiciones locales, por prefijo de id (para las pruebas). */
export const LOCAL_ANCHORS: [prefix: string, anchor: Maq][] = [
  ['puerto', PORT_ANCHOR],
  ['fiestera', FIESTERA_ANCHOR],
  ['circuito-semaforo', CIRCUIT_START],
];
