/**
 * La cuenta en el servidor (plan 008, T90): lo que el repositorio de un
 * miembro lee de Supabase y las RPC con las que escribe. Sin dependencias de
 * `@supabase/supabase-js`: el cliente se describe por la forma mínima que se
 * usa (`SupabaseLike`), así las pruebas pasan uno falso y la web, el suyo.
 *
 * Lo de valor sólo se escribe con las RPC de T86 (decisión 6); las respuestas
 * del Carnet van a `carnet_answers`, que la RLS deja escribir a su dueño.
 */

/** Error de PostgREST (o de red) tal como lo da el cliente. */
export interface SupabaseErrorLike {
  message?: string | undefined;
  code?: string | undefined;
  details?: string | null | undefined;
  status?: number | undefined;
}

export interface SupabaseResult<T = unknown> {
  data: T | null;
  error: SupabaseErrorLike | null;
}

/** Una consulta encadenable que al final se espera. */
export interface SupabaseQueryLike<T = unknown> extends PromiseLike<SupabaseResult<T>> {
  eq(column: string, value: unknown): SupabaseQueryLike<T>;
  order(column: string, options?: { ascending?: boolean }): SupabaseQueryLike<T>;
  range(from: number, to: number): SupabaseQueryLike<T>;
  select(columns?: string): SupabaseQueryLike<T>;
}

export interface SupabaseTableLike {
  select(columns: string): SupabaseQueryLike<Record<string, unknown>[]>;
  insert(row: Record<string, unknown>): SupabaseQueryLike;
  update(patch: Record<string, unknown>): SupabaseQueryLike<Record<string, unknown>[]>;
  delete(): SupabaseQueryLike;
}

/** Lo que se usa del cliente de Supabase. */
export interface SupabaseLike {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<SupabaseResult>;
  from(table: string): SupabaseTableLike;
}

// ---------------------------------------------------------------------------
// Lo que hay en el servidor de una cuenta

export type ServerLedgerKind =
  'world_reward' | 'achievement' | 'stamp' | 'cosmetic' | 'adjustment' | 'compensation';

/** Una fila de `ledger_transactions` de la cuenta. */
export interface ServerLedgerRow {
  id: string;
  kind: ServerLedgerKind;
  points_delta: number;
  coins_delta: number;
  achievement_id?: string | null;
  event_id?: string | null;
  cosmetic_key: string | null;
  compensates_id: string | null;
  source_ref: string | null;
  reason: string | null;
  created_by: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  /** Acción de `point_actions` (`world`, `achievement`…) o `buy`/`unlock`/`stamp`. */
  action: string | null;
  /** Cuándo ocurrió (en una fusión, la fecha del invitado). */
  occurred_at: string | null;
}

export interface ServerRaceTime {
  circuit_id: string;
  circuit_version: number;
  best_ms: number;
  best_at: string;
  attempts: number;
  voided_at: string | null;
}

export interface ServerDiscount {
  discount_id: string;
  found_at: string;
  used_at: string | null;
  used_event: string | null;
}

export interface ServerCarnet {
  nickname: string;
  avatar_key: string | null;
  avatar_image: string | null;
  member_since: string;
  member_number?: number | null;
  version?: number | null;
  updated_at?: string | null;
}

export interface ServerAnswer {
  question_id: string;
  question_version: number;
  answer: string;
  updated_at: string | null;
}

export interface ServerSnapshot {
  data: Record<string, unknown>;
  version: number;
}

/** Todo lo de una cuenta que el navegador guarda como copia. */
export interface ServerState {
  ledger: ServerLedgerRow[];
  /** Ranura → cosmético. */
  equipped: Record<string, string>;
  times: ServerRaceTime[];
  discounts: ServerDiscount[];
  carnet: ServerCarnet | null;
  answers: ServerAnswer[];
  snapshot: ServerSnapshot | null;
}

// ---------------------------------------------------------------------------
// Fallos

/**
 * Un fallo al hablar con el servidor. `transient`: sin red, servidor caído o
 * sesión que se está renovando; se vuelve a intentar. Si no, es un rechazo
 * (`reason`: la clave estable de la RPC, p. ej. `insufficient_coins`).
 */
export class ServerCallError extends Error {
  readonly transient: boolean;
  readonly reason: string;
  constructor(transient: boolean, reason: string, message?: string) {
    super(message ?? reason);
    this.name = 'ServerCallError';
    this.transient = transient;
    this.reason = reason;
  }
}

const REASON = /^[a-z_]+$/;

/**
 * Qué es un error del cliente de Supabase: un rechazo de la RPC (P0001, o
 * 42501 si falta cuenta o rol, con la clave como mensaje), un error de datos
 * (22…, 23…) o algo pasajero (red, 5xx, sesión caducada). `not_member` se
 * trata como pasajero: la sesión se perdió y la acción espera a la siguiente.
 */
export function classifyServerError(err: unknown): ServerCallError {
  if (err instanceof ServerCallError) return err;
  const e = (err && typeof err === 'object' ? err : {}) as SupabaseErrorLike;
  const code = typeof e.code === 'string' ? e.code : '';
  const message = typeof e.message === 'string' ? e.message : String(err);
  if (code === 'P0001' || code === '42501') {
    const reason = REASON.test(message) ? message : 'invalid_input';
    return new ServerCallError(reason === 'not_member', reason, message);
  }
  if (/^2[23]/.test(code)) return new ServerCallError(false, 'invalid_input', message);
  if (code === 'PGRST301' || code === 'PGRST303') {
    return new ServerCallError(true, 'session', message);
  }
  if (code.startsWith('PGRST')) return new ServerCallError(false, 'server_error', message);
  if (typeof e.status === 'number' && e.status >= 400 && e.status < 500 && e.status !== 408) {
    if (e.status === 401) return new ServerCallError(true, 'session', message);
    return new ServerCallError(false, 'server_error', message);
  }
  return new ServerCallError(true, 'network', message);
}

// ---------------------------------------------------------------------------
// El adaptador

/** Las RPC de valor que llama el repositorio de un miembro. */
export type MemberRpc =
  | 'award_points'
  | 'buy_cosmetic'
  | 'equip_cosmetic'
  | 'submit_race_time'
  | 'find_discount'
  | 'use_discount'
  | 'save_profile'
  | 'set_artist_music'
  | 'save_snapshot';

export interface MemberServer {
  /** Lo de la cuenta, para la copia local. */
  pull(): Promise<ServerState>;
  /** Llama a una RPC; lanza `ServerCallError`. */
  rpc(fn: MemberRpc, args: Record<string, unknown>): Promise<unknown>;
  /** Contesta (o, con null, borra) una pregunta del Carnet. */
  saveAnswer(questionId: string, questionVersion: number, answer: string | null): Promise<void>;
  /**
   * El código común de la ticketera para un descuento de entradas que la
   * cuenta ya encontró (`discount_code_for`, plan 019 T215/T223); null si no
   * hay código común (vale el del descuento).
   */
  discountCode?(discountId: string): Promise<string | null>;
}

/** Filas del libro por página (PostgREST corta en 1000). */
const LEDGER_PAGE = 500;

async function run<T>(q: PromiseLike<SupabaseResult<T>>): Promise<T | null> {
  let res: SupabaseResult<T>;
  try {
    res = await q;
  } catch (e) {
    throw classifyServerError(e);
  }
  if (res.error) throw classifyServerError(res.error);
  return res.data;
}

/**
 * El servidor de la cuenta `userId` sobre un cliente de Supabase con su
 * sesión. `client` puede ser una promesa (la web lo carga a demanda).
 */
export function supabaseMemberServer(
  client: SupabaseLike | PromiseLike<SupabaseLike>,
  userId: string,
): MemberServer {
  const sb = async () => client;
  const rows = async (table: string, columns: string) =>
    ((await run((await sb()).from(table).select(columns).eq('user_id', userId))) ?? []) as Record<
      string,
      unknown
    >[];

  return {
    async pull() {
      const c = await sb();
      const ledger: ServerLedgerRow[] = [];
      const loadLedger = async () => {
        for (let from = 0; ; from += LEDGER_PAGE) {
          const page = ((await run(
            c
              .from('ledger_transactions')
              .select(
                'id, kind, points_delta, coins_delta, achievement_id, event_id, cosmetic_key, ' +
                  'compensates_id, source_ref, reason, created_by, metadata, created_at, action, occurred_at',
              )
              .eq('user_id', userId)
              .order('created_at', { ascending: true })
              .order('id', { ascending: true })
              .range(from, from + LEDGER_PAGE - 1),
          )) ?? []) as unknown as ServerLedgerRow[];
          ledger.push(...page);
          if (page.length < LEDGER_PAGE) return;
        }
      };
      const [, equipped, times, discounts, carnets, answers, snapshots] = await Promise.all([
        loadLedger(),
        rows('equipped_cosmetics', 'slot, cosmetic_id'),
        rows('race_times', 'circuit_id, circuit_version, best_ms, best_at, attempts, voided_at'),
        rows('user_discounts', 'discount_id, found_at, used_at, used_event'),
        rows(
          'carnets',
          'nickname, avatar_key, avatar_image, member_since, member_number, version, updated_at',
        ),
        rows('carnet_answers', 'question_id, question_version, answer, updated_at'),
        rows('account_snapshots', 'data, version'),
      ]);
      const snap = snapshots[0] as unknown as ServerSnapshot | undefined;
      return {
        ledger,
        equipped: Object.fromEntries(equipped.map((r) => [String(r.slot), String(r.cosmetic_id)])),
        times: times as unknown as ServerRaceTime[],
        discounts: discounts as unknown as ServerDiscount[],
        carnet: (carnets[0] as unknown as ServerCarnet | undefined) ?? null,
        answers: answers as unknown as ServerAnswer[],
        snapshot:
          snap && snap.data && typeof snap.data === 'object'
            ? { data: snap.data, version: Number(snap.version) }
            : null,
      };
    },

    async rpc(fn, args) {
      return run((await sb()).rpc(fn, args));
    },

    async discountCode(discountId) {
      const code = await run((await sb()).rpc('discount_code_for', { p_discount: discountId }));
      return typeof code === 'string' && code.trim() !== '' ? code : null;
    },

    async saveAnswer(questionId, questionVersion, answer) {
      const t = async () => (await sb()).from('carnet_answers');
      if (answer === null) {
        await run((await t()).delete().eq('user_id', userId).eq('question_id', questionId));
        return;
      }
      // Sin upsert: la RLS deja actualizar sólo la respuesta y su versión.
      const updated = await run(
        (await t())
          .update({ answer, question_version: questionVersion })
          .eq('user_id', userId)
          .eq('question_id', questionId)
          .select('question_id'),
      );
      if (Array.isArray(updated) && updated.length > 0) return;
      await run(
        (await t()).insert({
          user_id: userId,
          question_id: questionId,
          question_version: questionVersion,
          answer,
        }),
      );
    },
  };
}
