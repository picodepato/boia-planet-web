import { memberSyncKey, type StorageLike } from '@boia/store';

/** Copias de cuenta que se quedaron al salir porque aún tenían algo sin mandar (en esta pestaña). */
const unsent = new Set<string>();

/** Lo que `clearAcknowledgedMemberCopy` dejó por tener cambios sin mandar (T284: no se borra al salir). */
export function unsentMemberCopies(): ReadonlySet<string> {
  return unsent;
}

/** Drop only an acknowledged account copy. Dirty evidence stays under its account key
 * and the game switches to its independent guest repository on sign-out.
 */
export function clearAcknowledgedMemberCopy(
  storage: StorageLike | null,
  cacheKey: string,
  pending: number,
  snapshotPending: boolean,
): void {
  if (pending > 0 || snapshotPending) {
    unsent.add(cacheKey);
    return;
  }
  unsent.delete(cacheKey);
  try {
    storage?.removeItem(cacheKey);
    storage?.removeItem(memberSyncKey(cacheKey));
  } catch {
    /* An unavailable store must not break sign-out. */
  }
}
