import { describe, expect, it } from 'vitest';
import { isStoreError } from './errors';
import { CANONCITO, ESTELA_VORTICE, SAMPLE_COSMETICS, TORTUGA_TURBO } from './sample';
import { makeRepo } from './test-helpers';

/**
 * Los premios de plan 015 (decisión 16, T175): las mascotas «Cañoncito» y
 * «Tortuga turbo» (ranura `mascot`) y la «Estela del vórtice» (ranura
 * `wake`) están en el catálogo, no se venden, y sólo se equipan cuando son
 * tuyas (`grantCosmetic`: el atajo de desarrollo hasta que T176 ponga sus
 * logros). Una mascota ocupa la ranura de la otra: una a la vez.
 */

const PRIZES = [
  [CANONCITO, 'mascot'],
  [TORTUGA_TURBO, 'mascot'],
  [ESTELA_VORTICE, 'wake'],
] as const;

describe('premios del castillo y la carrera (T175)', () => {
  it('están en el catálogo, cada uno en su ranura, sin precio', () => {
    for (const [id, slot] of PRIZES) {
      const c = SAMPLE_COSMETICS.find((x) => x.id === id);
      expect(c, id).toBeDefined();
      expect(c!.slot).toBe(slot);
      expect(c!.priceCoins).toBeNull();
      expect(c!.base).toBeFalsy();
    }
  });

  it('sin tenerlos no se compran ni se equipan; en la tienda salen bloqueados', async () => {
    const { repo } = makeRepo();
    const shop = await repo.progress.shop();
    for (const [id, slot] of PRIZES) {
      const item = shop.find((i) => i.cosmetic.id === id)!;
      expect(item.owned).toBe(false);
      expect(item.canBuy).toBe(false);
      expect(item.unlock.kind).not.toBe('coins');
      const buy = await repo.progress.buyCosmetic(id).catch((e: unknown) => e);
      expect(isStoreError(buy, 'forbidden'), id).toBe(true);
      const err = await repo.progress.equip(slot, id).catch((e: unknown) => e);
      expect(isStoreError(err, 'forbidden'), id).toBe(true);
    }
    expect(await repo.progress.equipped()).toEqual({});
  });

  it('`grantCosmetic` los da una vez sin cobrar; luego se equipan en su ranura y no en otra', async () => {
    const { repo, reload } = makeRepo();
    await repo.progress.grantWorldReward({ sourceRef: 'cofre', coins: 5, points: 1 });
    for (const [id] of PRIZES) {
      const r = await repo.progress.grantCosmetic(id, { sourceRef: 'dev:atajo' });
      expect(r.granted, id).toBe(true);
      const again = await repo.progress.grantCosmetic(id, { sourceRef: 'dev:atajo' });
      expect(again.granted).toBe(false);
    }
    expect(await repo.progress.balances()).toMatchObject({ coins: 5, points: 1 });
    const shop = await repo.progress.shop();
    for (const [id] of PRIZES) expect(shop.find((i) => i.cosmetic.id === id)?.owned, id).toBe(true);

    const wrong = await repo.progress.equip('wake', CANONCITO).catch((e: unknown) => e);
    expect(isStoreError(wrong)).toBe(true);
    expect(await repo.progress.equip('mascot', CANONCITO)).toEqual({ mascot: CANONCITO });
    // Una mascota a la vez: la tortuga quita al cañoncito.
    expect(await repo.progress.equip('mascot', TORTUGA_TURBO)).toEqual({ mascot: TORTUGA_TURBO });
    expect(await repo.progress.equip('wake', ESTELA_VORTICE)).toEqual({
      mascot: TORTUGA_TURBO,
      wake: ESTELA_VORTICE,
    });
    expect(await reload().progress.equipped()).toEqual({
      mascot: TORTUGA_TURBO,
      wake: ESTELA_VORTICE,
    });
  });

  it('un cosmético que no existe no se concede', async () => {
    const { repo } = makeRepo();
    const err = await repo.progress
      .grantCosmetic('mascota-que-no-existe', { sourceRef: 'dev:atajo' })
      .catch((e: unknown) => e);
    expect(isStoreError(err, 'not_found')).toBe(true);
  });
});
