import {
  createLocalRepository,
  createSwitchableRepository,
  MemoryStorage,
  memberSyncKey,
} from '@boia/store';
import { expect, it } from 'vitest';
import { clearAcknowledgedMemberCopy } from './member-cache';

it('sign-out retains dirty account evidence and queue while guest and another account stay isolated', async () => {
  const storage = new MemoryStorage();
  const key = 'boia.cuenta.A';
  const a = createLocalRepository({ storage, key, watch: false });
  await a.carnet.create({ nickname: 'Cuenta A' });
  await a.progress.completeAchievement('whatsapp');
  storage.setItem(memberSyncKey(key), 'pending-sync');
  const guest = createLocalRepository({ storage, key: 'guest', watch: false });
  const game = createSwitchableRepository(guest);
  game.switchTo(a);
  game.switchTo(guest);
  clearAcknowledgedMemberCopy(storage, key, 0, true);
  expect(storage.getItem(key)).not.toBeNull();
  expect(storage.getItem(memberSyncKey(key))).toBe('pending-sync');
  expect(await game.repo.carnet.mine()).toBeNull();
  const b = createLocalRepository({ storage, key: 'boia.cuenta.B', watch: false });
  expect(await b.carnet.mine()).toBeNull();
  expect((await b.progress.achievements()).find((x) => x.definition.id === 'whatsapp')?.state).toBe(
    'in_progress',
  );
  clearAcknowledgedMemberCopy(storage, key, 1, false);
  expect(storage.getItem(key)).not.toBeNull();
  clearAcknowledgedMemberCopy(storage, key, 0, false);
  expect(storage.getItem(key)).toBeNull();
  expect(storage.getItem(memberSyncKey(key))).toBeNull();
});
