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
const LOCKDOWN_FILE = '20261013100200_security_definer_lockdown.sql';
const LOCKDOWN = read(`supabase/migrations/${LOCKDOWN_FILE}`);

/** El cuerpo de una función. */
function body(sql: string, name: string): string {
  const start = sql.indexOf(`create function ${name}(`);
  expect(start, name).toBeGreaterThanOrEqual(0);
  const open = sql.indexOf('$$', start);
  return sql.slice(open, sql.indexOf('$$', open + 2));
}

describe('el Carnet 000 es del Admin y el contador nunca lo da', () => {
  it('el contador empieza en el mayor (≥ 0) y sube antes de dar un número: nunca da el 0 (desde T282, el primero es el 10)', () => {
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
    expect(SQL).toContain(
      'grant execute on function public.assign_admin_carnet(uuid) to service_role;',
    );
  });

  it('el email del 000 ya no lo da la base (T278): la función que lo daba a anon se borra', () => {
    // La primera versión se lo daba a cualquiera que escribiera «000».
    expect(SQL).toContain('grant execute on function public.admin_sign_in_email(bigint) to anon');
    expect(LOCKDOWN).toContain('drop function public.admin_sign_in_email(bigint);');
    expect(LOCKDOWN).not.toMatch(/grant [^;]* to [^;]*anon/);
    expect(TYPES).not.toContain('admin_sign_in_email');
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
    expect(use).toContain(
      "delete from auth.mfa_factors where user_id = p_user and factor_type = 'totp';",
    );
    expect(body(SQL, 'public.admin_use_backup_code')).toContain('private.require_member()');
  });
});

describe('descargar mis datos: sólo lo de quien llama y sin secretos', () => {
  const exp = body(SQL, 'private.export_my_data');

  it('cada tabla se lee filtrada por la cuenta que llama', () => {
    const reads = [
      ...exp.matchAll(/from (public|auth)\.(\w+) (\w+)\s+where (\w+)\.(\w+) = p_user/g),
    ];
    const all = [...exp.matchAll(/from (public|auth)\.(\w+)/g)];
    expect(reads.length).toBe(all.length);
    for (const r of reads) expect(r[3], r[2]).toBe(r[4]);
    expect(reads.map((r) => r[2])).toEqual(
      expect.arrayContaining([
        'carnets',
        'consents',
        'ledger_transactions',
        'bottles',
        'purchases',
      ]),
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
      'admin_use_backup_code',
      'assign_admin_carnet',
      'export_my_data',
    ]) {
      expect(TYPES).toContain(`      ${name}: {`);
    }
  });
});

describe('T278: nada con SECURITY DEFINER en public', () => {
  /** Las funciones que crea la migración, con su esquema. */
  const created = [...LOCKDOWN.matchAll(/create (?:or replace )?function (\w+)\.(\w+)\(/g)].map(
    (m) => `${m[1]}.${m[2]}`,
  );

  it('va detrás de la última migración que había', () => {
    expect(LOCKDOWN_FILE > '20261013100100_gallery_clips_longer.sql').toBe(true);
  });

  it('la lógica en private con SECURITY DEFINER; en public, envolturas INVOKER con la misma firma', () => {
    expect(created.sort()).toEqual([
      'private.discount_code_for',
      'private.radio_reorder',
      'private.radio_set_first',
      'public.discount_code_for',
      'public.radio_reorder',
      'public.radio_set_first',
    ]);
    for (const name of created) {
      const start = LOCKDOWN.indexOf(`function ${name}(`);
      expect(start, name).toBeGreaterThanOrEqual(0);
      const header = LOCKDOWN.slice(start, LOCKDOWN.indexOf('$$', start));
      expect(header, name).toContain("set search_path = ''");
      if (name.startsWith('private.')) expect(header, name).toContain('security definer');
      else {
        expect(header, name).toContain('security invoker');
        expect(header, name).not.toContain('security definer');
      }
    }
    expect(LOCKDOWN).toContain('select private.discount_code_for(p_discount)');
    expect(LOCKDOWN).toContain('select private.radio_set_first(p_song)');
    expect(LOCKDOWN).toContain('select private.radio_reorder(p_ids)');
  });

  it('cada una mira la sesión por dentro: la radio pide admin con aal2; el código, la cuenta', () => {
    for (const fn of ['radio_set_first', 'radio_reorder']) {
      const body = LOCKDOWN.slice(LOCKDOWN.indexOf(`create function private.${fn}(`));
      expect(body.slice(0, 300), fn).toContain("perform private.require_staff('admin');");
    }
    const code = LOCKDOWN.slice(LOCKDOWN.indexOf('create function private.discount_code_for('));
    expect(code.slice(0, 600)).toContain('u.user_id = (select auth.uid())');
    expect(code.slice(0, 600)).toContain("d.scope = 'event'");
    // Ninguna recibe la cuenta como parámetro.
    expect(LOCKDOWN).not.toMatch(/function private\.\w+\(p_user/);
  });

  it('sin EXECUTE para PUBLIC ni anon; sólo authenticated', () => {
    for (const fn of [
      'private.discount_code_for(text)',
      'private.radio_set_first(text)',
      'private.radio_reorder(text[])',
      'public.discount_code_for(text)',
      'public.radio_set_first(text)',
      'public.radio_reorder(text[])',
    ]) {
      expect(LOCKDOWN).toContain(`revoke all on function ${fn} from public, anon;`);
      expect(LOCKDOWN).toContain(`grant execute on function ${fn} to authenticated;`);
    }
    for (const m of LOCKDOWN.matchAll(/raise exception '([a-z_]+)'/g)) {
      expect(RPC_REJECTIONS).toContain(m[1]);
    }
  });
});
