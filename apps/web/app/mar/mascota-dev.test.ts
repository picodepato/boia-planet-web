import { MINIKRAKEN, createLocalRepository } from '@boia/store';
import { describe, expect, it } from 'vitest';
import { devGrantMascot, wantsDevMascot } from './mascota-dev';

/** El atajo `?mascota=1` (T154): sólo en desarrollo y e2e, nunca en la versión de prueba. */
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
    expect(await devGrantMascot(progress, env('production', '?dev=1&mascota=1'))).toBe(false);
    expect((await progress.shop()).find((i) => i.cosmetic.id === MINIKRAKEN)?.owned).toBe(false);
    expect(await devGrantMascot(progress, env('development', '?mascota=1'))).toBe(true);
    expect(await devGrantMascot(progress, env('development', '?mascota=1'))).toBe(false);
    expect(await progress.equip('mascot', MINIKRAKEN)).toEqual({ mascot: MINIKRAKEN });
  });
});
