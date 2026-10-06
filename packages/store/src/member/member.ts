/**
 * El repositorio de un miembro (plan 008, T90, decisión 6): la misma
 * interfaz que el local, con la cuenta de Supabase detrás.
 *
 * - Debajo hay un repositorio local propio de la cuenta (su copia: se lee de
 *   él, también sin red). Al empezar, al volver la red y cuando se pide, se
 *   pone al día con lo del servidor, que gana (`applyServerState`).
 * - Cada acción de valor se hace primero en la copia (la interfaz responde al
 *   momento, como siempre) y entra en una cola que va a las RPC de T86 en
 *   orden. Comprar, equipar y el Carnet esperan la respuesta: un rechazo
 *   llega a quien llamó como `SyncRejectedError`. Los demás no esperan; un
 *   rechazo se avisa (`onEvent`). Tras un rechazo la copia vuelve a lo del
 *   servidor.
 * - Sin red, la cola se guarda en el navegador y se reintenta (también al
 *   volver a abrir); nada se pierde en silencio: se avisa una vez.
 * - El resto del documento (descubrimientos, misiones, ajustes…) se guarda
 *   con `save_snapshot` unos segundos después de cada cambio y cuando se pide
 *   (al ocultar la página). Si otro dispositivo guardó antes, gana el
 *   servidor.
 */
import { newId } from '../ids';
import { localDocAccess, type LocalDocAccess } from '../local';
import type {
  BoiaRepository,
  CarnetApi,
  CarnetView,
  ChangeArea,
  IdentityApi,
  ProgressApi,
  PurchaseApi,
} from '../repository';
import { CARNET_QUESTIONS } from '@boia/contracts';
import type { JsonValue } from '../schema';
import type { StorageLike } from '../storage';
import { applyServerState, applySnapshot, CIRCUIT_RECORD, snapshotOf } from './hydrate';
import { emptySnapshot, mergeSnapshots, remoteSnapshot } from './snapshot-merge';
import {
  isAlreadyDone,
  pointActionFor,
  sendOp,
  SyncRejectedError,
  type MemberOp,
  type MemberOpInput,
  type MemberOpKind,
} from './ops';
import { classifyServerError, type MemberServer } from './server';

export type SyncEvent =
  /** Sin red: lo hecho se guarda aquí y se manda al volver. Una vez por corte. */
  | { type: 'offline'; pending: number }
  /** Volvió la red y la cola ya está en el servidor. */
  | { type: 'online' }
  /** El servidor no aceptó una acción; la copia vuelve a lo suyo. */
  | { type: 'rejected'; op: MemberOpKind | 'snapshot'; reason: string }
  /** La copia está al día con el servidor. */
  | { type: 'pulled' };

export interface MemberSync {
  readonly userId: string;
  /** Primera puesta al día (o la última pedida con `refresh`), con límite de espera. */
  ready(): Promise<void>;
  /**
   * Manda la cola y vuelve a leer del servidor. Con `block` (por defecto),
   * las llamadas esperan a que acabe (p. ej. tras pasar lo del invitado).
   */
  refresh(block?: boolean): Promise<void>;
  /** Manda la cola (y lee del servidor si hace falta) y guarda la copia pendiente. */
  flush(): Promise<void>;
  /** Guarda ya la copia del resto del documento, si cambió. */
  saveSnapshot(): Promise<void>;
  /** Acciones que esperan a ir al servidor. */
  pending(): number;
  /** Non-economic progress not yet acknowledged by the server. */
  snapshotPending(): boolean;
  offline(): boolean;
  dispose(): void;
}

export interface MemberRepository extends BoiaRepository {
  readonly sync: MemberSync;
}

export interface MemberRepositoryOptions {
  userId: string;
  /** Repositorio local de la cuenta (`createLocalRepository` con su propia clave). */
  cache: BoiaRepository;
  server: MemberServer;
  /** Dónde vive la cola; null: en memoria. */
  storage?: StorageLike | null;
  /** Clave de la cola en `storage` (por defecto `<clave de la copia>.sync`). */
  syncKey?: string;
  now?: () => Date;
  onEvent?: (e: SyncEvent) => void;
  /** Espera tras un cambio antes de guardar la copia. */
  snapshotDelayMs?: number;
  /** Lo que una llamada espera a la puesta al día antes de usar la copia tal cual. */
  readyTimeoutMs?: number;
  /** Esperas entre reintentos sin red. */
  retryMs?: readonly number[];
}

const ALL_AREAS: ChangeArea[] = ['identity', 'carnet', 'progress', 'purchases', 'bottles'];
const METADATA_MAX_BYTES = 1800;

interface SyncMeta {
  ops: MemberOp[];
  snapshotVersion: number | null;
  snapshotJson: string | null;
}

function readMeta(storage: StorageLike | null, key: string): SyncMeta | null {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return null;
    const m = JSON.parse(raw) as Partial<SyncMeta>;
    return {
      ops: Array.isArray(m.ops) ? m.ops : [],
      snapshotVersion: typeof m.snapshotVersion === 'number' ? m.snapshotVersion : null,
      snapshotJson: typeof m.snapshotJson === 'string' ? m.snapshotJson : null,
    };
  } catch {
    return null;
  }
}

function parseJson(json: string): unknown {
  try {
    return JSON.parse(json) as unknown;
  } catch {
    return null;
  }
}

/** Clave de la cola de la cuenta de una copia (`boia.cuenta.<id>` → `boia.cuenta.<id>.sync`). */
export function memberSyncKey(cacheKey: string): string {
  return `${cacheKey}.sync`;
}

function raceTimeout(p: Promise<unknown>, ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    p.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      () => {
        clearTimeout(timer);
        resolve();
      },
    );
  });
}

export function createMemberRepository(opts: MemberRepositoryOptions): MemberRepository {
  return new MemberRepo(opts);
}

class MemberRepo implements MemberRepository {
  private readonly uid: string;
  private readonly cache: BoiaRepository;
  private readonly access: LocalDocAccess;
  private readonly server: MemberServer;
  private readonly storage: StorageLike | null;
  private readonly syncKey: string;
  private readonly now: () => Date;
  private readonly onEvent: (e: SyncEvent) => void;
  private readonly snapshotDelayMs: number;
  private readonly readyTimeoutMs: number;
  private readonly retryMs: readonly number[];

  private ops: MemberOp[];
  private snapshotVersion: number | null;
  private lastSnapshotJson: string;
  /** Sube con cada acción nueva: una lectura del servidor de antes no se aplica. */
  private gen = 0;
  private needsPull = true;
  private hydrating = false;
  private isOffline = false;
  private retryIndex = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private snapshotTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private chain: Promise<unknown> = Promise.resolve();
  private gate: Promise<void>;
  private readonly results = new Map<string, string | null>();
  private readonly unsubscribe: () => void;

  readonly identity: IdentityApi;
  readonly carnet: CarnetApi;
  readonly progress: ProgressApi;
  readonly purchases: PurchaseApi;
  readonly bottles: BoiaRepository['bottles'];
  readonly content: BoiaRepository['content'];
  readonly admin: BoiaRepository['admin'];
  readonly sync: MemberSync;

  constructor(o: MemberRepositoryOptions) {
    const access = localDocAccess(o.cache);
    if (!access)
      throw new Error('createMemberRepository: la copia tiene que ser un repositorio local');
    this.uid = o.userId;
    this.cache = o.cache;
    this.access = access;
    this.server = o.server;
    this.storage = o.storage ?? null;
    this.syncKey = o.syncKey ?? memberSyncKey(access.key);
    this.now = o.now ?? (() => new Date());
    this.onEvent = o.onEvent ?? (() => {});
    this.snapshotDelayMs = o.snapshotDelayMs ?? 4000;
    this.readyTimeoutMs = o.readyTimeoutMs ?? 8000;
    this.retryMs = o.retryMs ?? [2000, 5000, 15_000, 30_000, 60_000];

    // La copia es de esta cuenta desde el principio: nada se apunta a un invitado.
    if (access.view((d) => d.identity?.id) !== this.uid) {
      access.write(['identity'], (d) => {
        d.identity = { id: this.uid, kind: 'member', createdAt: this.now().toISOString() };
      });
    }
    const meta = readMeta(this.storage, this.syncKey);
    this.ops = meta?.ops ?? [];
    this.snapshotVersion = meta?.snapshotVersion ?? null;
    this.lastSnapshotJson = meta?.snapshotJson ?? JSON.stringify(emptySnapshot());
    // Una copia vacía con la última copia reconocida guardada (p. ej. se borró
    // la copia y quedó la cola): se parte de ella, así lo que falta en la copia
    // vacía no se toma por borrado al fusionar con el servidor.
    if (meta?.snapshotJson && this.isEmptyCopy()) {
      const acknowledged = parseJson(meta.snapshotJson);
      access.write(ALL_AREAS, (d) => {
        applySnapshot(d, this.uid, acknowledged);
      });
    }
    this.unsubscribe = this.cache.subscribe(() => {
      if (!this.hydrating) this.scheduleSnapshot();
    });

    this.identity = this.wrap(this.identityApi());
    this.carnet = this.wrap(this.carnetApi());
    this.progress = this.wrap(this.progressApi());
    this.purchases = this.wrap(this.purchaseApi());
    this.bottles = this.wrap({ ...this.cache.bottles });
    this.content = this.cache.content;
    this.admin = this.cache.admin;
    this.sync = this.syncApi();
    this.gate = Promise.resolve();
    this.setReady(this.serial(() => this.runFlush()));
  }

  // -------------------------------------------------------------------------
  // BoiaRepository

  readonly status: BoiaRepository['status'] = () => this.cache.status();
  readonly revision: BoiaRepository['revision'] = () => this.cache.revision();
  readonly subscribe: BoiaRepository['subscribe'] = (l) => this.cache.subscribe(l);

  /** Cada llamada espera a la puesta al día (con límite) antes de ir a la copia. */
  private wrap<T extends object>(api: T): T {
    const out: Record<string, unknown> = {};
    for (const [name, fn] of Object.entries(api)) {
      if (typeof fn !== 'function') continue;
      out[name] = async (...args: unknown[]) => {
        await this.gate;
        return (fn as (...a: unknown[]) => unknown)(...args);
      };
    }
    return out as T;
  }

  private identityApi(): IdentityApi {
    const c = this.cache.identity;
    return {
      ...c,
      // Empezar de cero en este navegador: se tira la copia y se vuelve a leer la cuenta.
      reset: async () => {
        // Refresh the account copy, not the user's progress. Emptying it here
        // would look like intentional preference/purchase deletions to the merger.
        this.snapshotVersion = null;
        await this.sync.refresh();
        return (await c.current())!;
      },
    };
  }

  /** El Carnet guardado tal cual (sin lo que oculta la moderación local). */
  private storedCarnet() {
    return this.access.view((d) => structuredClone(d.carnets[this.uid] ?? null));
  }

  private async saveProfile(): Promise<void> {
    const c = this.storedCarnet();
    if (!c) return;
    await this.enqueue(
      {
        kind: 'profile',
        nickname: c.nickname,
        avatarKey: c.avatarKey,
        avatarImage: c.avatarImage,
      },
      true,
    );
  }

  private carnetApi(): CarnetApi {
    const c = this.cache.carnet;
    const mine = async (fallback: CarnetView) => (await c.mine()) ?? fallback;
    return {
      ...c,
      // La cuenta ya tiene su Carnet desde el alta (T89): crear es guardar.
      // El enlace de artistas lo comprueba el servidor al crear la cuenta
      // (save_profile, T186): la copia local no se marca sola.
      create: async ({ artistCode: _code, ...input }) => {
        const view = (await c.mine()) ? await c.update(input) : await c.create(input);
        await this.saveProfile();
        return mine(view);
      },
      update: async (patch) => {
        const view = await c.update(patch);
        await this.saveProfile();
        return mine(view);
      },
      answer: async (questionId, answer) => {
        const view = await c.answer(questionId, answer);
        const stored = this.storedCarnet()?.answers[questionId];
        const q = CARNET_QUESTIONS.find((x) => x.id === questionId);
        await this.enqueue(
          {
            kind: 'answer',
            questionId,
            questionVersion: stored?.questionVersion ?? q?.version ?? 1,
            answer: stored?.answer ?? null,
          },
          true,
        );
        return mine(view);
      },
    };
  }

  private progressApi(): ProgressApi {
    const p = this.cache.progress;
    return {
      ...p,
      grantWorldReward: async (input) => {
        const r = await p.grantWorldReward(input);
        if (!r.granted) return r;
        const action = pointActionFor(input.sourceRef);
        if (!action) {
          this.rejectLocally('award', 'unknown_action');
          return r;
        }
        const key = r.entry.id.replace(/^world_reward:/, '');
        void this.enqueue({
          kind: 'award',
          action,
          ref: input.sourceRef,
          points: r.entry.pointsDelta,
          coins: r.entry.coinsDelta,
          policy: input.policy ?? 'once',
          metadata: this.awardMetadata(input.metadata ?? {}, key, r.entry.seasonId),
        });
        return r;
      },
      claimAchievement: async (achievementId) => {
        const r = await p.claimAchievement(achievementId);
        if (!r.claimed) return r;
        void this.enqueue({
          kind: 'award',
          action: 'achievement',
          ref: achievementId,
          points: r.entry.pointsDelta,
          coins: r.entry.coinsDelta,
          policy: 'once',
          metadata: this.awardMetadata(r.entry.metadata, null, r.entry.seasonId),
        });
        return r;
      },
      buyCosmetic: async (cosmeticId) => {
        const r = await p.buyCosmetic(cosmeticId);
        if (r.granted) await this.enqueue({ kind: 'buy', cosmetic: cosmeticId }, true);
        return r;
      },
      equip: async (slot, cosmeticId) => {
        await p.equip(slot, cosmeticId);
        await this.enqueue({ kind: 'equip', slot, cosmetic: cosmeticId }, true);
        return p.equipped();
      },
      submitTime: async (id, ms) => {
        const r = await p.submitTime(id, ms);
        const m = CIRCUIT_RECORD.exec(id);
        if (m) {
          void this.enqueue({
            kind: 'time',
            circuit: m[1]!,
            version: Number(m[2]),
            ms: Math.round(ms),
          });
        }
        return r;
      },
      findDiscount: async (discountId, o) => {
        const r = await p.findDiscount(discountId, o);
        if (r.first) void this.enqueue({ kind: 'find_discount', discount: discountId });
        return r;
      },
    };
  }

  private purchaseApi(): PurchaseApi {
    const p = this.cache.purchases;
    return {
      ...p,
      // La compra de prueba sigue en el navegador (va en la copia); el
      // descuento que usa, en la cuenta. Su sello no: en la cuenta, el sello
      // es por el QR de la fiesta (decisión 9).
      confirmSandbox: async (input) => {
        const r = await p.confirmSandbox(input);
        if (r.first && r.purchase.discountId) {
          void this.enqueue({
            kind: 'use_discount',
            discount: r.purchase.discountId,
            event: r.purchase.eventId,
          });
        }
        return r;
      },
    };
  }

  /** Lo del premio que se guarda con él, más la clave local (`lk`) y el mundo. */
  private awardMetadata(
    metadata: Record<string, JsonValue>,
    localKey: string | null,
    world: string | null,
  ): Record<string, JsonValue> {
    const extra: Record<string, JsonValue> = {
      ...(localKey ? { lk: localKey } : {}),
      ...(world ? { world } : {}),
    };
    const rest = Object.fromEntries(Object.entries(metadata).filter(([k]) => k !== 'policy'));
    const all = { ...rest, ...extra };
    return JSON.stringify(all).length <= METADATA_MAX_BYTES ? all : extra;
  }

  // -------------------------------------------------------------------------
  // Cola

  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn);
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private setReady(p: Promise<unknown>): void {
    this.gate = raceTimeout(p, this.readyTimeoutMs);
  }

  private saveMeta(): void {
    if (this.disposed) return;
    try {
      this.storage?.setItem(
        this.syncKey,
        JSON.stringify({
          ops: this.ops,
          snapshotVersion: this.snapshotVersion,
          snapshotJson: this.lastSnapshotJson,
        } satisfies SyncMeta),
      );
    } catch {
      // sin sitio: la cola sigue en memoria mientras dure la visita
    }
  }

  /**
   * Pone una acción en la cola y la manda. Con `wait`, espera su respuesta
   * (y la vuelta a lo del servidor si se rechaza) y lanza el rechazo; sin
   * red, vuelve igual: la acción queda en la cola.
   */
  private async enqueue(input: MemberOpInput, wait = false): Promise<void> {
    const op = { ...input, id: newId(), at: this.now().toISOString() } as MemberOp;
    this.ops.push(op);
    this.gen++;
    this.saveMeta();
    const run = this.serial(() => this.runFlush());
    if (!wait) {
      void run;
      return;
    }
    await run;
    const reason = this.results.get(op.id);
    this.results.delete(op.id);
    if (reason) throw new SyncRejectedError(reason);
  }

  /** Un rechazo sin pasar por el servidor (p. ej. un origen que no conoce). */
  private rejectLocally(op: MemberOpKind, reason: string): void {
    this.onEvent({ type: 'rejected', op, reason });
    this.needsPull = true;
    void this.serial(() => this.runFlush());
  }

  private async runFlush(): Promise<void> {
    if (this.disposed) return;
    while (this.ops.length > 0) {
      const op = this.ops[0]!;
      let reason: string | null = null;
      try {
        await sendOp(this.server, op);
        if (this.disposed) return;
      } catch (e) {
        if (this.disposed) return;
        const err = classifyServerError(e);
        if (err.transient) {
          this.goOffline();
          return;
        }
        reason = isAlreadyDone(op.kind, err.reason) ? null : err.reason;
      }
      this.ops.shift();
      this.saveMeta();
      if (reason) {
        this.results.set(op.id, reason);
        this.needsPull = true;
        this.onEvent({ type: 'rejected', op: op.kind, reason });
      }
    }
    if (this.isOffline) {
      this.isOffline = false;
      this.retryIndex = 0;
      this.needsPull = true;
      this.onEvent({ type: 'online' });
    }
    if (this.needsPull) await this.pullNow();
  }

  private goOffline(): void {
    if (this.disposed) return;
    if (!this.isOffline) {
      this.isOffline = true;
      this.onEvent({ type: 'offline', pending: this.ops.length });
    }
    this.scheduleRetry();
  }

  private scheduleRetry(): void {
    if (this.retryTimer || this.disposed) return;
    const ms = this.retryMs[Math.min(this.retryIndex, this.retryMs.length - 1)] ?? 60_000;
    this.retryIndex++;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.sync.flush();
    }, ms);
  }

  /** Lee del servidor y lo pone en la copia; sólo con la cola vacía. */
  private async pullNow(): Promise<void> {
    if (this.ops.length > 0 || this.disposed) {
      this.needsPull = true;
      return;
    }
    const gen = this.gen;
    let state;
    try {
      state = await this.server.pull();
    } catch (e) {
      const err = classifyServerError(e);
      this.needsPull = true;
      if (err.transient) this.goOffline();
      else console.warn('[boia] no se pudo leer la cuenta', err);
      return;
    }
    if (this.disposed) return;
    if (gen !== this.gen || this.ops.length > 0) {
      // Hubo acciones nuevas mientras se leía: se lee después de mandarlas.
      this.needsPull = true;
      return;
    }
    const base = remoteSnapshot(parseJson(this.lastSnapshotJson), emptySnapshot(), this.uid);
    const local = this.access.view((doc) => snapshotOf(doc, this.uid));
    const remote = remoteSnapshot(state.snapshot?.data, base, this.uid);
    this.hydrating = true;
    try {
      this.access.write(ALL_AREAS, (d) => {
        const r = applyServerState(d, this.uid, state, {
          snapshotVersion: this.snapshotVersion,
          now: this.now,
        });
        this.snapshotVersion = r.snapshotVersion;
        applySnapshot(d, this.uid, mergeSnapshots(base, local, remote));
      });
    } finally {
      this.hydrating = false;
    }
    this.lastSnapshotJson = JSON.stringify(remote);
    this.needsPull = false;
    this.saveMeta();
    this.onEvent({ type: 'pulled' });
    this.scheduleSnapshot();
  }

  // -------------------------------------------------------------------------
  // Copia del resto del documento

  /** La copia de este navegador aún no tiene nada de la cuenta. */
  private isEmptyCopy(): boolean {
    return this.access.view(
      (d) => !d.players[this.uid] && !d.purchases.some((p) => p.userId === this.uid),
    );
  }

  private currentSnapshotJson(): string {
    return JSON.stringify(this.access.view((d) => snapshotOf(d, this.uid)));
  }

  private scheduleSnapshot(): void {
    if (this.disposed || this.snapshotTimer) return;
    if (this.currentSnapshotJson() === this.lastSnapshotJson) return;
    this.snapshotTimer = setTimeout(() => {
      this.snapshotTimer = null;
      void this.sync.saveSnapshot();
    }, this.snapshotDelayMs);
  }

  private async saveSnapshotNow(conflicts = 0): Promise<void> {
    if (this.disposed) return;
    const snapshot = this.access.view((d) => snapshotOf(d, this.uid));
    const json = JSON.stringify(snapshot);
    if (json === this.lastSnapshotJson) return;
    try {
      const r = (await this.server.rpc('save_snapshot', {
        p_data: snapshot,
        p_base_version: this.snapshotVersion ?? 0,
      })) as { version?: unknown } | null;
      if (this.disposed) return;
      if (typeof r?.version === 'number') this.snapshotVersion = r.version;
      this.lastSnapshotJson = json;
      this.saveMeta();
    } catch (e) {
      if (this.disposed) return;
      const err = classifyServerError(e);
      if (err.transient) {
        this.goOffline();
        return;
      }
      if (err.reason === 'snapshot_conflict') {
        // Rebase pending non-economic edits onto the other device's acknowledged snapshot.
        this.snapshotVersion = null;
        this.needsPull = true;
        await this.runFlush();
        if (conflicts < 2) await this.saveSnapshotNow(conflicts + 1);
        else this.scheduleSnapshot();
        return;
      }
      this.onEvent({ type: 'rejected', op: 'snapshot', reason: err.reason });
      this.saveMeta();
    }
  }

  // -------------------------------------------------------------------------

  private syncApi(): MemberSync {
    return {
      userId: this.uid,
      ready: () => this.gate,
      refresh: (block = true) => {
        this.needsPull = true;
        const p = this.serial(() => this.runFlush());
        if (block) this.setReady(p);
        return p;
      },
      flush: () => {
        if (this.retryTimer) {
          clearTimeout(this.retryTimer);
          this.retryTimer = null;
        }
        return this.serial(async () => {
          await this.runFlush();
          if (!this.isOffline) await this.saveSnapshotNow();
        });
      },
      saveSnapshot: () => {
        if (this.snapshotTimer) {
          clearTimeout(this.snapshotTimer);
          this.snapshotTimer = null;
        }
        return this.serial(() => this.saveSnapshotNow());
      },
      pending: () => this.ops.length,
      snapshotPending: () => this.currentSnapshotJson() !== this.lastSnapshotJson,
      offline: () => this.isOffline,
      dispose: () => {
        this.disposed = true;
        if (this.retryTimer) clearTimeout(this.retryTimer);
        if (this.snapshotTimer) clearTimeout(this.snapshotTimer);
        this.retryTimer = null;
        this.snapshotTimer = null;
        this.unsubscribe();
      },
    };
  }
}
