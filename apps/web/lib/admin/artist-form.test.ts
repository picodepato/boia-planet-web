import { artistSchema, type Artist } from '@boia/contracts';
import { describe, expect, it } from 'vitest';
import { ArtistMusicError, artistFormOf, artistFromForm } from './artist-form';

const ARTIST: Artist = artistSchema.parse({
  id: 'alba-fitz',
  name: 'Alba Fitz',
  genres: ['Melodic Techno'],
  photoUrl: '/contenido/artistas/alba-fitz.webp',
  spotifyUrl: 'https://open.spotify.com/artist/alba',
});

describe('the Admin artist row (plan 007 T82)', () => {
  it('saving without touching anything keeps the photo and the Spotify link', () => {
    expect(artistFromForm(ARTIST, artistFormOf(ARTIST))).toEqual(ARTIST);
  });

  it('edits the name, genres, photo and music; empty removes them', () => {
    const form = { ...artistFormOf(ARTIST), name: ' Alba ', genres: 'House, , Techno' };
    expect(artistFromForm(ARTIST, form)).toEqual({
      ...ARTIST,
      name: 'Alba',
      genres: ['House', 'Techno'],
    });
    const music = 'https://open.spotify.com/artist/otra';
    const saved = artistFromForm(ARTIST, { ...form, music });
    expect(saved.music).toEqual({ platform: 'spotify', url: music });
    expect(saved).not.toHaveProperty('spotifyUrl');
    const cleared = artistFromForm(ARTIST, { ...form, photo: ' ', music: '' });
    expect(cleared).not.toHaveProperty('photoUrl');
    expect(cleared).not.toHaveProperty('spotifyUrl');
    expect(cleared).not.toHaveProperty('music');
  });

  it('what it saves passes the schema, with a site path for the photo', () => {
    const saved = artistFromForm(ARTIST, {
      ...artistFormOf(ARTIST),
      photo: '/contenido/artistas/alba-fitz.webp',
    });
    expect(artistSchema.parse(saved)).toEqual(saved);
  });
});

describe('the music link of the Admin row (plan 019 T217, decision 10)', () => {
  it('the platform comes from the link: SoundCloud, Bandcamp, Instagram', () => {
    const form = artistFormOf(ARTIST);
    for (const [url, platform] of [
      ['https://soundcloud.com/alba', 'soundcloud'],
      ['alba.bandcamp.com', 'bandcamp'],
      ['https://www.instagram.com/alba', 'instagram'],
    ] as const) {
      const saved = artistFromForm(ARTIST, { ...form, music: url, platform: 'spotify' });
      expect(saved.music?.platform, url).toBe(platform);
      expect(artistSchema.parse(saved)).toEqual(saved);
    }
  });

  it('a link whose domain does not say it (a sandbox one) keeps the platform picked', () => {
    const music = 'https://example.com/boia-sandbox/bandcamp/alba';
    const saved = artistFromForm(ARTIST, { ...artistFormOf(ARTIST), music, platform: 'bandcamp' });
    expect(saved.music).toEqual({ platform: 'bandcamp', url: music });
    // And saving it again untouched keeps it.
    expect(artistFromForm(saved, artistFormOf(saved))).toEqual(saved);
  });

  it('a link that is not https is refused', () => {
    expect(() =>
      artistFromForm(ARTIST, { ...artistFormOf(ARTIST), music: 'http://soundcloud.com/alba' }),
    ).toThrow(ArtistMusicError);
  });
});
