import { describe, expect, it } from 'vitest';
import { localDocAccess } from './local';
import { MINIKRAKEN, SAMPLE_ACHIEVEMENTS } from './sample';
import { STORE_KEY } from './storage';
import { makeRepo } from './test-helpers';

describe('T167: historical flags', () => {
  it.each(['bandera-boia', 'bandera-personalizada'])(
    'loads owned and equipped %s without changing other progress',
    async (flagId) => {
      const { repo, storage, reload } = makeRepo();
      await repo.carnet.create({ nickname: 'Marea' });
      await repo.progress.grantWorldReward({ sourceRef: 'cofre', points: 50, coins: 100 });
      await repo.progress.buyCosmetic('estela-naranja');
      await repo.progress.equip('wake', 'estela-naranja');
      await repo.progress.discover('puerto');
      const doc = localDocAccess(repo)!.read();
      const userId = doc.identity!.id;
      doc.players[userId]!.equipped.flag = flagId;
      doc.players[userId]!.equipped.mascot = MINIKRAKEN;
      doc.ledger.push({
        id: `cosmetic:${flagId}`,
        userId,
        kind: 'cosmetic',
        pointsDelta: 0,
        coinsDelta: -20,
        seasonId: null,
        cosmeticKey: flagId,
        sourceRef: 'coins',
        metadata: {},
        createdAt: doc.identity!.createdAt,
      });
      if (flagId === 'bandera-personalizada') {
        doc.content.items.cosmetics = {
          [flagId]: {
            value: { id: flagId, name: 'Legacy flag', slot: 'flag', priceCoins: 20, sample: true },
            deleted: false,
            at: doc.identity!.createdAt,
          },
        };
      }
      storage.setItem(STORE_KEY, JSON.stringify(doc));
      const expected = structuredClone(doc);
      delete expected.players[userId]!.equipped.flag;
      for (let n = 0; n < 2; n++) {
        const loaded = reload();
        expect(loaded.status()).toMatchObject({ issue: null, droppedOnLoad: 0 });
        expect(localDocAccess(loaded)!.read()).toEqual(expected);
        expect(await loaded.progress.balances()).toMatchObject({ points: 50, coins: 50 });
        expect((await loaded.progress.cosmetics()).map((c) => c.id)).toEqual(['estela-naranja']);
        expect((await loaded.carnet.mine())!.cosmeticIds).toEqual(['estela-naranja']);
        await expect(loaded.progress.equip('wake', flagId)).rejects.toThrow();
      }
    },
  );

  it('ignores a historical achievement flag reward while preserving points and coins', async () => {
    const achievement = SAMPLE_ACHIEVEMENTS.find((a) => a.id === 'fiestera-entregada')!;
    const { repo } = makeRepo({
      sample: { achievements: [{ ...achievement, cosmeticKey: 'bandera-fiestera' }] },
    });
    await repo.progress.completeAchievement(achievement.id);
    const claim = await repo.progress.claimAchievement(achievement.id);
    expect(claim).toMatchObject({ claimed: true, cosmetic: null, reward: { cosmeticKey: null } });
    expect(await repo.progress.cosmetics()).toEqual([]);
    expect(await repo.progress.balances()).toMatchObject({
      points: achievement.points,
      coins: achievement.coins,
    });
  });
});
