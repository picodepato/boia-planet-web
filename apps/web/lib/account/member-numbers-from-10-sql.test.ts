import { readdirSync, readFileSync } from 'node:fs';
import { MEMBER_NUMBER_FIRST } from '@boia/store';
import { describe, expect, it } from 'vitest';

/**
 * Números de Carnet desde el 10 con cuentas (plan 029 T282), leída como
 * texto: lo que esta máquina comprueba sin PostgreSQL. Las pruebas contra la
 * base (incluidas dos altas a la vez) están en
 * packages/db/src/supabase/member-numbers.supabase.ts (`pnpm test:supabase`).
 */
const MIGRATIONS = new URL('../../../../supabase/migrations/', import.meta.url);
const FILE = '20261014100200_member_numbers_from_10.sql';
const SQL = readFileSync(new URL(FILE, MIGRATIONS), 'utf8');

function body(name: string): string {
  const start = SQL.indexOf(`create or replace function ${name}(`);
  expect(start, name).toBeGreaterThanOrEqual(0);
  const open = SQL.indexOf('$$', start);
  return SQL.slice(open, SQL.indexOf('$$', open + 2));
}

describe('el contador de socios con cuentas empieza en el 10 (T282)', () => {
  it('next_member_number no baja del 10 y salta los ocupados, con el cerrojo de la fila', () => {
    const next = body('private.next_member_number');
    // El mismo primer número que el modo local.
    expect(next).toContain(
      `set last_number = greatest(last_number, ${MEMBER_NUMBER_FIRST - 1}) + 1 where id`,
    );
    expect(next).toContain(
      'while exists (select 1 from public.carnets c where c.member_number = n)',
    );
    expect(next).not.toMatch(/last_number - 1|set last_number = 0/);
    expect(SQL).toMatch(
      /function private\.next_member_number\(\) returns bigint\s+language plpgsql volatile\s+security definer\s+set search_path = ''/,
    );
  });

  it('el contador se pone una vez: tras el mayor del tramo 10–999, si no, a 9', () => {
    const update = SQL.slice(SQL.indexOf('update private.member_counter\nset last_number'));
    expect(update).toContain(
      'case when max(c.member_number) < 1000 then max(c.member_number) else 9 end',
    );
    expect(update).toContain('where c.member_number >= 10');
    expect(update).toMatch(/,\s*9\)\s*where id;/);
  });

  it('nadie cambia de número y no toca permisos ni el alta', () => {
    expect(SQL).not.toMatch(/update public\.carnets|set member_number|alter column member_number/);
    expect(SQL).not.toMatch(/\bgrant\b|\brevoke\b|save_profile/);
  });

  it('es la última migración que toca el contador', () => {
    const later = readdirSync(MIGRATIONS).filter((f) => f > FILE);
    // Devolver de la papelera (plan 032 T300) sólo llama a la función.
    const RESTORE = '20261015100700_secret_prizes_member_restore.sql';
    for (const f of later) {
      const text = readFileSync(new URL(f, MIGRATIONS), 'utf8');
      if (f === RESTORE) {
        expect(text, f).not.toMatch(
          /function private\.next_member_number|member_counter|set member_number/,
        );
        continue;
      }
      expect(text, f).not.toMatch(/next_member_number|member_counter|set member_number/);
    }
  });
});
