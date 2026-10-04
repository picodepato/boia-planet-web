import { emptyPlayer, playerSchema, purchaseSchema } from '../schema';
import { type MemberSnapshot, SNAPSHOT_FORMAT } from './hydrate';

/** A partial/malformed remote snapshot does not assert deletion of absent fields. */
export function remoteSnapshot(raw: unknown, base: MemberSnapshot, userId: string): MemberSnapshot {
  const out = structuredClone(base);
  if (!raw || typeof raw !== 'object' || !('format' in raw) || raw.format !== SNAPSHOT_FORMAT)
    return out;
  const data = raw as { player?: Record<string, unknown>; purchases?: unknown[] };
  for (const field of Object.keys(out.player) as (keyof MemberSnapshot['player'])[]) {
    if (!data.player || !(field in data.player)) continue;
    const parsed = playerSchema.shape[field].safeParse(data.player[field]);
    if (parsed.success) Object.assign(out.player, { [field]: parsed.data });
  }
  if (Array.isArray(data.purchases))
    out.purchases = data.purchases.flatMap((p) => {
      const parsed = purchaseSchema.safeParse(p);
      return parsed.success ? [{ ...parsed.data, userId }] : [];
    });
  return out;
}

export function emptySnapshot(): MemberSnapshot {
  const { discoveries, missions, counters, prefs, achievements, records } = emptyPlayer();
  return {
    format: SNAPSHOT_FORMAT,
    player: { discoveries, missions, counters, prefs, achievements, records },
    purchases: [],
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** Common-base edit merge; absence locally is an explicit deletion only if it existed in base. */
function edits<T>(
  base: Record<string, T>,
  local: Record<string, T>,
  remote: Record<string, T>,
): Record<string, T> {
  const result = { ...remote };
  for (const key of new Set([...Object.keys(base), ...Object.keys(local)])) {
    if (same(local[key], base[key])) continue;
    if (key in local) result[key] = local[key]!;
    else delete result[key];
  }
  return result;
}

/** Merge only non-economic progress; balances, attendance and entitlements never enter this function. */
export function mergeSnapshots(
  base: MemberSnapshot,
  local: MemberSnapshot,
  remote: MemberSnapshot,
): MemberSnapshot {
  const result = structuredClone(remote);
  // Discoveries and completed achievements accumulate by stable IDs.
  result.player.discoveries = { ...remote.player.discoveries, ...local.player.discoveries };
  result.player.achievements = { ...remote.player.achievements, ...local.player.achievements };
  result.player.prefs = edits(base.player.prefs, local.player.prefs, remote.player.prefs);
  result.player.missions = edits(
    base.player.missions,
    local.player.missions,
    remote.player.missions,
  );
  for (const [id, mission] of Object.entries(remote.player.missions)) {
    const own = result.player.missions[id];
    if (
      own &&
      ((!own.completedAt && mission.completedAt) ||
        (Boolean(own.completedAt) === Boolean(mission.completedAt) &&
          mission.updatedAt > own.updatedAt))
    )
      result.player.missions[id] = mission;
  }
  for (const key of new Set([
    ...Object.keys(local.player.counters),
    ...Object.keys(remote.player.counters),
  ])) {
    // Without per-device event IDs, summing deltas would double-count an accepted
    // request whose acknowledgement was lost. Preserve the greatest observed total.
    result.player.counters[key] = Math.max(
      remote.player.counters[key] ?? 0,
      local.player.counters[key] ?? 0,
    );
  }
  result.player.records = edits(base.player.records, local.player.records, remote.player.records);
  for (const [id, record] of Object.entries(remote.player.records)) {
    const own = result.player.records[id];
    if (own && record.bestMs < own.bestMs) result.player.records[id] = record;
  }
  const byId = (s: MemberSnapshot) => Object.fromEntries(s.purchases.map((p) => [p.id, p]));
  result.purchases = Object.values(edits(byId(base), byId(local), byId(remote)));
  return result;
}
