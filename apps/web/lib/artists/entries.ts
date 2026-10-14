import type { Artist, MusicLink } from '@boia/contracts';

/**
 * Un artista tal como lo pintan /artistas y la banda de la landing (plan 019
 * T217, decisión 10): su imagen al lado, el nombre que abre su Carnet, «Ver
 * carnet» y el botón de su música.
 *
 * Hay dos clases: los del contenido (la ficha del Admin; su Carnet es el que
 * el repositorio construye de la ficha, `/carnet/artista-<id>`) y los que se
 * dieron de alta con el enlace de artistas (su propio Carnet, con el enlace a
 * su música que pusieron al crearlo).
 *
 * Este archivo no importa el repositorio, el Carnet ni zod (sólo tipos): viaja
 * con la landing (presupuesto D-26).
 */
export interface ArtistEntry {
  /** Único en la lista: el id de la ficha o `carnet:<userId>`. */
  key: string;
  name: string;
  genres: readonly string[];
  /** Foto (de la ficha o del Carnet); null: avatar. */
  photoUrl: string | null;
  /** El avatar neutro de un Carnet sin foto; null: las iniciales. */
  avatar: { glyph: string; bg: string } | null;
  /** Dónde está su Carnet. */
  carnetHref: string;
  music: MusicLink | null;
}

/** Prefijo del Carnet de un artista del contenido (el mismo que `ARTIST_CARNET_PREFIX` de @boia/store). */
export const CONTENT_ARTIST_CARNET_PREFIX = 'artista-';

/** La ruta del Carnet de alguien (la misma que `carnetPath` del Carnet). */
export function carnetHref(userId: string): string {
  return `/carnet/${encodeURIComponent(userId)}`;
}

/**
 * Su música: la suya o, si no, su Spotify. Lo mismo que `artistMusic` de
 * @boia/contracts, aquí para no traer zod a la landing.
 */
export function contentArtistMusic(artist: Pick<Artist, 'music' | 'spotifyUrl'>): MusicLink | null {
  if (artist.music) return artist.music;
  return artist.spotifyUrl ? { platform: 'spotify', url: artist.spotifyUrl } : null;
}

/**
 * El avatar que enseña el Carnet de un artista del contenido sin foto: el
 * neutro por defecto del Carnet (`DEFAULT_AVATAR` de lib/mundo/carnet/avatar,
 * que este archivo no importa para no traer @boia/store a la landing; un test
 * comprueba que es el mismo).
 */
export const CARNET_DEFAULT_AVATAR: { glyph: string; bg: string } = {
  glyph: '🌊',
  bg: '#1f6f8b',
};

/**
 * Un artista del contenido, con la imagen de su Carnet (plan 020 T227,
 * decisión 4): su foto o, sin ella, el avatar que su Carnet enseña.
 */
export function contentArtistEntry(artist: Artist): ArtistEntry {
  const photoUrl = artist.photoUrl ?? null;
  return {
    key: artist.id,
    name: artist.name,
    genres: artist.genres,
    photoUrl,
    avatar: photoUrl ? null : CARNET_DEFAULT_AVATAR,
    carnetHref: carnetHref(`${CONTENT_ARTIST_CARNET_PREFIX}${artist.id}`),
    music: contentArtistMusic(artist),
  };
}

/** Lo que hace falta de un Carnet de artista para ponerlo en la lista. */
export interface ArtistCarnet {
  userId: string;
  nickname: string;
  avatarImage: string | null;
  avatar: { glyph: string; bg: string } | null;
  music: MusicLink | null;
  /**
   * La ficha del contenido a la que el Admin unió este Carnet (plan 031
   * T295, `carnets.artist_profile_id`); null o ausente: sin unir.
   */
  artistProfileId?: string | null;
}

/** Un artista que se dio de alta con su Carnet. */
export function carnetArtistEntry(c: ArtistCarnet): ArtistEntry {
  return {
    key: `carnet:${c.userId}`,
    name: c.nickname,
    genres: [],
    photoUrl: c.avatarImage,
    avatar: c.avatarImage ? null : c.avatar,
    carnetHref: carnetHref(c.userId),
    music: c.music,
  };
}

/**
 * Una ficha reclamada (plan 031 T295): sale una vez, con el apodo del Carnet
 * (decisión de Álvaro), su foto (o la de la ficha; sin ninguna, el avatar
 * del Carnet), su música (o la de la ficha), los géneros de la ficha y
 * «Ver carnet» al Carnet de verdad. La clave sigue siendo el id de la ficha.
 */
export function claimedArtistEntry(artist: Artist, c: ArtistCarnet): ArtistEntry {
  const photoUrl = c.avatarImage ?? artist.photoUrl ?? null;
  return {
    key: artist.id,
    name: c.nickname,
    genres: artist.genres,
    photoUrl,
    avatar: photoUrl ? null : (c.avatar ?? CARNET_DEFAULT_AVATAR),
    carnetHref: carnetHref(c.userId),
    music: c.music ?? contentArtistMusic(artist),
  };
}

/**
 * Las fichas del contenido y los Carnets de artista en una lista (plan 031
 * T295): la ficha unida a un Carnet sale una vez (`claimedArtistEntry`) y el
 * Carnet ya no sale aparte. Las fichas sin unir y los Carnets sin ficha (o
 * con una ficha que ya no existe) salen como siempre. Primero las fichas, en
 * su orden; detrás, los Carnets.
 */
export function artistEntries(
  artists: readonly Artist[],
  carnets: readonly ArtistCarnet[],
): ArtistEntry[] {
  const ids = new Set(artists.map((a) => a.id));
  const claims = new Map<string, ArtistCarnet>();
  for (const c of carnets) {
    const id = c.artistProfileId;
    if (id && ids.has(id) && !claims.has(id)) claims.set(id, c);
  }
  const joined = new Set([...claims.values()].map((c) => c.userId));
  return [
    ...artists.map((a) => {
      const c = claims.get(a.id);
      return c ? claimedArtistEntry(a, c) : contentArtistEntry(a);
    }),
    ...carnets.filter((c) => !joined.has(c.userId)).map(carnetArtistEntry),
  ];
}
