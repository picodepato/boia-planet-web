import { withoutFlag } from '../removed-flags';
import { withoutRetiredAchievements, withoutRetiredDiscoveries } from '../retired-achievements';
import { sampleStampRevokedEvents, sampleStampRevocationPref } from '../sample-stamps';
/**
 * La copia local de una cuenta (plan 008, T90): lo que hay en el servidor se
 * pasa al documento del navegador con la forma de siempre, así todo lo que
 * lee el repositorio local (saldos, tienda, Carnet, récords) sale igual. El
 * servidor gana: lo de valor se sustituye entero por lo suyo.
 *
 * Los ids del libro local se calculan como los calcula el repositorio local
 * al conceder (`ledgerId`), para que repetir una concesión ya hecha en el
 * servidor se vea como repetida aquí también:
 * - premio del mundo: `world_reward:<clave>` (la clave local que viajó en
 *   `metadata.lk`; si no, la del servidor);
 * - logro: `achievement:<id>` (en el servidor, `award_points('achievement')`);
 * - cosmético: `cosmetic:<id>`, `cosmetic:<id>#2`… en orden;
 * - sello por QR: `stamp:qr:<fiesta>`;
 * - ajuste y compensación: su id del servidor.
 *
 * Lo demás del documento (descubrimientos, misiones, contadores, ajustes,
 * logros completados sin reclamar, récords que no son de un circuito y las
 * compras de prueba) es la copia `save_snapshot` (`MemberSnapshot`).
 */
import { ledgerId } from '../ids';
import { replayLedger } from '../ledger';
import {
  emptyPlayer,
  playerSchema,
  purchaseSchema,
  type CarnetRecord,
  type JsonValue,
  type LedgerEntry,
  type PlayerState,
  type Purchase,
  type StoreDoc,
} from '../schema';
import type { ServerLedgerRow, ServerState } from './server';

/** Récord de un circuito: `circuito:<id>:v<versión>` (`circuitRecordId` del motor). */
export const CIRCUIT_RECORD = /^circuito:([a-z0-9]+(?:-[a-z0-9]+)*):v(\d+)$/;

/** Claves de `metadata` que pone el servidor o el repositorio y no son del premio. */
const INTERNAL_META = new Set(['key', 'lk', 'world']);

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function jsonOnly(meta: Record<string, unknown>): Record<string, JsonValue> {
  const out: Record<string, JsonValue> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (INTERNAL_META.has(k) || v === undefined) continue;
    out[k] = JSON.parse(JSON.stringify(v)) as JsonValue;
  }
  return out;
}

/** Créditos antes que gastos en la misma fecha: el libro nunca pasa por negativo. */
function order(rows: readonly ServerLedgerRow[]): ServerLedgerRow[] {
  return [...rows].sort(
    (a, b) =>
      a.created_at.localeCompare(b.created_at) ||
      b.points_delta + b.coins_delta - (a.points_delta + a.coins_delta) ||
      a.id.localeCompare(b.id),
  );
}

/** El libro del servidor con los ids y la forma del libro local. */
export function ledgerFromServer(rows: readonly ServerLedgerRow[], userId: string): LedgerEntry[] {
  const ids = new Map<string, string>();
  const used = new Set<string>();
  const out: LedgerEntry[] = [];
  const unique = (id: string, serverId: string) => {
    let next = id;
    if (used.has(next)) next = `${id}#${serverId}`;
    used.add(next);
    return next;
  };
  for (const row of order(rows)) {
    const meta = isObject(row.metadata) ? row.metadata : {};
    const at = row.occurred_at ?? row.created_at;
    const base = {
      userId,
      pointsDelta: row.points_delta,
      coinsDelta: row.coins_delta,
      seasonId: str(meta.world),
      createdAt: at,
      metadata: jsonOnly(meta),
    };
    let entry: LedgerEntry | null = null;
    switch (row.kind) {
      case 'world_reward': {
        const ref = row.source_ref ?? '';
        if (row.action === 'achievement') {
          entry = {
            ...base,
            id: ledgerId('achievement', ref),
            kind: 'achievement',
            achievementId: ref,
            sourceRef: `achievement:${ref}`,
          };
        } else {
          const key = str(meta.lk) ?? str(meta.key) ?? ref;
          entry = {
            ...base,
            id: ledgerId('world_reward', key),
            kind: 'world_reward',
            sourceRef: ref,
            metadata: { ...base.metadata, policy: str(meta.policy) ?? 'once' },
          };
        }
        break;
      }
      case 'achievement':
        if (row.achievement_id) {
          entry = {
            ...base,
            id: ledgerId('achievement', row.achievement_id),
            kind: 'achievement',
            achievementId: row.achievement_id,
            sourceRef: `achievement:${row.achievement_id}`,
          };
        }
        break;
      case 'cosmetic':
        if (row.cosmetic_key) {
          const first = ledgerId('cosmetic', row.cosmetic_key);
          let id = first;
          for (let n = 2; used.has(id); n++) id = `${first}#${n}`;
          entry = {
            ...base,
            id,
            kind: 'cosmetic',
            cosmeticKey: row.cosmetic_key,
            sourceRef: row.source_ref ?? 'coins',
          };
        }
        break;
      case 'stamp': {
        const ref = row.source_ref ?? '';
        const event = ref.startsWith('qr:') ? ref.slice(3) : (row.event_id ?? null);
        if (event) {
          const purchaseId = ref || `qr:${event}`;
          entry = {
            ...base,
            id: ledgerId('stamp', purchaseId),
            kind: 'stamp',
            eventId: event,
            purchaseId,
            sourceRef: ref || purchaseId,
          };
        }
        break;
      }
      case 'adjustment':
        entry = {
          ...base,
          id: `adjustment:${row.id}`,
          kind: 'adjustment',
          reason: row.reason ?? 'ajuste',
          createdBy: row.created_by ?? 'admin',
        };
        break;
      case 'compensation': {
        const of = row.compensates_id ? ids.get(row.compensates_id) : undefined;
        if (of) {
          entry = {
            ...base,
            id: `compensation:${row.id}`,
            kind: 'compensation',
            compensatesId: of,
            reason: row.reason ?? 'compensación',
          };
        }
        break;
      }
    }
    if (!entry) continue;
    entry.id = unique(entry.id, row.id);
    ids.set(row.id, entry.id);
    out.push(entry);
  }
  return replayLedger(out).ledger;
}

// ---------------------------------------------------------------------------
// La copia del resto del documento (save_snapshot)

export const SNAPSHOT_FORMAT = 1;

/** Lo del jugador que no tiene valor y viaja en la copia. */
export type SnapshotPlayer = Pick<
  PlayerState,
  'discoveries' | 'missions' | 'counters' | 'prefs' | 'achievements' | 'records'
>;

export interface MemberSnapshot {
  format: typeof SNAPSHOT_FORMAT;
  player: SnapshotPlayer;
  /** Compras de prueba (D-20) de esta cuenta. */
  purchases: Purchase[];
}

const SNAPSHOT_FIELDS = [
  'discoveries',
  'missions',
  'counters',
  'prefs',
  'achievements',
  'records',
] as const;

/** La copia de `userId` en el documento (sin los récords de circuito: van en su tabla). */
export function snapshotOf(doc: Readonly<StoreDoc>, userId: string): MemberSnapshot {
  const p = doc.players[userId] ?? emptyPlayer();
  const records = Object.fromEntries(
    Object.entries(p.records).filter(([id]) => !CIRCUIT_RECORD.test(id)),
  );
  return structuredClone({
    format: SNAPSHOT_FORMAT,
    player: {
      discoveries: p.discoveries,
      missions: p.missions,
      counters: p.counters,
      prefs: {
        ...p.prefs,
        ...Object.fromEntries(
          [...sampleStampRevokedEvents(doc, userId)].map((event) => [
            sampleStampRevocationPref(event),
            true,
          ]),
        ),
      },
      achievements: p.achievements,
      records,
    },
    purchases: doc.purchases.filter((x) => x.userId === userId),
  });
}

/**
 * Pone la copia del servidor en el documento (el servidor gana). Un campo
 * que no tiene la forma esperada se deja como estaba; una copia de otro
 * formato no se toca. Devuelve si se aplicó.
 */
export function applySnapshot(doc: StoreDoc, userId: string, raw: unknown): boolean {
  if (!isObject(raw) || raw.format !== SNAPSHOT_FORMAT) return false;
  const p = (doc.players[userId] ??= emptyPlayer());
  const player = isObject(raw.player) ? raw.player : {};
  for (const field of SNAPSHOT_FIELDS) {
    if (!(field in player)) continue;
    const parsed = playerSchema.shape[field].safeParse(player[field]);
    if (!parsed.success) continue;
    if (field === 'records') {
      const circuits = Object.entries(p.records).filter(([id]) => CIRCUIT_RECORD.test(id));
      const others = Object.entries(parsed.data as PlayerState['records']).filter(
        ([id]) => !CIRCUIT_RECORD.test(id),
      );
      p.records = Object.fromEntries([...others, ...circuits]);
    } else if (field === 'achievements') {
      // Un logro retirado (T157) no vuelve con la copia del servidor.
      p.achievements = withoutRetiredAchievements(parsed.data as PlayerState['achievements']);
    } else if (field === 'discoveries') {
      p.discoveries = withoutRetiredDiscoveries(parsed.data as PlayerState['discoveries']);
    } else {
      (p as Record<string, unknown>)[field] = parsed.data;
    }
  }
  if (Array.isArray(raw.purchases)) {
    const purchases = raw.purchases.flatMap((x) => {
      const r = purchaseSchema.safeParse(x);
      return r.success ? [{ ...r.data, userId }] : [];
    });
    doc.purchases = [...doc.purchases.filter((x) => x.userId !== userId), ...purchases];
  }
  return true;
}

// ---------------------------------------------------------------------------
// Todo junto

export interface HydrateOptions {
  /** Versión de la copia que ya se aplicó (o se guardó) en este navegador. */
  snapshotVersion: number | null;
  now: () => Date;
}

/**
 * Pone en `doc` lo de la cuenta `userId` tal como está en el servidor (el
 * servidor gana). Devuelve la versión de la copia que queda aplicada.
 */
export function applyServerState(
  doc: StoreDoc,
  userId: string,
  state: ServerState,
  opts: HydrateOptions,
): { snapshotVersion: number | null } {
  doc.identity = {
    id: userId,
    kind: 'member',
    createdAt:
      doc.identity?.id === userId
        ? doc.identity.createdAt
        : (state.carnet?.member_since ?? opts.now().toISOString()),
  };
  doc.ledger = [
    ...doc.ledger.filter((e) => e.userId !== userId),
    ...ledgerFromServer(state.ledger, userId),
  ];

  const p = (doc.players[userId] ??= emptyPlayer());
  p.equipped = withoutFlag(state.equipped);
  const prevDiscounts = p.discounts;
  p.discounts = Object.fromEntries(
    state.discounts.map((d) => [
      d.discount_id,
      { at: d.found_at, worldId: prevDiscounts[d.discount_id]?.worldId ?? null },
    ]),
  );

  let snapshotVersion = opts.snapshotVersion;
  if (state.snapshot && state.snapshot.version !== opts.snapshotVersion) {
    if (applySnapshot(doc, userId, state.snapshot.data)) snapshotVersion = state.snapshot.version;
  }

  // Los récords de circuito, de `race_times` (un tiempo anulado no cuenta).
  const others = Object.entries(p.records).filter(([id]) => !CIRCUIT_RECORD.test(id));
  const circuits = state.times
    .filter((t) => t.voided_at === null && t.best_ms > 0)
    .map((t) => {
      const id = `circuito:${t.circuit_id}:v${t.circuit_version}`;
      return [
        id,
        { id, bestMs: t.best_ms, bestAt: t.best_at, attempts: Math.max(1, t.attempts) },
      ] as const;
    });
  p.records = Object.fromEntries([...others, ...circuits]);

  if (state.carnet) {
    const c = state.carnet;
    const prev = doc.carnets[userId];
    const answers: CarnetRecord['answers'] = {};
    for (const a of state.answers) {
      if (a.answer.trim() === '') continue;
      answers[a.question_id] = {
        answer: a.answer,
        questionVersion: Math.max(1, a.question_version),
        updatedAt: a.updated_at ?? c.member_since,
      };
    }
    doc.carnets[userId] = {
      userId,
      nickname: c.nickname,
      avatarKey: c.avatar_key,
      avatarImage: c.avatar_image,
      memberSince: c.member_since,
      answers,
      version: Math.max(1, c.version ?? prev?.version ?? 1),
      updatedAt: c.updated_at ?? c.member_since,
      // El enlace a su música (plan 019 T217) no se lee del servidor: la
      // copia guarda el último que se puso aquí.
      ...(prev?.musicLink ? { musicLink: prev.musicLink } : {}),
    };
  } else {
    delete doc.carnets[userId];
  }
  return { snapshotVersion };
}
