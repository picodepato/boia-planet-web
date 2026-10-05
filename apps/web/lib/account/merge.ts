/**
 * Lo que el invitado tenía en este navegador pasa a su cuenta al entrar
 * (decisión 4, REQ-IDE-006): se arma la entrada de `merge_guest` y el
 * servidor la valida elemento a elemento con las mismas reglas que una
 * acción en vivo. Fusionar dos veces no duplica nada (ids estables).
 *
 * Qué va:
 * - Premios del libro: los del mundo (`lugar:…`, encuentros, misión,
 *   minijuegos) con su política y su fecha, y los logros reclamados. Los
 *   sellos de compras de prueba no: en Supabase el sello es por QR (T86).
 * - Cosméticos comprados con monedas, en orden (los que regala un logro
 *   llegan con el logro), y lo equipado.
 * - El mejor tiempo de cada circuito (`circuito:<id>:v<n>`).
 * - Los descuentos encontrados y si se usaron (con la fiesta de la compra).
 *
 * - La copia del resto del documento (`snapshot`, con la forma de
 *   `save_snapshot` de T90): descubrimientos, misiones, contadores, ajustes,
 *   logros completados y compras de prueba. El servidor sólo la guarda si la
 *   cuenta aún no tenía copia.
 */
import type { MergePayload, MergeResult } from '@boia/db/rpc';
import {
  COSMETIC_SLOTS,
  type FoundDiscount,
  type LedgerEntry,
  type Purchase,
  type TimeRecord,
  pointActionFor,
} from '@boia/store';

type Reward = NonNullable<MergePayload['rewards']>[number];
type Policy = NonNullable<Reward['policy']>;

const POLICIES: readonly Policy[] = ['once', 'daily', 'season'];
/** Las ranuras que se equipan, las de la tienda (con `mascot` desde T154). */
const SLOTS: readonly (keyof NonNullable<MergePayload['equipped']>)[] = COSMETIC_SLOTS;
const METADATA_MAX_BYTES = 2000;
const RECORD_ID = /^circuito:([a-z0-9]+(?:-[a-z0-9]+)*):v(\d+)$/;

/**
 * La acción del servidor (`point_actions`) de un premio del mundo, por la
 * forma de su origen; null si el servidor no la conoce (no se manda). La
 * misma que usa el repositorio de un miembro (T90).
 */
export const actionForRef = pointActionFor;

function policyOf(metadata: Record<string, unknown>): Policy {
  const p = metadata.policy;
  return POLICIES.includes(p as Policy) ? (p as Policy) : 'once';
}

function cleanMetadata(metadata: Record<string, unknown>): Record<string, unknown> | undefined {
  const rest = Object.fromEntries(Object.entries(metadata).filter(([k]) => k !== 'policy'));
  if (Object.keys(rest).length === 0) return undefined;
  return JSON.stringify(rest).length <= METADATA_MAX_BYTES ? rest : undefined;
}

export interface GuestState {
  /** Id del invitado de este navegador. */
  userId: string;
  ledger: readonly LedgerEntry[];
  equipped: Record<string, string>;
  discounts: readonly FoundDiscount[];
  purchases: readonly Purchase[];
  /** Récords por id (`player.records` del documento local). */
  records: Record<string, Pick<TimeRecord, 'bestMs' | 'bestAt'>>;
  /** El resto del documento (`snapshotOf` de @boia/store), si lo hay. */
  snapshot?: Record<string, unknown> | null | undefined;
}

/** La entrada de `merge_guest`; sin claves vacías. */
export function mergePayloadFrom(guest: GuestState): MergePayload {
  const mine = guest.ledger.filter((e) => e.userId === guest.userId);

  const rewards: Reward[] = [];
  for (const e of mine) {
    if (e.kind === 'world_reward' && e.sourceRef) {
      const action = actionForRef(e.sourceRef);
      if (!action) continue;
      const metadata = cleanMetadata(e.metadata);
      rewards.push({
        action,
        ref: e.sourceRef,
        ...(e.pointsDelta > 0 ? { points: e.pointsDelta } : {}),
        ...(e.coinsDelta > 0 ? { coins: e.coinsDelta } : {}),
        policy: policyOf(e.metadata),
        at: e.createdAt,
        ...(metadata ? { metadata } : {}),
      });
    } else if (e.kind === 'achievement' && e.achievementId) {
      rewards.push({
        action: 'achievement',
        ref: e.achievementId,
        ...(e.pointsDelta > 0 ? { points: e.pointsDelta } : {}),
        ...(e.coinsDelta > 0 ? { coins: e.coinsDelta } : {}),
        policy: 'once',
        at: e.createdAt,
      });
    }
  }

  // Comprados con monedas (los regalados por un logro no cobran nada).
  const cosmetics = [
    ...new Set(
      mine
        .filter((e) => e.kind === 'cosmetic' && e.cosmeticKey && e.coinsDelta < 0)
        .map((e) => e.cosmeticKey!),
    ),
  ];

  const equipped: NonNullable<MergePayload['equipped']> = {};
  for (const slot of SLOTS) {
    const id = guest.equipped[slot];
    if (id) equipped[slot] = id;
  }

  const times = Object.entries(guest.records).flatMap(([id, r]) => {
    const m = RECORD_ID.exec(id);
    if (!m || !(r.bestMs > 0)) return [];
    return [{ circuit: m[1]!, version: Number(m[2]), ms: Math.round(r.bestMs), at: r.bestAt }];
  });

  const eventOf = new Map(guest.purchases.map((p) => [p.id, p.eventId]));
  const discounts = guest.discounts.map((d) => ({
    id: d.discount.id,
    found_at: d.foundAt,
    used: d.usedAt !== null,
    event: d.usedIn ? (eventOf.get(d.usedIn) ?? null) : null,
  }));

  return {
    ...(rewards.length ? { rewards } : {}),
    ...(cosmetics.length ? { cosmetics } : {}),
    ...(Object.keys(equipped).length ? { equipped } : {}),
    ...(times.length ? { times } : {}),
    ...(discounts.length ? { discounts } : {}),
    ...(guest.snapshot && !isEmptySnapshot(guest.snapshot) ? { snapshot: guest.snapshot } : {}),
  };
}

/** Una copia sin nada que guardar (un invitado que aún no ha hecho nada). */
function isEmptySnapshot(snapshot: Record<string, unknown>): boolean {
  const player = (snapshot.player ?? {}) as Record<string, unknown>;
  const purchases = snapshot.purchases;
  const empty = (v: unknown) => !v || (typeof v === 'object' && Object.keys(v).length === 0);
  return (
    Object.values(player).every(empty) && (!Array.isArray(purchases) || purchases.length === 0)
  );
}

export function isEmptyPayload(p: MergePayload): boolean {
  return Object.keys(p).length === 0;
}

/** Los récords del invitado en el documento local (`boia.store`), si se puede leer. */
export function recordsFromStoreDoc(
  raw: string | null,
  userId: string,
): Record<string, Pick<TimeRecord, 'bestMs' | 'bestAt'>> {
  if (!raw) return {};
  try {
    const doc = JSON.parse(raw) as { players?: Record<string, { records?: unknown }> };
    const records = doc.players?.[userId]?.records;
    if (!records || typeof records !== 'object') return {};
    const out: Record<string, Pick<TimeRecord, 'bestMs' | 'bestAt'>> = {};
    for (const [id, r] of Object.entries(records as Record<string, unknown>)) {
      const rec = r as Partial<TimeRecord> | null;
      if (rec && typeof rec.bestMs === 'number' && typeof rec.bestAt === 'string') {
        out[id] = { bestMs: rec.bestMs, bestAt: rec.bestAt };
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** Lo que se cuenta en la bienvenida: «120 puntos, 3 logros y tu barco». */
export interface MergeSummary {
  points: number;
  achievements: number;
  ship: boolean;
  times: number;
}

export function mergeSummary(payload: MergePayload, result: MergeResult | null): MergeSummary {
  if (!result) return { points: 0, achievements: 0, ship: false, times: 0 };
  const rejected = new Set(result.rejected.filter((r) => r.kind === 'reward').map((r) => r.ref));
  const accepted = (payload.rewards ?? []).filter((r) => !rejected.has(r.ref));
  return {
    points: accepted.reduce((n, r) => n + (r.points ?? 0), 0),
    achievements: accepted.filter((r) => r.action === 'achievement').length,
    ship: Boolean(payload.equipped?.ship && result.equipped.ship === payload.equipped.ship),
    times: result.times.accepted,
  };
}

export function isEmptySummary(s: MergeSummary): boolean {
  return s.points === 0 && s.achievements === 0 && !s.ship && s.times === 0;
}
