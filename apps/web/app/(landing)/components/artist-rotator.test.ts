import { artistCarnetId } from '@boia/store';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CARNET_DEFAULT_AVATAR, carnetHref } from '../../../lib/artists/entries';
import { t } from '../../../lib/i18n/web';
import { SAMPLE_CONTENT } from '../../../lib/landing/sample-content';
import { DEFAULT_AVATAR } from '../../../lib/mundo/carnet/avatar';
import { ArtistRotator, rotationEntries } from './artist-rotator';
import { ARTISTS_PAGE } from './blocks';

const artists = SAMPLE_CONTENT.artists;

function render() {
  return renderToStaticMarkup(
    createElement(ArtistRotator, {
      artists,
      rotationMs: 6000,
      labels: { all: t('artists.all'), genres: t('artists.genres') },
      allHref: ARTISTS_PAGE,
    }),
  );
}

describe('la banda de artistas de la landing (plan 020 T227, decisión 4)', () => {
  it('cada artista lleva la imagen de su Carnet: su foto o el avatar de su Carnet', () => {
    // El avatar por defecto de la landing es el mismo que pinta el Carnet.
    expect(CARNET_DEFAULT_AVATAR).toEqual({ glyph: DEFAULT_AVATAR.glyph, bg: DEFAULT_AVATAR.bg });
    for (const entry of rotationEntries(artists, [])) {
      const artist = artists.find((a) => a.id === entry.key)!;
      if (artist.photoUrl) {
        expect(entry.photoUrl).toBe(artist.photoUrl);
        expect(entry.avatar).toBeNull();
      } else {
        expect(entry.photoUrl).toBeNull();
        expect(entry.avatar).toEqual(CARNET_DEFAULT_AVATAR);
      }
      expect(entry.carnetHref).toBe(carnetHref(artistCarnetId(artist.id)));
    }
    const html = render();
    const trio = html.match(/<ul class="artist-trio".*?<\/ul>/s)?.[0] ?? '';
    expect(trio.match(/<li /g)).toHaveLength(Math.min(3, artists.length));
    for (const li of trio.match(/<li .*?<\/li>/gs) ?? []) {
      expect(li).toMatch(/class="artist-card__(avatar|photo)"/);
      if (li.includes('artist-card__avatar')) expect(li).toContain(CARNET_DEFAULT_AVATAR.glyph);
    }
  });

  it('los Carnets de artista entran en la rotación con la imagen que eligieron', () => {
    const entries = rotationEntries(artists, [
      {
        userId: 'guest-1',
        nickname: 'Zzyzx Sónica',
        avatarImage: 'data:image/jpeg;base64,AAAA',
        avatar: { glyph: '🎧', bg: '#2f8f6f' },
        music: null,
      },
      {
        userId: 'guest-2',
        nickname: 'Otra',
        avatarImage: null,
        avatar: { glyph: '🌙', bg: '#5b4b8a' },
        music: null,
      },
    ]);
    expect(entries).toHaveLength(artists.length + 2);
    expect(entries.at(-2)).toMatchObject({
      key: 'carnet:guest-1',
      photoUrl: 'data:image/jpeg;base64,AAAA',
      avatar: null,
      carnetHref: carnetHref('guest-1'),
    });
    expect(entries.at(-1)).toMatchObject({
      key: 'carnet:guest-2',
      photoUrl: null,
      avatar: { glyph: '🌙', bg: '#5b4b8a' },
    });
  });

  it('«Ver todos los artistas» sustituye a «Pausar rotación» y abre /artistas', () => {
    const html = render();
    expect(ARTISTS_PAGE).toBe('/artistas');
    expect(t('artists.all')).toBe('Ver todos los artistas');
    expect(html).toMatch(
      new RegExp(
        `<a class="[^"]*artist-rotator__all"[^>]*href="${ARTISTS_PAGE}"[^>]*>${t('artists.all')}</a>`,
      ),
    );
    expect(html).not.toContain('<button');
    expect(html).not.toContain('aria-pressed');
  });
});
