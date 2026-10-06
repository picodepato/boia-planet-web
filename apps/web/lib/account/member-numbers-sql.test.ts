import { readdirSync, readFileSync } from 'node:fs';
import { RPC_REJECTIONS } from '@boia/db/rpc';
import { describe, expect, it } from 'vitest';
import { artistLinkHref, cleanArtistCode } from './artist-link';

/**
 * La migración de números de socio y enlace de artistas (plan 016 T186),
 * leída como texto: lo que esta máquina puede comprobar sin PostgreSQL. Las
 * pruebas de verdad contra la base están en
 * packages/db/src/supabase/member-numbers.supabase.ts (`pnpm test:supabase`).
 */
const read = (path: string) =>
  readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8');
const FILE = '20261006100600_member_numbers_artist_link.sql';
const SQL = read(`supabase/migrations/${FILE}`);
const TYPES = read('packages/db/src/database.types.ts');

/** El cuerpo de una función de la migración. */
function body(name: string): string {
  const start = SQL.indexOf(`create function ${name}(`);
  expect(start, name).toBeGreaterThanOrEqual(0);
  const open = SQL.indexOf('$$', start);
  return SQL.slice(open, SQL.indexOf('$$', open + 2));
}

describe('números de socio por orden de llegada (T186)', () => {
  it('es la última migración que toca el número o save_profile', () => {
    const later = readdirSync(new URL('../../../../supabase/migrations/', import.meta.url)).filter(
      (f) => f > FILE,
    );
    for (const f of later) {
      expect(read(`supabase/migrations/${f}`)).not.toMatch(/member_number|save_profile/);
    }
  });

  it('el número sale de un contador en la misma sentencia del alta, no de una secuencia', () => {
    expect(SQL).toContain('alter table public.carnets alter column member_number drop identity');
    expect(SQL).toContain(
      'alter table public.carnets alter column member_number set default private.next_member_number();',
    );
    // Los números que ya hay no cambian: el contador sigue desde el mayor.
    expect(SQL).toContain('select true, coalesce(max(member_number), 0) from public.carnets;');
    expect(SQL).not.toMatch(/update public\.carnets set member_number = (?!p_number)/);
    const next = body('private.next_member_number');
    expect(next).toContain('update private.member_counter set last_number = last_number + 1');
    expect(next).not.toMatch(/nextval|sequence/);
    // El alta no pone el número a mano: lo pone el valor por defecto.
    const save = body('private.save_profile');
    expect(save).toMatch(
      /insert into public\.carnets \(user_id, nickname, avatar_key, avatar_image, is_artist\)/,
    );
    expect(save).not.toMatch(/member_number\s*,|next_member_number/);
  });

  it('el Admin cambia un número sólo a uno libre, con el cerrojo del contador y auditoría', () => {
    const set = body('private.admin_set_member_number');
    expect(set).toContain("private.require_staff('admin')");
    expect(set).toContain('from private.member_counter where id for update');
    expect(set).toContain("raise exception 'number_taken'");
    expect(set).toContain("'set_member_number'");
    expect(set).toMatch(/old_value, new_value/);
  });

  it('el código del enlace de artistas se guarda con hash y nunca va a la auditoría', () => {
    expect(SQL).toMatch(/code_hash text not null check \(code_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/);
    expect(body('private.artist_code_hash')).toContain('sha256(');
    const rotate = body('private.admin_rotate_artist_link');
    expect(rotate).toContain("private.require_staff('admin')");
    expect(rotate).toContain('private.artist_code_hash(code)');
    const audit = rotate.slice(rotate.indexOf('insert into public.audit_log'));
    expect(audit.slice(0, audit.indexOf(';'))).not.toMatch(/\bcode\b(?!_)/);
    // Sólo cuenta al crear el Carnet.
    const save = body('private.save_profile');
    expect(save.indexOf('private.artist_code_ok(p_artist_code)')).toBeGreaterThan(
      save.indexOf('privacy_required'),
    );
  });

  it('rechazos catalogados; nada para anon; tipos al día', () => {
    for (const m of SQL.matchAll(/raise exception '([a-z_]+)'/g)) {
      expect(RPC_REJECTIONS).toContain(m[1]);
    }
    for (const fn of [
      'public.save_profile(text, text, text, text, boolean, text)',
      'public.admin_set_member_number(uuid, bigint, text)',
      'public.admin_rotate_artist_link(text)',
      'public.admin_artist_link_info()',
    ]) {
      expect(SQL).toContain(`revoke all on function ${fn} from public, anon;`);
      expect(SQL).toContain(`grant execute on function ${fn} to authenticated;`);
    }
    expect(SQL).not.toMatch(/to anon/);
    expect(TYPES).toContain('p_artist_code?: string;');
    expect(TYPES).toMatch(
      /admin_set_member_number: \{\s*Args: \{\s*p_user: string;\s*p_number: number;/,
    );
    expect(TYPES).toContain('admin_rotate_artist_link: {');
    expect(TYPES).not.toContain('member_number?: never;');
  });
});

describe('el enlace de artistas en la web (T186)', () => {
  it('limpia el código y arma el enlace', () => {
    expect(cleanArtistCode(' 0f3a9c ')).toBe('0f3a9c');
    expect(cleanArtistCode('a%2Fb')).toBeNull();
    expect(cleanArtistCode('')).toBeNull();
    expect(cleanArtistCode('x'.repeat(65))).toBeNull();
    expect(artistLinkHref('0f3a9c', 'https://boia.test')).toBe('https://boia.test/artista/0f3a9c');
  });
});
