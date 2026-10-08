import { readFileSync } from 'node:fs';
import { RPC_REJECTIONS } from '@boia/db/rpc';
import { STAFF_STAMP_REF } from '@boia/store';
import { describe, expect, it } from 'vitest';

/**
 * La migración de la puerta (plan 019 T218, decisión 11), leída como texto:
 * lo que esta máquina puede comprobar sin PostgreSQL. Las pruebas contra la
 * base están en packages/db/src/supabase/door-stamps.supabase.ts
 * (`pnpm test:supabase`, tras aplicarla en boia-planet-dev).
 */
const read = (path: string) =>
  readFileSync(new URL(`../../../../../${path}`, import.meta.url), 'utf8');
const SQL = read('supabase/migrations/20261008100300_door_stamps.sql');
const TYPES = read('packages/db/src/database.types.ts');

function body(name: string): string {
  const start = SQL.indexOf(`create function ${name}(`);
  expect(start, name).toBeGreaterThanOrEqual(0);
  const open = SQL.indexOf('$$', start);
  return SQL.slice(open, SQL.indexOf('$$', open + 2));
}

describe('la puerta en la base (plan 019 T218)', () => {
  const fn = body('private.staff_stamp');

  it('la puerta pide editor; a mano, admin con motivo', () => {
    expect(fn).toContain("case when p_source = 'manual' then 'admin' else 'editor' end");
    expect(fn).toContain('private.require_staff(');
    expect(fn).toContain("raise exception 'reason_required'");
    expect(SQL).toMatch(/create function private\.staff_stamp[^$]*security definer/);
  });

  it('cada rechazo lo conoce la web', () => {
    for (const m of SQL.matchAll(/raise exception '([a-z_]+)'/g)) {
      expect(RPC_REJECTIONS).toContain(m[1]);
    }
  });

  it('el libro guarda el origen con los mismos prefijos que el modo local', () => {
    const prefixes = [...fn.matchAll(/'(puerta|admin):'/g)].map((m) => m[1]);
    expect(prefixes.sort()).toEqual(['admin', 'puerta']);
    for (const p of prefixes) expect(STAFF_STAMP_REF.test(`${p}:boia-halloween-2026`)).toBe(true);
    // Los mismos puntos que el sello por QR, y un sello por fiesta (stamps_once).
    expect(fn).toContain("pa.action = 'stamp'");
    expect(fn).toContain("'already_stamped'");
    expect(fn).toContain('on conflict (event_id, user_id) do nothing');
  });

  it('nadie escribe la asistencia a mano ni llama a la RPC sin cuenta', () => {
    expect(SQL).toContain(
      'revoke all on public.event_attendance from anon, authenticated, service_role;',
    );
    expect(SQL).toContain('grant select on public.event_attendance to authenticated;');
    expect(SQL).not.toMatch(/grant (insert|update|delete)[^;]*event_attendance to authenticated/);
    expect(SQL).toContain(
      'revoke all on function public.staff_stamp(uuid, text, text, text) from public, anon;',
    );
    expect(SQL).toContain(
      'grant execute on function public.staff_stamp(uuid, text, text, text) to authenticated;',
    );
  });

  it('los tipos de la base la conocen', () => {
    expect(TYPES).toMatch(
      /staff_stamp: \{\s*Args: \{\s*p_member: string;\s*p_event: string;\s*p_source\?: string;\s*p_reason\?: string;/,
    );
    expect(TYPES).toContain('event_attendance: {');
  });
});
