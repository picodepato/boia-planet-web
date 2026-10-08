import { readFileSync } from 'node:fs';
import { FULL_ACCESS_LIMIT, RPC_REJECTIONS } from '@boia/db/rpc';
import { describe, expect, it } from 'vitest';

/**
 * El límite del acceso completo al Admin y el interruptor de la analítica
 * (plan 019 T223, decisión 17), leídos como texto: lo que esta máquina puede
 * comprobar sin PostgreSQL. Las pruebas contra la base están en
 * packages/db/src/supabase/admin-limits.supabase.ts (`pnpm test:supabase`).
 */
const read = (path: string) =>
  readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8');
const SQL = read('supabase/migrations/20261008100600_admin_limits_analytics.sql');
const TYPES = read('packages/db/src/database.types.ts');

/** Cuerpo de una función de la migración. */
function body(name: string): string {
  const start = SQL.indexOf(`create function ${name}(`);
  expect(start, name).toBeGreaterThanOrEqual(0);
  return SQL.slice(start, SQL.indexOf('$$;', start));
}

describe('acceso completo: como mucho FULL_ACCESS_LIMIT (T223)', () => {
  it('el límite de la base de datos es el de la web', () => {
    expect(body('private.full_access_limit')).toContain(`select ${FULL_ACCESS_LIMIT}`);
  });

  it('un disparador cuenta admin y owner antes de dar el acceso, con cerrojo', () => {
    const guard = body('private.guard_full_access_limit');
    expect(guard).toContain("if new.role not in ('admin', 'owner') then");
    expect(guard).toContain("where s.role in ('admin', 'owner')");
    expect(guard).toContain('and s.user_id <> new.user_id;');
    expect(guard).toContain('if others >= private.full_access_limit() then');
    expect(guard).toContain("raise exception 'full_access_limit'");
    // El cerrojo va antes de contar: dos altas a la vez no se cuelan.
    expect(guard.indexOf('pg_advisory_xact_lock')).toBeLessThan(guard.indexOf('count(*)'));
    expect(SQL).toContain(
      'before insert or update of role, user_id on public.staff_roles\n  for each row execute function private.guard_full_access_limit();',
    );
    expect(RPC_REJECTIONS).toContain('full_access_limit');
  });

  it('el Admin ve la cuenta y el límite; nadie sin rol', () => {
    expect(body('private.admin_full_access')).toContain("perform private.require_staff('editor');");
    expect(SQL).toContain('revoke all on function public.admin_full_access() from public, anon;');
    expect(TYPES).toContain('admin_full_access: {');
  });
});

describe('analítica de visitas (T223)', () => {
  it('apagada por defecto, la lee cualquiera y la cambia sólo un admin', () => {
    expect(SQL).toContain(
      'alter table public.site_settings\n  add column analytics_enabled boolean not null default false;',
    );
    const set = body('private.admin_set_analytics');
    expect(set).toContain("actor uuid := private.require_staff('admin');");
    expect(set).toContain("'boia.audit_reason'");
    expect(set).toContain(
      'update public.site_settings set analytics_enabled = p_enabled where id;',
    );
    expect(SQL).toContain(
      'revoke all on function public.admin_set_analytics(boolean, text) from public, anon;',
    );
    // Ningún cliente la escribe directamente.
    expect(SQL).not.toMatch(/grant [^;]*(insert|update)[^;]* on public\.site_settings/);
    expect(TYPES).toContain('analytics_enabled: boolean;');
    expect(TYPES).toContain('admin_set_analytics: {');
  });

  it('rechazos catalogados', () => {
    for (const m of SQL.matchAll(/raise exception '([a-z_]+)'/g)) {
      expect(RPC_REJECTIONS).toContain(m[1]);
    }
  });
});
