/**
 * Sólo pruebas: un Supabase de mentira para una cuenta, en memoria, con la
 * forma del cliente (`SupabaseLike`) y una versión reducida de las reglas de
 * las RPC de T86 (ids estables, duplicados, saldo, propiedad, mínimos de
 * tiempo, versión de la copia). Se puede dejar sin red (`offline`) o hacer
 * que rechace la próxima llamada a una RPC (`failNext`).
 */
import type {
  ServerLedgerRow,
  SupabaseLike,
  SupabaseQueryLike,
  SupabaseResult,
  SupabaseTableLike,
} from './server';

export interface FakeCosmetic {
  slot: string;
  price: number | null;
  forShip?: string;
  base?: boolean;
}

const COSMETICS: Record<string, FakeCosmetic> = {
  'barco-arcilla': { slot: 'ship', price: null, base: true },
  'barco-cartoon-30': { slot: 'ship', price: 120 },
  'skin-arcilla-noche': { slot: 'skin', price: 50, forShip: 'barco-arcilla' },
  'bandera-boia': { slot: 'flag', price: 20 },
};

type Row = Record<string, unknown>;

class FakeQuery implements SupabaseQueryLike<Row[]> {
  readonly filters: Array<[string, unknown]> = [];
  from = 0;
  to = Number.POSITIVE_INFINITY;
  constructor(private readonly exec: (q: FakeQuery) => SupabaseResult<Row[]>) {}
  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }
  order() {
    return this;
  }
  range(from: number, to: number) {
    this.from = from;
    this.to = to;
    return this;
  }
  select() {
    return this;
  }
  matches(row: Row): boolean {
    return this.filters.every(([c, v]) => row[c] === v);
  }
  then<A = SupabaseResult<Row[]>, B = never>(
    onFulfilled?: ((v: SupabaseResult<Row[]>) => A | PromiseLike<A>) | null,
    onRejected?: ((e: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve()
      .then(() => this.exec(this))
      .then(onFulfilled, onRejected);
  }
}

export class FakeSupabase implements SupabaseLike {
  readonly userId: string;
  offline = false;
  /** Llamadas a RPC, en orden. */
  readonly calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  ledger: ServerLedgerRow[] = [];
  equipped: Record<string, string> = {};
  times: Row[] = [];
  discounts: Row[] = [];
  carnet: Row | null = null;
  answers: Row[] = [];
  snapshot: { data: Record<string, unknown>; version: number } | null = null;
  readonly takenNicknames = new Set<string>();
  private failures = new Map<string, string>();
  private clock = 0;

  constructor(userId: string) {
    this.userId = userId;
  }

  /** La próxima llamada a `fn` se rechaza con `reason`. */
  failNext(fn: string, reason: string): void {
    this.failures.set(fn, reason);
  }

  /** Puntos y monedas de la cuenta, como `point_balances` y `coin_balances`. */
  balances(): { points: number; coins: number } {
    return this.ledger.reduce(
      (b, r) => ({ points: b.points + r.points_delta, coins: b.coins + r.coins_delta }),
      { points: 0, coins: 0 },
    );
  }

  /** Una fila del libro escrita por el servidor (p. ej. otro dispositivo o el Admin). */
  addRow(row: Partial<ServerLedgerRow> & Pick<ServerLedgerRow, 'kind'>): ServerLedgerRow {
    const at = this.tick();
    const full: ServerLedgerRow = {
      id: `tx-${this.ledger.length + 1}`,
      points_delta: 0,
      coins_delta: 0,
      cosmetic_key: null,
      compensates_id: null,
      source_ref: null,
      reason: null,
      created_by: null,
      metadata: {},
      created_at: at,
      action: null,
      occurred_at: at,
      ...row,
    };
    this.ledger.push(full);
    return full;
  }

  private tick(): string {
    this.clock++;
    return new Date(Date.UTC(2026, 9, 3, 12, 0, this.clock)).toISOString();
  }

  private owns(id: string): boolean {
    const c = COSMETICS[id];
    if (c?.base) return true;
    let n = 0;
    for (const r of this.ledger) {
      if (r.kind === 'cosmetic' && r.cosmetic_key === id) n++;
      if (r.kind === 'compensation') {
        const orig = this.ledger.find((x) => x.id === r.compensates_id);
        if (orig?.kind === 'cosmetic' && orig.cosmetic_key === id) n--;
      }
    }
    return n > 0;
  }

  private reject(reason: string): SupabaseResult {
    return { data: null, error: { code: 'P0001', message: reason } };
  }

  rpc(fn: string, args: Record<string, unknown> = {}): PromiseLike<SupabaseResult> {
    return Promise.resolve().then(() => {
      if (this.offline) return { data: null, error: { message: 'TypeError: Failed to fetch' } };
      this.calls.push({ fn, args });
      const fail = this.failures.get(fn);
      if (fail) {
        this.failures.delete(fn);
        return this.reject(fail);
      }
      return this.handle(fn, args);
    });
  }

  private handle(fn: string, a: Record<string, unknown>): SupabaseResult {
    switch (fn) {
      case 'award_points': {
        const policy = String(a.p_policy ?? 'once');
        const ref = String(a.p_ref);
        const key = policy === 'season' ? `${ref}@season:s1` : ref;
        const id = `award|${String(a.p_action)}|${key}`;
        if (this.ledger.some((r) => r.id === id)) {
          return { data: { granted: false, reason: 'duplicate', tx_id: id }, error: null };
        }
        const points = Number(a.p_points ?? 0);
        const coins = Number(a.p_coins ?? 0);
        if (points + coins <= 0) return this.reject('invalid_amount');
        this.addRow({
          id,
          kind: 'world_reward',
          points_delta: points,
          coins_delta: coins,
          source_ref: ref,
          action: String(a.p_action),
          metadata: { ...(a.p_metadata as Row), policy, key },
        });
        return { data: { granted: true, tx_id: id, points, coins }, error: null };
      }
      case 'buy_cosmetic': {
        const id = String(a.p_cosmetic);
        const c = COSMETICS[id];
        if (!c) return this.reject('unknown_cosmetic');
        if (this.owns(id)) return { data: { granted: false, reason: 'duplicate' }, error: null };
        if (c.price === null) return this.reject('not_for_sale');
        if (c.forShip && !this.owns(c.forShip)) return this.reject('needs_ship');
        if (this.balances().coins < c.price) return this.reject('insufficient_coins');
        this.addRow({
          kind: 'cosmetic',
          coins_delta: -c.price,
          cosmetic_key: id,
          source_ref: 'coins',
          action: 'buy',
        });
        return { data: { granted: true }, error: null };
      }
      case 'equip_cosmetic': {
        const slot = String(a.p_slot);
        const id = (a.p_cosmetic as string | null) ?? null;
        if (id === null) {
          delete this.equipped[slot];
          return { data: this.equipped, error: null };
        }
        const c = COSMETICS[id];
        if (!c) return this.reject('unknown_cosmetic');
        if (c.slot !== slot) return this.reject('wrong_slot');
        if (!this.owns(id)) return this.reject('not_owned');
        this.equipped[slot] = id;
        if (slot === 'skin' && c.forShip) this.equipped.ship = c.forShip;
        return { data: { ...this.equipped }, error: null };
      }
      case 'submit_race_time': {
        if (a.p_circuit !== 'el-freu' || a.p_version !== 3) return this.reject('unknown_circuit');
        const ms = Number(a.p_ms);
        if (ms < 45_000) return this.reject('too_fast');
        const prev = this.times.find((t) => t.circuit_id === 'el-freu');
        const at = this.tick();
        if (!prev) {
          this.times.push({
            user_id: this.userId,
            circuit_id: 'el-freu',
            circuit_version: 3,
            best_ms: ms,
            best_at: at,
            attempts: 1,
            voided_at: null,
          });
        } else {
          prev.attempts = Number(prev.attempts) + 1;
          if (ms < Number(prev.best_ms)) {
            prev.best_ms = ms;
            prev.best_at = at;
          }
        }
        return { data: { best: true }, error: null };
      }
      case 'find_discount': {
        const id = String(a.p_discount);
        if (!this.discounts.some((d) => d.discount_id === id)) {
          this.discounts.push({
            user_id: this.userId,
            discount_id: id,
            found_at: this.tick(),
            used_at: null,
            used_event: null,
          });
        }
        return { data: { first: true }, error: null };
      }
      case 'use_discount': {
        const d = this.discounts.find((x) => x.discount_id === a.p_discount);
        if (!d) return this.reject('discount_not_found');
        if (d.used_at) return this.reject('discount_used');
        d.used_at = this.tick();
        d.used_event = a.p_event ?? null;
        return { data: { used: true }, error: null };
      }
      case 'save_profile': {
        const nickname = String(a.p_nickname);
        if (this.takenNicknames.has(nickname.toLowerCase())) return this.reject('nickname_taken');
        this.carnet = {
          ...(this.carnet ?? { member_since: this.tick(), member_number: 7, version: 0 }),
          user_id: this.userId,
          nickname,
          avatar_key: a.p_avatar_key ?? null,
          avatar_image: a.p_avatar_image ?? null,
        };
        this.carnet.version = Number(this.carnet.version ?? 0) + 1;
        return { data: this.carnet, error: null };
      }
      case 'save_snapshot': {
        const base = a.p_base_version as number | null | undefined;
        const cur = this.snapshot?.version ?? 0;
        if (base !== null && base !== undefined && base !== cur) {
          return this.reject('snapshot_conflict');
        }
        this.snapshot = { data: structuredClone(a.p_data as Row), version: cur + 1 };
        return { data: { version: cur + 1 }, error: null };
      }
      default:
        return { data: null, error: { code: 'PGRST202', message: `sin ${fn}` } };
    }
  }

  private table(name: string): Row[] {
    const uid = { user_id: this.userId };
    switch (name) {
      case 'ledger_transactions':
        return this.ledger.map((r) => ({ ...r, ...uid }));
      case 'equipped_cosmetics':
        return Object.entries(this.equipped).map(([slot, cosmetic_id]) => ({
          ...uid,
          slot,
          cosmetic_id,
        }));
      case 'race_times':
        return this.times;
      case 'user_discounts':
        return this.discounts;
      case 'carnets':
        return this.carnet ? [this.carnet] : [];
      case 'carnet_answers':
        return this.answers;
      case 'account_snapshots':
        return this.snapshot ? [{ ...uid, ...this.snapshot }] : [];
      default:
        return [];
    }
  }

  from(name: string): SupabaseTableLike {
    const offline = () => (this.offline ? { message: 'TypeError: Failed to fetch' } : null);
    const read = (q: FakeQuery): SupabaseResult<Row[]> => {
      const error = offline();
      if (error) return { data: null, error };
      const rows = this.table(name).filter((r) => q.matches(r));
      return { data: structuredClone(rows.slice(q.from, q.to + 1)), error: null };
    };
    return {
      select: () => new FakeQuery(read),
      insert: (row) =>
        new FakeQuery(() => {
          const error = offline();
          if (error) return { data: null, error };
          if (name === 'carnet_answers') this.answers.push({ ...row, updated_at: this.tick() });
          return { data: [], error: null };
        }),
      update: (patch) =>
        new FakeQuery((q) => {
          const error = offline();
          if (error) return { data: null, error };
          const hits = name === 'carnet_answers' ? this.answers.filter((r) => q.matches(r)) : [];
          for (const r of hits) Object.assign(r, patch, { updated_at: this.tick() });
          return { data: structuredClone(hits), error: null };
        }),
      delete: () =>
        new FakeQuery((q) => {
          const error = offline();
          if (error) return { data: null, error };
          if (name === 'carnet_answers') this.answers = this.answers.filter((r) => !q.matches(r));
          return { data: [], error: null };
        }),
    };
  }
}
