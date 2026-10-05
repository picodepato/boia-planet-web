import { type BossId, SURVIVORS_CONFIG, type SurvivorsConfig } from '@boia/engine/survivors';
import type { CanonSubmission, MemberCanonStanding } from '../../lib/mundo/ranking-canon-global';
import {
  type CanonBestStorage,
  type CanonRankRejection,
  canonBoardBoss,
  canonGameScore,
  canonRankRejection,
  crewCanonPlace,
  readCanonBest,
  recordCanonBest,
} from '../../lib/mundo/ranking-canon';
import type { CanonResult } from './canon-hud-model';

/**
 * El ranking de una partida acabada del Cañón (plan 013 T155), para la
 * tarjeta final: su puntuación, tu mejor contra el boss final del acto y tu
 * puesto. Decide si la partida entra (`canonRankRejection`: nunca las de
 * «Terminar partida», las de atajo ni las que la sesión no validó) y la
 * apunta como mejor de este navegador; con cuenta, la manda al ranking
 * global y espera su puesto.
 */

/** Dónde está el puesto. */
export type CanonStanding =
  /** No entra en el ranking, y por qué. */
  | { kind: 'off'; reason: CanonRankRejection }
  /** Modo local: contra la tripulación de muestra. */
  | { kind: 'local'; position: number; of: number }
  /** Con cuenta: mandándose y leyendo el puesto. */
  | { kind: 'loading' }
  | { kind: 'global'; position: number; total: number }
  /** Con Supabase y sin cuenta: tu mejor se queda en este navegador. */
  | { kind: 'guest' }
  /** Con cuenta, pero sin red o la base no la aceptó. */
  | { kind: 'unavailable' };

export interface CanonRankingOutcome {
  /** El boss final de la tabla (null: el acto no tiene). */
  boss: BossId | null;
  /** La puntuación de esta partida. */
  score: number;
  /** Tu mejor contra este boss (contando esta), o null. */
  best: number | null;
  /** Esta partida es tu mejor. */
  isBest: boolean;
  standing: CanonStanding;
}

export interface CanonRankDeps {
  /** `local` sin Supabase; `member` con cuenta y Carnet; `guest` el resto. */
  mode: 'local' | 'member' | 'guest';
  storage: CanonBestStorage | null;
  /** Manda la partida y lee el puesto (`memberCanonStanding`). */
  submit: (s: CanonSubmission) => Promise<MemberCanonStanding>;
  now?: () => Date;
}

export interface CanonRankGame {
  result: CanonResult;
  /** Empezada con un atajo de desarrollo (`session.testStart`). */
  testStart: boolean;
  /** El ayudante `&ranking=1` (sólo en `pnpm dev` y las e2e): sólo cuenta en modo local. */
  testHelper?: boolean;
  /** La sesión la validó. */
  valid: boolean;
}

/**
 * La puntuación y el puesto de una partida: lo que se sabe ya (`now`) y, con
 * cuenta, la promesa del puesto global (`later`).
 */
export function rankCanonGame(
  g: CanonRankGame,
  deps: CanonRankDeps,
  cfg: SurvivorsConfig = SURVIVORS_CONFIG,
): { now: CanonRankingOutcome; later: Promise<CanonRankingOutcome> | null } {
  const r = g.result;
  const score = canonGameScore(
    {
      defeated: r.defeated,
      notes: r.notes,
      medal: r.medal,
      playedS: r.playedS,
      difficulty: r.difficulty,
    },
    cfg,
  ).total;
  const boss = canonBoardBoss(r.act, cfg);
  const rejection = canonRankRejection(
    {
      quit: !r.ranked,
      testStart: g.testStart,
      // El ayudante de las pruebas nunca manda nada a la base.
      testHelper: g.testHelper === true && deps.mode === 'local',
      valid: g.valid,
      act: r.act,
      medal: r.medal,
      playedS: r.playedS,
      score,
    },
    cfg,
  );
  if (rejection || !boss) {
    return {
      now: {
        boss,
        score,
        best: boss ? (readCanonBest(deps.storage, boss)?.score ?? null) : null,
        isBest: false,
        standing: { kind: 'off', reason: rejection ?? 'no_board' },
      },
      later: null,
    };
  }
  const at = (deps.now?.() ?? new Date()).toISOString();
  const { best, record } = recordCanonBest(deps.storage, boss, {
    score,
    at,
    medal: r.medal,
    difficulty: r.difficulty,
  });
  const base = { boss, score, best: record.score, isBest: best };
  if (deps.mode === 'local') {
    return {
      now: { ...base, standing: { kind: 'local', ...crewCanonPlace(record.score, boss) } },
      later: null,
    };
  }
  if (deps.mode === 'guest') return { now: { ...base, standing: { kind: 'guest' } }, later: null };
  const later = deps
    .submit({
      boss,
      score,
      ms: Math.round(r.playedS * 1000),
      medal: r.medal,
      difficulty: r.difficulty,
    })
    .then(
      (s): CanonRankingOutcome =>
        s.kind === 'global'
          ? {
              ...base,
              best: s.bestScore,
              isBest: s.best,
              standing: { kind: 'global', position: s.position, total: s.total },
            }
          : { ...base, standing: { kind: 'unavailable' } },
      (): CanonRankingOutcome => ({ ...base, standing: { kind: 'unavailable' } }),
    );
  return { now: { ...base, standing: { kind: 'loading' } }, later };
}
