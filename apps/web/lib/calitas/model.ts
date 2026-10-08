import { COMMENT_MAX, commentProblem } from '@boia/store';
import type { MessageKey } from '../i18n';

/**
 * Las Calitas (plan 019 T222, decisión 16): los comentarios de la isla, sus
 * respuestas (un nivel) y sus votos, sin React. Dos almacenes con la misma
 * forma: el de este navegador (`local.ts`: los de muestra más los tuyos,
 * que sólo ves tú) y, con Supabase, el de todos (`shared.ts`, las RPC de
 * 20261008100500_calitas.sql).
 */

export type Vote = -1 | 0 | 1;

export interface CalitasComment {
  id: string;
  /** El comentario al que responde; null si no es respuesta. */
  parentId: string | null;
  body: string;
  /** El apodo de su autor (null: sin Carnet en este navegador o sin apodo). */
  author: string | null;
  isMine: boolean;
  isSample: boolean;
  /** Votos a favor menos votos en contra (también el de quien lee). */
  score: number;
  myVote: Vote;
  createdAt: string;
  /** Sólo en el Admin: oculto, cuándo y por qué. */
  hidden: { at: string; reason: string | null } | null;
}

export interface CalitasThread {
  comment: CalitasComment;
  replies: CalitasComment[];
}

export type CalitasOrder = 'recent' | 'top';

/** Lo que leen la isla y el Admin, y lo que escriben. */
export interface CalitasStore {
  /** true con Supabase: los comentarios son de todos y escribir pide Carnet. */
  readonly shared: boolean;
  /** Los visibles (las respuestas, sólo si su comentario se ve). */
  list(): Promise<CalitasComment[]>;
  /** Publica un comentario o, con `parentId`, una respuesta. `author`: el apodo en modo local. */
  post(body: string, parentId: string | null, author: string | null): Promise<CalitasComment>;
  /** 1 a favor, -1 en contra, 0 quita el voto. */
  vote(id: string, value: Vote): Promise<void>;
  /** Avisa cuando cambia algo (en este navegador). */
  subscribe(listener: () => void): () => void;
}

/** La moderación del Admin: todos (también los ocultos), y ocultar o mostrar uno. */
export interface CalitasModeration {
  list(): Promise<CalitasComment[]>;
  moderate(id: string, action: 'hide' | 'show', reason: string): Promise<void>;
}

/** Los comentarios con sus respuestas: las respuestas sueltas (sin su comentario) no salen. */
export function buildThreads(
  list: readonly CalitasComment[],
  order: CalitasOrder = 'recent',
): CalitasThread[] {
  const tops = list.filter((c) => c.parentId === null);
  const ids = new Set(tops.map((c) => c.id));
  const replies = new Map<string, CalitasComment[]>();
  for (const c of list) {
    if (c.parentId === null || !ids.has(c.parentId)) continue;
    const arr = replies.get(c.parentId) ?? [];
    arr.push(c);
    replies.set(c.parentId, arr);
  }
  const newest = (a: CalitasComment, b: CalitasComment) =>
    b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
  const sorted = [...tops].sort(
    order === 'top' ? (a, b) => b.score - a.score || newest(a, b) : newest,
  );
  return sorted.map((comment) => ({
    comment,
    replies: (replies.get(comment.id) ?? []).sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    ),
  }));
}

/** El voto que deja un toque: el mismo otra vez lo quita. */
export function nextVote(current: Vote, pressed: 1 | -1): Vote {
  return current === pressed ? 0 : pressed;
}

// ---------------------------------------------------------------------------
// Errores

export type CalitasErrorCode =
  'offensive' | 'contact' | 'length' | 'limit' | 'account' | 'gone' | 'own' | 'generic';

export class CalitasError extends Error {
  constructor(readonly code: CalitasErrorCode) {
    super(`calitas: ${code}`);
    this.name = 'CalitasError';
  }
}

/** El texto de cada error (con `{max}` en el de la longitud). */
export const CALITAS_ERROR_KEY: Record<CalitasErrorCode, MessageKey> = {
  offensive: 'calitas.error.offensive',
  contact: 'calitas.error.contact',
  length: 'calitas.error.length',
  limit: 'calitas.error.limit',
  account: 'calitas.error.account',
  gone: 'calitas.error.gone',
  own: 'calitas.error.own',
  generic: 'calitas.error.generic',
};

/** El error de la interfaz para un rechazo de la base (el `message` de PostgREST). */
export function calitasErrorFrom(reason: string): CalitasErrorCode {
  if (reason === 'text_offensive') return 'offensive';
  if (/^text_(link|email|phone)$/.test(reason)) return 'contact';
  if (reason === 'invalid_message') return 'length';
  if (reason === 'limit_action' || reason === 'limit_daily') return 'limit';
  if (reason === 'carnet_required' || reason === 'not_member') return 'account';
  if (reason === 'unknown_comment') return 'gone';
  if (reason === 'own_comment') return 'own';
  return 'generic';
}

/** Lo que tiene de malo un comentario antes de mandarlo, o null (el mismo filtro que la base). */
export function checkComment(text: string): CalitasErrorCode | null {
  const body = text.trim();
  if (body.length < 1 || [...body].length > COMMENT_MAX) return 'length';
  const problem = commentProblem(body);
  if (problem === 'offensive') return 'offensive';
  if (problem) return 'contact';
  return null;
}

export { COMMENT_MAX };
