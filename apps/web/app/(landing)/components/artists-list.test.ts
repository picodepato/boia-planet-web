import { artistMusic } from '@boia/contracts';
import { artistCarnetId } from '@boia/store';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { carnetHref, contentArtistMusic } from '../../../lib/artists/entries';
import { repoRoot } from '../../../lib/barco/load';
import { t } from '../../../lib/i18n/web';
import { SAMPLE_CONTENT } from '../../../lib/landing/sample-content';
import { carnetPath } from '../../../lib/mundo/carnet/share';
import { ArtistsList } from './artists-list';

const escape = (s: string) => s.replace(/&/g, '&amp;');

/** La lista provisional de v14 §18.1, leída del documento maestro: «- Nombre — Género, Género». */
function v14Artists(): Array<{ name: string; genres: string[] }> {
  const text = readFileSync(path.join(repoRoot(), 'docs/fuente/v14-maestro.md'), 'utf8');
  const start = text.indexOf('## 18.1 ');
  const section = text.slice(start, text.indexOf('\n#', start + 1));
  return [...section.matchAll(/^- (.+?) — (.+)$/gm)].map((m) => ({
    name: m[1]!.trim(),
    genres: m[2]!.split(',').map((g) => g.trim()),
  }));
}

/** El <li> de un artista. */
const itemOf = (html: string, key: string) =>
  html.match(new RegExp(`<li data-artist="${key}">.*?</li>`, 's'))?.[0] ?? '';

describe('/artistas: la lista completa', () => {
  const html = renderToStaticMarkup(
    createElement(ArtistsList, { artists: SAMPLE_CONTENT.artists }),
  );

  it('pinta cada artista de su fuente de datos, una vez, con sus géneros', () => {
    expect(html.match(/<li /g)?.length).toBe(SAMPLE_CONTENT.artists.length);
    for (const a of SAMPLE_CONTENT.artists) {
      expect(html).toContain(`data-artist="${a.id}"`);
      expect(itemOf(html, a.id)).toContain(`>${escape(a.name)}</a></h3>`);
      expect(html).toContain(escape(a.genres.join(', ')));
    }
    // Avatar neutro: ninguna foto mientras no haya aprobadas.
    expect(html).not.toContain('<img');
  });

  it('los datos son los de v14 §18.1, textuales', () => {
    const v14 = v14Artists();
    expect(v14.length).toBeGreaterThan(0);
    expect(SAMPLE_CONTENT.artists.map((a) => ({ name: a.name, genres: a.genres }))).toEqual(v14);
    expect(html).toContain(`${v14.length} artistas`);
  });

  it('va de la A a la Z', () => {
    const names = [
      ...html.matchAll(/<h3 class="artist-card__name"><a [^>]*>(.+?)<\/a><\/h3>/g),
    ].map((m) => m[1]);
    expect(names).toHaveLength(SAMPLE_CONTENT.artists.length);
    expect(names).toEqual([...names].sort((a, b) => a!.localeCompare(b!, 'es')));
  });
});

describe('/artistas: imagen, Carnet y música de cada artista (plan 019 T217, decisión 10)', () => {
  const html = renderToStaticMarkup(
    createElement(ArtistsList, { artists: SAMPLE_CONTENT.artists }),
  );

  it('cada uno tiene su imagen al lado, el nombre y «Ver carnet» que abren su Carnet', () => {
    for (const a of SAMPLE_CONTENT.artists) {
      const li = itemOf(html, a.id);
      const href = carnetPath(artistCarnetId(a.id));
      expect(carnetHref(artistCarnetId(a.id))).toBe(href);
      expect(li).toMatch(/class="artist-card__(avatar|photo)"/);
      expect(li).toMatch(new RegExp(`<h3 class="artist-card__name"><a href="${href}"`));
      expect(li).toMatch(
        new RegExp(
          `<a class="[^"]*artist-card__carnet"[^>]*href="${href}"[^>]*>${t('artist.carnet')}</a>`,
        ),
      );
    }
  });

  it('la música de la landing (sin zod) es la misma que la de @boia/contracts', () => {
    for (const a of SAMPLE_CONTENT.artists) expect(contentArtistMusic(a)).toEqual(artistMusic(a));
  });

  it('el botón de música lleva la plataforma de su enlace, su icono y su nombre', () => {
    const withMusic = SAMPLE_CONTENT.artists.filter((a) => artistMusic(a));
    // La muestra enseña las cuatro plataformas.
    expect(new Set(withMusic.map((a) => artistMusic(a)!.platform))).toEqual(
      new Set(['spotify', 'soundcloud', 'bandcamp', 'instagram']),
    );
    for (const a of SAMPLE_CONTENT.artists) {
      const li = itemOf(html, a.id);
      const music = artistMusic(a);
      if (!music) {
        expect(li).not.toContain('artist-card__music');
        continue;
      }
      const button = li.match(/<a class="[^"]*artist-card__music[^"]*"[^>]*>.*?<\/a>/s)?.[0] ?? '';
      expect(button).toContain(`href="${music.url}"`);
      expect(button).toContain(`data-platform="${music.platform}"`);
      expect(button).toContain('target="_blank"');
      expect(button).toContain('rel="noopener noreferrer"');
      expect(button).toContain(`<svg class="music-icon" data-platform="${music.platform}"`);
      expect(button).toContain(`${t(`artist.music.${music.platform}`)}</a>`);
    }
  });

  it('un Carnet de artista entra en la lista con su foto o avatar, su Carnet y su música', () => {
    const own = renderToStaticMarkup(
      createElement(ArtistsList, {
        artists: SAMPLE_CONTENT.artists,
        carnets: [
          {
            userId: 'guest-1',
            nickname: 'Zzyzx Sónica',
            avatarImage: null,
            avatar: { glyph: '🎧', bg: '#2f8f6f' },
            music: { platform: 'soundcloud', url: 'https://soundcloud.com/zeta' },
          },
        ],
      }),
    );
    expect(own.match(/<li /g)?.length).toBe(SAMPLE_CONTENT.artists.length + 1);
    const li = itemOf(own, 'carnet:guest-1');
    expect(li).toContain('🎧');
    expect(li).toContain(`href="${carnetPath('guest-1')}"`);
    expect(li).toContain('data-platform="soundcloud"');
    expect(li).not.toContain('artist-card__genres');
    // Va en su sitio de la A a la Z: la última.
    const keys = [...own.matchAll(/<li data-artist="([^"]+)"/g)].map((m) => m[1]);
    expect(keys.at(-1)).toBe('carnet:guest-1');
  });
});
