import {
  type BossId,
  type DifficultyId,
  SURVIVORS_CONFIG,
  type SurvivorsConfig,
  type SurvivorsMedal,
  actFinalBoss,
} from '@boia/engine/survivors';
import { SAMPLE_CREW, type SampleCrewMember } from '@boia/store';

/**
 * El ranking por boss del Cañón (plan 013 T155, §9 del diseño): una tabla
 * por boss final (Barco Pirata Fantasma en el acto 1, Kraken en el 2), con
 * la mejor partida de cada uno. Como el del circuito (`ranking-circuit.ts`):
 * en modo local, tu mejor partida de este navegador entre la tripulación de
 * muestra; con cuentas, el ranking global (`ranking_canon`, migración
 * `…_canon_ranking.sql`), que valida lo mismo que aquí
 * (`canonRankRejection`).
 *
 * Puntuación de una partida = enemigos + notas + medalla + rapidez al vencer
 * al boss final, × el multiplicador de la dificultad. Todo `muestra`.
 */

/**
 * Versión de la tabla (la fórmula y sus topes). Va en la base
 * (`canon_boards.version`): cambiar la fórmula abre tablas nuevas; cambiar el
 * equilibrio del juego (`SURVIVORS_CONFIG_VERSION`) no.
 */
export const CANON_RANKING_VERSION = 1;

/** Lo que vale cada cosa de una partida. muestra */
export const CANON_SCORE = {
  perEnemy: 10,
  perNote: 5,
  medal: { bronce: 2000, plata: 4000, oro: 8000 } as Readonly<Record<SurvivorsMedal, number>>,
  /** Por cada segundo que faltaba para el amanecer al vencer al boss final. */
  speedPerS: 100,
  difficulty: { tranquila: 0.75, normal: 1, tormenta: 1.5 } as Readonly<
    Record<DifficultyId, number>
  >,
} as const;

/**
 * El antitrampas básico (como el de los tiempos de carrera, plan 008): una
 * partida que dura menos de `minS` o más que la noche no vale, ni una que
 * pase de `maxScore` (holgado: ~2 000 enemigos en una partida de Tormenta
 * dan unos 60 000). La base tiene los mismos números (`canon_boards`).
 */
export const CANON_RANKING_LIMITS = {
  minS: 30,
  /** Margen sobre los 7:00 de la noche (redondeos del reloj). */
  slackS: 1,
  maxScore: 170_000,
} as const;

/** Lo que hace falta de una partida acabada para su puntuación. */
export interface CanonScoreInput {
  defeated: number;
  notes: number;
  medal: SurvivorsMedal | null;
  /** s de tiempo activo. */
  playedS: number;
  difficulty: DifficultyId;
}

export interface CanonScore {
  total: number;
  enemies: number;
  notes: number;
  medal: number;
  speed: number;
  multiplier: number;
}

const count = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);

/** La puntuación de una partida (entera, nunca negativa). */
export function canonGameScore(
  r: CanonScoreInput,
  cfg: SurvivorsConfig = SURVIVORS_CONFIG,
): CanonScore {
  const enemies = count(r.defeated) * CANON_SCORE.perEnemy;
  const notes = count(r.notes) * CANON_SCORE.perNote;
  const medal = r.medal ? CANON_SCORE.medal[r.medal] : 0;
  // Rapidez: sólo con el boss final vencido (el oro), lo que faltaba para el amanecer.
  const speed =
    r.medal === 'oro' ? count(cfg.durationS - Math.max(0, r.playedS)) * CANON_SCORE.speedPerS : 0;
  const multiplier = CANON_SCORE.difficulty[r.difficulty] ?? 1;
  return {
    total: Math.round((enemies + notes + medal + speed) * multiplier),
    enemies,
    notes,
    medal,
    speed,
    multiplier,
  };
}

/** El boss de la tabla de un acto: su boss final (null si el acto no existe). */
export function canonBoardBoss(
  act: number,
  cfg: SurvivorsConfig = SURVIVORS_CONFIG,
): BossId | null {
  return actFinalBoss(act, cfg);
}

/** Los bosses con tabla: los finales de los actos de la config, en orden. */
export function canonBoardBosses(cfg: SurvivorsConfig = SURVIVORS_CONFIG): BossId[] {
  return [...new Set(cfg.acts.map((a) => actFinalBoss(a.act, cfg)).filter((b) => b !== null))];
}

/** El segundo en que entra el boss final del acto (antes, el oro no vale). */
export function canonGoldMinS(act: number, cfg: SurvivorsConfig = SURVIVORS_CONFIG): number {
  const ev = cfg.acts
    .find((a) => a.act === act)
    ?.events.find((e) => e.type === 'boss' && e.enabled !== false && cfg.bosses[e.ref as BossId]);
  return ev ? ev.atS : cfg.durationS;
}

/** Por qué una partida no entra en el ranking. */
export type CanonRankRejection =
  /** «Terminar partida» (T148). */
  | 'quit'
  /** Empezada con un atajo de desarrollo (decisión 8 del plan 013). */
  | 'test'
  /** La sesión no la validó (duración imposible, otra config…). */
  | 'invalid'
  /** El acto no tiene boss final. */
  | 'no_board'
  | 'too_short'
  | 'too_long'
  /** Oro antes de que entre el boss final, o bronce/plata antes del amanecer. */
  | 'medal_too_early'
  | 'score_too_high'
  | 'no_score';

export interface CanonRankCheck {
  /** Acabada con «Terminar partida» (`CanonResult.ranked === false`). */
  quit: boolean;
  /** Empezada con un atajo de desarrollo (`session.testStart`). */
  testStart: boolean;
  /**
   * El ayudante de las pruebas (`&ranking=1`, sólo en `pnpm dev` y las e2e):
   * deja entrar una partida de atajo en el ranking local. Nunca en el global.
   */
  testHelper?: boolean;
  /** La sesión la validó (`settlement.validation.valid`). */
  valid: boolean;
  act: number;
  medal: SurvivorsMedal | null;
  playedS: number;
  score: number;
}

/**
 * ¿Entra la partida en el ranking? null si sí; si no, por qué. Lo mismo que
 * comprueba `private.submit_canon_score` en la base (menos la sesión).
 */
export function canonRankRejection(
  g: CanonRankCheck,
  cfg: SurvivorsConfig = SURVIVORS_CONFIG,
): CanonRankRejection | null {
  if (g.quit) return 'quit';
  if (g.testStart && !g.testHelper) return 'test';
  if (!g.valid) return 'invalid';
  if (!canonBoardBoss(g.act, cfg)) return 'no_board';
  if (!(g.playedS >= CANON_RANKING_LIMITS.minS)) return 'too_short';
  if (g.playedS > cfg.durationS + CANON_RANKING_LIMITS.slackS) return 'too_long';
  if (g.medal === 'oro' && g.playedS < canonGoldMinS(g.act, cfg)) return 'medal_too_early';
  if ((g.medal === 'bronce' || g.medal === 'plata') && g.playedS < cfg.durationS - 1e-6) {
    return 'medal_too_early';
  }
  if (!(g.score > 0)) return 'no_score';
  if (g.score > CANON_RANKING_LIMITS.maxScore) return 'score_too_high';
  return null;
}

// --- La mejor partida de este navegador ---------------------------------------

/** La mejor partida de una tabla en este navegador. */
export interface CanonBest {
  score: number;
  at: string;
  medal: SurvivorsMedal | null;
  difficulty: DifficultyId;
  games: number;
}

export const CANON_BEST_KEY = 'boia.canon.ranking.v1';

/** Lo que se usa del almacenamiento (`localStorage` o uno falso en las pruebas). */
export interface CanonBestStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const canonBoardKey = (boss: string, version = CANON_RANKING_VERSION) =>
  `${boss}:v${version}`;

function readAll(storage: CanonBestStorage | null): Record<string, CanonBest> {
  if (!storage) return {};
  try {
    const raw = storage.getItem(CANON_BEST_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, CanonBest> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, Partial<CanonBest>>)) {
      if (v && typeof v.score === 'number' && v.score > 0 && typeof v.at === 'string') {
        out[k] = {
          score: v.score,
          at: v.at,
          medal: v.medal ?? null,
          difficulty: v.difficulty ?? 'normal',
          games: typeof v.games === 'number' && v.games > 0 ? v.games : 1,
        };
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** El `localStorage` del navegador, o null (servidor, o el navegador no deja). */
export function browserCanonStorage(): CanonBestStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Tu mejor partida contra `boss` en este navegador, o null. */
export function readCanonBest(
  storage: CanonBestStorage | null,
  boss: string,
  version = CANON_RANKING_VERSION,
): CanonBest | null {
  return readAll(storage)[canonBoardKey(boss, version)] ?? null;
}

/**
 * Apunta una partida que entra en el ranking: devuelve si es tu mejor y la
 * mejor (la de antes si esta no la supera). Si el navegador no deja
 * guardar, la de ahora cuenta como la mejor de la visita.
 */
export function recordCanonBest(
  storage: CanonBestStorage | null,
  boss: string,
  game: { score: number; at: string; medal: SurvivorsMedal | null; difficulty: DifficultyId },
  version = CANON_RANKING_VERSION,
): { best: boolean; record: CanonBest } {
  const all = readAll(storage);
  const key = canonBoardKey(boss, version);
  const prev = all[key];
  const best = !prev || game.score > prev.score;
  const record: CanonBest = best
    ? { ...game, games: (prev?.games ?? 0) + 1 }
    : { ...prev!, games: prev!.games + 1 };
  all[key] = record;
  try {
    storage?.setItem(CANON_BEST_KEY, JSON.stringify(all));
  } catch {
    // Sin almacenamiento, el récord dura lo que la visita (la tarjeta lo enseña igual).
  }
  return { best, record };
}

// --- El ranking local (tripulación de muestra) ---------------------------------

/**
 * La mejor partida de cada miembro de muestra contra cada boss final: uno
 * muy arriba, otro en medio y otro abajo. muestra
 */
export const SAMPLE_CANON_SCORES: Readonly<
  Partial<Record<BossId, Readonly<Record<string, number>>>>
> = {
  fantasma: {
    'muestra-pulpo-sonico': 41_850,
    'muestra-la-del-castillo': 27_300,
    'muestra-grumete-turron': 12_640,
  },
  kraken: {
    'muestra-pulpo-sonico': 46_200,
    'muestra-la-del-castillo': 30_950,
    'muestra-grumete-turron': 9_870,
  },
};

export interface CanonRow {
  userId: string;
  nickname: string | null;
  /** La mejor puntuación, o null si aún no hay. */
  score: number | null;
  /** Puesto (1 = la más alta), o null sin partida. */
  position: number | null;
  isMine: boolean;
  isSample: boolean;
}

export interface CanonRanking {
  rows: CanonRow[];
  mine: CanonRow;
}

function crewScores(boss: string, scores: typeof SAMPLE_CANON_SCORES) {
  return scores[boss as BossId] ?? {};
}

/** La tabla de un boss: los de muestra con partida y el visitante (sin partida, al final). */
export function canonRanking(
  me: { userId?: string; nickname: string | null; bestScore: number | null },
  boss: string,
  crew: readonly SampleCrewMember[] = SAMPLE_CREW,
  scores: typeof SAMPLE_CANON_SCORES = SAMPLE_CANON_SCORES,
): CanonRanking {
  const mine: CanonRow = {
    userId: me.userId ?? '',
    nickname: me.nickname,
    score: me.bestScore,
    position: null,
    isMine: true,
    isSample: false,
  };
  const table = crewScores(boss, scores);
  const others: CanonRow[] = crew.flatMap((c) => {
    const score = table[c.userId];
    return score === undefined
      ? []
      : [
          {
            userId: c.userId,
            nickname: c.nickname,
            score,
            position: null,
            isMine: false,
            isSample: true,
          },
        ];
  });
  const scored = [...others, ...(mine.score !== null ? [mine] : [])].sort(
    // A igualdad, el visitante delante (lo suyo es lo que importa aquí).
    (a, b) => b.score! - a.score! || Number(b.isMine) - Number(a.isMine),
  );
  scored.forEach((r, i) => (r.position = i + 1));
  return { rows: mine.score === null ? [...scored, mine] : scored, mine };
}

/** El puesto de una puntuación contra la tripulación de muestra: 1 más los que la superan, de cuántos. */
export function crewCanonPlace(
  score: number,
  boss: string,
  crew: readonly SampleCrewMember[] = SAMPLE_CREW,
  scores: typeof SAMPLE_CANON_SCORES = SAMPLE_CANON_SCORES,
): { position: number; of: number } {
  const table = crewScores(boss, scores);
  const others = crew.flatMap((c) => (table[c.userId] === undefined ? [] : [table[c.userId]!]));
  return { position: 1 + others.filter((s) => s > score).length, of: others.length + 1 };
}
