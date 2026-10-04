import { describe, expect, it } from 'vitest';
import { createLocalRepository, MemoryStorage } from '@boia/store';
import { discoverShipMenu, markShipMenuSeen } from './ship-menu-discovery';

describe('Cala introduces Mi Barco once per profile', () => {
  it('first arrival opens once and survives reload', async () => {
    const storage = new MemoryStorage();
    const repo = createLocalRepository({ storage, watch: false });
    expect(await discoverShipMenu(repo.progress)).toBe(true);
    expect(await discoverShipMenu(repo.progress)).toBe(false);
    const again = createLocalRepository({ storage, watch: false });
    expect(await discoverShipMenu(again.progress)).toBe(false);
  });
  it('a previous manual opening suppresses the introduction', async () => {
    const repo = createLocalRepository({ storage: null });
    await markShipMenuSeen(repo.progress);
    expect(await discoverShipMenu(repo.progress)).toBe(false);
  });
});
