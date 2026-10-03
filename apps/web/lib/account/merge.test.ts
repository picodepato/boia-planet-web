import {
  MemoryStorage,
  STORE_KEY,
  createLocalRepository,
  localDocAccess,
  snapshotOf,
} from '@boia/store';
import { describe, expect, it } from 'vitest';
import {
  actionForRef,
  isEmptyPayload,
  isEmptySummary,
  mergePayloadFrom,
  mergeSummary,
  recordsFromStoreDoc,
} from './merge';

/** Un invitado de verdad (repositorio local en memoria) con algo de progreso. */
async function guestWithProgress() {
  const storage = new MemoryStorage();
  const repo = createLocalRepository({ storage, watch: false });
  await repo.progress.grantWorldReward({ sourceRef: 'lugar:cala:points', points: 20 });
  await repo.progress.grantWorldReward({
    sourceRef: 'minigame:faro',
    points: 150,
    coins: 50,
    policy: 'daily',
    metadata: { score: 9 },
  });
  // Un origen que el servidor no conoce no se manda.
  await repo.progress.grantWorldReward({ sourceRef: 'e2e:cofre', coins: 500 });
  await repo.progress.submitTime('circuito:el-freu:v3', 71_234.4);
  const me = (await repo.identity.current())!;
  return {
    repo,
    storage,
    state: {
      userId: me.id,
      ledger: await repo.progress.ledger(),
      equipped: await repo.progress.equipped(),
      discounts: await repo.progress.discounts(),
      purchases: await repo.purchases.list(),
      records: recordsFromStoreDoc(storage.getItem(STORE_KEY), me.id),
    },
  };
}

describe('lo del invitado pasa a la cuenta (decisión 4, merge_guest)', () => {
  it('la acción del servidor sale de la forma del origen', () => {
    expect(actionForRef('lugar:cala:points')).toBe('world');
    expect(actionForRef('lugar:cofre-1:coins:visita:g1')).toBe('world');
    expect(actionForRef('lugar:delfin:seguir')).toBe('encounter');
    expect(actionForRef('lugar:remolino:30s')).toBe('encounter');
    expect(actionForRef('mision:fiestera:entrega')).toBe('mission');
    expect(actionForRef('minigame:faro')).toBe('minigame');
    expect(actionForRef('e2e:cofre')).toBeNull();
  });

  it('premios con su política y fecha, y el récord del circuito', async () => {
    const { state } = await guestWithProgress();
    const p = mergePayloadFrom(state);
    expect(p.rewards).toEqual([
      expect.objectContaining({
        action: 'world',
        ref: 'lugar:cala:points',
        points: 20,
        policy: 'once',
      }),
      expect.objectContaining({
        action: 'minigame',
        ref: 'minigame:faro',
        points: 150,
        coins: 50,
        policy: 'daily',
        metadata: { score: 9 },
      }),
    ]);
    for (const r of p.rewards!) expect(r.at).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(p.times).toEqual([
      expect.objectContaining({ circuit: 'el-freu', version: 3, ms: 71_234 }),
    ]);
    expect(p).not.toHaveProperty('snapshot');
  });

  it('lleva la copia del resto del documento (T90) si el invitado hizo algo', async () => {
    const { repo, state } = await guestWithProgress();
    await repo.progress.discover('isla:puerto');
    await repo.progress.setMission('fiestera', { step: 'rescued' });
    const snapshot = snapshotOf(localDocAccess(repo)!.read(), state.userId);
    const p = mergePayloadFrom({ ...state, snapshot: { ...snapshot } });
    expect(p.snapshot).toMatchObject({
      format: 1,
      player: { discoveries: { 'isla:puerto': expect.any(Object) } },
    });
    // El récord del circuito va en `times`, no en la copia.
    expect(Object.keys((p.snapshot as unknown as typeof snapshot).player.records)).toEqual([]);
    const fresh = createLocalRepository({ storage: new MemoryStorage(), watch: false });
    await fresh.identity.ensure();
    const empty = snapshotOf(localDocAccess(fresh)!.read(), 'nadie');
    expect(mergePayloadFrom({ ...state, snapshot: { ...empty } })).not.toHaveProperty('snapshot');
  });

  it('sólo lo del propio invitado, y nada si no hay nada', () => {
    expect(
      isEmptyPayload(
        mergePayloadFrom({
          userId: 'yo',
          ledger: [],
          equipped: {},
          discounts: [],
          purchases: [],
          records: {},
        }),
      ),
    ).toBe(true);
  });

  it('compras con monedas y lo equipado; los regalos de un logro no se compran', () => {
    const base = {
      userId: 'yo',
      seasonId: null,
      pointsDelta: 0,
      metadata: {},
      createdAt: '2026-09-20T10:00:00.000Z',
    };
    const p = mergePayloadFrom({
      userId: 'yo',
      ledger: [
        { ...base, id: '1', kind: 'cosmetic', coinsDelta: -20, cosmeticKey: 'bandera-boia' },
        { ...base, id: '2', kind: 'cosmetic', coinsDelta: 0, cosmeticKey: 'regalo' },
        { ...base, id: '3', kind: 'achievement', coinsDelta: 30, achievementId: 'primera-boia' },
        { ...base, id: '4', userId: 'otro', kind: 'cosmetic', coinsDelta: -9, cosmeticKey: 'x' },
      ],
      equipped: { flag: 'bandera-boia', raro: 'x' },
      discounts: [],
      purchases: [],
      records: { 'circuito:el-freu@v1': { bestMs: 1, bestAt: base.createdAt } },
    });
    expect(p.cosmetics).toEqual(['bandera-boia']);
    expect(p.equipped).toEqual({ flag: 'bandera-boia' });
    expect(p.rewards).toEqual([
      expect.objectContaining({ action: 'achievement', ref: 'primera-boia', coins: 30 }),
    ]);
    expect(p).not.toHaveProperty('times');
  });

  it('el resumen de la bienvenida cuenta lo aceptado', async () => {
    const { state } = await guestWithProgress();
    const p = mergePayloadFrom(state);
    const s = mergeSummary(p, {
      rewards: { granted: 1, duplicate: 0 },
      cosmetics: { granted: 0, duplicate: 0 },
      times: { accepted: 1 },
      discounts: { found: 0, used: 0 },
      equipped: {},
      snapshot: 'none',
      rejected: [{ kind: 'reward', ref: 'minigame:faro', reason: 'limit_daily' }],
    });
    expect(s).toEqual({ points: 20, achievements: 0, ship: false, times: 1 });
    expect(isEmptySummary(mergeSummary(p, null))).toBe(true);
  });

  it('los récords se leen del documento local sin romperse con basura', () => {
    expect(recordsFromStoreDoc(null, 'yo')).toEqual({});
    expect(recordsFromStoreDoc('no es json', 'yo')).toEqual({});
    expect(
      recordsFromStoreDoc(
        JSON.stringify({
          players: { yo: { records: { a: { bestMs: 5, bestAt: 'x' }, b: { bestMs: 'no' } } } },
        }),
        'yo',
      ),
    ).toEqual({ a: { bestMs: 5, bestAt: 'x' } });
  });
});
