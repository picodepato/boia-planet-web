import { SURVIVORS_CONFIG, actFinalBoss } from '@boia/engine/survivors';
import { SAMPLE_CREW } from '@boia/store';
import { describe, expect, it } from 'vitest';
import {
  CANON_BEST_KEY,
  CANON_RANKING_LIMITS,
  CANON_SCORE,
  type CanonBestStorage,
  type CanonRankCheck,
  SAMPLE_CANON_SCORES,
  canonBoardBoss,
  canonBoardBosses,
  canonGameScore,
  canonGoldMinS,
  canonRankRejection,
  canonRanking,
  crewCanonPlace,
  readCanonBest,
  recordCanonBest,
} from './ranking-canon';

const night = SURVIVORS_CONFIG.durationS;

function memoryStorage(): CanonBestStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

describe('puntuación de una partida del Cañón (T155)', () => {
  it('enemigos + notas + medalla, por la dificultad', () => {
    const s = canonGameScore({
      defeated: 1200,
      notes: 300,
      medal: 'bronce',
      playedS: night,
      difficulty: 'normal',
    });
    const raw = 1200 * CANON_SCORE.perEnemy + 300 * CANON_SCORE.perNote + CANON_SCORE.medal.bronce;
    expect(s).toMatchObject({
      enemies: 1200 * CANON_SCORE.perEnemy,
      notes: 300 * CANON_SCORE.perNote,
      medal: CANON_SCORE.medal.bronce,
      speed: 0,
    });
    expect(s.total).toBe(Math.round(raw * CANON_SCORE.difficulty.normal));
    const storm = canonGameScore({
      defeated: 1200,
      notes: 300,
      medal: 'bronce',
      playedS: night,
      difficulty: 'tormenta',
    });
    expect(storm.total).toBe(Math.round(raw * CANON_SCORE.difficulty.tormenta));
    expect(storm.total).toBeGreaterThan(s.total);
  });

  it('rapidez: sólo con el oro, por cada segundo que faltaba para el amanecer', () => {
    const at = canonGoldMinS(1) + 20;
    const gold = canonGameScore({
      defeated: 0,
      notes: 0,
      medal: 'oro',
      playedS: at,
      difficulty: 'normal',
    });
    expect(gold.speed).toBe(Math.floor(night - at) * CANON_SCORE.speedPerS);
    expect(gold.total).toBe(CANON_SCORE.medal.oro + gold.speed);
    const later = canonGameScore({
      defeated: 0,
      notes: 0,
      medal: 'oro',
      playedS: at + 30,
      difficulty: 'normal',
    });
    expect(later.total).toBeLessThan(gold.total);
    // Inundado: ni medalla ni rapidez.
    const sunk = canonGameScore({
      defeated: 10,
      notes: 4,
      medal: null,
      playedS: 200,
      difficulty: 'normal',
    });
    expect(sunk.total).toBe(10 * CANON_SCORE.perEnemy + 4 * CANON_SCORE.perNote);
  });

  it('nunca negativa ni con decimales raros', () => {
    expect(
      canonGameScore({
        defeated: -5,
        notes: Number.NaN,
        medal: null,
        playedS: 0,
        difficulty: 'tranquila',
      }).total,
    ).toBe(0);
    expect(
      Number.isInteger(
        canonGameScore({ defeated: 3, notes: 1, medal: null, playedS: 50, difficulty: 'tranquila' })
          .total,
      ),
    ).toBe(true);
  });
});

describe('una tabla por boss final', () => {
  it('el acto 1 es el Barco Fantasma y el 2 el Kraken; sin acto 3', () => {
    expect(canonBoardBoss(1)).toBe(actFinalBoss(1));
    expect(canonBoardBoss(2)).toBe(actFinalBoss(2));
    expect(canonBoardBoss(1)).not.toBe(canonBoardBoss(2));
    expect(canonBoardBoss(3)).toBeNull();
    expect(canonBoardBosses()).toEqual([actFinalBoss(1), actFinalBoss(2)]);
    // Cada tabla tiene su tripulación de muestra.
    for (const boss of canonBoardBosses()) expect(SAMPLE_CANON_SCORES[boss]).toBeDefined();
  });

  it('la mejor de este navegador se guarda por boss: una no pisa la otra', () => {
    const st = memoryStorage();
    const [a, b] = canonBoardBosses() as [string, string];
    expect(readCanonBest(st, a)).toBeNull();
    const game = { at: '2026-10-05T20:00:00.000Z', medal: null, difficulty: 'normal' as const };
    expect(recordCanonBest(st, a, { ...game, score: 5000 })).toMatchObject({
      best: true,
      record: { score: 5000, games: 1 },
    });
    expect(recordCanonBest(st, a, { ...game, score: 3000 })).toMatchObject({
      best: false,
      record: { score: 5000, games: 2 },
    });
    expect(recordCanonBest(st, b, { ...game, score: 1000 })).toMatchObject({
      best: true,
      record: { score: 1000, games: 1 },
    });
    expect(readCanonBest(st, a)?.score).toBe(5000);
    expect(readCanonBest(st, b)?.score).toBe(1000);
    expect(recordCanonBest(st, a, { ...game, score: 9000 }).best).toBe(true);
    expect(readCanonBest(st, a)).toMatchObject({ score: 9000, games: 3 });
    expect(readCanonBest(st, b)?.score).toBe(1000);
    // Otra versión de la fórmula es otra tabla.
    expect(readCanonBest(st, a, 2)).toBeNull();
  });

  it('almacenamiento roto o sin permiso: nada se rompe', () => {
    const broken: CanonBestStorage = {
      getItem: () => {
        throw new Error('no');
      },
      setItem: () => {
        throw new Error('no');
      },
    };
    expect(readCanonBest(broken, 'fantasma')).toBeNull();
    expect(
      recordCanonBest(broken, 'fantasma', { score: 10, at: 'x', medal: null, difficulty: 'normal' })
        .best,
    ).toBe(true);
    const junk = memoryStorage();
    junk.data.set(CANON_BEST_KEY, '{"fantasma:v1":{"score":"mucho"}}');
    expect(readCanonBest(junk, 'fantasma')).toBeNull();
    expect(readCanonBest(null, 'fantasma')).toBeNull();
  });

  it('ranking local: la tripulación de muestra de ese boss y el visitante en su puesto', () => {
    for (const boss of canonBoardBosses()) {
      const scores = SAMPLE_CANON_SCORES[boss]!;
      const withScore = SAMPLE_CREW.filter((c) => scores[c.userId] !== undefined);
      const sorted = [...withScore].sort((x, y) => scores[y.userId]! - scores[x.userId]!);
      const none = canonRanking({ nickname: null, bestScore: null }, boss);
      expect(none.rows.map((r) => r.userId)).toEqual([...sorted.map((c) => c.userId), '']);
      expect(none.mine.position).toBeNull();
      const top = scores[sorted[0]!.userId]!;
      const first = canonRanking({ nickname: null, bestScore: top + 1 }, boss);
      expect(first.rows[0]).toBe(first.mine);
      expect(first.mine.position).toBe(1);
      expect(crewCanonPlace(top + 1, boss)).toEqual({ position: 1, of: withScore.length + 1 });
      expect(crewCanonPlace(1, boss)).toEqual({
        position: withScore.length + 1,
        of: withScore.length + 1,
      });
    }
    // Las tablas no se mezclan: el mismo visitante, otro puesto en cada boss.
    const [a, b] = canonBoardBosses() as [string, string];
    const mid =
      (SAMPLE_CANON_SCORES.fantasma!['muestra-pulpo-sonico']! +
        SAMPLE_CANON_SCORES.kraken!['muestra-pulpo-sonico']!) /
      2;
    expect(crewCanonPlace(mid, a)).not.toEqual(crewCanonPlace(mid, b));
  });
});

describe('qué partidas entran en el ranking', () => {
  const ok: CanonRankCheck = {
    quit: false,
    testStart: false,
    valid: true,
    act: 1,
    medal: 'bronce',
    playedS: night,
    score: 20_000,
  };

  it('una partida normal entra (también inundada)', () => {
    expect(canonRankRejection(ok)).toBeNull();
    expect(canonRankRejection({ ...ok, medal: null, playedS: 200 })).toBeNull();
    expect(
      canonRankRejection({ ...ok, act: 2, medal: 'oro', playedS: canonGoldMinS(2) + 1 }),
    ).toBeNull();
  });

  it('«Terminar partida» nunca', () => {
    expect(canonRankRejection({ ...ok, quit: true })).toBe('quit');
    expect(canonRankRejection({ ...ok, quit: true, testHelper: true })).toBe('quit');
  });

  it('una partida de atajo nunca, salvo con el ayudante de las pruebas', () => {
    expect(canonRankRejection({ ...ok, testStart: true })).toBe('test');
    expect(canonRankRejection({ ...ok, testStart: true, testHelper: true })).toBeNull();
  });

  it('tiempos imposibles, la sesión no válida y puntuaciones de más', () => {
    expect(canonRankRejection({ ...ok, valid: false })).toBe('invalid');
    expect(canonRankRejection({ ...ok, medal: null, playedS: CANON_RANKING_LIMITS.minS - 1 })).toBe(
      'too_short',
    );
    expect(canonRankRejection({ ...ok, playedS: night + CANON_RANKING_LIMITS.slackS + 1 })).toBe(
      'too_long',
    );
    expect(canonRankRejection({ ...ok, medal: 'oro', playedS: canonGoldMinS(1) - 1 })).toBe(
      'medal_too_early',
    );
    expect(canonRankRejection({ ...ok, medal: 'plata', playedS: night - 10 })).toBe(
      'medal_too_early',
    );
    expect(canonRankRejection({ ...ok, score: CANON_RANKING_LIMITS.maxScore + 1 })).toBe(
      'score_too_high',
    );
    expect(canonRankRejection({ ...ok, score: 0 })).toBe('no_score');
    expect(canonRankRejection({ ...ok, act: 3 })).toBe('no_board');
  });

  it('el tope de puntuación deja sitio a la mejor partida posible', () => {
    // Una partida muy buena en Tormenta: el oro nada más entrar el boss, con miles de enemigos.
    const great = canonGameScore({
      defeated: 3000,
      notes: 2000,
      medal: 'oro',
      playedS: canonGoldMinS(1),
      difficulty: 'tormenta',
    });
    expect(great.total).toBeLessThan(CANON_RANKING_LIMITS.maxScore);
  });
});
