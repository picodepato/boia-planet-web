import {
  DEFENSE_CONFIG,
  DEFENSE_RUN_MINS,
  chasePlaneBot,
  createDefense,
  defenseCastleMaxLives,
} from '@boia/engine/defense';
import { describe, expect, it } from 'vitest';
import { castleResult, memoryCastleStorage as memoryStorage } from './__fixtures__/castle-result';
import {
  CASTLE_BEST_KEY,
  CASTLE_DIFFICULTIES,
  SAMPLE_CASTLE_SCORES,
  castleBoardKey,
  castleMaxKillPoints,
  castleRankRejection,
  castleRanking,
  readCastleBest,
  recordCastleBest,
} from './ranking-castle';

describe('ranking del Castillo: nueve tablas y puntuación de la sim', () => {
  it('separa todas las duraciones, dificultades y versiones; cada una tiene muestra', () => {
    const storage = memoryStorage();
    for (const runMin of DEFENSE_RUN_MINS)
      for (const difficulty of CASTLE_DIFFICULTIES) {
        expect(readCastleBest(storage, runMin, difficulty)).toBeNull();
        const r = castleResult({ runMin, difficulty });
        expect(recordCastleBest(storage, r, '2026-10-06')).not.toBeNull();
        expect(readCastleBest(storage, runMin, difficulty)?.score).toBe(r.score);
        expect(castleRanking(r.score, runMin, difficulty).rows).toHaveLength(4);
      }
    expect(Object.keys(JSON.parse(storage.getItem(CASTLE_BEST_KEY)!))).toHaveLength(9);
    expect(Object.keys(SAMPLE_CASTLE_SCORES)).toHaveLength(9);
    expect(castleBoardKey(5, 'normal', 2)).not.toBe(castleBoardKey(5, 'normal'));
  });
  it('ordena descendente, comparte puesto en empates y conserva el mejor ante empate o peor', () => {
    const storage = memoryStorage();
    const high = castleResult({ castleLife: 90 });
    expect(recordCastleBest(storage, high, 'primera')?.best).toBe(true);
    expect(recordCastleBest(storage, high, 'empate')?.best).toBe(false);
    expect(recordCastleBest(storage, castleResult(), 'peor')?.best).toBe(false);
    expect(readCastleBest(storage, 5, 'normal')).toEqual({
      score: high.score,
      at: 'primera',
      games: 3,
    });
    const tie = Object.values(SAMPLE_CASTLE_SCORES[castleBoardKey(5, 'normal')]!)[1]!;
    const table = castleRanking(tie, 5, 'normal');
    expect(table.rows.map((r) => r.score)).toEqual(
      [...table.rows.map((r) => r.score!)].sort((a, b) => b - a),
    );
    expect(table.mine.position).toBe(2);
    expect(table.rows.filter((r) => r.position === 2)).toHaveLength(2);
    expect(castleRanking(null, 5, 'normal').mine.position).toBeNull();
  });
  it('acepta un resultado real, incluyendo caídas con puntos pero sin medalla', () => {
    const game = createDefense(DEFENSE_CONFIG, 7);
    while (!game.result()) game.step();
    const result = game.result()!;
    expect(result.score).toBeGreaterThan(0);
    expect(castleRankRejection(result)).toBeNull();
    expect(recordCastleBest(memoryStorage(), result, 'ahora')?.record.score).toBe(result.score);
    expect(castleRankRejection(castleResult({ end: 'fallen', playedS: 80 }))).toBeNull();
  });
  it('acepta el castillo mejorado y las oleadas llamadas antes (plan 015 T169)', () => {
    // Un castillo con dos mejoras de vida: la vida máxima es la de su nivel.
    const lives = defenseCastleMaxLives(DEFENSE_CONFIG);
    const upgraded = lives[2]!;
    expect(
      castleRankRejection(
        castleResult({ castleLife: upgraded * 0.8, castleMaxLife: upgraded, castleLevel: 3 }),
      ),
    ).toBeNull();
    expect(
      castleRankRejection(castleResult({ castleLife: 60, castleMaxLife: lives[0]! + 1 })),
    ).toBe('invalid');
    // Una partida real que llama todas las oleadas y cae: lo salido cuenta con lo adelantado.
    const game = createDefense(DEFENSE_CONFIG, 7);
    game.step();
    while (game.callWave());
    while (!game.result()) game.step(chasePlaneBot(game.snapshot()));
    const result = game.result()!;
    expect(result.wavesAheadS).toBeGreaterThan(0);
    expect(result.kills).toBeGreaterThan(0);
    expect(castleRankRejection(result)).toBeNull();
    expect(castleRankRejection({ ...result, wavesAheadS: -1 })).toBe('invalid');
  });
  it.each([
    [{ ranked: false }, 'test'],
    [{ end: 'quit' }, 'quit'],
    [{ end: 'abandoned' }, 'quit'],
    [{ playedS: 29 }, 'too_short'],
    [{ playedS: 301.01 }, 'too_long'],
    [{ playedS: NaN }, 'invalid'],
    [{ playedS: Infinity }, 'invalid'],
    [{ playedS: 299 }, 'medal_too_early'],
    [{ score: Infinity }, 'no_score'],
    [{ score: 0 }, 'no_score'],
    [{ score: 1.5 }, 'no_score'],
    [{ castleLife: NaN }, 'invalid'],
    [{ castleLife: 101 }, 'invalid'],
    [{ configVersion: -1 }, 'invalid'],
    [{ durationS: 420 }, 'invalid'],
    [{ difficulty: 'facil' }, 'no_board'],
    [{ runMin: 8 }, 'no_board'],
    [{ score: 10000 }, 'invalid'],
    [{ killsByKind: { piranha: 999999 } }, 'score_too_high'],
    [{ killsByKind: { kraken: 1 } }, 'score_too_high'],
  ] as const)('rechaza %j sin modificar el récord (%s)', (overrides, reason) => {
    const storage = memoryStorage();
    const result = { ...castleResult(), ...overrides } as unknown as ReturnType<
      typeof castleResult
    >;
    expect(castleRankRejection(result)).toBe(reason);
    expect(recordCastleBest(storage, result, 'ahora')).toBeNull();
    expect(storage.getItem(CASTLE_BEST_KEY)).toBeNull();
  });
  it('medallas y tiempos propios: bronce desde la mitad, oro/plata al final; fallen también en el último tick', () => {
    for (const runMin of DEFENSE_RUN_MINS) {
      const duration = DEFENSE_CONFIG.runs[runMin].durationS;
      expect(
        castleRankRejection(castleResult({ runMin, end: 'fallen', playedS: duration / 2 })),
      ).toBeNull();
      expect(
        castleRankRejection(
          castleResult({ runMin, end: 'fallen', playedS: duration / 2 - 1, medal: 'bronce' }),
        ),
      ).toBe('medal_too_early');
      expect(
        castleRankRejection(castleResult({ runMin, end: 'fallen', playedS: duration })),
      ).toBeNull();
      expect(castleRankRejection(castleResult({ runMin, castleLife: 50 }))).toBeNull();
      expect(castleRankRejection(castleResult({ runMin, castleLife: 50, medal: 'oro' }))).toBe(
        'invalid',
      );
      expect(castleMaxKillPoints(runMin, 'normal')).toBeGreaterThan(0);
    }
  });
  it('storage roto, no disponible o mal formado no rompe el juego', () => {
    const broken = {
      getItem: () => {
        throw Error('denied');
      },
      setItem: () => {
        throw Error('denied');
      },
    };
    expect(readCastleBest(broken, 5, 'normal')).toBeNull();
    expect(recordCastleBest(broken, castleResult(), 'ahora')?.best).toBe(true);
    const storage = memoryStorage();
    for (const raw of [
      'bad JSON',
      '[]',
      'null',
      '{"5:normal:v1":{"score":1e999,"at":"now","games":1}}',
    ]) {
      storage.setItem(CASTLE_BEST_KEY, raw);
      expect(readCastleBest(storage, 5, 'normal')).toBeNull();
    }
  });
});
