import { compensatedIds } from './ledger';
import type { StoreDoc } from './schema';

const PREFIX = 'sample-stamp-revoked:';
/** Preserve only explicit stamp compensation evidence across non-economic snapshots. */
export function sampleStampRevokedEvents(doc: Readonly<StoreDoc>, userId: string): Set<string> {
  const revoked = compensatedIds(doc.ledger);
  return new Set([
    ...Object.entries(doc.players[userId]?.prefs ?? {}).flatMap(([key, value]) =>
      key.startsWith(PREFIX) && value === true ? [key.slice(PREFIX.length)] : [],
    ),
    ...doc.ledger.flatMap((entry) =>
      entry.userId === userId &&
      entry.kind === 'stamp' &&
      entry.sourceRef?.startsWith('purchase:') &&
      entry.eventId &&
      revoked.has(entry.id)
        ? [entry.eventId]
        : [],
    ),
  ]);
}
export const sampleStampRevocationPref = (eventId: string): string => `${PREFIX}${eventId}`;
