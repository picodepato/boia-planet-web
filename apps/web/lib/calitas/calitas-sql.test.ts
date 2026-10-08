import { readFileSync } from 'node:fs';
import { RPC_REJECTIONS } from '@boia/db/rpc';
import { describe, expect, it } from 'vitest';
import { calitasErrorFrom } from './model';

/**
 * La migración de Las Calitas (plan 019 T222, decisión 16), leída como
 * texto: lo que esta máquina puede comprobar sin PostgreSQL. Las pruebas
 * contra la base están en packages/db/src/supabase/calitas.supabase.ts
 * (`pnpm test:supabase`, tras aplicarla en boia-planet-dev).
 */
const read = (path: string) =>
  readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8');
const SQL = read('supabase/migrations/20261008100500_calitas.sql');
const TYPES = read('packages/db/src/database.types.ts');

function body(name: string): string {
  const start = SQL.indexOf(`create function ${name}(`);
  expect(start, name).toBeGreaterThanOrEqual(0);
  const open = SQL.indexOf('$$', start);
  return SQL.slice(open, SQL.indexOf('$$', open + 2));
}

describe('Las Calitas en la base (plan 019 T222)', () => {
  it('cada rechazo lo conoce la web y tiene su texto en la isla', () => {
    const raised = [...SQL.matchAll(/raise exception '([a-z_]+)'/g)].map((m) => m[1]!);
    expect(raised.length).toBeGreaterThan(0);
    for (const r of raised) expect(RPC_REJECTIONS).toContain(r);
    // Los de comentar y votar se explican en la isla (los del Admin, en el Admin).
    for (const r of ['carnet_required', 'invalid_message', 'unknown_comment', 'own_comment']) {
      expect(calitasErrorFrom(r), r).not.toBe('generic');
    }
  });

  it('el texto pasa el filtro en cualquier escritura, también sin el navegador', () => {
    expect(SQL).toMatch(
      /create trigger calitas_comments_text_guard before insert or update of body\s+on public\.calitas_comments/,
    );
    expect(body('private.calitas_text_guard')).toContain('private.comment_text_problem(new.body)');
    expect(body('private.calitas_post')).toContain('private.comment_text_problem(msg)');
    // El filtro de los comentarios empieza por el de las botellas.
    expect(body('private.comment_text_problem')).toContain('private.text_problem(p)');
  });

  it('comentar y votar piden cuenta con Carnet; moderar, admin con segundo factor', () => {
    expect(SQL).toContain(
      'select private.calitas_post(private.require_member(), p_body, p_parent)',
    );
    expect(SQL).toContain(
      'select private.calitas_vote(private.require_member(), p_comment, p_value)',
    );
    expect(body('private.calitas_post')).toContain("raise exception 'carnet_required'");
    expect(body('private.calitas_vote')).toContain("raise exception 'carnet_required'");
    expect(body('private.admin_calitas_list')).toContain("private.require_staff('admin')");
    const mod = body('private.admin_moderate_comment');
    expect(mod).toContain("private.require_staff('admin')");
    expect(mod).toContain("raise exception 'reason_required'");
    expect(mod).toContain('insert into public.audit_log');
  });

  it('respuestas de un nivel, un voto por persona y el propio no se vota', () => {
    expect(body('private.calitas_post')).toContain('and parent_id is null');
    expect(SQL).toContain('primary key (comment_id, user_id)');
    expect(body('private.calitas_vote')).toContain("raise exception 'own_comment'");
    expect(body('private.calitas_vote')).toContain('on conflict (comment_id, user_id) do update');
  });

  it('lo oculto no se lee: ni el comentario ni sus respuestas', () => {
    const list = body('private.calitas_list');
    expect(list).toContain('c.parent_id is null and c.hidden_at is null');
    expect(list).toContain('where r.hidden_at is null');
    expect(list).toContain("- 'hidden_at' - 'hidden_reason'");
    expect(SQL).toMatch(
      /create policy calitas_comments_read on public\.calitas_comments\s+for select to anon, authenticated\s+using \(hidden_at is null/,
    );
  });

  it('nadie escribe las tablas a mano: sólo las RPC', () => {
    for (const table of ['calitas_comments', 'calitas_votes']) {
      expect(SQL).toContain(`alter table public.${table} enable row level security;`);
      expect(SQL).toContain(
        `revoke all on public.${table} from anon, authenticated, service_role;`,
      );
      expect(SQL).not.toMatch(
        new RegExp(`grant (insert|update|delete)[^;]*public\\.${table} to (anon|authenticated)`),
      );
    }
    for (const fn of [
      'calitas_post(text, uuid)',
      'calitas_vote(uuid, integer)',
      'admin_calitas_list(integer)',
      'admin_moderate_comment(uuid, text, text)',
    ]) {
      expect(SQL).toContain(`revoke all on function public.${fn} from public, anon;`);
      expect(SQL).toContain(`grant execute on function public.${fn} to authenticated;`);
    }
    // Leer es de todos.
    expect(SQL).toContain(
      'grant execute on function public.calitas_list(integer) to anon, authenticated;',
    );
    // Toda función SECURITY DEFINER fija su search_path.
    expect(SQL.match(/security definer\n/g)?.length).toBeGreaterThan(0);
    expect([...SQL.matchAll(/security definer\n(?!set search_path = '')/g)]).toHaveLength(0);
  });

  it('los tipos de la base la conocen', () => {
    expect(TYPES).toContain('calitas_comments: {');
    expect(TYPES).toContain('calitas_votes: {');
    expect(TYPES).toMatch(/calitas_post: \{\s*Args: \{\s*p_body: string;\s*p_parent\?: string;/);
    expect(TYPES).toMatch(/calitas_vote: \{\s*Args: \{\s*p_comment: string;\s*p_value: number;/);
    expect(TYPES).toMatch(/calitas_list: \{\s*Args: \{\s*p_limit\?: number;/);
    expect(TYPES).toMatch(/admin_calitas_list: \{\s*Args: \{\s*p_limit\?: number;/);
    expect(TYPES).toMatch(
      /admin_moderate_comment: \{\s*Args: \{\s*p_comment: string;\s*p_action: string;\s*p_reason\?: string;/,
    );
  });
});
