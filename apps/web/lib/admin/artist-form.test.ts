import { artistSchema, type Artist } from '@boia/contracts';
import { describe, expect, it } from 'vitest';
import { artistFormOf, artistFromForm } from './artist-form';

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

  it('edits the name, genres, photo and Spotify; empty removes them', () => {
    const form = { ...artistFormOf(ARTIST), name: ' Alba ', genres: 'House, , Techno' };
    expect(artistFromForm(ARTIST, form)).toEqual({
      ...ARTIST,
      name: 'Alba',
      genres: ['House', 'Techno'],
    });
    const spotify = 'https://open.spotify.com/artist/otra';
    expect(artistFromForm(ARTIST, { ...form, spotify }).spotifyUrl).toBe(spotify);
    const cleared = artistFromForm(ARTIST, { ...form, photo: ' ', spotify: '' });
    expect(cleared).not.toHaveProperty('photoUrl');
    expect(cleared).not.toHaveProperty('spotifyUrl');
  });

  it('what it saves passes the schema, with a site path for the photo', () => {
    const saved = artistFromForm(ARTIST, {
      ...artistFormOf(ARTIST),
      photo: '/contenido/artistas/alba-fitz.webp',
    });
    expect(artistSchema.parse(saved)).toEqual(saved);
  });
});
