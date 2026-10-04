import {
  type SwitchableRepository,
  createLocalRepository,
  resetBrowserRepositoryForTests,
} from '@boia/store';
import { afterEach, expect, it, vi } from 'vitest';
import { gameRepository } from '../repo';
import { discountFound } from '../mundo/world-progress';
import { readLogros } from './use-logros';

const session = vi.hoisted(() => ({ switcher: null as SwitchableRepository | null }));
vi.mock('../supabase/config', () => ({ isSupabaseConfigured: () => true }));
vi.mock('../repo-member', () => ({
  startMemberSync: (switcher: SwitchableRepository) => {
    session.switcher = switcher;
    return Promise.resolve();
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetBrowserRepositoryForTests();
});

it('T115: switching accounts during historical evidence recovery cannot complete account B', async () => {
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  const facade = gameRepository();
  await facade.identity.current();
  const a = createLocalRepository({ storage: null, watch: false });
  const b = createLocalRepository({ storage: null, watch: false });
  await a.progress.findDiscount('dto-naufrago');
  session.switcher!.switchTo(a);
  const readDiscounts = a.progress.discounts;
  vi.spyOn(a.progress, 'discounts').mockImplementation(async () => {
    const evidence = await readDiscounts();
    session.switcher!.switchTo(b);
    return evidence;
  });
  const data = await readLogros(facade);
  expect(data.list.find((x) => x.definition.id === 'naufrago-fiesta')?.state).toBe('ready');
  expect(
    (await b.progress.achievements()).find((x) => x.definition.id === 'naufrago-fiesta')?.state,
  ).toBe('in_progress');
  expect(await b.progress.discoveries()).toEqual([]);
  expect(await b.progress.ledger()).toEqual([]);
});

it('T115: switching accounts just after the rescue discount is saved keeps its signal with account A', async () => {
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  const facade = gameRepository();
  await facade.identity.current();
  const a = createLocalRepository({ storage: null, watch: false });
  const b = createLocalRepository({ storage: null, watch: false });
  session.switcher!.switchTo(a);
  const findDiscount = a.progress.findDiscount;
  vi.spyOn(a.progress, 'findDiscount').mockImplementation(async (...args) => {
    const found = await findDiscount(...args);
    session.switcher!.switchTo(b);
    return found;
  });
  const out = await discountFound(facade.progress, 'dto-naufrago', {
    sessionId: 'rescue',
    worldId: 'arcilla',
  });
  expect(out.map((o) => o.notice.id)).toContain('logro:naufrago-fiesta');
  expect(
    (await a.progress.achievements()).find((x) => x.definition.id === 'naufrago-fiesta')?.state,
  ).toBe('ready');
  expect(
    (await b.progress.achievements()).find((x) => x.definition.id === 'naufrago-fiesta')?.state,
  ).toBe('in_progress');
  expect(await b.progress.discounts()).toEqual([]);
  expect(await b.progress.discoveries()).toEqual([]);
});
