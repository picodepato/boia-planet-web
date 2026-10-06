import {
  CANONCITO,
  ESTELA_VORTICE,
  MINIKRAKEN,
  SAMPLE_ACHIEVEMENTS,
  TORTUGA_TURBO,
  createLocalRepository,
} from '@boia/store';
import { describe, expect, it } from 'vitest';
import { devCosmeticsWanted, devGrantMascot, wantsDevMascot } from './mascota-dev';

/** El atajo `?mascota=` / `?estela=` (T154, T175): sólo en desarrollo y e2e, nunca en la versión de prueba. */
const env = (nodeEnv: string, search: string, webdriver = false) => ({
  nodeEnv,
  webdriver,
  search,
});

describe('atajo de la mascota (T154)', () => {
  it('sólo con `mascota=1` y donde una partida de prueba puede pagar', () => {
    expect(wantsDevMascot(env('development', '?mascota=1'))).toBe(true);
    expect(wantsDevMascot(env('production', '?mascota=1', true))).toBe(true);
    expect(wantsDevMascot(env('development', ''))).toBe(false);
    // Versión de prueba: ni con `?dev=1`.
    expect(wantsDevMascot(env('production', '?mascota=1&dev=1'))).toBe(false);
  });

  it('da la mascota por su logro una vez; luego se puede equipar', async () => {
    const repo = createLocalRepository({ storage: null, watch: false });
    const progress = repo.progress;
    expect(await devGrantMascot(progress, env('production', '?dev=1&mascota=1'))).toBe(0);
    expect((await progress.shop()).find((i) => i.cosmetic.id === MINIKRAKEN)?.owned).toBe(false);
    expect(await devGrantMascot(progress, env('development', '?mascota=1'))).toBe(1);
    expect(await devGrantMascot(progress, env('development', '?mascota=1'))).toBe(0);
    expect(await progress.equip('mascot', MINIKRAKEN)).toEqual({ mascot: MINIKRAKEN });
    // Por el logro: con sus puntos.
    expect((await progress.balances()).points).toBeGreaterThan(0);
  });
});

describe('atajo de los premios del castillo y la carrera (T175)', () => {
  it('lee las mascotas (varias con comas) y la estela; ignora lo que no conoce', () => {
    expect(devCosmeticsWanted(env('development', '?mascota=canoncito'))).toEqual([CANONCITO]);
    expect(devCosmeticsWanted(env('development', '?mascota=canoncito,tortuga-turbo&estela=vortice'))).toEqual([
      CANONCITO,
      TORTUGA_TURBO,
      ESTELA_VORTICE,
    ]);
    expect(devCosmeticsWanted(env('development', '?mascota=otra&estela=rara'))).toEqual([]);
    expect(devCosmeticsWanted(env('production', '?mascota=canoncito&estela=vortice'))).toEqual([]);
  });

  it('con su logro (T176) los da por él, una sola vez, con sus puntos y monedas; luego se equipan', async () => {
    const repo = createLocalRepository({ storage: null, watch: false });
    const progress = repo.progress;
    const e = env('development', '?mascota=canoncito,tortuga-turbo&estela=vortice');
    expect(await devGrantMascot(progress, e)).toBe(3);
    expect(await devGrantMascot(progress, e)).toBe(0);
    const shop = await progress.shop();
    const givers = SAMPLE_ACHIEVEMENTS.filter((a) =>
      [CANONCITO, TORTUGA_TURBO, ESTELA_VORTICE].includes(a.cosmeticKey ?? ''),
    );
    expect(givers).toHaveLength(3);
    for (const id of [CANONCITO, TORTUGA_TURBO, ESTELA_VORTICE]) {
      const item = shop.find((i) => i.cosmetic.id === id)!;
      expect(item.owned, id).toBe(true);
      expect(item.unlock.kind, id).toBe('achievement');
    }
    const list = await progress.achievements();
    for (const a of givers) {
      expect(list.find((x) => x.definition.id === a.id)?.state, a.id).toBe('claimed');
    }
    expect(await progress.equip('mascot', TORTUGA_TURBO)).toEqual({ mascot: TORTUGA_TURBO });
    expect(await progress.equip('wake', ESTELA_VORTICE)).toEqual({
      mascot: TORTUGA_TURBO,
      wake: ESTELA_VORTICE,
    });
    // El premio de cada logro: sus puntos y sus monedas.
    expect(await progress.balances()).toMatchObject({
      points: givers.reduce((n, a) => n + a.points, 0),
      coins: givers.reduce((n, a) => n + (a.coins ?? 0), 0),
    });
  });
});
