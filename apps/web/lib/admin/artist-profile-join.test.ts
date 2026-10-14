import { readFileSync } from 'node:fs';
import type { Artist } from '@boia/contracts';
import { RPC_REJECTIONS } from '@boia/db/rpc';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ArtistJoin, type ArtistProfiles } from '../../app/admin/real/socios';
import type { MemberRow } from '../../app/admin/real/csv';
import type { BoiaSupabase } from '../supabase/browser';
import { slugify } from './actions';
import { t } from '../i18n';

/**
 * Un Carnet unido a su ficha de artista (plan 031 T295): la migración leída
 * como texto (lo que esta máquina comprueba sin PostgreSQL; contra la base,
 * packages/db/src/supabase/artist-profile-join.supabase.ts) y los botones del
 * Admin en «Socios».
 */
const read = (path: string) =>
  readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8');
const SQL = read('supabase/migrations/20261015100200_artist_profile_join.sql');
const TYPES = read('packages/db/src/database.types.ts');

function body(name: string): string {
  const start = SQL.search(
    new RegExp(`create (or replace )?function ${name.replace('.', '\\.')}\\(`),
  );
  expect(start, name).toBeGreaterThanOrEqual(0);
  return SQL.slice(start, SQL.indexOf('$$;', start));
}

describe('la unión en la base (migración 20261015100200)', () => {
  it('una ficha, un Carnet: columna única con el formato de los ids de las fichas', () => {
    expect(SQL).toContain('unique (artist_profile_id)');
    const re = new RegExp(/check \(artist_profile_id ~ '([^']+)'/.exec(SQL)![1]!);
    for (const name of ['Alba Fitz', 'DJ Sacred', 'Koko Moreno', 'Niña Pastori 2']) {
      expect(slugify(name), name).toMatch(re);
    }
    for (const bad of ['', 'Alba', 'alba fitz', '-alba', 'alba--fitz']) expect(bad).not.toMatch(re);
  });

  it('las RPC del Admin comprueban el rol y dejan auditoría; la unión sin rol no es de nadie', () => {
    expect(body('private.admin_join_artist_profile')).toContain(
      "actor uuid := private.require_staff('admin');",
    );
    expect(body('private.admin_unjoin_artist_profile')).toContain(
      "actor uuid := private.require_staff('admin');",
    );
    expect(body('private.join_artist_profile')).toContain('insert into public.audit_log');
    expect(body('private.join_artist_profile')).toContain('is_artist = true');
    expect(body('private.admin_unjoin_artist_profile')).toContain('insert into public.audit_log');
    expect(body('private.admin_set_artist')).toContain(
      'artist_profile_id = case when artist then artist_profile_id else null end',
    );
    for (const name of ['admin_join_artist_profile', 'admin_unjoin_artist_profile']) {
      expect(body(`public.${name}`)).toContain('security invoker');
      expect(body(`private.${name}`)).toContain('security definer');
      expect(TYPES).toContain(`${name}: {`);
    }
    expect(SQL).toContain(
      'revoke all on function private.join_artist_profile(uuid, text, uuid, text, text)\n  from public, anon, authenticated;',
    );
    expect(SQL).not.toMatch(/grant [^;]*private\.join_artist_profile/);
    expect(SQL).not.toMatch(/grant (insert|update)[^;]*carnets/);
    for (const m of SQL.matchAll(/raise exception '([a-z_]+)'/g)) {
      expect(RPC_REJECTIONS).toContain(m[1]);
    }
  });
});

const member = (over: Partial<MemberRow> = {}): MemberRow => ({
  user_id: 'u1',
  email: 'ana@example.test',
  nickname: 'Ana',
  member_number: 12,
  member_since: null,
  signed_up_at: '2026-10-01T10:00:00Z',
  is_artist: true,
  news: false,
  news_at: null,
  news_version: null,
  privacy_version: null,
  privacy_at: null,
  total: 1,
  ...over,
});
const all: Artist[] = [
  { id: 'alba-fitz', name: 'Alba Fitz', genres: ['Techno'] },
  { id: 'casta-diva', name: 'Casta Diva', genres: ['Hip Hop'] },
];
const sb = {} as BoiaSupabase;
const render = (m: MemberRow, profiles: ArtistProfiles) =>
  renderToStaticMarkup(createElement(ArtistJoin, { sb, m, profiles, onChanged: () => {} }));

describe('«Unir a un perfil de artista» en Socios', () => {
  it('sin unir: el botón para unir', () => {
    const html = render(member(), { all, joins: new Map([['otro', 'casta-diva']]) });
    expect(html).toContain(t('admin.real.socios.join'));
    expect(html).not.toContain(t('admin.real.socios.unjoin'));
  });

  it('unido: a qué perfil y «Deshacer unión»', () => {
    const html = render(member(), { all, joins: new Map([['u1', 'alba-fitz']]) });
    expect(html).toContain(t('admin.real.socios.joinedTo', { name: 'Alba Fitz' }));
    expect(html).toContain(t('admin.real.socios.unjoin'));
    expect(html).not.toContain(t('admin.real.socios.join'));
  });

  it('una cuenta sin Carnet no se une', () => {
    expect(render(member({ nickname: null }), { all, joins: new Map() })).toBe('');
  });
});
