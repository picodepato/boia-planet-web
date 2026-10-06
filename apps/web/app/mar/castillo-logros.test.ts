import type { DefenseResult } from '@boia/engine/defense';
import {
  CANONCITO,
  CASTLE_GAME,
  CASTLE_STORM_ACHIEVEMENT,
  CASTLE_VORTEX_ACHIEVEMENT,
  ESTELA_VORTICE,
  MemoryStorage,
  RACE_FAST_ACHIEVEMENT,
  RACE_FAST_MS,
  SAMPLE_ACHIEVEMENTS,
  SAMPLE_COSMETICS,
  STORE_KEY,
  TORTUGA_TURBO,
  createLocalRepository,
  emptyDoc,
  v10CastleMedalCounter,
} from '@boia/store';
import { describe, expect, it } from 'vitest';
import { reconcileAchievementEvidence } from '../../lib/mundo/achievements';
import { finishLap } from '../../lib/mundo/circuit-hud';
import { castleSignals, recordCastleWin } from './castillo-logros';

/**
 * Los logros del castillo y la carrera (plan 015 T176, decisión 16): cada
 * logro del castillo sale una vez y sólo con una victoria que cuenta (ni
 * atajo donde no dan premio, ni «Terminar partida», ni caer o abandonar);
 * la tarjeta final dice qué se desbloqueó; reclamar da puntos, monedas y el
 * cosmético. La regata: «Primera regata» al terminar, «Rápido» bajo
 * `RACE_FAST_MS`. Las victorias de antes (migración v10) y los récords de
 * antes también cuentan al abrir «Logros».
 */

const result = (over: Partial<DefenseResult>): DefenseResult =>
  ({
    end: 'held',
    ranked: true,
    medal: 'oro',
    score: 1000,
    killPoints: 900,
    lifeBonus: 100,
    runMin: 5,
    difficulty: 'normal',
    durationS: 300,
    playedS: 300,
    castleLife: 100,
    castleMaxLife: 100,
    kills: 10,
    killsByKind: {},
    bossesDefeated: [],
    coinsEarned: 0,
    planeLevel: 1,
    planeSpeedLevel: 1,
    castleLevel: 1,
    wavesAheadS: 0,
    towersBuilt: 0,
    configVersion: 1,
    ...over,
  }) as DefenseResult;

const castleDefs = SAMPLE_ACHIEVEMENTS.filter(
  (a) => a.trigger === 'win_minigame' && a.triggerParams?.game === CASTLE_GAME,
);

const fresh = () => {
  const storage = new MemoryStorage();
  const open = () => createLocalRepository({ storage, watch: false });
  return { open, repo: open(), storage };
};
const stateOf = async (repo: ReturnType<typeof fresh>['repo'], id: string) =>
  (await repo.progress.achievements()).find((a) => a.definition.id === id)?.state;

describe('castleSignals: sólo una victoria que cuenta', () => {
  it('aguantar da la señal con su dificultad y su duración', () => {
    expect(castleSignals(result({ difficulty: 'tormenta', runMin: 10 }), true)).toEqual([
      { trigger: 'win_minigame', game: CASTLE_GAME, difficulty: 'tormenta', runMin: 10 },
    ]);
  });

  it('caer (aun con bronce), abandonar, «Terminar partida» o un atajo que no paga: nada', () => {
    expect(castleSignals(result({ end: 'fallen', medal: 'bronce' }), true)).toEqual([]);
    expect(castleSignals(result({ end: 'abandoned', medal: null }), true)).toEqual([]);
    expect(castleSignals(result({ end: 'quit', medal: null, ranked: false }), true)).toEqual([]);
    expect(castleSignals(result({}), false)).toEqual([]);
    expect(castleSignals(null, true)).toEqual([]);
  });
});

describe('recordCastleWin: cada logro una vez, y la tarjeta dice qué se desbloqueó', () => {
  it('ganar en Tormenta 10 min completa Tormenta y el vórtice, con sus premios', async () => {
    const { repo } = fresh();
    const won = await recordCastleWin(
      repo,
      castleSignals(result({ difficulty: 'tormenta', runMin: 10 }), true),
    );
    const name = (id: string) => SAMPLE_COSMETICS.find((c) => c.id === id)!.name;
    expect(won.map((u) => u.id).sort()).toEqual(
      [CASTLE_STORM_ACHIEVEMENT, CASTLE_VORTEX_ACHIEVEMENT].sort(),
    );
    expect(won.find((u) => u.id === CASTLE_STORM_ACHIEVEMENT)?.prize).toBe(name(CANONCITO));
    expect(won.find((u) => u.id === CASTLE_VORTEX_ACHIEVEMENT)?.prize).toBe(name(ESTELA_VORTICE));
    // Otra vez: nada nuevo.
    expect(
      await recordCastleWin(repo, castleSignals(result({ difficulty: 'tormenta', runMin: 10 }), true)),
    ).toEqual([]);
    // Reclamar: puntos, monedas y el cosmético.
    for (const id of [CASTLE_STORM_ACHIEVEMENT, CASTLE_VORTEX_ACHIEVEMENT]) {
      expect((await repo.progress.claimAchievement(id)).claimed).toBe(true);
    }
    const shop = await repo.progress.shop();
    for (const key of [CANONCITO, ESTELA_VORTICE])
      expect(shop.find((i) => i.cosmetic.id === key)?.owned, key).toBe(true);
    const defs = castleDefs.filter((a) =>
      [CASTLE_STORM_ACHIEVEMENT, CASTLE_VORTEX_ACHIEVEMENT].includes(a.id),
    );
    expect(await repo.progress.balances()).toMatchObject({
      points: defs.reduce((n, a) => n + a.points, 0),
      coins: defs.reduce((n, a) => n + (a.coins ?? 0), 0),
    });
  });

  it('cada dificultad, su logro y sólo el suyo; Tormenta de 5 min no es el vórtice', async () => {
    const { repo } = fresh();
    for (const def of castleDefs.filter((a) => a.triggerParams?.runMin === undefined)) {
      const difficulty = def.triggerParams!.difficulty as DefenseResult['difficulty'];
      const won = await recordCastleWin(repo, castleSignals(result({ difficulty, runMin: 5 }), true));
      expect(won.map((u) => u.id), difficulty).toEqual([def.id]);
      expect(await stateOf(repo, def.id)).toBe('ready');
    }
    expect(await stateOf(repo, CASTLE_VORTEX_ACHIEVEMENT)).toBe('in_progress');
  });

  it('una partida que no cuenta no completa nada', async () => {
    const { repo } = fresh();
    for (const r of [
      result({ difficulty: 'tormenta', runMin: 10, end: 'quit', medal: null }),
      result({ difficulty: 'tormenta', runMin: 10, end: 'fallen', medal: 'bronce' }),
    ]) {
      expect(await recordCastleWin(repo, castleSignals(r, true))).toEqual([]);
    }
    expect(
      await recordCastleWin(repo, castleSignals(result({ difficulty: 'tormenta' }), false)),
    ).toEqual([]);
    for (const a of castleDefs) expect(await stateOf(repo, a.id), a.id).toBe('in_progress');
    expect(await repo.progress.discoveries()).toEqual([]);
  });
});

describe('la regata: «Primera regata» y «Rápido» (T176)', () => {
  const spec = { id: 'el-freu', version: 3 };

  it('terminar da «Primera regata»; bajo el umbral, también «Rápido» (una vez)', async () => {
    const { repo } = fresh();
    const slow = await finishLap(repo.progress, spec, RACE_FAST_MS + 5_000);
    expect(slow.achievements.map((n) => n.title)).toContain('Primera regata');
    expect(await stateOf(repo, RACE_FAST_ACHIEVEMENT)).toBe('in_progress');
    const fast = await finishLap(repo.progress, spec, RACE_FAST_MS - 1);
    expect(fast.achievements.map((n) => n.id)).toEqual([`logro:${RACE_FAST_ACHIEVEMENT}`]);
    expect((await finishLap(repo.progress, spec, RACE_FAST_MS - 2)).achievements).toEqual([]);
    expect((await repo.progress.claimAchievement(RACE_FAST_ACHIEVEMENT)).claimed).toBe(true);
    const shop = await repo.progress.shop();
    expect(shop.find((i) => i.cosmetic.id === TORTUGA_TURBO)?.owned).toBe(true);
  });
});

describe('lo de antes cuenta al abrir «Logros»', () => {
  it('las victorias del castillo de un documento v9 y un récord bajo el umbral', async () => {
    const storage = new MemoryStorage();
    const at = '2026-10-06T09:00:00.000Z';
    storage.setItem(
      STORE_KEY,
      JSON.stringify({
        ...emptyDoc(9),
        schemaVersion: 9,
        identity: { id: 'yo', kind: 'guest', createdAt: at },
        players: {
          yo: {
            discoveries: { 'circuito:el-freu': { at, worldId: 'arcilla' } },
            discounts: {},
            missions: {},
            records: {
              'logro-vuelta:el-freu': {
                id: 'logro-vuelta:el-freu',
                bestMs: RACE_FAST_MS - 500,
                bestAt: at,
                attempts: 4,
              },
            },
            counters: { [v10CastleMedalCounter(10, 'tormenta')]: 2 },
            equipped: {},
            prefs: {},
            achievements: {},
          },
        },
        ledger: [],
      }),
    );
    const repo = createLocalRepository({ storage, watch: false });
    await reconcileAchievementEvidence(repo);
    await reconcileAchievementEvidence(repo);
    for (const id of [CASTLE_STORM_ACHIEVEMENT, CASTLE_VORTEX_ACHIEVEMENT, RACE_FAST_ACHIEVEMENT]) {
      expect(await stateOf(repo, id), id).toBe('ready');
    }
    expect(await stateOf(repo, 'castillo-normal')).toBe('in_progress');
    // Nada se cobra solo.
    expect(await repo.progress.ledger()).toEqual([]);
  });
});
