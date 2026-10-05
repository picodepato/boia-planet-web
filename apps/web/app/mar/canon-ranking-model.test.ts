import { SURVIVORS_CONFIG, actFinalBoss } from '@boia/engine/survivors';
import { describe, expect, it, vi } from 'vitest';
import type { CanonSubmission } from '../../lib/mundo/ranking-canon-global';
import {
  type CanonBestStorage,
  canonGameScore,
  crewCanonPlace,
  readCanonBest,
} from '../../lib/mundo/ranking-canon';
import type { CanonResult } from './canon-hud-model';
import { type CanonRankDeps, rankCanonGame } from './canon-ranking-model';

function memoryStorage(): CanonBestStorage {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

const result = (o: Partial<CanonResult> = {}): CanonResult => ({
  reason: 'survived',
  ranked: true,
  playedS: SURVIVORS_CONFIG.durationS,
  defeated: 900,
  notes: 200,
  level: 12,
  medal: 'bronce',
  act: 1,
  difficulty: 'normal',
  bosses: [],
  weapons: [],
  vinyls: [],
  ...o,
});

const scoreOf = (r: CanonResult) =>
  canonGameScore({
    defeated: r.defeated,
    notes: r.notes,
    medal: r.medal,
    playedS: r.playedS,
    difficulty: r.difficulty,
  }).total;

function deps(
  mode: CanonRankDeps['mode'],
  submit = vi.fn(),
): CanonRankDeps & { submit: typeof submit } {
  return { mode, storage: memoryStorage(), submit, now: () => new Date('2026-10-05T21:00:00Z') };
}

describe('el ranking de una partida acabada (T155)', () => {
  it('modo local: puntuación, tu mejor de este navegador y el puesto entre la tripulación de muestra', () => {
    const d = deps('local');
    const r = result();
    const { now, later } = rankCanonGame({ result: r, testStart: false, valid: true }, d);
    const boss = actFinalBoss(1)!;
    expect(later).toBeNull();
    expect(now).toMatchObject({ boss, score: scoreOf(r), best: scoreOf(r), isBest: true });
    expect(now.standing).toEqual({ kind: 'local', ...crewCanonPlace(scoreOf(r), boss) });
    expect(readCanonBest(d.storage, boss)?.score).toBe(scoreOf(r));
    // Una peor después: el puesto es el de tu mejor.
    const worse = result({ defeated: 10, notes: 0, medal: null, playedS: 100, reason: 'flooded' });
    const again = rankCanonGame({ result: worse, testStart: false, valid: true }, d).now;
    expect(again).toMatchObject({ score: scoreOf(worse), best: scoreOf(r), isBest: false });
    expect(again.standing).toEqual({ kind: 'local', ...crewCanonPlace(scoreOf(r), boss) });
    expect(d.submit).not.toHaveBeenCalled();
  });

  it('cada acto va a la tabla de su boss final', () => {
    const d = deps('local');
    const one = rankCanonGame({ result: result({ act: 1 }), testStart: false, valid: true }, d).now;
    const two = rankCanonGame(
      { result: result({ act: 2, defeated: 10 }), testStart: false, valid: true },
      d,
    ).now;
    expect(one.boss).toBe(actFinalBoss(1));
    expect(two.boss).toBe(actFinalBoss(2));
    expect(two.isBest).toBe(true);
    expect(readCanonBest(d.storage, actFinalBoss(1)!)?.score).toBe(one.score);
    expect(readCanonBest(d.storage, actFinalBoss(2)!)?.score).toBe(two.score);
  });

  it('con cuenta: la manda al ranking global y espera el puesto', async () => {
    const submit = vi.fn(async (_s: CanonSubmission) => ({
      kind: 'global' as const,
      position: 3,
      total: 40,
      bestScore: 99_000,
      best: false,
    }));
    const d = deps('member', submit);
    const r = result({
      reason: 'victory',
      medal: 'oro',
      playedS: 360,
      difficulty: 'tormenta',
      act: 2,
    });
    const { now, later } = rankCanonGame({ result: r, testStart: false, valid: true }, d);
    expect(now.standing).toEqual({ kind: 'loading' });
    expect(submit).toHaveBeenCalledWith({
      boss: actFinalBoss(2),
      score: scoreOf(r),
      ms: 360_000,
      medal: 'oro',
      difficulty: 'tormenta',
    });
    expect(await later).toMatchObject({
      score: scoreOf(r),
      best: 99_000,
      isBest: false,
      standing: { kind: 'global', position: 3, total: 40 },
    });
  });

  it('con cuenta y sin red: el puesto no está, la partida queda en el navegador', async () => {
    const d = deps(
      'member',
      vi.fn(async () => Promise.reject(new Error('sin red'))),
    );
    const { later } = rankCanonGame({ result: result(), testStart: false, valid: true }, d);
    expect((await later)?.standing).toEqual({ kind: 'unavailable' });
    expect(readCanonBest(d.storage, actFinalBoss(1)!)).not.toBeNull();
  });

  it('invitado con Supabase: tu mejor en el navegador, sin mandar nada', () => {
    const d = deps('guest');
    const { now, later } = rankCanonGame({ result: result(), testStart: false, valid: true }, d);
    expect(now.standing).toEqual({ kind: 'guest' });
    expect(later).toBeNull();
    expect(d.submit).not.toHaveBeenCalled();
  });

  it('no entran ni se mandan: «Terminar partida», atajos, sesión no válida, tiempos imposibles', () => {
    const cases: [Parameters<typeof rankCanonGame>[0], string][] = [
      [
        {
          result: result({ reason: 'quit', ranked: false, medal: null }),
          testStart: false,
          valid: true,
        },
        'quit',
      ],
      [{ result: result(), testStart: true, valid: true }, 'test'],
      [{ result: result(), testStart: false, valid: false }, 'invalid'],
      [
        {
          result: result({ medal: null, playedS: 5, reason: 'flooded' }),
          testStart: false,
          valid: true,
        },
        'too_short',
      ],
      [
        {
          result: result({ medal: 'oro', playedS: 100, reason: 'victory' }),
          testStart: false,
          valid: true,
        },
        'medal_too_early',
      ],
    ];
    for (const mode of ['local', 'member', 'guest'] as const) {
      for (const [game, reason] of cases) {
        const d = deps(mode);
        const { now, later } = rankCanonGame(game, d);
        expect(now.standing, `${mode} ${reason}`).toEqual({ kind: 'off', reason });
        expect(now.isBest).toBe(false);
        expect(later).toBeNull();
        expect(d.submit).not.toHaveBeenCalled();
        expect(readCanonBest(d.storage, actFinalBoss(1)!)).toBeNull();
      }
    }
  });

  it('el ayudante de las pruebas (`&ranking=1`) sólo vale en el ranking local', () => {
    const local = deps('local');
    const game = { result: result(), testStart: true, testHelper: true, valid: true };
    expect(rankCanonGame(game, local).now.standing.kind).toBe('local');
    const member = deps('member');
    expect(rankCanonGame(game, member).now.standing).toEqual({ kind: 'off', reason: 'test' });
    expect(member.submit).not.toHaveBeenCalled();
  });
});
