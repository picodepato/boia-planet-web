import { readFileSync } from 'node:fs';
import { RPC_REJECTIONS } from '@boia/db/rpc';
import { describe, expect, it } from 'vitest';

/**
 * La papelera de 30 días con datos reales (plan 020 T230, decisión 6), leída
 * como texto: lo que esta máquina puede comprobar sin PostgreSQL. Las pruebas
 * contra la base están en packages/db/src/supabase/trash.supabase.ts
 * (`pnpm test:supabase`).
 */
const read = (path: string) =>
  readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8');
const SQL = read('supabase/migrations/20261008200200_member_party_trash.sql');
const TYPES = read('packages/db/src/database.types.ts');
const FLOW = read('.github/workflows/supabase-backup.yml');
const SOCIOS = read('apps/web/app/admin/real/socios.tsx');
const FIESTAS = read('apps/web/app/admin/real/fiestas.tsx');
const PAPELERA = read('apps/web/app/admin/real/papelera.tsx');

/** Cuerpo de una función de la migración. */
function body(name: string): string {
  const start = SQL.search(
    new RegExp(`create (or replace )?function ${name.replace('.', '\\.')}\\(`),
  );
  expect(start, name).toBeGreaterThanOrEqual(0);
  return SQL.slice(start, SQL.indexOf('$$;', start));
}

const ADMIN_RPCS = [
  'admin_restore_member(uuid, text)',
  'admin_delete_event(text, text)',
  'admin_restore_event(uuid, text)',
  'admin_list_trash(integer)',
  'admin_purge_expired_trash()',
];

describe('papelera de socios (T230)', () => {
  it('borrar un socio va a la papelera, no borra la cuenta', () => {
    const del = body('private.admin_delete_member');
    expect(del).toContain("actor uuid := private.require_staff('admin');");
    expect(del).toContain("raise exception 'reason_required'");
    expect(del).toContain('from public.staff_roles where user_id = p_user');
    expect(del).toContain('insert into public.member_trash');
    expect(del).toContain('delete from public.carnets where user_id = p_user;');
    expect(del).toContain("banned_until = now() + interval '100 years'");
    expect(del).toContain('delete from auth.sessions');
    expect(del).not.toContain('delete_account');
    expect(del).not.toContain('delete from auth.users');
  });

  it('una cuenta en la papelera no es socio aunque le quede un token', () => {
    expect(body('private.is_member')).toContain(
      'and not private.account_in_trash((select auth.uid()))',
    );
  });

  it('sus botellas, tiempos y comentarios dejan de leerse; y sale de «Socios y emails»', () => {
    for (const policy of [
      'bottles_read_active',
      'race_times_read',
      'canon_scores_read',
      'castle_scores_read',
    ]) {
      const at = SQL.indexOf(`create policy ${policy} `);
      expect(at, policy).toBeGreaterThan(SQL.indexOf(`drop policy ${policy} `));
      expect(SQL.slice(at, SQL.indexOf(';', at))).toContain(
        'not private.account_in_trash(user_id)',
      );
    }
    expect(body('private.calitas_list').match(/account_in_trash/g)).toHaveLength(2);
    expect(body('private.admin_list_members')).toContain(
      'not exists (select 1 from public.member_trash t where t.user_id = u.id)',
    );
  });

  it('devolverlo pone su Carnet, sus respuestas y su acceso como estaban', () => {
    const restore = body('private.admin_restore_member');
    expect(restore).toContain('jsonb_populate_record(null::public.carnets, t.carnet)');
    expect(restore).toContain('jsonb_populate_recordset(null::public.carnet_answers, t.answers)');
    expect(restore).toContain('banned_until = t.banned_until_before');
    expect(restore).toContain("raise exception 'nickname_taken'");
    expect(restore).toContain("raise exception 'number_taken'");
    expect(restore).toContain("raise exception 'unknown_trash'");
  });

  it('ningún cliente lee la tabla de la papelera', () => {
    expect(SQL).toContain('alter table public.member_trash enable row level security;');
    expect(SQL).toContain(
      'revoke all on public.member_trash from anon, authenticated, service_role;',
    );
    expect(SQL).not.toMatch(
      /grant [a-z, ]+ on public\.member_trash to [a-z, ]*(anon|authenticated)/,
    );
  });
});

describe('papelera de fiestas (T230)', () => {
  it('borrar una fiesta la marca y la archiva: ni la web, ni el equipo, ni el QR', () => {
    const del = body('private.admin_delete_event');
    expect(del).toContain("actor uuid := private.require_staff('admin');");
    expect(del).toContain('archived_at = coalesce(archived_at, now())');
    expect(del).toContain('set deleted_at = now()');
    expect(SQL).toMatch(/create policy events_read_public[^;]*and deleted_at is null\);/);
    expect(SQL).toMatch(
      /create policy events_read_staff[^;]*has_staff_role\('editor'\)\) and deleted_at is null\);/,
    );
  });

  it('devolverla quita sólo el archivo que puso el borrado', () => {
    expect(body('private.admin_restore_event')).toContain(
      'archived_at = case when archived_at = deleted_at then null else archived_at end',
    );
  });
});

describe('purga a los 30 días (T230)', () => {
  it('el plazo es el de la papelera de moderación', () => {
    expect(body('private.trash_days')).toContain('select private.moderation_trash_days()');
  });

  it('borra de verdad socios y fiestas caducados; la fiesta con historial se queda oculta', () => {
    const purge = body('private.purge_expired_trash');
    expect(purge).toContain('make_interval(days => private.trash_days())');
    expect(purge).toContain(
      "perform private.delete_account(m.user_id, null, 'papelera: plazo cumplido');",
    );
    for (const t of ['purchases', 'stamps', 'ledger_transactions']) {
      expect(purge).toContain(`not exists (select 1 from public.${t} `);
    }
    expect(purge).toContain('private.purge_moderation_trash()');
  });

  it('la lanza cada día el flujo de copias, después de guardar la copia (sin pg_cron)', () => {
    expect(SQL).toContain(
      'grant execute on function public.purge_expired_trash() to service_role;',
    );
    expect(SQL).toContain(
      'revoke all on function public.purge_expired_trash() from public, anon, authenticated;',
    );
    const purge = FLOW.indexOf("'select public.purge_expired_trash()'");
    expect(purge).toBeGreaterThan(FLOW.indexOf('uses: actions/upload-artifact@v4'));
  });
});

describe('las RPC del Admin y la interfaz (T230)', () => {
  it('sólo para quien tiene sesión, nunca anon, y en los tipos', () => {
    for (const fn of ADMIN_RPCS) {
      expect(SQL).toContain(`revoke all on function public.${fn} from public, anon;`);
      expect(SQL).toContain(`grant execute on function public.${fn} to authenticated;`);
      expect(TYPES).toContain(`${fn.slice(0, fn.indexOf('('))}: {`);
    }
    expect(TYPES).toContain('member_trash: {');
    for (const r of ['unknown_trash', 'nickname_taken', 'number_taken', 'unknown_event']) {
      expect(RPC_REJECTIONS).toContain(r);
    }
  });

  it('Socios, Fiestas y la Papelera llaman a sus RPC', () => {
    expect(SOCIOS).toContain("sb.rpc('admin_delete_member'");
    expect(FIESTAS).toContain("sb.rpc('admin_delete_event'");
    expect(PAPELERA).toContain("sb.rpc('admin_list_trash'");
    expect(PAPELERA).toContain("sb.rpc('admin_restore_member'");
    expect(PAPELERA).toContain("sb.rpc('admin_restore_event'");
    expect(PAPELERA).toContain("rpc('admin_purge_expired_trash')");
  });
});
