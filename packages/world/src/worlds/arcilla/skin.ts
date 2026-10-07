import { sharedCoastArt, sharedPlaceAsset } from '../place-art';
import type { PlaceSkinInput, WorldSkinInput } from '../skin';
import { ARCILLA_MAP } from './map';

/**
 * La piel de Arcilla (B05) sobre el mapa compartido (T20): el arte de T18
 * (`art/mundos/arcilla/<lugar>/`, una pieza por lugar del mapa), los nombres
 * propuestos en `mundos/arcilla/diseno.md` y sus bocadillos. Nombres, textos
 * e historia son `muestra` [pendiente Álvaro, P11]. Los secretos y la grada
 * no tienen arte todavía: van con un marcador a propósito.
 */

export const ARCILLA_WORLD_ID = 'arcilla';

/** Bocadillos y textos de Arcilla (mapa.json → `texto` y `encuentro`). */
const SKIN_TEXT: Record<string, PlaceSkinInput> = {
  'puerto-boia': {
    lines: [
      '¡Plop! Bienvenido. Una Boia Fiestera se ha perdido entre cocodrilos: encuéntrala y llévala a la Isla de Nochevieja.',
      'Toca en cualquier sitio y arrastra: el barco va hacia donde apuntes.',
      'Por el camino hay monedas, descuentos y algún secreto. Toca para seguir.',
      {
        text: 'Arriba tienes el minimapa: tócalo para ampliar, mantenlo pulsado para moverlo.',
        cue: 'pulse_minimap',
      },
      { text: 'Y en el ancla está el Menú de a bordo. ¡Buen viaje!', cue: 'pulse_menu' },
    ],
  },
  'puerto-whatsapp': {
    texts: {
      title: 'Boia de WhatsApp',
      body: 'Si quieres enterarte antes que nadie de la próxima fiesta, BOIA tiene un grupo de WhatsApp. Es voluntario y puedes salir cuando quieras.',
    },
  },
  // El Puerto de Alicante (T108, antes la Cala Cantalar): aquí se cambia de barco.
  cala: {
    texts: {
      kicker: 'Puerto',
      body: 'Aquí amarran todos los barcos de BOIA. Elige el tuyo, cámbialo cuando quieras y vuelve a la mar.',
    },
  },
  ultima: {
    texts: {
      kicker: 'Isla de Nochevieja',
      body: 'Aquí el año se despide bailando y la fiesta acaba cuando sale el sol. Quédate un rato: esto no se ve desde la orilla.',
    },
  },
  fotos: {
    texts: { body: 'Todas las fotos de BOIA se revelan aquí. Pasa por el marco y sonríe.' },
  },
  tienda: {
    texts: {
      body: 'Camisetas, tote bags y pegatinas. La tienda de verdad está en tierra; esto es su escaparate.',
    },
  },
  fiestera: {
    lines: [
      '¡Eh, barquito! Estos señores no me dejan ir a la fiesta.',
      '¿Me llevas a la Isla de Nochevieja? Te lo pagaré bailando.',
    ],
  },
  naufrago: {
    lines: [
      '¡Llevo tres fiestas esperando aquí! Acércame a una de BOIA y te dejo un regalo.',
      'Arrima el barco al banco de arena y subo de un salto.',
    ],
  },
  // Las cinco boies informativas (O12, T45): textos-zonas.md, zona 23. muestra
  'boia-espacio': {
    lines: [
      '¡Plop! ¿Sabes por qué existe BOIA?',
      'Para dar espacio: a artistas nuevos, a proyectos raros y a gente con algo que contar. Como este horno, que cuece de todo.',
    ],
  },
  'boia-descubrir': {
    lines: [
      'Aquí nadie te pregunta qué música te gusta.',
      'En BOIA suenan house, cumbia, techno o ambient en el mismo día. Vienes por uno y te vas con cinco.',
    ],
  },
  'boia-pertenecer': {
    lines: [
      '¿Ves las huellas de dedos en el barro? Todo aquí lleva la marca de alguien.',
      'No vienes simplemente a BOIA: formas parte. Tu Carnet guarda tus sellos, tus respuestas y tu barco.',
    ],
  },
  'boia-allday': {
    lines: [
      'Ahí delante está el escenario del All Day.',
      'Un All Day es un día entero: paella, música, juegos y alguna sorpresa. De la comida al amanecer.',
    ],
  },
  'boia-secretos': {
    lines: [
      'Psst. No todo sale en el minimapa.',
      'Una cueva, un ánfora, una campana… BOIA premia la curiosidad. Desvíate un poco.',
    ],
  },
};

/**
 * Nombres propios de Arcilla (diseno.md → `propuesta_nombre`); las islas de
 * evento no. Desde el 2026-10-02 (Hernán y Álvaro) las islas de Arcilla
 * llevan nombres reales del Mediterráneo y de Alicante (Isla de Benidorm,
 * Ibiza, Tabarca, L'Illeta dels Banyets; la Cala Cantalar es desde el
 * 2026-10-04 el Puerto de Alicante, T108): son los nombres comunes del mapa
 * (`./map`), así que aquí sólo quedan el puerto, el remanso, el circuito y
 * las boias.
 */
const NAMES: Record<string, string> = {
  puerto: 'El Varadero',
  fiestera: 'El Remanso de los Cocodrilos',
  circuito: 'Los Rápidos',
  'boia-espacio': 'La boia del horno',
  'boia-descubrir': 'La boia del chiringuito',
  'boia-pertenecer': 'La boia de las huellas',
  'boia-allday': 'La boia del escenario',
  'boia-secretos': 'La boia chismosa',
};

export const ARCILLA_SKIN: WorldSkinInput = {
  id: ARCILLA_WORLD_ID,
  // Es el mundo principal: su nombre no se enseña como «Arcilla» (plan 017, decisión 3).
  name: 'Mundo principal',
  tagline:
    'Barro cocido en la costa de Alicante: rescata a la Boia Fiestera de los cocodrilos y llévala a la Isla de Nochevieja.',
  ship: { style: 'arcilla' },
  sea: { base: '#1a7aa6', wave: '#3aa3c4', crest: '#f4efe6' },
  ui: { accent: '#e43b30' },
  music: null,
  coast: sharedCoastArt(ARCILLA_WORLD_ID),
  places: Object.fromEntries(
    ARCILLA_MAP.places.map((p, i) => [
      p.id,
      {
        asset: sharedPlaceAsset(ARCILLA_WORLD_ID, p.id, i),
        ...SKIN_TEXT[p.id],
      },
    ]),
  ),
  names: NAMES,
};
