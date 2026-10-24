/**
 * Álvaro's real content, in one place (plan 007 T82; what to deliver and in
 * which format: docs/contenido-real.md). The sample content
 * (`./content.ts`) is built from this: filling it in needs no code.
 *
 * Links (P15): `null` (or a missing entry) is the `muestra` flag: the content
 * then carries a sandbox link under `SAMPLE_LINK_BASE` (example.com), and the
 * page marks it «muestra» next to the link (`isSampleLink`, @boia/contracts).
 * Paste the real URL in its place and the mark goes away.
 *
 * Files (P17, P19): put the file in `apps/web/public/contenido/…` with the
 * name below and add its id to the list; a test checks that files and lists
 * agree.
 */
export interface RealContent {
  links: {
    /** Ticket link per event id (the ticketera's page; P2/D-06 decides the ticketera). */
    tickets: Readonly<Record<string, string>>;
    /** Legacy external store value, retained for existing content. T103 uses /tienda. */
    store: string | null;
    /** The WhatsApp group or chat (`https://chat.whatsapp.com/…` or `https://wa.me/…`). */
    whatsapp: string | null;
    /** Instagram profile (P15; the handle `@boia.planet`). No TikTok: BOIA has none (plan 045 T325). */
    instagram: string | null;
    /** Contact email (the address, not `mailto:`). */
    email: string | null;
    /**
     * BOIA's Spotify playlist (plan 007 T79). `null` shows nothing: no
     * «escucha» column, no «Escúchalo en Spotify», no «muestra» placeholder
     * (plan 045 T325), until a real playlist exists.
     */
    spotifyPlaylist: string | null;
    /**
     * Each artist's Spotify by artist id: a URL, or `null` if the artist has
     * none (no link). A missing artist keeps the sample's sandbox link.
     */
    artistSpotify: Readonly<Record<string, string | null>>;
  };
  /** Artist ids with a photo in `apps/web/public/contenido/artistas/<id>.webp` (P17). */
  artistPhotos: readonly string[];
  /** Event ids with a poster in `apps/web/public/contenido/carteles/<id>.webp` (P19). */
  eventPosters: readonly string[];
}

/** Folders under `apps/web/public` (served from the site root). */
export const ARTIST_PHOTO_DIR = '/contenido/artistas';
export const EVENT_POSTER_DIR = '/contenido/carteles';

export const artistPhotoPath = (id: string) => `${ARTIST_PHOTO_DIR}/${id}.webp`;
export const eventPosterPath = (id: string) => `${EVENT_POSTER_DIR}/${id}.webp`;

/** Today: Halloween poster, WhatsApp group, Instagram and contact email are real; the rest is `muestra`. */
export const REAL_CONTENT: RealContent = {
  links: {
    tickets: {},
    store: null,
    whatsapp: 'https://chat.whatsapp.com/LfcWsDaBzbLAB6H7WK7Lyw',
    instagram: 'https://www.instagram.com/boia.planet/',
    email: 'hola@boiaplanet.net',
    spotifyPlaylist: null,
    artistSpotify: {},
  },
  artistPhotos: [],
  eventPosters: ['halloween-2026'],
};
