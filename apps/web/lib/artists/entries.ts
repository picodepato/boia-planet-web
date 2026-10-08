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

/** Un artista del contenido. */
export function contentArtistEntry(artist: Artist): ArtistEntry {
  return {
    key: artist.id,
    name: artist.name,
    genres: artist.genres,
    photoUrl: artist.photoUrl ?? null,
    avatar: null,
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
