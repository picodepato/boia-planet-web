import type { Artist } from '@boia/contracts';

/** What the Admin's artist row edits (REQ-ADM-019; photo P17, Spotify P15). */
export interface ArtistForm {
  name: string;
  /** Comma-separated. */
  genres: string;
  /** `/contenido/artistas/<id>.webp` or an https URL; empty: neutral avatar. */
  photo: string;
  /** The artist's Spotify; empty: no link. */
  spotify: string;
}

export const genresOf = (s: string) =>
  s
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean);

export function artistFormOf(artist: Artist): ArtistForm {
  return {
    name: artist.name,
    genres: artist.genres.join(', '),
    photo: artist.photoUrl ?? '',
    spotify: artist.spotifyUrl ?? '',
  };
}

/**
 * The artist to save from the row: everything the artist already has, with
 * the form on top (plan 007 T82: saving used to drop `spotifyUrl`). An empty
 * photo or Spotify removes it.
 */
export function artistFromForm(artist: Artist, form: ArtistForm): Artist {
  const next: Artist = { ...artist, name: form.name.trim(), genres: genresOf(form.genres) };
  const photo = form.photo.trim();
  const spotify = form.spotify.trim();
  if (photo) next.photoUrl = photo;
  else delete next.photoUrl;
  if (spotify) next.spotifyUrl = spotify;
  else delete next.spotifyUrl;
  return next;
}
