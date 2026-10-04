import { memberSyncKey, type StorageLike } from '@boia/store';

/** Drop only an acknowledged account copy. Dirty evidence stays under its account key
 * and the game switches to its independent guest repository on sign-out.
 */
export function clearAcknowledgedMemberCopy(
  storage: StorageLike | null,
  cacheKey: string,
  pending: number,
  snapshotPending: boolean,
): void {
  if (pending > 0 || snapshotPending) return;
  try {
    storage?.removeItem(cacheKey);
    storage?.removeItem(memberSyncKey(cacheKey));
  } catch {
    /* An unavailable store must not break sign-out. */
  }
}
