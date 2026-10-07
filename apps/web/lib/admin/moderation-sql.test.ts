import { readFileSync } from 'node:fs';
import { RPC_REJECTIONS } from '@boia/db/rpc';
import { describe, expect, it } from 'vitest';
import { REAL_CARNET_ACTIONS } from './moderation';

/**
 * La migración de la moderación (plan 017 T191), leída como texto: lo que
 * esta máquina puede comprobar sin PostgreSQL. Las pruebas contra la base
 * están en packages/db/src/supabase/moderation.supabase.ts
 * (`pnpm test:supabase`).
 */
const read = (path: string) =>
  readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8');
const SQL = read('supabase/migrations/20261007100200_moderation.sql');
const TYPES = read('packages/db/src/database.types.ts');
const PUBLIC_RPCS = [
  'admin_moderate_carnet',
  'admin_list_carnets',
  'admin_restore_bottle',
  'admin_void_score',
  'admin_restore_score',
  'admin_list_voided',
] as const;
const PRIVATE_RPCS = [
  'admin_moderate_carnet',
  'admin_list_carnets',
  'admin_restore_bottle',
  'admin_set_score_void',
  'admin_list_voided',
] as const;

describe('moderación con datos reales: RPC y permisos (T191)', () => {
  it('cada RPC pide rol admin con aal2 y nunca la llama anon', () => {
    for (const name of PRIVATE_RPCS) {
      const body = SQL.split(`create function private.${name}(`)[1]!.split('$$;')[0]!;
      expect(body, name).toContain("private.require_staff('admin')");
      expect(body, name).toContain('security definer');
      expect(body, name).toContain("set search_path = ''");
      expect(SQL).toMatch(
        new RegExp(`revoke all on function private\\.${name}\\([^)]*\\) from public;`),
      );
    }
    for (const name of PUBLIC_RPCS) {
      expect(SQL).toMatch(
        new RegExp(`revoke all on function public\\.${name}\\([^)]*\\) from public, anon;`),
      );
      expect(SQL).toMatch(
        new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to authenticated;`),
      );
      expect(TYPES, name).toContain(`      ${name}: {`);
    }
  });

  it('las acciones del Carnet son las que ofrece el Admin, y los rechazos están catalogados', () => {
    const listed = SQL.match(/p_action not in\s*\(([^)]*)\)/)![1]!;
    expect([...listed.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort()).toEqual(
      [...REAL_CARNET_ACTIONS].sort(),
    );
    for (const m of SQL.matchAll(/raise exception '([a-z_]+)'/g)) {
      expect(RPC_REJECTIONS).toContain(m[1]);
    }
  });

  it('un Carnet oculto (y sus respuestas) sólo lo leen su dueño y el equipo', () => {
    expect(SQL).toMatch(
      /create policy carnets_read on public\.carnets\s+for select to anon, authenticated\s+using \(hidden_at is null\s+or user_id = \(select auth\.uid\(\)\)\s+or \(select private\.has_staff_role\('admin'\)\)\);/,
    );
    expect(SQL).toMatch(
      /create policy carnet_answers_read[^;]*c\.user_id = carnet_answers\.user_id and c\.hidden_at is null/,
    );
  });

  it('lo retirado se guarda fuera del alcance de los clientes y no vuelve al guardar el perfil', () => {
    expect(SQL).toContain('create table private.carnet_moderation (');
    expect(SQL).toContain(
      'revoke all on private.carnet_moderation from public, anon, authenticated;',
    );
    expect(SQL).toMatch(
      /create trigger carnets_moderation_guard before update of nickname, avatar_key, avatar_image\s+on public\.carnets/,
    );
    // El apodo retirado no vuelve; uno nuevo sí, y quita la marca.
    expect(SQL).toContain('lower(new.nickname) = lower(m.nickname)');
    expect(SQL).toContain('new.nickname_moderated := false;');
  });

  it('las anuladas del Castillo salen de su tabla, como las de la carrera y el Cañón', () => {
    expect(SQL).toContain('alter table public.castle_scores\n  add column voided_at timestamptz,');
    const ranking = SQL.split('create or replace function private.ranking_castle(')[1]!;
    expect(ranking).toContain('and s.voided_at is null');
    expect(SQL).toMatch(
      /create policy castle_scores_read on public\.castle_scores\s+for select to anon, authenticated\s+using \(voided_at is null or user_id = \(select auth\.uid\(\)\)\);/,
    );
  });

  it('todo cambio deja su fila en la auditoría', () => {
    for (const action of ["'moderate_carnet:' || p_action", "'restore_bottle'", "'void_score'"]) {
      expect(SQL).toContain(action);
    }
    expect(SQL.match(/insert into public\.audit_log/g)!.length).toBeGreaterThanOrEqual(3);
  });
});
