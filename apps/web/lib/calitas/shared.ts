import type { BoiaSupabase } from '../supabase/browser';
import {
  type CalitasComment,
  CalitasError,
  type CalitasModeration,
  type CalitasStore,
  type Vote,
  calitasErrorFrom,
  checkComment,
} from './model';

/**
 * Las Calitas con Supabase (decisión 16: reales y de todos), con las RPC de
 * supabase/migrations/20261008100500_calitas.sql: leer es de todos;
 * comentar y votar piden cuenta con Carnet; el Admin ve también los ocultos
 * y los oculta o devuelve. Antes de mandar nada se pasa el mismo filtro que
 * la base (`checkComment`).
 */

/** Una fila de `calitas_list` / `admin_calitas_list`. */
export interface CalitasRow {
  id: string;
  parent_id: string | null;
  body: string;
  author_nickname: string | null;
  is_mine: boolean;
  score: number;
  my_vote: number;
  created_at: string;
  hidden_at?: string | null;
  hidden_reason?: string | null;
}

/** Cuántos comentarios (sin contar respuestas) se leen. */
export const CALITAS_LIST_LIMIT = 50;

export function commentFromRow(r: CalitasRow): CalitasComment {
  const vote = Number(r.my_vote);
  return {
    id: r.id,
    parentId: r.parent_id ?? null,
    body: r.body,
    author: r.author_nickname ?? null,
    isMine: r.is_mine === true,
    isSample: false,
    score: Number(r.score) || 0,
    myVote: (vote === 1 || vote === -1 ? vote : 0) as Vote,
    createdAt: r.created_at,
    hidden: r.hidden_at ? { at: r.hidden_at, reason: r.hidden_reason ?? null } : null,
  };
}

interface Result<T> {
  data: T;
  error: { message?: string; code?: string } | null;
}

async function call<T>(q: PromiseLike<Result<T>>): Promise<T> {
  const r = await q;
  if (r.error) {
    const reason = r.error.message ?? '';
    throw new CalitasError(r.error.code === '42501' ? 'account' : calitasErrorFrom(reason));
  }
  return r.data;
}

export function createSharedCalitas(client: () => Promise<BoiaSupabase | null>): CalitasStore {
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const l of [...listeners]) {
      try {
        l();
      } catch {
        // un oyente roto no rompe a los demás
      }
    }
  };
  const sb = async () => {
    const c = await client();
    if (!c) throw new CalitasError('generic');
    return c;
  };
  return {
    shared: true,
    async list() {
      const c = await sb();
      const rows = (await call(c.rpc('calitas_list', { p_limit: CALITAS_LIST_LIMIT }))) as unknown;
      return (Array.isArray(rows) ? (rows as CalitasRow[]) : []).map(commentFromRow);
    },
    async post(body, parentId) {
      const problem = checkComment(body);
      if (problem) throw new CalitasError(problem);
      const c = await sb();
      const row = (await call(
        c.rpc('calitas_post', {
          p_body: body.trim(),
          ...(parentId ? { p_parent: parentId } : {}),
        }),
      )) as unknown as CalitasRow;
      emit();
      return commentFromRow(row);
    },
    async vote(id, value) {
      const c = await sb();
      await call(c.rpc('calitas_vote', { p_comment: id, p_value: value }));
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Para el Admin, el error tal cual (`message` y `code` de PostgREST): lo explica `realErrorText`. */
async function callRaw<T>(q: PromiseLike<Result<T>>): Promise<T> {
  const r = await q;
  if (r.error) throw r.error;
  return r.data;
}

/** La moderación con cuentas: el cliente del Admin (rol admin con segundo factor). */
export function createSharedModeration(sb: BoiaSupabase): CalitasModeration {
  return {
    async list() {
      const rows = (await callRaw(sb.rpc('admin_calitas_list', { p_limit: 200 }))) as unknown;
      return (Array.isArray(rows) ? (rows as CalitasRow[]) : []).map(commentFromRow);
    },
    async moderate(id, action, reason) {
      await callRaw(
        sb.rpc('admin_moderate_comment', { p_comment: id, p_action: action, p_reason: reason }),
      );
    },
  };
}
