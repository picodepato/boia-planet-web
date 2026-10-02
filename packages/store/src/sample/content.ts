import type { AreaInput } from '../schema';

/**
 * Contenido de MUESTRA de la web (home, eventos, artistas, fotos, descuentos).
 * Sale de `apps/web/lib/landing/sample-content.ts` (plan 001), que la landing
 * sigue usando hasta que lea de `@boia/store`. Todo lo que no es textual de la
 * v14 es inventado y va marcado `sample`: eventos, fechas, enlaces (sandbox en
 * example.com), códigos de descuento. Los 26 artistas son la lista provisional
 * de v14 §18.1, textual, sin foto (avatar neutro).
 *
 * Diferencia con la muestra de la landing: el evento de primavera va a la isla
 * `allday` del mapa compartido (mundos/arcilla/mapa.json, D-20), no a la
 * `isla-primavera` del mundo de muestra de plan 001.
 */

const ARTISTS_V14: ReadonlyArray<[string, string[]]> = [
  ['Alba Fitz', ['Melodic Techno', 'Downtempo']],
  ['Amenaza Verde', ['Cumbia']],
  ['Casta Diva', ['Hip Hop']],
  ['DJ Alpina', ['Electro', 'Techno']],
  ['DJ Sacred', ['Techno']],
  ['EGFNK', ['House']],
  ['Franco Maltratto', ['Reggaeton', 'House']],
  ['Koko Moreno', ['Reggaeton', 'House', 'Hard Dance']],
  ['Las Precarias de Torrevieja', ['Techno', 'Hard Dance']],
  ['Latin Master X', ['House']],
  ['Manija', ['Melodic Techno', 'Techno', 'Psytrance']],
  ['Marabina', ['Ambient', 'Experimental']],
  ['Moglia (Live)', ['Hip Hop', 'Jazz Fusion']],
  ['Nacho Age', ['House']],
  ['Nat', ['House']],
  ['Pollo Can Fly', ['Hard Dance', 'Hard Trance']],
  ['The Rancho Cashmere Band', ['Country']],
  ['RBS', ['Techno']],
  ['RKVX', ['Techno']],
  ['Soviet Gym', ['House']],
  ['Spowy', ['House']],
  ['Stonzze', ['Hard Bounce', 'Hard Trance']],
  ['Tere Ling', ['Hard Bounce', 'Hard Groove', 'Hard Trance']],
  ['Tonitto', ['Reggaeton', 'Hip Hop']],
  ['Torvik', ['Tech House']],
  ['Wet Kisses', ['Trance']],
];

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const SANDBOX = 'https://example.com/boia-sandbox';

export const SAMPLE_HOME_BLOCKS: AreaInput<'homeBlocks'>[] = [
  {
    id: 'hero',
    type: 'hero',
    visible: true,
    title: 'BOIA UNDERGROUND MUSIC FESTIVAL',
    // §37.11, frase de trabajo. [pendiente Álvaro]
    positioning: 'Música sin un único género. Cultura sin un único formato.',
  },
  { id: 'priority', type: 'priority_event', visible: true, eventId: 'ev-all-day-primavera' },
  { id: 'upcoming', type: 'upcoming_events', visible: true, limit: 6 },
  { id: 'photos', type: 'photos', visible: true, limit: 6 },
  { id: 'artists', type: 'artists', visible: true, rotationMs: 5000 },
  {
    id: 'philosophy',
    type: 'philosophy',
    visible: true,
    // Versión breve a partir de §37 (docs/spec/10-filosofia.md). [pendiente Álvaro]
    paragraphs: [
      'BOIA nace en Alicante para dar espacio a lo que merece ser descubierto: nuevos DJs, productores, directos y proyectos que no encajan en una escena de club segmentada por géneros.',
      'No vienes simplemente a BOIA. Formas parte de BOIA.',
    ],
    verbs: [
      { verb: 'Dar espacio', text: 'A artistas, proyectos, ideas y personas.' },
      { verb: 'Descubrir', text: 'Música, cultura, personas y cosas que no esperabas.' },
      { verb: 'Pertenecer', text: 'Formar parte de una comunidad, no mirarla desde fuera.' },
    ],
  },
  {
    id: 'store',
    type: 'store',
    visible: true,
    url: `${SANDBOX}/tienda`,
    products: ['Camisetas', 'Tote bags', 'Packs de pegatinas'],
  },
  {
    id: 'contact',
    type: 'contact',
    visible: true,
    email: 'hola@example.com',
    links: [{ label: 'WhatsApp', url: `${SANDBOX}/whatsapp` }],
  },
  {
    id: 'footer',
    type: 'footer',
    visible: true,
    officialLinks: [
      { label: 'Instagram', url: `${SANDBOX}/instagram` },
      { label: 'TikTok', url: `${SANDBOX}/tiktok` },
    ],
  },
];

/**
 * Id del primer evento real (D-23, respuesta 2 de Álvaro): BOIA Club ·
 * Halloween en el Kiki García Bar. No es un All Day: es una activación
 * satélite de la serie BOIA Club, sin isla propia (vive en la localización
 * común, O7). Cartel «próximamente» (P19); precio y hora de muestra.
 */
export const HALLOWEEN_EVENT_ID = 'halloween-2026';

export const SAMPLE_EVENTS: AreaInput<'events'>[] = [
  {
    id: 'ev-all-day-primavera',
    slug: 'all-day-boia-primavera-2027',
    name: 'All Day BOIA · Primavera',
    format: 'all_day',
    startsAt: '2027-04-17T12:00:00+02:00',
    endsAt: '2027-04-18T02:00:00+02:00',
    timeZone: 'Europe/Madrid',
    placeLabel: 'Alicante · ubicación secreta',
    state: 'on_sale',
    description: 'Un día entero de música sin un único género, comida, actividades y sorpresas.',
    artistIds: ['alba-fitz', 'amenaza-verde', 'casta-diva', 'manija', 'marabina'],
    activities: ['Paella a mediodía', 'Mercadillo de artistas locales', 'Taller de serigrafía'],
    priceCents: 2500,
    ticketUrl: `${SANDBOX}/tickets/all-day-boia-primavera-2027`,
    islandId: 'allday',
    sample: true,
  },
  {
    id: HALLOWEEN_EVENT_ID,
    slug: HALLOWEEN_EVENT_ID,
    name: 'BOIA Club · Halloween',
    format: 'satelite',
    series: 'boia-club',
    // La fecha es real; la hora, de muestra hasta que Álvaro la confirme.
    startsAt: '2026-10-31T23:00:00+01:00',
    timeZone: 'Europe/Madrid',
    placeLabel: 'Kiki García Bar',
    state: 'on_sale',
    description:
      'La primera noche del BOIA Club. Disfraz opcional, música sin etiqueta y un bar lleno de fantasmas con buen gusto.',
    artistIds: [],
    priceCents: 1000,
    priceSample: true,
    ticketUrl: `${SANDBOX}/tickets/${HALLOWEEN_EVENT_ID}`,
    sample: false,
  },
  {
    id: 'ev-noche-mayo',
    slug: 'boia-noche-mayo-2027',
    name: 'BOIA Noche · Mayo',
    format: 'satelite',
    series: 'noche',
    startsAt: '2027-05-22T23:00:00+02:00',
    timeZone: 'Europe/Madrid',
    placeLabel: 'Alicante',
    state: 'on_sale',
    description: 'Una noche larga con cabina abierta a propuestas nuevas.',
    artistIds: ['rbs', 'rkvx', 'tere-ling'],
    priceCents: 1500,
    ticketUrl: `${SANDBOX}/tickets/boia-noche-mayo-2027`,
    sample: true,
  },
  {
    id: 'ev-all-day-verano',
    slug: 'all-day-boia-verano-2027',
    name: 'All Day BOIA · Verano',
    format: 'all_day',
    startsAt: '2027-07-10T12:00:00+02:00',
    // Hasta la apertura, «próximamente»; después, las fechas lo ponen a la venta.
    saleOpensAt: '2027-05-01T12:00:00+02:00',
    timeZone: 'Europe/Madrid',
    placeLabel: 'Alicante · ubicación secreta',
    state: 'coming_soon',
    description: 'El siguiente All Day BOIA. Cartel por anunciar.',
    artistIds: [],
    activities: ['Comida', 'Actividades por anunciar'],
    priceCents: 2800,
    islandId: 'allday',
    sample: true,
  },
  {
    id: 'ev-borrador',
    slug: 'borrador',
    name: 'Evento en borrador',
    format: 'satelite',
    startsAt: '2027-09-01T23:00:00+02:00',
    timeZone: 'Europe/Madrid',
    placeLabel: 'Alicante',
    state: 'draft',
    description: 'No debe aparecer en la home.',
    artistIds: [],
    sample: true,
  },
  {
    id: 'ev-finalizado',
    slug: 'all-day-boia-2026',
    name: 'All Day BOIA 2026',
    format: 'all_day',
    startsAt: '2026-06-20T12:00:00+02:00',
    timeZone: 'Europe/Madrid',
    placeLabel: 'Alicante',
    state: 'finished',
    description: 'Ya pasó: vive en el archivo y en su isla.',
    artistIds: ['dj-alpina', 'nat', 'spowy', 'wet-kisses'],
    activities: ['Paella', 'Mercadillo'],
    islandId: 'allday',
    sample: true,
  },
];

export const SAMPLE_ARTISTS: AreaInput<'artists'>[] = ARTISTS_V14.map(([name, genres]) => ({
  id: slugify(name),
  name,
  genres,
}));

export const SAMPLE_ALBUMS: AreaInput<'albums'>[] = [
  {
    id: 'album-muestra',
    title: 'All Day BOIA 2026',
    eventId: 'ev-finalizado',
    date: '2026-06-20T12:00:00+02:00',
    coverPhotoId: 'foto-1',
    sample: true,
  },
  {
    id: 'album-cala',
    title: 'Tardes en la cala',
    islandId: 'cala',
    date: '2026-08-15T19:00:00+02:00',
    sample: true,
  },
];

/**
 * Fotos de muestra (sin imagen: marcador). Las marcadas `selection` son las
 * que salen en la home (D-23, respuesta 6); todas, en `/fotos`, en la
 * galería de su isla (la del evento del álbum, o la del álbum).
 */
export const SAMPLE_PHOTOS: AreaInput<'photos'>[] = [
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `foto-${i + 1}`,
    albumId: 'album-muestra',
    alt: `Foto de muestra ${i + 1} de un All Day BOIA`,
    width: 4,
    height: 3,
    selection: i < 4,
  })),
  ...Array.from({ length: 3 }, (_, i) => ({
    id: `foto-cala-${i + 1}`,
    albumId: 'album-cala',
    alt: `Foto de muestra ${i + 1} de una tarde en la cala`,
    width: 3,
    height: 4,
    selection: i === 0,
  })),
];

export const SAMPLE_PROMOTIONS: AreaInput<'promotions'>[] = [];

/**
 * Los tres descuentos escondidos en el mundo (T59, decisión de Hernán y
 * Álvaro; REQ-COM-020 a 022): el del náufrago, el del ánfora (el «cofre») y
 * el premio de la Boia Fiestera, que se da al dejarla en la última isla. Cada
 * uno sale como «?» en el minimapa. Los códigos son inventados (`muestra`,
 * P16). Ya no hay código caducado en los restos ni descuento de tienda en el
 * mundo: el Admin puede seguir escondiendo uno de tienda (`hiddenAt`).
 */
export const SAMPLE_DISCOUNTS: AreaInput<'discounts'>[] = [
  {
    id: 'dto-naufrago',
    code: 'NAUFRAGO10',
    label: '-10 % en el All Day de primavera',
    eventId: 'ev-all-day-primavera',
    kind: 'percent',
    value: 10,
    endsAt: '2027-04-16T23:59:00+02:00',
    conditions: 'Una vez por compra. Muestra: no es un código real.',
    sample: true,
  },
  {
    id: 'dto-cofre',
    code: 'COFRE5',
    label: '5 € menos en la Noche de mayo',
    eventId: 'ev-noche-mayo',
    kind: 'amount',
    value: 500,
    endsAt: '2027-05-21T23:59:00+02:00',
    conditions: 'Muestra: no es un código real.',
    sample: true,
  },
  {
    // El premio de la misión central (T59): vale para cualquier entrega y,
    // si hay otro código para la misma compra, se aplica éste (prioridad).
    id: 'dto-fiestera',
    code: 'FIESTERA20',
    label: '-20 % en tu próxima entrada',
    kind: 'percent',
    value: 20,
    priority: 10,
    endsAt: '2027-12-31T23:59:00+01:00',
    conditions:
      'Sólo para quien rescata a la Boia Fiestera y la lleva a la última isla. Muestra: no es un código real.',
    sample: true,
  },
];

/**
 * El descuento de tener Carnet BOIA (T66, decisión de Hernán y Álvaro del
 * 2026-10-02): -10 % en la entrada para quien tiene Carnet. No se suma a los
 * códigos del mundo: la compra aplica el mejor de los dos y dice cuál. No es
 * un código escondido (no está en `discounts` ni sale en el mapa). Valor
 * `muestra`; el Admin lo podrá editar (T63).
 */
export const SAMPLE_CARNET_DISCOUNT: AreaInput<'discounts'> = {
  id: 'carnet',
  code: 'CARNET BOIA',
  label: '-10 % por tener Carnet BOIA',
  kind: 'percent',
  value: 10,
  conditions: 'En cada entrada, con tu Carnet BOIA. No se suma a otros códigos. Muestra.',
  sample: true,
};

/** Prefijo del id del Carnet de un artista (T66): `artista-<id del artista>`. */
export const ARTIST_CARNET_PREFIX = 'artista-';

/** Id del Carnet de un artista del contenido. */
export function artistCarnetId(artistId: string): string {
  return `${ARTIST_CARNET_PREFIX}${artistId}`;
}

/**
 * «Miembro desde» del Carnet de un artista que aún no toca en ningún evento:
 * el primer All Day de la muestra. `muestra`.
 */
export const ARTIST_CARNET_SINCE = '2025-06-21T12:00:00+02:00';
