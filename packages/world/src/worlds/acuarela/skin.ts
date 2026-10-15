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
      'world.acuarela.skin.puerto-boia.1',
      'world.acuarela.skin.puerto-boia.2',
      'world.acuarela.boia.tutorial.2',
      'world.acuarela.skin.puerto-boia.4',
      {
        text: 'world.acuarela.boia.tutorial.5',
        cue: 'pulse_minimap',
      },
      { text: 'world.acuarela.skin.puerto-boia.6', cue: 'pulse_menu' },
    ],
  },
  'puerto-whatsapp': {
    texts: {
      title: 'world.acuarela.skin.puerto-whatsapp.title',
      body: 'world.acuarela.skin.puerto-whatsapp.body',
    },
  },
  // El Puerto de Alicante (T108, antes la Cala Cantalar): aquí se cambia de barco.
  cala: {
    texts: {
      kicker: 'world.acuarela.skin.cala.kicker',
      body: 'world.acuarela.skin.cala.body',
    },
  },
  ultima: {
    texts: {
      kicker: 'world.acuarela.skin.ultima.kicker',
      body: 'world.acuarela.skin.ultima.body',
    },
  },
  fotos: {
    texts: {
      body: 'world.acuarela.island.fotos.body',
    },
  },
  tienda: {
    texts: {
      body: 'world.acuarela.skin.tienda.body',
    },
  },
  fiestera: {
    lines: ['world.acuarela.fiestera.call.1', 'world.acuarela.fiestera.board'],
  },
  naufrago: {
    lines: [
      'world.acuarela.naufrago.1',
      'world.acuarela.skin.naufrago.2',
      'world.acuarela.skin.naufrago.3',
    ],
  },
  // Las cinco boies informativas (O12, T45): textos-zonas.md, zona 23. muestra
  'boia-espacio': {
    lines: ['world.acuarela.boia.espacio.1', 'world.acuarela.boia.espacio.2'],
  },
  'boia-descubrir': {
    lines: ['world.acuarela.boia.descubrir.1', 'world.acuarela.boia.descubrir.2'],
  },
  'boia-pertenecer': {
    lines: ['world.acuarela.boia.pertenecer.1', 'world.acuarela.boia.pertenecer.2'],
  },
  'boia-allday': {
    lines: ['world.acuarela.boia.allday.1', 'world.acuarela.boia.allday.2'],
  },
  'boia-secretos': {
    lines: ['world.acuarela.boia.secretos.1', 'world.acuarela.boia.secretos.2'],
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
  puerto: 'world.acuarela.name.puerto',
  cala: 'world.acuarela.name.cala',
  fiestera: 'world.acuarela.name.fiestera',
  fotos: 'world.acuarela.name.fotos',
  tienda: 'world.acuarela.name.tienda',
  naufrago: 'world.acuarela.name.naufrago',
  remolino: 'world.acuarela.name.remolino',
  circuito: 'world.acuarela.name.circuito',
  'circuito-dents': 'world.acuarela.name.circuito',
  faro: 'world.acuarela.name.faro',
  canon: 'world.acuarela.name.canon',
  'boia-espacio': 'world.acuarela.boia.espacio.name',
  'boia-descubrir': 'world.acuarela.boia.descubrir.name',
  'boia-pertenecer': 'world.acuarela.boia.pertenecer.name',
  'boia-allday': 'world.acuarela.boia.allday.name',
  'boia-secretos': 'world.acuarela.boia.secretos.name',
};

export const ACUARELA_SKIN: WorldSkinInput = {
  id: ACUARELA_WORLD_ID,
  name: 'world.acuarela.name',
  tagline: 'world.acuarela.tagline',
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
