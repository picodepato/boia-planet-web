import type { WorldEvent } from '@boia/engine';
import {
  CARNET_SHIP,
  MemoryStorage,
  SAMPLE_ACHIEVEMENTS,
  SAMPLE_COSMETICS,
  createLocalRepository,
} from '@boia/store';
import { COFRE_COINS, COFRE_POINTS, RESTOS_COINS, WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { grantCarnetReward } from './achievements';
import { persistWorldEvent } from './world-progress';

/**
 * Las cifras fijas de la decisión 2026-10-02 (T72) que viven en el mar y en
 * el Carnet: cada resto flotante da 10 monedas; el Cofre fugaz, 40 monedas y
 * 20 puntos; crear el Carnet BOIA, 300 puntos y un barco que no es de base,
 * ni de misión, ni premio de otro logro. Las cifras son la decisión misma.
 */

const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config;
const ofCategory = (c: string) => world.objects.filter((o) => o.identity.category === c);
const rewards = (o: (typeof world.objects)[number]) =>
  o.behaviors.flatMap((b) => (b.type === 'reward' ? [b.params] : []));

function browser() {
  const storage = new MemoryStorage();
  return () =>
    createLocalRepository({
      storage,
      now: () => new Date('2026-10-02T18:00:00Z'),
      watch: false,
    });
}

const event = (objectId: string, kind: string, amount: number): WorldEvent => ({
  type: 'reward',
  objectId,
  kind,
  amount,
  frequency: 'session',
  key: null,
});

describe('mar vivo (decisión 2026-10-02)', () => {
  it('cada resto flotante da 10 monedas, una vez por visita', () => {
    expect(RESTOS_COINS).toBe(10);
    const restos = ofCategory('restos');
    expect(restos.length).toBeGreaterThan(0);
    for (const o of restos) {
      expect(rewards(o)).toEqual([
        expect.objectContaining({ kind: 'coins', amount: 10, frequency: 'session' }),
      ]);
    }
  });

  it('el Cofre fugaz da 40 monedas y 20 puntos, una vez por visita', () => {
    expect([COFRE_COINS, COFRE_POINTS]).toEqual([40, 20]);
    const cofres = ofCategory('cofre');
    expect(cofres.length).toBeGreaterThan(0);
    for (const o of cofres) {
      expect(rewards(o)).toEqual([
        expect.objectContaining({ kind: 'coins', amount: 40, frequency: 'session' }),
        expect.objectContaining({ kind: 'points', amount: 20, frequency: 'session' }),
      ]);
    }
  });

  it('los premios por visita llegan al saldo: una vez en la visita y otra en la siguiente', async () => {
    const visit = browser();
    const repo = visit();
    const [resto] = ofCategory('restos');
    const [cofre] = ofCategory('cofre');
    const pick = async (r: typeof repo, sessionId: string) => {
      const ctx = { sessionId, worldId: world.id };
      const out = [
        ...(await persistWorldEvent(
          r.progress,
          event(resto!.identity.id, 'coins', RESTOS_COINS),
          ctx,
        )),
        ...(await persistWorldEvent(
          r.progress,
          event(cofre!.identity.id, 'coins', COFRE_COINS),
          ctx,
        )),
        ...(await persistWorldEvent(
          r.progress,
          event(cofre!.identity.id, 'points', COFRE_POINTS),
          ctx,
        )),
      ];
      return out.length;
    };
    expect(await pick(repo, 'k1x2-ab12cd')).toBe(3);
    expect(await pick(repo, 'k1x2-ab12cd')).toBe(0);
    expect(await repo.progress.balances()).toMatchObject({
      coins: RESTOS_COINS + COFRE_COINS,
      points: COFRE_POINTS,
    });
    const next = visit();
    expect(await pick(next, 'k1x3-ef34gh')).toBe(3);
    expect(await next.progress.balances()).toMatchObject({
      coins: 2 * (RESTOS_COINS + COFRE_COINS),
      points: 2 * COFRE_POINTS,
    });
  });
});

describe('el Carnet BOIA (decisión 2026-10-02)', () => {
  const carnet = SAMPLE_ACHIEVEMENTS.find((a) => a.trigger === 'create_carnet')!;
  const ship = SAMPLE_COSMETICS.find((c) => c.id === CARNET_SHIP)!;

  it('da 300 puntos y un barco que no es libre, ni de misión, ni de otro logro', () => {
    expect(carnet.points).toBe(300);
    expect(carnet.cosmeticKey).toBe(CARNET_SHIP);
    expect(ship.slot).toBe('ship');
    expect(ship.base).toBeFalsy();
    expect(ship.unlockMission).toBeUndefined();
    expect(ship.unlockPoints).toBeUndefined();
    // No se vende: sólo lo da el Carnet.
    expect(ship.priceCoins).toBeNull();
    expect(
      SAMPLE_ACHIEVEMENTS.filter((a) => a.cosmeticKey === CARNET_SHIP).map((a) => a.id),
    ).toEqual([carnet.id]);
  });

  it('crearlo da el premio en el acto, sin «Reclamar», y una sola vez', async () => {
    const visit = browser();
    const repo = visit();
    await repo.carnet.create({ nickname: 'Recién llegada' });
    const notices = await grantCarnetReward(repo);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ id: `logro:${carnet.id}`, title: carnet.title });
    expect(notices[0]!.body).toContain(String(carnet.points));
    expect(notices[0]!.body).toContain(ship.name);
    expect(await repo.progress.balances()).toMatchObject({ points: carnet.points, coins: 0 });
    const item = (await repo.progress.shop()).find((i) => i.cosmetic.id === CARNET_SHIP)!;
    expect(item.owned).toBe(true);
    expect(
      (await repo.progress.achievements()).find((a) => a.definition.id === carnet.id)?.state,
    ).toBe('claimed');
    // Guardar el Carnet otra vez, o tras recargar, no da nada más.
    expect(await grantCarnetReward(repo)).toEqual([]);
    expect(await grantCarnetReward(visit())).toEqual([]);
    expect(await visit().progress.balances()).toMatchObject({ points: carnet.points });
  });

  it('un Carnet de antes, con el logro completado sin reclamar, recibe el premio al guardarlo', async () => {
    const repo = browser()();
    await repo.carnet.create({ nickname: 'De antes' });
    await repo.progress.completeAchievement(carnet.id);
    expect(await grantCarnetReward(repo)).toHaveLength(1);
    expect((await repo.progress.shop()).find((i) => i.cosmetic.id === CARNET_SHIP)?.owned).toBe(
      true,
    );
  });
});
