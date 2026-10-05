import { describe, expect, it } from 'vitest';
import { isStoreError } from './errors';
import { V7_SHIP_PREF, V7_SOURCE, migrate } from './migrations';
import { SAMPLE_COSMETICS } from './sample';
import { SCHEMA_VERSION } from './schema';
import { STORE_KEY } from './storage';
import { makeRepo } from './test-helpers';

/**
 * Economía de barcos (T40, D-23 punto 1 y O5): todo bloqueado menos los barcos
 * de base; las monedas compran barcos y skins con una sola fila del libro; un
 * barco se desbloquea al llegar a un umbral de puntos, que no se gastan. Los
 * precios y umbrales salen del catálogo de muestra, no de números escritos aquí.
 */

const ships = SAMPLE_COSMETICS.filter((c) => c.slot === 'ship');
const baseShips = ships.filter((c) => c.base);
const coinShip = ships
  .filter((c) => !c.base && c.priceCoins !== null && c.priceCoins > 0)
  .sort((a, b) => a.priceCoins! - b.priceCoins!)[0]!;
const pointsShip = ships.find((c) => c.unlockPoints !== undefined)!;
const skinOf = (shipId: string) =>
  SAMPLE_COSMETICS.find((c) => c.slot === 'skin' && c.forShip === shipId)!;

describe('catálogo de muestra (O5)', () => {
  it('B05 Arcilla y B02 Acuarela son los barcos de base; los demás, con precio, umbral o logro', () => {
    expect(baseShips.map((c) => c.assetKey).sort()).toEqual(['acuarela', 'arcilla']);
    for (const c of ships.filter((s) => !s.base)) {
      const how = [c.priceCoins !== null, c.unlockPoints !== undefined].filter(Boolean).length;
      // Sin precio ni umbral: se gana con un logro (lo comprueba achievements.test.ts).
      expect(how).toBeLessThanOrEqual(1);
    }
    for (const c of SAMPLE_COSMETICS.filter((s) => s.slot === 'skin')) {
      expect(ships.some((s) => s.id === c.forShip)).toBe(true);
      expect(c.priceCoins).toBeGreaterThan(0);
    }
  });
});

describe('tienda «Barco»', () => {
  it('un visitante nuevo tiene exactamente B05 y B02, sin skins ni cosméticos', async () => {
    const { repo } = makeRepo();
    const shop = await repo.progress.shop();
    expect(
      shop
        .filter((i) => i.owned)
        .map((i) => i.cosmetic.id)
        .sort(),
    ).toEqual(baseShips.map((c) => c.id).sort());
    const owned = (await repo.progress.ships()).filter((s) => s.owned);
    expect(owned.map((s) => s.style).sort()).toEqual(['acuarela', 'arcilla']);
    expect(owned.every((s) => s.base)).toBe(true);
    // Y puede llevarlos sin comprar nada.
    await repo.progress.equip('ship', baseShips[0]!.id);
    expect((await repo.progress.balances()).coins).toBe(0);
  });

  it('dice cuánto falta: monedas para lo que se vende, puntos para el umbral', async () => {
    const { repo } = makeRepo();
    await repo.progress.grantWorldReward({ sourceRef: 'cofre', points: 100, coins: 40 });
    const shop = await repo.progress.shop();
    const buy = shop.find((i) => i.cosmetic.id === coinShip.id)!;
    expect(buy.unlock).toEqual({ kind: 'coins', price: coinShip.priceCoins });
    expect(buy.missing).toBe(coinShip.priceCoins! - 40);
    expect(buy.canBuy).toBe(false);
    const veteran = shop.find((i) => i.cosmetic.id === pointsShip.id)!;
    expect(veteran.unlock).toEqual({ kind: 'points', points: pointsShip.unlockPoints });
    expect(veteran.missing).toBe(pointsShip.unlockPoints! - 100);
  });

  it('sin monedas suficientes no compra ni cobra', async () => {
    const { repo } = makeRepo();
    await repo.progress.grantWorldReward({
      sourceRef: 'cofre',
      points: 5,
      coins: coinShip.priceCoins! - 1,
    });
    await expect(repo.progress.buyCosmetic(coinShip.id)).rejects.toSatisfy((e) =>
      isStoreError(e, 'insufficient_coins'),
    );
    expect(await repo.progress.balances()).toMatchObject({
      points: 5,
      coins: coinShip.priceCoins! - 1,
    });
    expect((await repo.progress.shop()).find((i) => i.cosmetic.id === coinShip.id)?.owned).toBe(
      false,
    );
    await expect(repo.progress.equip('ship', coinShip.id)).rejects.toSatisfy((e) =>
      isStoreError(e, 'forbidden'),
    );
  });

  it('comprar cobra una vez aunque se confirme dos veces', async () => {
    const { repo, reload } = makeRepo();
    const price = coinShip.priceCoins!;
    await repo.progress.grantWorldReward({ sourceRef: 'cofre', points: 7, coins: price * 2 });
    const [a, b] = await Promise.all([
      repo.progress.buyCosmetic(coinShip.id),
      repo.progress.buyCosmetic(coinShip.id),
    ]);
    expect([a.granted, b.granted].sort()).toEqual([false, true]);
    const again = await repo.progress.buyCosmetic(coinShip.id);
    expect(again).toMatchObject({ granted: false, reason: 'duplicate' });
    const rows = (await repo.progress.ledger()).filter((e) => e.cosmeticKey === coinShip.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'cosmetic', coinsDelta: -price, pointsDelta: 0 });
    // Los saldos se derivan del libro: las monedas bajan una vez y los puntos no.
    expect(await repo.progress.balances()).toMatchObject({ points: 7, coins: price });
    // Otra pestaña (otro repositorio sobre el mismo almacenamiento) tampoco cobra otra vez.
    const other = reload();
    expect((await other.progress.buyCosmetic(coinShip.id)).granted).toBe(false);
    expect((await other.progress.balances()).coins).toBe(price);
  });

  it('comprado, se equipa y sigue equipado al recargar', async () => {
    const { repo, reload } = makeRepo();
    const skin = skinOf(coinShip.id);
    await repo.progress.grantWorldReward({
      sourceRef: 'cofre',
      coins: coinShip.priceCoins! + skin.priceCoins!,
    });
    // Una skin sin su barco no se vende.
    await expect(repo.progress.buyCosmetic(skin.id)).rejects.toSatisfy((e) =>
      isStoreError(e, 'forbidden'),
    );
    await repo.progress.buyCosmetic(coinShip.id);
    await repo.progress.buyCosmetic(skin.id);
    expect((await repo.progress.balances()).coins).toBe(0);
    // Equipar la skin lleva su barco.
    expect(await repo.progress.equip('skin', skin.id)).toEqual({
      ship: coinShip.id,
      skin: skin.id,
    });
    expect(await reload().progress.equipped()).toEqual({ ship: coinShip.id, skin: skin.id });
    // Un barco de base quita la skin del otro.
    expect(await repo.progress.equip('ship', baseShips[0]!.id)).toEqual({ ship: baseShips[0]!.id });
  });

  it('el barco por puntos se desbloquea al llegar al umbral sin gastar los puntos', async () => {
    const { repo } = makeRepo();
    const threshold = pointsShip.unlockPoints!;
    await repo.progress.grantWorldReward({ sourceRef: 'a', points: threshold - 1, coins: 3 });
    let item = (await repo.progress.shop()).find((i) => i.cosmetic.id === pointsShip.id)!;
    expect(item).toMatchObject({ owned: false, missing: 1, canBuy: false });
    await expect(repo.progress.equip('ship', pointsShip.id)).rejects.toSatisfy((e) =>
      isStoreError(e, 'forbidden'),
    );
    await repo.progress.grantWorldReward({ sourceRef: 'b', points: 1 });
    item = (await repo.progress.shop()).find((i) => i.cosmetic.id === pointsShip.id)!;
    expect(item).toMatchObject({ owned: true, missing: 0 });
    expect((await repo.progress.ships()).find((s) => s.cosmeticId === pointsShip.id)).toMatchObject(
      { owned: true, unlockPoints: threshold },
    );
    // Ni se cobra ni se escribe nada: los puntos siguen enteros.
    expect(await repo.progress.buyCosmetic(pointsShip.id)).toMatchObject({ granted: false });
    await repo.progress.equip('ship', pointsShip.id);
    expect(await repo.progress.balances()).toMatchObject({ points: threshold, coins: 3 });
    expect((await repo.progress.ledger()).filter((e) => e.kind === 'cosmetic')).toHaveLength(0);
  });
});

describe('migración v6 → v7', () => {
  const v6 = (pref: Record<string, unknown> | undefined) => ({
    schemaVersion: 6,
    identity: { id: 'yo', kind: 'guest', createdAt: '2026-09-01T10:00:00Z' },
    players: {
      yo: {
        discoveries: {},
        discounts: {},
        missions: {},
        records: {},
        counters: {},
        equipped: { flag: 'bandera-boia' },
        prefs: pref ? { [V7_SHIP_PREF]: pref } : {},
        achievements: {},
      },
    },
    ledger: [
      {
        id: 'world_reward:cofre',
        userId: 'yo',
        kind: 'world_reward',
        pointsDelta: 20,
        coinsDelta: 30,
        seasonId: null,
        sourceRef: 'cofre',
        metadata: {},
        createdAt: '2026-09-01T10:00:00Z',
      },
      {
        id: 'cosmetic:bandera-boia',
        userId: 'yo',
        kind: 'cosmetic',
        pointsDelta: 0,
        coinsDelta: -30,
        seasonId: null,
        cosmeticKey: 'bandera-boia',
        sourceRef: 'coins',
        metadata: {},
        createdAt: '2026-09-01T10:00:00Z',
      },
    ],
    content: { items: {}, order: {}, places: {}, skins: {}, texts: {}, missionDestinations: {} },
  });

  const open = (doc: unknown) => {
    const { storage } = makeRepo();
    storage.setItem(STORE_KEY, JSON.stringify(doc));
    return makeRepo({ storage }).reload();
  };

  it('lo que el visitante llevaba sigue siendo suyo y sigue equipado, sin tocar los saldos', async () => {
    const skin = skinOf(coinShip.id);
    const m = migrate(v6({ style: coinShip.assetKey, skin: skin.assetKey, label: 'x' }));
    expect(m.status).toBe('ok');
    const repo = open(v6({ style: coinShip.assetKey, skin: skin.assetKey, label: 'x' }));
    expect(repo.status().schemaVersion).toBe(SCHEMA_VERSION);
    const owned = (await repo.progress.shop()).filter((i) => i.owned).map((i) => i.cosmetic.id);
    expect(owned).toEqual(expect.arrayContaining([coinShip.id, skin.id, 'bandera-boia']));
    expect(await repo.progress.equipped()).toEqual({
      flag: 'bandera-boia',
      ship: coinShip.id,
      skin: skin.id,
    });
    expect(await repo.progress.balances()).toMatchObject({ points: 20, coins: 0 });
    const rows = (await repo.progress.ledger()).filter((e) => e.sourceRef === V7_SOURCE);
    expect(rows.map((e) => e.coinsDelta)).toEqual([0, 0]);
  });

  it('un barco de logro sin reclamar no se regala, y sin preferencia no cambia nada', async () => {
    const reward = ships.find((c) => !c.base && c.priceCoins === null && !c.unlockPoints)!;
    const repo = open(v6({ style: reward.assetKey, skin: 'noche', label: 'x' }));
    expect((await repo.progress.shop()).find((i) => i.cosmetic.id === reward.id)?.owned).toBe(
      false,
    );
    expect(await repo.progress.equipped()).toEqual({ flag: 'bandera-boia' });
    const plain = open(v6(undefined));
    expect(await plain.progress.equipped()).toEqual({ flag: 'bandera-boia' });
    expect((await plain.progress.ledger()).filter((e) => e.sourceRef === V7_SOURCE)).toHaveLength(
      0,
    );
  });
});
