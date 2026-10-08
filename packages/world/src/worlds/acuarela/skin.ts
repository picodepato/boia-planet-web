import { ARCILLA_MAP } from '../arcilla/map';
import { sharedCoastArt, sharedPlaceAsset } from '../place-art';
import type { PlaceSkinInput, WorldSkinInput } from '../skin';

/**
 * La piel de Acuarela (B02) sobre el mapa compartido (T24): el arte de T19
 * (`art/mundos/acuarela/<lugar>/`, las mismas piezas que Arcilla), los
 * nombres de `mundos/acuarela/lugares.json` (sitios reales de la costa de
 * Alicante) y los textos de `mundos/acuarela/diseno.md`: el cuaderno de una
 * pintora la noche de Sant Joan, de la Explanada a la hoguera de la Isla de
 * Nochevieja.
 * Ningún lugar se mueve: el mapa es el de Arcilla. Las islas con
 * entradas (`halloween`, `allday`, `ultima`) conservan el nombre compartido. Todo es `muestra` [pendiente
 * Álvaro, preguntas al final de diseno.md].
 */

export const ACUARELA_WORLD_ID = 'acuarela';

/** Bocadillos y textos de Acuarela (diseno.md → «Texto de muestra» e «Historia»). */
const SKIN_TEXT: Record<string, PlaceSkinInput> = {
  'puerto-boia': {
    lines: [
      "¡Plop! Esta tarde es Sant Joan. La Fiestera se ha quedado en L'Albufereta con los farolillos.",
      'Encuéntrala y llévala a la Isla de Nochevieja antes de medianoche.',
      'Toca en cualquier sitio y arrastra: el remolcador va hacia donde apuntes.',
      'Por el camino hay monedas, descuentos y algún secreto. Toca para seguir.',
      {
        text: 'Arriba tienes el minimapa: tócalo para ampliar, mantenlo pulsado para moverlo.',
        cue: 'pulse_minimap',
      },
      { text: 'Y en el ancla está el Menú de a bordo. ¡Buena verbena!', cue: 'pulse_menu' },
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
      body: 'La pintora baja al puerto a pintar barcos. Elige uno de su cuaderno, cámbialo cuando quieras y sigue la verbena.',
    },
  },
  ultima: {
    texts: {
      kicker: 'Isla de Nochevieja',
      body: 'La verbena acaba en la Isla de Nochevieja: a medianoche se quema la hoguera y todos se mojan los pies para pedir un deseo.',
    },
  },
  fotos: {
    texts: {
      body: 'En La Vila cada casa es de un color para que los marineros la vieran desde el mar. Aquí cada foto de BOIA tiene su casa.',
    },
  },
  tienda: {
    texts: {
      body: 'Camisetas, bolsas y pegatinas. La tienda de verdad está en tierra; esta es su cúpula, que se ve desde lejos, como la de Altea.',
    },
  },
  fiestera: {
    lines: [
      '¡Eh, barquito azul! Estos señores se han quedado con mis farolillos.',
      '¿Me llevas a la Isla de Nochevieja? A medianoche se quema la hoguera.',
    ],
  },
  naufrago: {
    lines: [
      'Llevo tres verbenas esperando que alguien me pinte de vuelta a tierra.',
      'Acércame a una fiesta de BOIA y te dejo un regalo.',
      'Arrima el barco al banco de arena y subo de un salto.',
    ],
  },
  // Las cinco boies informativas (O12, T45): textos-zonas.md, zona 23. muestra
  'boia-espacio': {
    lines: [
      '¡Plop! La pintora deja siempre un hueco en blanco en cada página.',
      'BOIA hace lo mismo: deja espacio a artistas nuevos y a lo que todavía no tiene sitio.',
    ],
  },
  'boia-descubrir': {
    lines: [
      'En esta página caben todos los colores.',
      'Con la música pasa igual: en BOIA se mezclan géneros como se mezclan aguadas. Lo bueno sale en los bordes.',
    ],
  },
  'boia-pertenecer': {
    lines: [
      'En La Vila cada casa tiene su color para que la reconozcan desde el mar.',
      'Tu Carnet BOIA es tu color: apodo, respuestas, sellos y barco. Así te reconocen los demás.',
    ],
  },
  'boia-allday': {
    lines: [
      '¿Ves la barraca? Es la del All Day.',
      'Un día entero de música, comida y gente, montado como las barracas de Hogueras.',
    ],
  },
  'boia-secretos': {
    lines: [
      'La pintora esconde cosas en los márgenes.',
      'Si ves algo raro, acércate: en BOIA la curiosidad tiene premio.',
    ],
  },
};

/**
 * Nombres propios de Acuarela (lugares.json → `nombre`) de los lugares que
 * son un sitio. Los que son una cosa o un bicho (restos, cofres, botellas,
 * delfín) y las piezas sueltas conservan el nombre común; las tres islas con
 * entradas (HALLOWEEN IN THE CLUB, ALL DAY BOIA e Isla de Nochevieja, que
 * antes era Tabarca), el compartido (2026-10-02).
 */
export const ACUARELA_NAMES: Record<string, string> = {
  puerto: 'La Explanada',
  cala: 'Puerto de Alicante',
  fiestera: "L'Albufereta",
  fotos: 'La Vila Joiosa',
  tienda: 'Altea',
  naufrago: 'La Nao',
  remolino: 'Cap de la Nau',
  circuito: 'El Penyal',
  'circuito-dents': 'El Penyal',
  faro: "Cap de l'Horta",
  canon: "Torre de l'Illeta",
  'boia-espacio': 'La boia del margen',
  'boia-descubrir': 'La boia de la paleta',
  'boia-pertenecer': 'La boia de las casas',
  'boia-allday': 'La boia de la barraca',
  'boia-secretos': 'La boia del borrón',
};

export const ACUARELA_SKIN: WorldSkinInput = {
  id: ACUARELA_WORLD_ID,
  name: 'Acuarela',
  tagline:
    "El cuaderno de una pintora la noche de Sant Joan: lleva a la Boia Fiestera y sus farolillos de L'Albufereta a la hoguera de la Isla de Nochevieja.",
  ship: { style: 'acuarela' },
  // lugares.json → `mar`: aguada turquesa, lejos del azul del casco B02.
  sea: { base: '#5fb3ae', wave: '#8fd0c6', crest: '#fbf6ea' },
  // El azul del casco del remolcador B02.
  ui: { accent: '#2c62be' },
  music: null,
  coast: sharedCoastArt(ACUARELA_WORLD_ID),
  places: Object.fromEntries(
    ARCILLA_MAP.places.map((p, i) => [
      p.id,
      { asset: sharedPlaceAsset(ACUARELA_WORLD_ID, p.id, i), ...SKIN_TEXT[p.id] },
    ]),
  ),
  names: ACUARELA_NAMES,
};
