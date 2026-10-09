import { describe, expect, it } from 'vitest';
import { SAMPLE_ACHIEVEMENTS, SAMPLE_COSMETICS, SAMPLE_RANKS } from './sample';
import { makeRepo } from './test-helpers';

/**
 * La economía se ajusta desde el Admin, sin desplegar (T72): los paneles
 * «Logros, cosméticos y rangos» guardan con `repo.admin.upsert` (como
 * `apps/web/app/admin/sections/achievements.tsx`) y lo siguiente que hace el
 * visitante ya usa el valor nuevo. Los números salen del catálogo de muestra.
 */

const ranks = [...SAMPLE_RANKS].sort((a, b) => a.minPoints - b.minPoints);
const coinShip = SAMPLE_COSMETICS.filter(
  (c) => c.slot === 'ship' && !c.base && c.priceCoins !== null && (c.priceCoins ?? 0) > 0,
).sort((a, b) => a.priceCoins! - b.priceCoins!)[0]!;
const prize = SAMPLE_ACHIEVEMENTS.find((a) => a.id === 'primera-boia')!;

describe('rangos lúdicos (REQ-IDE-028)', () => {
  it('cambiar un umbral desde el Admin recalcula el rango mostrado', async () => {
    const { repo } = makeRepo();
    await repo.carnet.create({ nickname: 'Rangos' });
    const [first, second] = ranks;
    // Justo por debajo del segundo rango: se ve el primero.
    const pts = second!.minPoints - 1;
    await repo.progress.grantWorldReward({ sourceRef: 'prueba-rangos', points: pts });
    expect((await repo.carnet.mine())!.rank?.id).toBe(first!.id);

    // El Admin baja el umbral del segundo por debajo de esos puntos: el Carnet sube.
    const stored = (await repo.content.list('ranks')).find((r) => r.id === second!.id)!;
    await repo.admin.upsert('ranks', { ...stored, minPoints: pts }, { reason: 'rango' });
    expect((await repo.carnet.mine())!.rank?.id).toBe(second!.id);

    // Y al subirlo otra vez, vuelve el primero.
    const again = (await repo.content.list('ranks')).find((r) => r.id === second!.id)!;
    await repo.admin.upsert('ranks', { ...again, minPoints: pts + 1 }, { reason: 'rango' });
    expect((await repo.carnet.mine())!.rank?.id).toBe(first!.id);
  });
});

describe('economía ajustable desde el Admin (REQ-IDE-029)', () => {
  it('cambiar un precio desde el Admin cambia lo que cobra la tienda', async () => {
    const { repo } = makeRepo();
    const price = coinShip.priceCoins! + 7;
    const stored = (await repo.content.list('cosmetics')).find((c) => c.id === coinShip.id)!;
    await repo.admin.upsert('cosmetics', { ...stored, priceCoins: price }, { reason: 'cosmético' });
    await repo.progress.grantWorldReward({ sourceRef: 'prueba-precio', coins: price + 3 });
    const item = (await repo.progress.shop()).find((i) => i.cosmetic.id === coinShip.id)!;
    expect(item.unlock).toEqual({ kind: 'coins', price });
    await repo.progress.buyCosmetic(coinShip.id);
    expect((await repo.progress.balances()).coins).toBe(3);
  });

  it('cambiar un premio desde el Admin cambia lo que da el logro al reclamarlo', async () => {
    const { repo } = makeRepo();
    const stored = (await repo.content.list('achievements')).find((a) => a.id === prize.id)!;
    const points = prize.points + 15;
    const coins = prize.coins + 5;
    await repo.admin.upsert('achievements', { ...stored, points, coins }, { reason: 'logro' });
    const before = await repo.progress.balances();
    await repo.progress.completeAchievement(prize.id);
    await repo.progress.claimAchievement(prize.id);
    const after = await repo.progress.balances();
    expect(after.points - before.points).toBe(points);
    expect(after.coins - before.coins).toBe(coins);
  });

  it('cambiar un umbral de puntos desde el Admin cambia lo que desbloquea', async () => {
    const { repo } = makeRepo();
    const ship = SAMPLE_COSMETICS.find((c) => c.slot === 'ship' && c.unlockPoints !== undefined)!;
    const stored = (await repo.content.list('cosmetics')).find((c) => c.id === ship.id)!;
    await repo.admin.upsert('cosmetics', { ...stored, unlockPoints: 5 }, { reason: 'cosmético' });
    await repo.progress.grantWorldReward({ sourceRef: 'prueba-umbral', points: 5 });
    const item = (await repo.progress.shop()).find((i) => i.cosmetic.id === ship.id)!;
    expect(item.unlock).toEqual({ kind: 'points', points: 5 });
    expect(item.missing).toBe(0);
  });
});
