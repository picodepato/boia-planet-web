import { describe, expect, it } from 'vitest';
import { artistMusic, artistSchema } from './content';
import { MUSIC_PLATFORMS, MUSIC_URL_MAX, musicLinkFrom, musicPlatformOf } from './music';

describe('el enlace a la música de un artista (plan 019 T217, decisión 10)', () => {
  it('la plataforma sale del dominio, con o sin subdominio y sin https:// escrito', () => {
    const cases: Array<[string, (typeof MUSIC_PLATFORMS)[number]]> = [
      ['https://open.spotify.com/artist/abc', 'spotify'],
      ['https://spotify.link/xyz', 'spotify'],
      ['soundcloud.com/alba', 'soundcloud'],
      ['https://on.soundcloud.com/x1', 'soundcloud'],
      ['https://alba.bandcamp.com/album/mar', 'bandcamp'],
      ['https://www.instagram.com/alba/', 'instagram'],
    ];
    for (const [url, platform] of cases) expect(musicPlatformOf(url), url).toBe(platform);
    expect(new Set(cases.map((c) => c[1]))).toEqual(new Set(MUSIC_PLATFORMS));
  });

  it('otro dominio, uno que sólo lo imita, http o algo que no es URL: nada', () => {
    for (const url of [
      'https://youtube.com/@alba',
      'https://soundcloud.com.evil.es/alba',
      'https://notsoundcloud.com/alba',
      'http://soundcloud.com/alba',
      'javascript:alert(1)',
      'no es un enlace',
    ]) {
      expect(musicPlatformOf(url), url).toBeNull();
    }
  });

  it('musicLinkFrom: vacío es null, uno raro es invalid, uno bueno lleva su plataforma', () => {
    expect(musicLinkFrom('  ')).toBeNull();
    expect(musicLinkFrom('https://youtube.com/x')).toBe('invalid');
    expect(musicLinkFrom(`https://soundcloud.com/${'a'.repeat(MUSIC_URL_MAX)}`)).toBe('invalid');
    expect(musicLinkFrom(' soundcloud.com/alba ')).toEqual({
      platform: 'soundcloud',
      url: 'https://soundcloud.com/alba',
    });
  });

  it('la ficha: su música o, si no, su Spotify de siempre', () => {
    const base = { id: 'a', name: 'A', genres: ['House'] };
    expect(artistMusic(artistSchema.parse(base))).toBeNull();
    expect(
      artistMusic(artistSchema.parse({ ...base, spotifyUrl: 'https://open.spotify.com/a' })),
    ).toEqual({ platform: 'spotify', url: 'https://open.spotify.com/a' });
    const music = { platform: 'bandcamp', url: 'https://a.bandcamp.com' } as const;
    expect(
      artistMusic(artistSchema.parse({ ...base, spotifyUrl: 'https://open.spotify.com/a', music })),
    ).toEqual(music);
    expect(() =>
      artistSchema.parse({ ...base, music: { ...music, url: 'http://x.es' } }),
    ).toThrow();
  });
});
