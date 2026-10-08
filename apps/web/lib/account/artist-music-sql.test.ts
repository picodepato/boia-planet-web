import { readFileSync } from 'node:fs';
import { MUSIC_PLATFORMS, musicPlatformOf } from '@boia/contracts';
import { RPC_REJECTIONS } from '@boia/db/rpc';
import { describe, expect, it } from 'vitest';

/**
 * La migración del enlace a la música de un Carnet de artista (plan 019
 * T217), leída como texto: lo que esta máquina puede comprobar sin
 * PostgreSQL. Las pruebas contra la base están en
 * packages/db/src/supabase/artist-music.supabase.ts (`pnpm test:supabase`).
 */
const read = (path: string) =>
  readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8');
const SQL = read('supabase/migrations/20261008100200_artist_music.sql');
const TYPES = read('packages/db/src/database.types.ts');

/** El cuerpo de una función de la migración. */
function body(name: string): string {
  const start = SQL.indexOf(`create function ${name}(`);
  expect(start, name).toBeGreaterThanOrEqual(0);
  const open = SQL.indexOf('$$', start);
  return SQL.slice(open, SQL.indexOf('$$', open + 2));
}

/** Las expresiones de `private.music_url_ok`, como RegExp de JS (sin distinguir mayúsculas). */
function sqlPatterns(): Map<string, RegExp> {
  const out = new Map<string, RegExp>();
  for (const m of body('private.music_url_ok').matchAll(
    /when '([a-z]+)' then p_url ~\* '([^']+)'/g,
  )) {
    out.set(m[1]!, new RegExp(m[2]!, 'i'));
  }
  return out;
}

describe('el enlace a la música en la base (plan 019 T217)', () => {
  it('cada plataforma de la web tiene su expresión, y ninguna más', () => {
    expect([...sqlPatterns().keys()].sort()).toEqual([...MUSIC_PLATFORMS].sort());
    expect(SQL).toContain(`music_platform in (${MUSIC_PLATFORMS.map((p) => `'${p}'`).join(', ')})`);
  });

  it('la base y la web dicen lo mismo de cada enlace', () => {
    const patterns = sqlPatterns();
    const urls = [
      'https://open.spotify.com/artist/abc',
      'https://spotify.link/xyz',
      'https://soundcloud.com/alba',
      'https://on.soundcloud.com/x1',
      'https://alba.bandcamp.com/album/mar',
      'https://www.instagram.com/alba/',
      'https://youtube.com/@alba',
      'https://soundcloud.com.evil.es/alba',
      'https://notsoundcloud.com/alba',
      'http://soundcloud.com/alba',
    ];
    for (const url of urls) {
      const sql = [...patterns].filter(([, re]) => re.test(url)).map(([p]) => p);
      const web = musicPlatformOf(url);
      expect(sql, url).toEqual(web ? [web] : []);
    }
  });

  it('sólo un Carnet de artista lo guarda, por la RPC y con la cuenta de quien llama', () => {
    const fn = body('private.set_artist_music');
    expect(fn).toContain("raise exception 'artist_required'");
    expect(fn).toContain("raise exception 'carnet_required'");
    expect(fn).toContain("raise exception 'invalid_music'");
    expect(body('public.set_artist_music')).toContain('private.require_member()');
    for (const m of SQL.matchAll(/raise exception '([a-z_]+)'/g)) {
      expect(RPC_REJECTIONS).toContain(m[1]);
    }
    // Ningún cliente escribe las columnas a mano ni llama a la RPC sin cuenta.
    expect(SQL).not.toMatch(/grant (insert|update)[^;]*music_/);
    expect(SQL).toContain(
      'revoke all on function public.set_artist_music(text, text) from public, anon;',
    );
    expect(SQL).toContain(
      'grant execute on function public.set_artist_music(text, text) to authenticated;',
    );
    expect(SQL).toMatch(/create function private\.set_artist_music[^$]*security definer/);
  });

  it('los tipos de la base la conocen', () => {
    expect(TYPES).toMatch(
      /set_artist_music: \{\s*Args: \{\s*p_platform\?: string;\s*p_url\?: string;/,
    );
    expect(TYPES.match(/music_platform\??: string \| null;/g)).toHaveLength(3);
    expect(TYPES.match(/music_url\??: string \| null;/g)).toHaveLength(3);
  });
});
