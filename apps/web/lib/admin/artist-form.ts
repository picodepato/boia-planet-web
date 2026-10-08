import {
  type Artist,
  type MusicPlatform,
  artistMusic,
  musicLinkSchema,
  musicPlatformOf,
  normalizeMusicUrl,
} from '@boia/contracts';

/**
 * What the Admin's artist row edits (REQ-ADM-019; photo P17; the music link
 * of plan 019 T217, decision 10, which took over the Spotify one of P15).
 */
export interface ArtistForm {
  name: string;
  /** Comma-separated. */
  genres: string;
  /** `/contenido/artistas/<id>.webp` or an https URL; empty: neutral avatar. */
  photo: string;
  /** The artist's music: one https link; empty: no button. */
  music: string;
  /** Its platform, when the link's domain does not say it (a sandbox link of the sample). */
  platform: MusicPlatform;
}

export const genresOf = (s: string) =>
  s
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean);

export function artistFormOf(artist: Artist): ArtistForm {
  const music = artistMusic(artist);
  return {
    name: artist.name,
    genres: artist.genres.join(', '),
    photo: artist.photoUrl ?? '',
    music: music?.url ?? '',
    platform: music?.platform ?? 'spotify',
  };
}

/** The link's platform: its domain's, or the one picked in the row. */
export function formPlatform(form: Pick<ArtistForm, 'music' | 'platform'>): MusicPlatform {
  return musicPlatformOf(form.music) ?? form.platform;
}

/** The music link is not an https URL. */
export class ArtistMusicError extends Error {
  constructor() {
    super('música: un enlace https');
    this.name = 'ArtistMusicError';
  }
}

/**
 * The artist to save from the row: everything the artist already has, with
 * the form on top (plan 007 T82: saving used to drop the link). An empty
 * photo or music link removes it. A link that is not https throws
 * `ArtistMusicError`. The music goes to `music`; the old `spotifyUrl` goes
 * once the row saves another link (or none).
 */
export function artistFromForm(artist: Artist, form: ArtistForm): Artist {
  const next: Artist = { ...artist, name: form.name.trim(), genres: genresOf(form.genres) };
  const photo = form.photo.trim();
  if (photo) next.photoUrl = photo;
  else delete next.photoUrl;
  const before = artistMusic(artist);
  const raw = form.music.trim();
  if (before && raw === before.url && formPlatform(form) === before.platform) return next;
  delete next.spotifyUrl;
  delete next.music;
  if (!raw) return next;
  const url = normalizeMusicUrl(raw);
  const link = musicLinkSchema.safeParse({ platform: formPlatform(form), url });
  if (!url || !link.success) throw new ArtistMusicError();
  next.music = link.data;
  return next;
}
