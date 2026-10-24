import { SAMPLE_LINK_BASE } from '@boia/contracts/links';
import type { AreaInput } from '../schema';
import { artistPhotoPath, eventPosterPath, REAL_CONTENT, type RealContent } from './real-content';

/**
 * Contenido de MUESTRA de la web (home, eventos, artistas, fotos, descuentos).
 * Sale de `apps/web/lib/landing/sample-content.ts` (plan 001), que la landing
 * sigue usando hasta que lea de `@boia/store`. Todo lo que no es textual de la
 * v14 es inventado y va marcado `sample`: eventos, fechas, enlaces (sandbox en
 * example.com), códigos de descuento. Los 26 artistas son la lista provisional
 * de v14 §18.1, textual, sin foto (avatar neutro).
 *
 * Lo real de Álvaro (enlaces, fotos de artistas, carteles) entra por
 * `./real-content.ts` (plan 007 T82): cada `sample…(real)` de aquí pone lo
 * real donde lo hay y deja el enlace sandbox (marcado «muestra») donde no.
 *
 * Los eventos con entradas van a sus islas del mapa compartido
 * (mundos/arcilla/mapa.json, D-20, y la Isla de Halloween de T67), no a la
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

const SANDBOX = SAMPLE_LINK_BASE;

/** El álbum de las fotos reales de BOIA, sin la marca `muestra` (plan 029 T277). */
export const REAL_ALBUM_ID = 'album-boia';

/** Piezas del bloque de la home: la selección de la portada (7 fotos y 2 clips hoy, plan 048 T328). */
export const HOME_PHOTOS_LIMIT = 9;

/** The home blocks with the real links where there are (P15) and sandbox ones elsewhere. */
export function sampleHomeBlocks(real: RealContent = REAL_CONTENT): AreaInput<'homeBlocks'>[] {
  const l = real.links;
  return [
    {
      id: 'hero',
      type: 'hero',
      visible: true,
      title: 'BOIA UNDERGROUND MUSIC FESTIVAL',
      // §37.11, frase de trabajo. [pendiente Álvaro]
      positioning: 'Música sin un único género. Cultura sin un único formato.',
    },
    { id: 'priority', type: 'priority_event', visible: true, eventId: 'halloween-2026' },
    { id: 'upcoming', type: 'upcoming_events', visible: true, limit: 6 },
    // «Sácate el Carnet» (plan 030 T288): el Carnet, necesario para entrar, y el WhatsApp.
    { id: 'carnet', type: 'carnet', visible: true },
    // Al menos 7 fotos en la home: las 4 reales y las de muestra de la selección (plan 029 T277).
    { id: 'photos', type: 'photos', visible: true, limit: HOME_PHOTOS_LIMIT },
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
      url: '/tienda',
      products: ['Camisetas', 'Tote bag BOIA', 'Packs de pegatinas'],
    },
    {
      id: 'contact',
      type: 'contact',
      visible: true,
      email: l.email ?? 'hola@example.com',
      links: [{ label: 'WhatsApp', url: l.whatsapp ?? `${SANDBOX}/whatsapp` }],
    },
    {
      id: 'footer',
      type: 'footer',
      visible: true,
      officialLinks: [
        { label: 'Instagram', url: l.instagram ?? `${SANDBOX}/instagram` },
        // BOIA's playlist (plan 007 T79): the artists band and the footer link
        // to it. Only a real one (plan 045 T325): no sample placeholder.
        ...(l.spotifyPlaylist ? [{ label: 'Spotify', url: l.spotifyPlaylist }] : []),
      ],
    },
  ];
}

export const SAMPLE_HOME_BLOCKS: AreaInput<'homeBlocks'>[] = sampleHomeBlocks();

/**
 * Los tres eventos con entradas (Álvaro, 2026-10-02), cada uno en su isla
 * del mapa compartido (`@boia/world`, `TICKET_ISLAND_EVENTS`): BOIA
 * Halloween en el Kiki García (isla `halloween`), SONIDO (isla `allday`,
 * `allday`) y BOIA Nochevieja (Isla de Nochevieja, `ultima`, donde se
 * entrega la Boia Fiestera). Nombre, fecha y sitio son reales; horas,
 * precios, descripciones y enlaces, `muestra`. Los eventos de muestra de
 * antes (All Day de primavera y de verano, Noche de mayo) ya no están: sólo
 * quedan el borrador (no se ve) y el finalizado (el archivo y sus fotos).
 */
export const HALLOWEEN_EVENT_ID = 'halloween-2026';
export const SONIDO_EVENT_ID = 'sonido-2026';
export const NOCHEVIEJA_EVENT_ID = 'nochevieja-2026';
/** Hora de cierre de la lista de Halloween (plan 034 T308): 22:30 del 31, Europe/Madrid. */
export const HALLOWEEN_LIST_CLOSES_AT = '2026-10-31T22:30:00+01:00';

/** Isla de cada evento con entradas (ids del mapa compartido). */
export const TICKET_EVENT_ISLANDS: Readonly<Record<string, string>> = {
  [HALLOWEEN_EVENT_ID]: 'halloween',
  [SONIDO_EVENT_ID]: 'allday',
  [NOCHEVIEJA_EVENT_ID]: 'ultima',
};

const BASE_EVENTS: AreaInput<'events'>[] = [
  {
    id: HALLOWEEN_EVENT_ID,
    slug: HALLOWEEN_EVENT_ID,
    name: 'HALLOWEEN IN THE CLUB',
    format: 'satelite',
    series: 'boia-club',
    // Fecha y hora reales (cartel: de 22:00 a 4:00; Álvaro 2026-10-22).
    startsAt: '2026-10-31T22:00:00+01:00',
    timeZone: 'Europe/Madrid',
    placeLabel: 'Kiki García',
    state: 'on_sale',
    description:
      'La noche de Halloween de BOIA. Disfraz opcional, música sin etiqueta y un bar lleno de fantasmas con buen gusto.',
    artistIds: [],
    priceCents: 500,
    priceSample: true,
    // Plan 019 T215 (decisión 6): sin venta online, «Solo en puerta · 5 € con
    // carnet». Muestra.
    boxOfficeOnly: { doorPriceCents: 500 },
    // Plan 034 T308 (Álvaro 2026-10-21): va en lista, tope 100; la lista vale
    // hasta las 22:30 del 31 (Alicante) y después, por orden de llegada.
    guestList: { cap: 100, closesAt: HALLOWEEN_LIST_CLOSES_AT, open: true },
    islandId: TICKET_EVENT_ISLANDS[HALLOWEEN_EVENT_ID],
    sample: false,
  },
  {
    id: SONIDO_EVENT_ID,
    slug: SONIDO_EVENT_ID,
    name: 'ALL DAY BOIA',
    format: 'all_day',
    // La fecha es real; las horas, de muestra.
    startsAt: '2026-12-05T12:00:00+01:00',
    endsAt: '2026-12-06T02:00:00+01:00',
    timeZone: 'Europe/Madrid',
    placeLabel: 'Alicante · ubicación secreta',
    state: 'on_sale',
    description:
      'Un día entero alrededor del sonido: muros de altavoces, música sin un único género y gente con ganas de bailar.',
    artistIds: ['alba-fitz', 'amenaza-verde', 'casta-diva', 'manija', 'marabina'],
    activities: ['Comida', 'Mercadillo de artistas locales'],
    priceCents: 2500,
    priceSample: true,
    // Plan 019 T215 (decisiones 5 y 14): vuelve la venta online (ticketera
    // por elegir) y vale el premio de la Boia Fiestera.
    ticketUrl: `${SANDBOX}/tickets/${SONIDO_EVENT_ID}`,
    // Álvaro, 2026-10-14 (plan 030 T292): «Tickets todavía no disponibles».
    ticketsNotYet: true,
    islandId: TICKET_EVENT_ISLANDS[SONIDO_EVENT_ID],
    sample: false,
  },
  {
    id: NOCHEVIEJA_EVENT_ID,
    slug: NOCHEVIEJA_EVENT_ID,
    name: 'BOIA Nochevieja',
    format: 'satelite',
    // La fecha es real; las horas, de muestra.
    startsAt: '2026-12-31T23:00:00+01:00',
    endsAt: '2027-01-01T08:00:00+01:00',
    timeZone: 'Europe/Madrid',
    placeLabel: 'Alicante',
    state: 'on_sale',
    description:
      'Despedimos el año con BOIA: uvas, confeti y música hasta que salga el sol del primer día.',
    artistIds: ['rbs', 'rkvx', 'tere-ling'],
    priceCents: 3000,
    priceSample: true,
    ticketUrl: `${SANDBOX}/tickets/${NOCHEVIEJA_EVENT_ID}`,
    // Álvaro, 2026-10-14 (plan 030 T292): «Tickets todavía no disponibles».
    ticketsNotYet: true,
    islandId: TICKET_EVENT_ISLANDS[NOCHEVIEJA_EVENT_ID],
    sample: false,
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

/** The events with their real ticket link (P15) and poster (P19) where there are. */
export function sampleEvents(real: RealContent = REAL_CONTENT): AreaInput<'events'>[] {
  return BASE_EVENTS.map((e) => {
    const ticketUrl = real.links.tickets[e.id];
    return {
      ...e,
      ...(ticketUrl ? { ticketUrl } : {}),
      ...(real.eventPosters.includes(e.id) ? { posterUrl: eventPosterPath(e.id) } : {}),
    };
  });
}

export const SAMPLE_EVENTS: AreaInput<'events'>[] = sampleEvents();

/** The other platforms of the sample's music links (plan 019 T217), in turn. */
const SAMPLE_MUSIC_PLATFORMS = ['soundcloud', 'bandcamp', 'instagram'] as const;

/**
 * The artists with their photo (P17) and Spotify (P15) where there are. Until
 * Álvaro sends them, every other artist has a sandbox Spotify link (plan 007
 * T79), and the rest a sandbox SoundCloud, Bandcamp or Instagram link (plan
 * 019 T217, decisión 10), all marked «muestra» on the page. An artist whose
 * real Spotify is known to be missing (null) gets no link.
 */
export function sampleArtists(real: RealContent = REAL_CONTENT): AreaInput<'artists'>[] {
  return ARTISTS_V14.map(([name, genres], i) => {
    const id = slugify(name);
    const known = id in real.links.artistSpotify;
    const spotify = known
      ? real.links.artistSpotify[id]
      : i % 2 === 0
        ? `${SANDBOX}/spotify/artist/${id}`
        : null;
    const platform = SAMPLE_MUSIC_PLATFORMS[((i - 1) / 2) % SAMPLE_MUSIC_PLATFORMS.length];
    const music =
      !known && !spotify && platform ? { platform, url: `${SANDBOX}/${platform}/${id}` } : null;
    return {
      id,
      name,
      genres,
      ...(real.artistPhotos.includes(id) ? { photoUrl: artistPhotoPath(id) } : {}),
      ...(spotify ? { spotifyUrl: spotify } : {}),
      ...(music ? { music } : {}),
    };
  });
}

export const SAMPLE_ARTISTS: AreaInput<'artists'>[] = sampleArtists();

export const SAMPLE_ALBUMS: AreaInput<'albums'>[] = [
  // Fotos reales de BOIA (plan 029 T277): sin evento ni isla, van a la galería general; sin `sample`.
  // Desde el plan 048 (T328) es el único álbum: las fotos y los clips de muestra ya no existen.
  {
    id: REAL_ALBUM_ID,
    title: 'Fotos de BOIA',
    date: '2026-10-13T12:00:00+02:00',
    coverPhotoId: 'galeria-1',
  },
];

/** Dónde están las fotos y los clips reales de la Galería (docs/contenido-real.md). */
const GALLERY_DIR = '/contenido/galeria';

/**
 * Las fotos reales (plan 048 T328): las 7 que mandó Álvaro el 2026-10-24
 * (tools/galeria/fotos.mjs, WebP de ≤ 1600 px), en el orden de la portada, y
 * las 2 de antes que se quedan (plan 023 T250, derechos aprobados el
 * 2026-10-13), sólo en la galería. `onHome`: en la selección de la portada.
 */
const REAL_PHOTOS = [
  {
    id: 'galeria-dj-cabina-humo-neon',
    alt: 'DJ en la cabina entre humo y luces de neón',
    width: 930,
    height: 1600,
    onHome: true,
  },
  {
    id: 'galeria-dj-neones-humo',
    alt: 'DJ entre neones y humo',
    width: 912,
    height: 1600,
    onHome: true,
  },
  {
    id: 'galeria-djs-cantando-palmeras',
    alt: 'DJs cantando entre luces de neón y palmeras',
    width: 1076,
    height: 1462,
    onHome: true,
  },
  {
    id: 'galeria-fiesta-nocturna-humo',
    alt: 'Fiesta nocturna entre luces y humo',
    width: 1536,
    height: 1024,
    onHome: true,
  },
  {
    id: 'galeria-grafiti-valla',
    alt: 'Grafiti nocturno junto a la valla iluminada',
    width: 1451,
    height: 1084,
    onHome: true,
  },
  {
    id: 'galeria-mezcla-allen-heath',
    alt: 'Mezcla nocturna en una mesa Allen & Heath',
    width: 1600,
    height: 872,
    onHome: true,
  },
  {
    id: 'galeria-pista-baile-humo',
    alt: 'Pista de baile entre luces y humo',
    width: 1098,
    height: 1433,
    onHome: true,
  },
  {
    id: 'galeria-1',
    alt: 'DJ con un vinilo en la mano, en la cabina de los platos',
    width: 1200,
    height: 675,
    onHome: false,
  },
  {
    id: 'galeria-2',
    alt: 'Gente bailando en una fiesta de BOIA',
    width: 1200,
    height: 675,
    onHome: false,
  },
] as const;

/**
 * Los clips reales (plan 048 T328; tools/galeria/clips.mjs): H.264 sin audio,
 * 1280 px de lado largo, con su póster WebP. Los dos primeros, en la portada
 * detrás de las fotos; el tercero, sólo en la galería.
 */
const REAL_CLIPS = [
  {
    id: 'clip-20260530-231216',
    alt: 'Gente bailando de noche entre luces azules y moradas',
    width: 1280,
    height: 720,
    onHome: true,
  },
  {
    id: 'clip-img-0561',
    alt: 'Una banda toca en directo bajo un toldo: batería, guitarra, teclado y bajo',
    width: 720,
    height: 1280,
    onHome: true,
  },
  {
    id: 'clip-img-0564',
    alt: 'DJ pinchando vinilos en una cabina redonda, bajo una bola de discoteca y una red',
    width: 720,
    height: 1280,
    onHome: false,
  },
] as const;

/**
 * Las fotos y los clips de la Galería, todos reales y en `REAL_ALBUM_ID`. Los
 * marcados `selection` salen en la portada (D-23, respuesta 6), en este orden;
 * todos, en `/galeria`. En la portada un clip enseña su póster y sólo se
 * reproduce, mudo, mientras está en pantalla (REQ-COM-032).
 */
export const SAMPLE_PHOTOS: AreaInput<'photos'>[] = [
  ...REAL_PHOTOS.map((p) => ({
    id: p.id,
    albumId: REAL_ALBUM_ID,
    alt: p.alt,
    src: `${GALLERY_DIR}/${p.id}.webp`,
    width: p.width,
    height: p.height,
    selection: p.onHome,
  })),
  ...REAL_CLIPS.map((c) => ({
    id: c.id,
    albumId: REAL_ALBUM_ID,
    alt: c.alt,
    kind: 'video' as const,
    src: `${GALLERY_DIR}/${c.id}.mp4`,
    poster: `${GALLERY_DIR}/${c.id}.webp`,
    width: c.width,
    height: c.height,
    selection: c.onHome,
  })),
];

export const SAMPLE_PROMOTIONS: AreaInput<'promotions'>[] = [];

/**
 * Los tres descuentos escondidos en el mundo (T59, decisión de Hernán y
 * Álvaro; REQ-COM-020 a 022): el del náufrago, el del ánfora (el «cofre») y
 * el premio de la Boia Fiestera, que se da al dejarla en la Isla de
 * Nochevieja. Cada
 * uno sale como «?» en el minimapa. Los códigos son inventados (`muestra`,
 * P16). Ya no hay código caducado en los restos ni descuento de tienda en el
 * mundo: el Admin puede seguir escondiendo uno de tienda (`hiddenAt`).
 */
export const SAMPLE_DISCOUNTS: AreaInput<'discounts'>[] = [
  {
    id: 'dto-naufrago',
    code: 'NAUFRAGO10',
    // SONIDO se vende sólo en taquilla (plan 017 T199): el código va a Nochevieja.
    label: '-10 % en BOIA Nochevieja',
    eventId: NOCHEVIEJA_EVENT_ID,
    kind: 'percent',
    value: 10,
    endsAt: '2026-12-30T23:59:00+01:00',
    conditions: 'Una vez por compra. Muestra: no es un código real.',
    sample: true,
  },
  {
    id: 'dto-cofre',
    code: 'COFRE5',
    label: '5 € menos en BOIA Nochevieja',
    eventId: 'nochevieja-2026',
    kind: 'amount',
    value: 500,
    endsAt: '2026-12-30T23:59:00+01:00',
    conditions: 'Muestra: no es un código real.',
    sample: true,
  },
  {
    // El premio de la misión central (T59): vale para cualquier entrega y,
    // si hay otro código para la misma compra, se aplica éste (prioridad).
    id: 'dto-fiestera',
    code: 'FIESTERA20',
    // Decisión 14 del plan 019 (reunión del 2026-10-08): vale para las dos
    // fiestas, ALL DAY BOIA y BOIA Nochevieja; lo dicen la etiqueta y las condiciones.
    label: '-20 % en ALL DAY BOIA o BOIA Nochevieja',
    kind: 'percent',
    value: 20,
    priority: 10,
    endsAt: '2027-12-31T23:59:00+01:00',
    conditions:
      'Vale para una entrada de ALL DAY BOIA o de BOIA Nochevieja. Sólo para quien rescata a la Boia Fiestera y la lleva a la Isla de Nochevieja. Muestra: no es un código real.',
    sample: true,
  },
];

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
