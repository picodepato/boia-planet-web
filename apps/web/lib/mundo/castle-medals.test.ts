import { DEFENSE_RUN_MINS } from '@boia/engine/defense';
import { DIFFICULTY_IDS } from '@boia/engine/survivors';
import { describe, expect, it } from 'vitest';
import {
  CASTLE_MEDAL_RANK,
  castleBestMedal,
  castleMedalCounter,
  castlePairMedal,
  castlePairs,
  readCastleMedals,
  recordCastleMedal,
} from './castle-medals';

/**
 * Las medallas de «Defensa del Castillo» (plan 014 T162): la mejor de cada
 * par duración × dificultad, en los contadores del progreso (como la
 * campaña del Cañón), sin perder nunca la mejor.
 */

/** Los contadores del progreso en memoria (`increment` sólo suma, como el de verdad). */
function memoryStore() {
  const counters = new Map<string, number>();
  return {
    counters,
    async counter(name: string) {
      return counters.get(name) ?? 0;
    },
    async increment(name: string, by = 1) {
      const v = (counters.get(name) ?? 0) + by;
      counters.set(name, v);
      return v;
    },
  };
}

describe('las medallas del castillo', () => {
  it('nueve pares, un contador distinto por par', () => {
    const pairs = castlePairs();
    expect(pairs).toHaveLength(DEFENSE_RUN_MINS.length * DIFFICULTY_IDS.length);
    const names = new Set(pairs.map((p) => castleMedalCounter(p.runMin, p.difficulty)));
    expect(names.size).toBe(pairs.length);
  });

  it('sin partidas, ninguna medalla', async () => {
    const medals = await readCastleMedals(memoryStore());
    expect(castleBestMedal(medals)).toBeNull();
    for (const p of castlePairs())
      expect(castlePairMedal(medals, p.runMin, p.difficulty)).toBeNull();
  });

  it('se guarda en su par y sólo en él', async () => {
    const store = memoryStore();
    const o = await recordCastleMedal(store, 5, 'tranquila', 'plata');
    expect(o).toEqual({ best: 'plata', improved: true });
    const medals = await readCastleMedals(store);
    expect(castlePairMedal(medals, 5, 'tranquila')).toBe('plata');
    for (const p of castlePairs()) {
      if (p.runMin === 5 && p.difficulty === 'tranquila') continue;
      expect(castlePairMedal(medals, p.runMin, p.difficulty)).toBeNull();
    }
    expect(store.counters.get(castleMedalCounter(5, 'tranquila'))).toBe(CASTLE_MEDAL_RANK.plata);
  });

  it('la mejor se queda: una peor no la baja; una mejor la sube', async () => {
    const store = memoryStore();
    await recordCastleMedal(store, 7, 'normal', 'oro');
    expect(await recordCastleMedal(store, 7, 'normal', 'bronce')).toEqual({
      best: 'oro',
      improved: false,
    });
    expect(await recordCastleMedal(store, 7, 'normal', null)).toEqual({
      best: 'oro',
      improved: false,
    });
    expect(castlePairMedal(await readCastleMedals(store), 7, 'normal')).toBe('oro');

    await recordCastleMedal(store, 10, 'tormenta', 'bronce');
    expect(await recordCastleMedal(store, 10, 'tormenta', 'plata')).toEqual({
      best: 'plata',
      improved: true,
    });
    expect(store.counters.get(castleMedalCounter(10, 'tormenta'))).toBe(CASTLE_MEDAL_RANK.plata);
  });

  it('el tablón enseña la mejor de todos los pares', async () => {
    const store = memoryStore();
    await recordCastleMedal(store, 5, 'tormenta', 'bronce');
    expect(castleBestMedal(await readCastleMedals(store))).toBe('bronce');
    await recordCastleMedal(store, 10, 'tranquila', 'oro');
    await recordCastleMedal(store, 7, 'normal', 'plata');
    expect(castleBestMedal(await readCastleMedals(store))).toBe('oro');
  });
});
