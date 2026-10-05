import { SAMPLE_COSMETICS, createLocalRepository } from '@boia/store';
import { WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { loadShipCatalog, repoRoot } from './load';
import { dressingFor, dressingKey } from './dressing';
import { confirmText, resolveLook, shopRows, unlockText } from './shop-model';

/**
 * La tienda «Barco» sin React (T40): filas, textos y el aspecto con que entra
 * el barco. Todo contra el catálogo de muestra y el arte reales.
 */

const catalog = loadShipCatalog(repoRoot())!;
const fresh = () => createLocalRepository({ storage: null, watch: false });
const ships = SAMPLE_COSMETICS.filter((c) => c.slot === 'ship');
const coinShip = ships.find((c) => !c.base && c.priceCoins)!;
const pointsShip = ships.find((c) => c.unlockPoints)!;
const rewardShip = ships.find((c) => !c.base && c.priceCoins === null && !c.unlockPoints)!;
const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).theme.ship;

describe('filas de la tienda', () => {
  it('cada barco del catálogo de muestra tiene arte, y cada skin que se vende también', async () => {
    const repo = fresh();
    const rows = shopRows(catalog, await repo.progress.shop());
    expect(rows.ships.map((r) => r.item.cosmetic.id).sort()).toEqual(ships.map((c) => c.id).sort());
    const sold = SAMPLE_COSMETICS.filter((c) => c.slot === 'skin');
    const shown = rows.ships.flatMap((r) =>
      r.skins.flatMap((k) => (k.item ? [k.item.cosmetic.id] : [])),
    );
    expect(shown.sort()).toEqual(sold.map((c) => c.id).sort());
    // Todos con la base, que va con el barco; el estilo «muestra» (sin cosmético) no sale.
    for (const r of rows.ships) expect(r.skins[0]).toMatchObject({ skin: 'base', item: null });
    expect(rows.ships.some((r) => r.style === catalog.defaultId)).toBe(false);
    expect(rows).not.toHaveProperty('flags');
    expect(rows.wakes.every((i) => i.cosmetic.slot === 'wake')).toBe(true);
  });

  it('dice el precio con «te faltan N monedas», el umbral con «te faltan N puntos» y el logro', async () => {
    const repo = fresh();
    await repo.progress.grantWorldReward({ sourceRef: 'cofre', points: 1, coins: 1 });
    const items = await repo.progress.shop();
    const [achievement] = await repo.progress
      .achievements()
      .then((l) => l.filter((a) => a.definition.cosmeticKey === rewardShip.id));
    const titles = { [achievement!.definition.id]: achievement!.definition.title };
    const byId = (id: string) => items.find((i) => i.cosmetic.id === id)!;
    expect(unlockText(byId(coinShip.id))).toBe(
      `${coinShip.priceCoins} 🪙 · te faltan ${coinShip.priceCoins! - 1} monedas`,
    );
    expect(unlockText(byId(pointsShip.id))).toBe(
      `Con ${pointsShip.unlockPoints} puntos · te faltan ${pointsShip.unlockPoints! - 1} puntos`,
    );
    expect(unlockText(byId(rewardShip.id), titles)).toBe(
      `Se gana con el logro «${achievement!.definition.title}»`,
    );
    expect(unlockText(byId(rewardShip.id), {})).toBe('Se gana con un logro oculto');
    expect(unlockText(byId(ships.find((c) => c.base)!.id))).toBe('De serie');
    expect(confirmText(byId(coinShip.id), 500)).toBe(
      `¿Comprar ${coinShip.name} por ${coinShip.priceCoins} 🪙? Te quedarán ${500 - coinShip.priceCoins!}.`,
    );
  });
});

describe('aspecto al entrar', () => {
  it('sin nada guardado, el barco del mundo; un ?estilo= que no es tuyo no se pone', async () => {
    const items = await fresh().progress.shop();
    const legacy = { style: null, skin: null };
    expect(resolveLook({ urlStyle: null, equipped: {}, legacy, items, world })).toEqual({
      style: world.style,
      skin: 'base',
      source: 'world',
    });
    expect(
      resolveLook({ urlStyle: coinShip.assetKey!, equipped: {}, legacy, items, world }).source,
    ).toBe('world');
    // Lo elegido antes de la tienda tampoco, si ahora está bloqueado.
    expect(
      resolveLook({
        urlStyle: null,
        equipped: {},
        legacy: { style: coinShip.assetKey!, skin: 'noche' },
        items,
        world,
      }),
    ).toMatchObject({ style: world.style, skin: 'base' });
  });

  it('lo equipado manda sobre lo de antes, con su skin; ?estilo= tuyo manda sobre todo', async () => {
    const repo = fresh();
    const skin = SAMPLE_COSMETICS.find((c) => c.slot === 'skin' && c.forShip === coinShip.id)!;
    await repo.progress.grantWorldReward({
      sourceRef: 'cofre',
      coins: coinShip.priceCoins! + skin.priceCoins!,
    });
    await repo.progress.buyCosmetic(coinShip.id);
    await repo.progress.buyCosmetic(skin.id);
    const equipped = await repo.progress.equip('skin', skin.id);
    const items = await repo.progress.shop();
    const base = ships.find((c) => c.base && c.assetKey !== coinShip.assetKey)!;
    const legacy = { style: base.assetKey!, skin: 'base' };
    expect(resolveLook({ urlStyle: null, equipped, legacy, items, world })).toEqual({
      style: coinShip.assetKey,
      skin: skin.assetKey,
      source: 'equipped',
    });
    expect(resolveLook({ urlStyle: base.assetKey!, equipped, legacy, items, world })).toEqual({
      style: base.assetKey,
      skin: 'base',
      source: 'url',
    });
  });

  it('la estela se pinta y una bandera antigua se ignora', () => {
    expect(dressingFor({})).toEqual({ wakeTint: null, mascot: null });
    const wake = SAMPLE_COSMETICS.find((c) => c.slot === 'wake')!;
    const d = dressingFor({ flag: 'bandera-boia', wake: wake.id, ship: coinShip.id });
    expect(d).not.toHaveProperty('flag');
    expect(dressingKey(d)).toBe(dressingKey(dressingFor({ wake: wake.id })));
    expect(d.wakeTint).not.toBeNull();
    expect(d.mascot).toBeNull();
  });

  it('cada mascota del catálogo tiene modelo en cubierta; sin mascota, nada (T154)', () => {
    const mascots = SAMPLE_COSMETICS.filter((c) => c.slot === 'mascot');
    expect(mascots.length).toBeGreaterThan(0);
    for (const m of mascots) expect(dressingFor({ mascot: m.id }).mascot, m.id).not.toBeNull();
    expect(dressingFor({ mascot: 'mascota-que-no-existe' }).mascot).toBeNull();
    expect(dressingKey(dressingFor({ mascot: mascots[0]!.id }))).not.toBe(
      dressingKey(dressingFor({})),
    );
  });
});
