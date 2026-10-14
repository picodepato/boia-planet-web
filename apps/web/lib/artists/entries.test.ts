import type { Artist } from '@boia/contracts';
import { describe, expect, it } from 'vitest';
import {
  type ArtistCarnet,
  CARNET_DEFAULT_AVATAR,
  artistEntries,
  carnetArtistEntry,
  carnetHref,
  contentArtistEntry,
} from './entries';

/**
 * Las fichas y los Carnets de artista en una lista (plan 031 T295): una ficha
 * unida a su Carnet sale una vez, con el apodo, la foto y la música del
 * Carnet (o las de la ficha), los géneros de la ficha y el Carnet de verdad.
 */
const alba: Artist = {
  id: 'alba-fitz',
  name: 'Alba Fitz',
  genres: ['Melodic Techno', 'Downtempo'],
  photoUrl: '/contenido/artistas/alba-fitz.webp',
  spotifyUrl: 'https://open.spotify.com/artist/alba',
};
const casta: Artist = { id: 'casta-diva', name: 'Casta Diva', genres: ['Hip Hop'] };
const artists = [alba, casta];

const carnet = (over: Partial<ArtistCarnet> = {}): ArtistCarnet => ({
  userId: 'u-alba',
  nickname: 'Albita',
  avatarImage: 'https://x.supabase.co/storage/v1/object/public/avatars/u-alba.webp',
  avatar: { glyph: '🎧', bg: '#2f8f6f' },
  music: { platform: 'soundcloud', url: 'https://soundcloud.com/albita' },
  artistProfileId: 'alba-fitz',
  ...over,
});
const loose: ArtistCarnet = {
  userId: 'u-nueva',
  nickname: 'Nueva',
  avatarImage: null,
  avatar: { glyph: '🌙', bg: '#5b4b8a' },
  music: null,
};

describe('artistEntries: una ficha reclamada sale una vez (plan 031 T295)', () => {
  it('la ficha unida lleva el apodo, la foto y la música del Carnet, los géneros de la ficha y su Carnet', () => {
    const list = artistEntries(artists, [carnet(), loose]);
    expect(list.map((e) => e.key)).toEqual(['alba-fitz', 'casta-diva', 'carnet:u-nueva']);
    expect(list[0]).toEqual({
      key: 'alba-fitz',
      name: 'Albita',
      genres: ['Melodic Techno', 'Downtempo'],
      photoUrl: carnet().avatarImage,
      avatar: null,
      carnetHref: carnetHref('u-alba'),
      music: { platform: 'soundcloud', url: 'https://soundcloud.com/albita' },
    });
    // El Carnet ya no sale aparte.
    expect(list.some((e) => e.key === 'carnet:u-alba')).toBe(false);
  });

  it('sin foto ni música en el Carnet, las de la ficha', () => {
    const [entry] = artistEntries([alba], [carnet({ avatarImage: null, music: null })]);
    expect(entry).toMatchObject({
      name: 'Albita',
      photoUrl: alba.photoUrl,
      avatar: null,
      music: { platform: 'spotify', url: alba.spotifyUrl },
      carnetHref: carnetHref('u-alba'),
    });
  });

  it('sin foto en ninguno, el avatar del Carnet', () => {
    const [entry] = artistEntries(
      [casta],
      [carnet({ avatarImage: null, music: null, artistProfileId: 'casta-diva' })],
    );
    expect(entry).toMatchObject({
      key: 'casta-diva',
      name: 'Albita',
      genres: ['Hip Hop'],
      photoUrl: null,
      avatar: { glyph: '🎧', bg: '#2f8f6f' },
      music: null,
    });
    const [noAvatar] = artistEntries(
      [casta],
      [carnet({ avatarImage: null, avatar: null, artistProfileId: 'casta-diva' })],
    );
    expect(noAvatar?.avatar).toEqual(CARNET_DEFAULT_AVATAR);
  });

  it('lo que no está unido sale como siempre', () => {
    expect(artistEntries(artists, [loose])).toEqual([
      contentArtistEntry(alba),
      contentArtistEntry(casta),
      carnetArtistEntry(loose),
    ]);
    expect(artistEntries(artists, [])).toEqual(artists.map(contentArtistEntry));
  });

  it('deshacer la unión devuelve las dos entradas', () => {
    const joined = artistEntries(artists, [carnet()]);
    expect(joined).toHaveLength(2);
    const undone = carnet({ artistProfileId: null });
    expect(artistEntries(artists, [undone])).toEqual([
      contentArtistEntry(alba),
      contentArtistEntry(casta),
      carnetArtistEntry(undone),
    ]);
  });

  it('un Carnet unido a una ficha que ya no existe sale solo; una ficha, un Carnet', () => {
    const orphan = carnet({ artistProfileId: 'borrada' });
    expect(artistEntries([casta], [orphan])).toEqual([
      contentArtistEntry(casta),
      carnetArtistEntry(orphan),
    ]);
    // Dos Carnets con la misma ficha (no pasa: la base lo impide): manda el primero.
    const second = carnet({ userId: 'u-otra', nickname: 'Otra' });
    const list = artistEntries([alba], [carnet(), second]);
    expect(list.map((e) => [e.key, e.name])).toEqual([
      ['alba-fitz', 'Albita'],
      ['carnet:u-otra', 'Otra'],
    ]);
  });
});
