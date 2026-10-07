import { readFileSync } from 'node:fs';
import { RPC_REJECTIONS } from '@boia/db/rpc';
import { describe, expect, it } from 'vitest';

/**
 * La migración del acceso del Admin y de «Descargar mis datos» (plan 017
 * T193), leída como texto: lo que esta máquina puede comprobar sin
 * PostgreSQL. Las pruebas contra la base están en
 * packages/db/src/supabase/admin-access.supabase.ts (`pnpm test:supabase`).
 */
const read = (path: string) =>
  readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8');
const SQL = read('supabase/migrations/20261007100400_admin_access_export.sql');
const NUMBERS = read('supabase/migrations/20261006100600_member_numbers_artist_link.sql');
const TYPES = read('packages/db/src/database.types.ts');

/** El cuerpo de una función. */
function body(sql: string, name: string): string {
  const start = sql.indexOf(`create function ${name}(`);
  expect(start, name).toBeGreaterThanOrEqual(0);
  const open = sql.indexOf('$$', start);
  return sql.slice(open, sql.indexOf('$$', open + 2));
}

describe('el Carnet 000 es del Admin y el contador nunca lo da', () => {
  it('el contador empieza en el mayor (≥ 0) y sube antes de dar un número: el primero es el 1', () => {
    expect(NUMBERS).toContain('select true, coalesce(max(member_number), 0) from public.carnets;');
    expect(NUMBERS).toContain('last_number bigint not null check (last_number >= 0)');
    const next = body(NUMBERS, 'private.next_member_number');
    const bump = next.indexOf('set last_number = last_number + 1');
    expect(bump).toBeGreaterThan(0);
    expect(bump).toBeLessThan(next.indexOf('return n'));
    expect(next).not.toMatch(/last_number - 1|set last_number = 0/);
  });

  it('el Admin no puede poner el 0 a mano a un socio', () => {
    expect(body(NUMBERS, 'private.admin_set_member_number')).toContain('p_number < 1');
  });

  it('ningún alta ni cambio da el 0 a quien no es admin u owner', () => {
    expect(SQL).toContain('check (member_number >= 0)');
    const guard = body(SQL, 'private.guard_carnet_zero');
    expect(guard).toMatch(/new\.member_number = 0/);
    expect(guard).toContain("s.role in ('admin', 'owner')");
    expect(guard).toContain("raise exception 'carnet_zero_reserved'");
    expect(SQL).toMatch(
      /create trigger carnets_zero_reserved before insert or update of member_number on public\.carnets/,
    );
  });

  it('sólo service_role da el Carnet 000, a una cuenta admin u owner, con auditoría', () => {
    const assign = body(SQL, 'private.assign_admin_carnet');
    expect(assign).toContain("raise exception 'not_admin'");
    expect(assign).toContain('from private.member_counter where id for update');
    expect(assign).toContain("raise exception 'number_taken'");
    expect(assign).toContain("'assign_admin_carnet'");
    expect(SQL).toContain(
      'revoke all on function public.assign_admin_carnet(uuid) from public, anon, authenticated;',
    );
    expect(SQL).toContain('grant execute on function public.assign_admin_carnet(uuid) to service_role;');
  });

  it('entrar con el número sólo vale para el 000 de una cuenta admin u owner', () => {
    const lookup = body(SQL, 'public.admin_sign_in_email');
    expect(lookup).toContain('where p_number = 0 and c.member_number = 0');
    expect(lookup).toContain("s.role in ('admin', 'owner')");
    // Lo único que puede llamar quien aún no ha entrado.
    expect([...SQL.matchAll(/grant execute on function (\S+) to anon/g)].map((m) => m[1])).toEqual([
      'public.admin_sign_in_email(bigint)',
    ]);
  });
});

describe('códigos de respaldo: de un solo uso y sólo su hash', () => {
  it('la tabla guarda sal y hash, nunca el código; sin acceso directo', () => {
    const table = SQL.slice(
      SQL.indexOf('create table private.admin_backup_codes'),
      SQL.indexOf(');', SQL.indexOf('create table private.admin_backup_codes')),
    );
    expect(table).toContain("code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$')");
    expect(table).toContain('salt text not null');
    expect(table).not.toMatch(/\bcode text\b/);
    expect(SQL).toContain(
      'revoke all on private.admin_backup_codes from public, anon, authenticated, service_role;',
    );
    expect(body(SQL, 'private.backup_code_hash')).toContain('sha256(');
  });

  it('generar: 10 nuevos, los anteriores dejan de valer, la auditoría sin códigos', () => {
    const gen = body(SQL, 'private.admin_generate_backup_codes');
    expect(gen).toContain("private.require_staff('editor')");
    expect(gen).toContain('delete from private.admin_backup_codes where user_id = p_user;');
    expect(gen).toContain('for i in 1..10 loop');
    expect(gen).toContain('private.backup_code_hash(salt, code)');
    const audit = gen.slice(gen.indexOf('insert into public.audit_log'));
    expect(audit.slice(0, audit.indexOf(';'))).not.toMatch(/\bcodes?\b(?!_)/);
  });

  it('usar: sólo uno sin usar, se marca usado en la misma transacción y otra vez no vale', () => {
    const use = body(SQL, 'private.admin_use_backup_code');
    const pick = use.slice(use.indexOf('select b.id into hit'), use.indexOf('for update;'));
    expect(pick).toContain('b.used_at is null');
    expect(pick).toContain('b.code_hash = private.backup_code_hash(b.salt, p_code)');
    expect(use).toContain('for update;');
    expect(use.indexOf("raise exception 'backup_code_invalid'")).toBeLessThan(
      use.indexOf('update private.admin_backup_codes set used_at = now()'),
    );
    expect(use).toContain('where id = hit and used_at is null;');
    // Nunca vuelve a poner used_at a null.
    expect(SQL).not.toMatch(/used_at = null|set used_at = null/);
    // Sólo quien es del equipo; quita el TOTP perdido para dar de alta otro.
    expect(use).toContain('from public.staff_roles s where s.user_id = p_user');
    expect(use).toContain("delete from auth.mfa_factors where user_id = p_user and factor_type = 'totp';");
    expect(body(SQL, 'public.admin_use_backup_code')).toContain('private.require_member()');
  });
});

describe('descargar mis datos: sólo lo de quien llama y sin secretos', () => {
  const exp = body(SQL, 'private.export_my_data');

  it('cada tabla se lee filtrada por la cuenta que llama', () => {
    const reads = [...exp.matchAll(/from (public|auth)\.(\w+) (\w+)\s+where (\w+)\.(\w+) = p_user/g)];
    const all = [...exp.matchAll(/from (public|auth)\.(\w+)/g)];
    expect(reads.length).toBe(all.length);
    for (const r of reads) expect(r[3], r[2]).toBe(r[4]);
    expect(reads.map((r) => r[2])).toEqual(
      expect.arrayContaining(['carnets', 'consents', 'ledger_transactions', 'bottles', 'purchases']),
    );
    expect(body(SQL, 'public.export_my_data')).toContain(
      'private.export_my_data(private.require_member())',
    );
  });

  it('nada de secretos ni de otras personas', () => {
    expect(exp).not.toMatch(
      /admin_backup_codes|mfa_|encrypted_password|artist_link|event_secrets|event_stamp_codes|private\./,
    );
    // Las columnas con ids de otras personas se quitan.
    for (const col of ['moderated_by', 'voided_by', 'resolved_by', 'granted_by', 'created_by']) {
      expect(exp).toContain(`- '${col}'`);
    }
    const account = exp.slice(exp.indexOf("'account'"), exp.indexOf("'carnet'"));
    expect(account).not.toMatch(/to_jsonb\(u\)|phone|password|token/);
  });
});

describe('permisos, rechazos y tipos', () => {
  it('rechazos catalogados; tipos al día', () => {
    for (const m of SQL.matchAll(/raise exception '([a-z_]+)'/g)) {
      expect(RPC_REJECTIONS).toContain(m[1]);
    }
    for (const fn of [
      'public.admin_generate_backup_codes()',
      'public.admin_use_backup_code(text)',
      'public.admin_backup_codes_left()',
      'public.export_my_data()',
    ]) {
      expect(SQL).toContain(`revoke all on function ${fn} from public, anon;`);
      expect(SQL).toContain(`grant execute on function ${fn} to authenticated;`);
    }
    for (const name of [
      'admin_backup_codes_left',
      'admin_generate_backup_codes',
      'admin_sign_in_email',
      'admin_use_backup_code',
      'assign_admin_carnet',
      'export_my_data',
    ]) {
      expect(TYPES).toContain(`      ${name}: {`);
    }
  });
});
