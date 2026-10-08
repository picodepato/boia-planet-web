import { sharedCoastArt, sharedPlaceAsset } from '../place-art';
import type { PlaceSkinInput, WorldSkinInput } from '../skin';
import { ARCILLA_MAP } from './map';

/**
 * La piel de Arcilla (B05) sobre el mapa compartido (T20): el arte de T18
 * (`art/mundos/arcilla/<lugar>/`, una pieza por lugar del mapa), los nombres
 * propuestos en `mundos/arcilla/diseno.md` y sus bocadillos. Nombres, textos
 * e historia son `muestra` [pendiente Álvaro, P11]. Los secretos y la grada
 * no tienen arte todavía: van con un marcador a propósito.
 *
 * Los textos visibles son claves del catálogo i18n de la web
 * (`apps/web/lib/i18n/`, plan 017 T195); la web las resuelve con
 * `resolveSkinTexts` al montar el registro de mundos.
 */

export const ARCILLA_WORLD_ID = 'arcilla';

/** Bocadillos y textos de Arcilla (mapa.json → `texto` y `encuentro`). */
const SKIN_TEXT: Record<string, PlaceSkinInput> = {
  'puerto-boia': {
    lines: [
      'world.arcilla.skin.puerto-boia.1',
      'world.arcilla.boia.tutorial.2',
      'world.arcilla.skin.puerto-boia.3',
      { text: 'world.arcilla.boia.tutorial.5', cue: 'pulse_minimap' },
      { text: 'world.arcilla.skin.puerto-boia.5', cue: 'pulse_menu' },
    ],
  },
  'puerto-whatsapp': {
    texts: {
      title: 'whatsapp.title',
      body: 'world.arcilla.skin.puerto-whatsapp.body',
    },
  },
  // El Puerto de Alicante (T108, antes la Cala Cantalar): aquí se cambia de barco.
  cala: {
    texts: {
      kicker: 'world.arcilla.skin.cala.kicker',
      body: 'world.arcilla.skin.cala.body',
    },
  },
  ultima: {
    texts: {
      kicker: 'world.arcilla.skin.ultima.kicker',
      body: 'world.arcilla.island.ultima.body',
    },
  },
  fotos: {
    texts: { body: 'world.arcilla.island.fotos.body' },
  },
  tienda: {
    texts: { body: 'world.arcilla.island.tienda.body' },
  },
  fiestera: {
    lines: ['world.arcilla.fiestera.call.1', 'world.arcilla.skin.fiestera.2'],
  },
  naufrago: {
    lines: ['world.arcilla.naufrago.1', 'world.arcilla.naufrago.2'],
  },
  // Las cinco boies informativas (O12, T45): textos-zonas.md, zona 23. muestra
  'boia-espacio': {
    lines: ['world.arcilla.boia.espacio.1', 'world.arcilla.boia.espacio.2'],
  },
  'boia-descubrir': {
    lines: ['world.arcilla.boia.descubrir.1', 'world.arcilla.boia.descubrir.2'],
  },
  'boia-pertenecer': {
    lines: ['world.arcilla.boia.pertenecer.1', 'world.arcilla.boia.pertenecer.2'],
  },
  'boia-allday': {
    lines: ['world.arcilla.boia.allday.1', 'world.arcilla.boia.allday.2'],
  },
  'boia-secretos': {
    lines: ['world.arcilla.boia.secretos.1', 'world.arcilla.boia.secretos.2'],
  },
};

/**
 * Nombres propios de Arcilla (diseno.md → `propuesta_nombre`), como claves
 * i18n; las islas de evento no. Desde el 2026-10-02 (Hernán y Álvaro) las
 * islas de Arcilla llevan nombres reales del Mediterráneo y de Alicante
 * (Isla de Benidorm, Botiga Ibiza, Tabarca, Puig Campana; la Cala Cantalar
 * es desde el 2026-10-04 el Puerto de Alicante, T108): son los nombres
 * comunes del mapa (`./map`), así que aquí sólo quedan el puerto, el remanso,
 * el circuito y las boias.
 */
const NAMES: Record<string, string> = {
  puerto: 'world.arcilla.skin.name.puerto',
  fiestera: 'world.arcilla.skin.name.fiestera',
  circuito: 'world.arcilla.skin.name.circuito',
  'boia-espacio': 'world.arcilla.boia.espacio.name',
  'boia-descubrir': 'world.arcilla.boia.descubrir.name',
  'boia-pertenecer': 'world.arcilla.boia.pertenecer.name',
  'boia-allday': 'world.arcilla.boia.allday.name',
  'boia-secretos': 'world.arcilla.boia.secretos.name',
};

export const ARCILLA_SKIN: WorldSkinInput = {
  id: ARCILLA_WORLD_ID,
  // Es el mundo principal: su nombre no se enseña como «Arcilla» (plan 017, decisión 3).
  name: 'world.arcilla.name',
  tagline: 'world.arcilla.tagline',
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
