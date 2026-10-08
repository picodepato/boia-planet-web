import {
  type CalitasComment,
  CalitasError,
  type CalitasModeration,
  type CalitasStore,
  type Vote,
  checkComment,
} from './model';
import { SAMPLE_COMMENTS, type SampleComment } from './sample';

/**
 * Las Calitas en modo local (D-20, decisión 16): los comentarios de muestra
 * más los tuyos, que sólo ves tú, guardados en este navegador con tus votos
 * y lo que el Admin de la demo ocultó. El filtro de insultos es el mismo que
 * con cuentas (`checkComment`).
 */

export const CALITAS_STORAGE_KEY = 'boia.calitas';

interface OwnComment {
  id: string;
  parentId: string | null;
  body: string;
  author: string | null;
  createdAt: string;
}

interface LocalState {
  v: 1;
  own: OwnComment[];
  votes: Record<string, 1 | -1>;
  hidden: Record<string, { at: string; reason: string }>;
}

const empty = (): LocalState => ({ v: 1, own: [], votes: {}, hidden: {} });

export interface LocalCalitasOptions {
  storage?: () => Storage | null;
  now?: () => Date;
  samples?: readonly SampleComment[];
  newId?: () => string;
}

function defaultStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function parse(raw: string | null): LocalState {
  if (!raw) return empty();
  try {
    const s = JSON.parse(raw) as Partial<LocalState>;
    if (s?.v !== 1) return empty();
    return {
      v: 1,
      own: Array.isArray(s.own) ? s.own : [],
      votes: s.votes && typeof s.votes === 'object' ? s.votes : {},
      hidden: s.hidden && typeof s.hidden === 'object' ? s.hidden : {},
    };
  } catch {
    return empty();
  }
}

export function createLocalCalitas(opts: LocalCalitasOptions = {}): {
  store: CalitasStore;
  moderation: CalitasModeration;
} {
  const storage = opts.storage ?? defaultStorage;
  const now = opts.now ?? (() => new Date());
  const samples = opts.samples ?? SAMPLE_COMMENTS;
  const newId =
    opts.newId ??
    (() =>
      `local-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`);
  const listeners = new Set<() => void>();
  /** Sin almacenamiento (modo privado): lo de esta visita, en memoria. */
  let memory: LocalState | null = null;

  const read = (): LocalState => {
    const s = storage();
    if (!s) return (memory ??= empty());
    try {
      return parse(s.getItem(CALITAS_STORAGE_KEY));
    } catch {
      return (memory ??= empty());
    }
  };
  const write = (state: LocalState) => {
    const s = storage();
    try {
      if (s) s.setItem(CALITAS_STORAGE_KEY, JSON.stringify(state));
      else memory = state;
    } catch {
      memory = state;
    }
    for (const l of [...listeners]) {
      try {
        l();
      } catch {
        // un oyente roto no rompe a los demás
      }
    }
  };

  /** Todos, con su voto y su marca de oculto. */
  const all = (state: LocalState): CalitasComment[] => {
    const hidden = (id: string) => {
      const h = state.hidden[id];
      return h ? { at: h.at, reason: h.reason } : null;
    };
    return [
      ...samples.map((c) => {
        const myVote: Vote = state.votes[c.id] ?? 0;
        return {
          id: c.id,
          parentId: c.parentId,
          body: c.body,
          author: c.author,
          isMine: false,
          isSample: true,
          score: c.score + myVote,
          myVote,
          createdAt: c.createdAt,
          hidden: hidden(c.id),
        };
      }),
      ...state.own.map((c) => ({
        id: c.id,
        parentId: c.parentId,
        body: c.body,
        author: c.author,
        isMine: true,
        isSample: false,
        score: 0,
        myVote: 0 as Vote,
        createdAt: c.createdAt,
        hidden: hidden(c.id),
      })),
    ];
  };

  const visible = (state: LocalState): CalitasComment[] => {
    const list = all(state);
    const shown = new Set(list.filter((c) => !c.hidden).map((c) => c.id));
    return list
      .filter((c) => shown.has(c.id) && (c.parentId === null || shown.has(c.parentId)))
      .map((c) => ({ ...c, hidden: null }));
  };

  const store: CalitasStore = {
    shared: false,
    async list() {
      return visible(read());
    },
    async post(body, parentId, author) {
      const problem = checkComment(body);
      if (problem) throw new CalitasError(problem);
      const state = read();
      if (parentId !== null) {
        const parent = visible(state).find((c) => c.id === parentId);
        if (!parent || parent.parentId !== null) throw new CalitasError('gone');
      }
      const own: OwnComment = {
        id: newId(),
        parentId,
        body: body.trim(),
        author: author?.trim() || null,
        createdAt: now().toISOString(),
      };
      write({ ...state, own: [...state.own, own] });
      return visible(read()).find((c) => c.id === own.id)!;
    },
    async vote(id, value) {
      const state = read();
      const target = visible(state).find((c) => c.id === id);
      if (!target) throw new CalitasError('gone');
      if (target.isMine) throw new CalitasError('own');
      const votes = { ...state.votes };
      if (value === 0) delete votes[id];
      else votes[id] = value;
      write({ ...state, votes });
    },
    subscribe(listener) {
      listeners.add(listener);
      const onStorage = (e: StorageEvent) => {
        if (e.key === CALITAS_STORAGE_KEY) listener();
      };
      if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
      return () => {
        listeners.delete(listener);
        if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
      };
    },
  };

  const moderation: CalitasModeration = {
    async list() {
      return all(read()).sort(
        (a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
      );
    },
    async moderate(id, action, reason) {
      const state = read();
      if (!all(state).some((c) => c.id === id)) throw new CalitasError('gone');
      const why = reason.trim();
      const hidden = { ...state.hidden };
      if (action === 'hide') {
        if (why.length < 3) throw new Error('reason_required');
        hidden[id] = { at: hidden[id]?.at ?? now().toISOString(), reason: why };
      } else {
        delete hidden[id];
      }
      write({ ...state, hidden });
    },
  };

  return { store, moderation };
}
