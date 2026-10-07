/**
 * Las botellas globales (plan 008, T93, decisión 12, REQ-IDE-040…044): con
 * Supabase, el mar de todo el mundo (invitado o miembro) enseña las 10
 * botellas activas más recientes de todas las cuentas (`latest_bottles`),
 * más la propia si queda fuera de esas diez.
 *
 * - Se leen al entrar (la primera vez que se piden) y, después, cuando la
 *   lista tiene más de `maxAgeMs` o se pide `refresh()` (la web lo pide cada
 *   pocos minutos con la página a la vista). Entre medias se sirve la última
 *   lectura: `list()` se llama con cada cambio del repositorio.
 * - Echar una pide cuenta con Carnet (`viewer()`): `place_bottle` retira la
 *   activa de esa cuenta y deja la nueva. Antes de mandar nada se comprueba
 *   el mensaje (`textProblem`: enlaces, emails, teléfonos, palabras
 *   ofensivas); la base lo vuelve a comprobar.
 * - Leer queda registrado (`bottle_reads`) para un miembro; el invitado lee
 *   igual, y lo leído se recuerda mientras dura la visita.
 * - Reportar escribe `bottle_reports` (una vez por persona y botella).
 *
 * Dónde flota cada una (fuera del radio de las islas, T88) lo decide /mar al
 * echarla y al pintarla, como con las locales.
 */
import {
  BOTTLE_MESSAGE_MAX,
  BOTTLE_REPORT_REASON_MAX,
  BOTTLES_IN_SEA_MAX,
  charLength,
} from '@boia/contracts';
import { textProblem } from '../bottle-text';
import { StoreError } from '../errors';
import type { BottleApi, BottleInput, BottleView } from '../repository';
import type { SupabaseErrorLike, SupabaseLike, SupabaseResult } from './server';

/** Cada cuánto se vuelve a leer el mar (también lo que dura una lectura). */
export const GLOBAL_BOTTLES_REFRESH_MS = 3 * 60_000;

export interface GlobalBottlesOptions {
  /** El cliente de Supabase (con la sesión, si la hay); puede llegar después. */
  client: SupabaseLike | PromiseLike<SupabaseLike>;
  /** La cuenta con Carnet que juega ahora, o null (invitado o sin Carnet). */
  viewer: () => string | null;
  /** La misma validación de posición que el repositorio local (el agua del mapa). */
  validatePosition?: ((pos: { x: number; y: number }) => string | null) | undefined;
  maxAgeMs?: number;
  now?: () => number;
}

export interface GlobalBottles {
  /** La `BottleApi` que usa la web en vez de la del repositorio. */
  readonly api: BottleApi;
  /** Vuelve a leer el mar ya (y avisa si cambió). */
  refresh(): Promise<void>;
  /** Olvida lo leído: lo siguiente se lee del servidor (al entrar o salir de la cuenta). */
  invalidate(): void;
  /** Avisa cuando cambia lo que hay en el mar. */
  subscribe(listener: () => void): () => void;
}

/** Una fila de `latest_bottles`. */
interface LatestRow {
  id: string;
  message: string;
  x: number;
  y: number;
  author_id: string;
  author_nickname: string | null;
  is_mine: boolean;
  created_at: string;
  updated_at: string;
}

/** Una fila propia de `bottles`. */
interface OwnRow {
  id: string;
  message: string;
  x: number;
  y: number;
  status: BottleView['status'];
  created_at: string;
  updated_at: string;
}

const OWN_COLUMNS = 'id, message, x, y, status, created_at, updated_at';
/** Lecturas propias que se traen para marcar las del mar como leídas. */
const READS_PAGE = 200;

class CallError extends Error {
  constructor(readonly error: SupabaseErrorLike) {
    super(error.message ?? 'error de Supabase');
    this.name = 'CallError';
  }
}

async function call<T>(q: PromiseLike<SupabaseResult<T>>): Promise<T | null> {
  const r = await q;
  if (r.error) throw new CallError(r.error);
  return r.data;
}

const codeOf = (e: unknown) => (e instanceof CallError ? (e.error.code ?? '') : '');
const reasonOf = (e: unknown) => (e instanceof CallError ? (e.error.message ?? '') : '');

/** Un rechazo del servidor como error del repositorio (el texto lo pone la interfaz). */
function storeErrorFrom(e: unknown): unknown {
  const reason = reasonOf(e);
  if (reason === 'carnet_required' || reason === 'not_member' || codeOf(e) === '42501') {
    return new StoreError('no_carnet', 'sin cuenta con Carnet no se escriben botellas');
  }
  if (/^text_(link|email|phone|offensive)$/.test(reason)) return new StoreError('invalid', reason);
  if (reason === 'invalid_message') return new StoreError('invalid', 'botella: mensaje');
  if (reason === 'invalid_position') return new StoreError('invalid', 'botella: fuera del mar');
  return e;
}

export function createGlobalBottles(opts: GlobalBottlesOptions): GlobalBottles {
  const sb = async () => opts.client;
  const now = opts.now ?? (() => Date.now());
  const maxAge = opts.maxAgeMs ?? GLOBAL_BOTTLES_REFRESH_MS;
  const listeners = new Set<() => void>();

  /** Lo último leído del mar (null: nada todavía, o se olvidó). */
  let sea: BottleView[] | null = null;
  /** La activa de la cuenta (aunque no esté entre las 10). */
  let own: BottleView | null = null;
  let readAt = 0;
  /** Para quién se leyó (lo que es mío depende de la sesión). */
  let readFor: string | null = null;
  let loading: Promise<void> | null = null;
  /** Sube al olvidar: una lectura de antes no se guarda. */
  let gen = 0;
  /** Lo leído en esta visita (el invitado no lo registra en el servidor). */
  const readHere = new Set<string>();

  const emit = () => {
    for (const l of [...listeners]) {
      try {
        l();
      } catch {
        // un oyente roto no rompe a los demás
      }
    }
  };

  const viewFromLatest = (r: LatestRow, reads: ReadonlySet<string>): BottleView => ({
    id: r.id,
    message: r.message,
    x: Number(r.x),
    y: Number(r.y),
    status: 'active',
    authorId: r.author_id,
    authorNickname: r.author_nickname,
    isMine: r.is_mine === true,
    isSample: false,
    read: reads.has(r.id),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });

  const viewFromOwn = (r: OwnRow, me: string, nickname: string | null): BottleView => ({
    id: r.id,
    message: r.message,
    x: Number(r.x),
    y: Number(r.y),
    status: r.status,
    authorId: me,
    authorNickname: nickname,
    isMine: true,
    isSample: false,
    read: readHere.has(r.id),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });

  const load = async (): Promise<void> => {
    const myGen = gen;
    const me = opts.viewer();
    const c = await sb();
    const rows = ((await call(c.rpc('latest_bottles', { p_limit: BOTTLES_IN_SEA_MAX }))) ??
      []) as LatestRow[];
    let mine: OwnRow | null = null;
    if (me) {
      const [reads, ownRows] = await Promise.all([
        call(
          c
            .from('bottle_reads')
            .select('bottle_id')
            .eq('reader_id', me)
            .order('read_at', { ascending: false })
            .range(0, READS_PAGE - 1),
        ).catch(() => null),
        call(c.from('bottles').select(OWN_COLUMNS).eq('user_id', me).eq('status', 'active')),
      ]);
      for (const r of (reads ?? []) as Record<string, unknown>[]) readHere.add(String(r.bottle_id));
      mine = ((ownRows ?? []) as unknown as OwnRow[])[0] ?? null;
    }
    if (myGen !== gen) return;
    const next = rows.slice(0, BOTTLES_IN_SEA_MAX).map((r) => viewFromLatest(r, readHere));
    const nickname = next.find((b) => b.isMine)?.authorNickname ?? own?.authorNickname ?? null;
    const nextOwn = me && mine ? viewFromOwn(mine, me, nickname) : null;
    const changed =
      sea === null ||
      readFor !== me ||
      JSON.stringify(next) !== JSON.stringify(sea) ||
      JSON.stringify(nextOwn) !== JSON.stringify(own);
    sea = next;
    own = nextOwn;
    readAt = now();
    readFor = me;
    if (changed) emit();
  };

  /** Lee si hace falta (nada leído, viejo o de otra sesión); nunca lanza. */
  const ensure = async (force = false): Promise<void> => {
    const fresh = sea !== null && readFor === opts.viewer() && now() - readAt < maxAge;
    if (fresh && !force) return;
    if (!loading) {
      const p: Promise<void> = load()
        .catch((e: unknown) => {
          console.warn('[boia] no se pudieron leer las botellas', e);
        })
        .finally(() => {
          if (loading === p) loading = null;
        });
      loading = p;
    }
    await loading;
  };

  const requireViewer = (what: string): string => {
    const me = opts.viewer();
    if (!me) throw new StoreError('no_carnet', `sin cuenta con Carnet no se ${what}`);
    return me;
  };

  const checkMessage = (raw: unknown): string => {
    if (typeof raw !== 'string') throw new StoreError('invalid', 'botella: texto');
    const message = raw.trim();
    const len = charLength(message);
    if (len < 1 || len > BOTTLE_MESSAGE_MAX)
      throw new StoreError('invalid', `botella: entre 1 y ${BOTTLE_MESSAGE_MAX} caracteres`);
    const problem = textProblem(message);
    if (problem) throw new StoreError('invalid', `text_${problem}`);
    return message;
  };

  const checkPosition = (x: unknown, y: unknown): { x: number; y: number } => {
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    )
      throw new StoreError('invalid', 'botella: posición');
    const pos = { x, y };
    const why = opts.validatePosition?.(pos) ?? null;
    if (why) throw new StoreError('invalid', `botella: ${why}`);
    return pos;
  };

  const find = (id: string): BottleView | null =>
    sea?.find((b) => b.id === id) ?? (own?.id === id ? own : null);

  /** Tras escribir: una lectura en marcha es de antes y no vale. */
  const discardReads = () => {
    gen++;
    loading = null;
  };

  /** Cambia una botella (o la quita, con null) en lo leído y avisa. */
  const patch = (id: string, next: BottleView | null) => {
    discardReads();
    if (sea) {
      const i = sea.findIndex((b) => b.id === id);
      if (i >= 0) {
        sea = next ? sea.map((b, j) => (j === i ? next : b)) : sea.filter((_, j) => j !== i);
      }
    }
    if (own?.id === id) own = next;
    emit();
  };

  const api: BottleApi = {
    list: async () => {
      await ensure();
      const list = sea ?? [];
      const activeOwn = own;
      const visible =
        activeOwn && !list.some((b) => b.id === activeOwn.id) ? [...list, activeOwn] : list;
      return visible.map((b) => ({ ...b, read: readHere.has(b.id) }));
    },

    mine: async () => {
      if (!opts.viewer()) return null;
      await ensure();
      return own ? { ...own } : null;
    },

    place: async (input: BottleInput) => {
      const me = requireViewer('escriben botellas');
      const message = checkMessage(input.message);
      const pos = checkPosition(input.x, input.y);
      let row: Omit<OwnRow, 'updated_at'>;
      try {
        row = (await call(
          (await sb()).rpc('place_bottle', { p_message: message, p_x: pos.x, p_y: pos.y }),
        )) as unknown as Omit<OwnRow, 'updated_at'>;
      } catch (e) {
        throw storeErrorFrom(e);
      }
      const nickname = own?.authorNickname ?? sea?.find((b) => b.isMine)?.authorNickname ?? null;
      const view = viewFromOwn({ ...row, updated_at: row.created_at }, me, nickname);
      discardReads();
      if (sea !== null && readFor === me) {
        // La nueva entra la primera; la anterior de la cuenta sale del mar.
        sea = [view, ...sea.filter((b) => !b.isMine)].slice(0, BOTTLES_IN_SEA_MAX);
        readAt = now();
      } else {
        sea = null;
      }
      own = view;
      emit();
      // Sin el mar leído o sin el apodo todavía: se lee entero, sin esperar.
      if (sea === null || !nickname) void ensure(true);
      return { ...view };
    },

    edit: async (id, changes) => {
      const me = requireViewer('editan botellas');
      const update: Record<string, unknown> = {};
      if (changes.message !== undefined) update.message = checkMessage(changes.message);
      if (changes.x !== undefined || changes.y !== undefined) {
        const cur = find(id);
        const pos = checkPosition(changes.x ?? cur?.x, changes.y ?? cur?.y);
        update.x = pos.x;
        update.y = pos.y;
      }
      let rows: OwnRow[];
      try {
        rows = ((await call(
          (await sb())
            .from('bottles')
            .update(update)
            .eq('id', id)
            .eq('user_id', me)
            .eq('status', 'active')
            .select(OWN_COLUMNS),
        )) ?? []) as unknown as OwnRow[];
      } catch (e) {
        throw storeErrorFrom(e);
      }
      const r = rows[0];
      if (!r) throw new StoreError('not_found', `botella ${id}`);
      const before = find(id);
      const view = viewFromOwn(r, me, before?.authorNickname ?? own?.authorNickname ?? null);
      patch(id, view);
      return { ...view };
    },

    retire: async (id) => {
      const me = requireViewer('retiran botellas');
      let rows: unknown[];
      try {
        rows = ((await call(
          (await sb())
            .from('bottles')
            .update({ status: 'retired' })
            .eq('id', id)
            .eq('user_id', me)
            .eq('status', 'active')
            .select('id'),
        )) ?? []) as unknown[];
      } catch (e) {
        throw storeErrorFrom(e);
      }
      if (rows.length === 0 && !find(id)) throw new StoreError('not_found', `botella ${id}`);
      patch(id, null);
    },

    read: async (id) => {
      await ensure();
      const b = find(id);
      if (!b) throw new StoreError('not_found', `botella ${id}`);
      const first = !readHere.has(id);
      readHere.add(id);
      const me = opts.viewer();
      if (me && first) {
        // Registrar la lectura no frena leerla; repetida (23505) no es un fallo.
        void sb()
          .then((c) => call(c.from('bottle_reads').insert({ bottle_id: id, reader_id: me })))
          .catch((e: unknown) => {
            if (codeOf(e) !== '23505') console.warn('[boia] no se registró la lectura', e);
          });
      }
      const view = { ...b, read: true };
      if (first) patch(id, view);
      return { ...view };
    },

    report: async (id, reason = null) => {
      const me = requireViewer('reportan botellas');
      const why = reason === null ? null : String(reason).trim() || null;
      if (why !== null && charLength(why) > BOTTLE_REPORT_REASON_MAX)
        throw new StoreError('invalid', `reporte: hasta ${BOTTLE_REPORT_REASON_MAX} caracteres`);
      const b = find(id);
      if (b?.isMine) throw new StoreError('forbidden', 'es tu botella');
      try {
        await call(
          (await sb())
            .from('bottle_reports')
            .insert({ bottle_id: id, reporter_id: me, reason: why }),
        );
      } catch (e) {
        if (codeOf(e) === '23505') return { first: false };
        if (codeOf(e) === '23503') throw new StoreError('not_found', `botella ${id}`);
        throw storeErrorFrom(e);
      }
      return { first: true };
    },
  };

  return {
    api,
    refresh: () => ensure(true),
    invalidate: () => {
      gen++;
      sea = null;
      own = null;
      readAt = 0;
      readFor = null;
      readHere.clear();
      loading = null;
    },
    subscribe: (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}
