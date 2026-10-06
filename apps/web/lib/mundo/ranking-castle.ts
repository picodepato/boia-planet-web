import {
  DEFENSE_CONFIG,
  DEFENSE_CONFIG_VERSION,
  DEFENSE_RUN_MINS,
  type DefenseEnemyKind,
  type DefenseResult,
  type DefenseRunMin,
  type DifficultyId,
  defenseCastleMaxLives,
  defenseEnemyDef,
  defenseMedal,
  defenseSchedule,
  defenseScore,
} from '@boia/engine/defense';
import { SAMPLE_CREW } from '@boia/store';

/** Tablas y tripulación de muestra del Castillo (T163), independientes del Cañón. */
export const CASTLE_RANKING_VERSION = 1;
export const CASTLE_RANKING_LIMITS = { minS: 30, slackS: 1 } as const;
export const CASTLE_DIFFICULTIES: readonly DifficultyId[] = ['tranquila', 'normal', 'tormenta'];
export const CASTLE_BEST_KEY = 'boia.castillo.ranking.v1';

export const castleBoardKey = (
  runMin: DefenseRunMin,
  difficulty: DifficultyId,
  version = CASTLE_RANKING_VERSION,
) => `${runMin}:${difficulty}:v${version}`;

/** Nadie puede matar más enemigos que los que salen en este calendario. */
export function castleMaxKillPoints(runMin: DefenseRunMin, difficulty: DifficultyId): number {
  return defenseSchedule(DEFENSE_CONFIG, runMin, difficulty).reduce(
    (sum, spawn) => sum + defenseEnemyDef(DEFENSE_CONFIG, spawn.kind)!.points,
    0,
  );
}

export type CastleRankRejection =
  | 'quit'
  | 'test'
  | 'invalid'
  | 'no_board'
  | 'too_short'
  | 'too_long'
  | 'medal_too_early'
  | 'score_too_high'
  | 'no_score';

/** La puntuación viene de la simulación; sólo comprobamos su plausibilidad. Sin excepciones para atajos. */
export function castleRankRejection(r: DefenseResult): CastleRankRejection | null {
  if (r.end === 'quit' || r.end === 'abandoned') return 'quit';
  if (!r.ranked) return 'test';
  if (!DEFENSE_RUN_MINS.includes(r.runMin) || !CASTLE_DIFFICULTIES.includes(r.difficulty))
    return 'no_board';
  const duration = DEFENSE_CONFIG.runs[r.runMin].durationS;
  if (
    r.configVersion !== DEFENSE_CONFIG_VERSION ||
    r.durationS !== duration ||
    !['held', 'fallen'].includes(r.end) ||
    !Number.isFinite(r.playedS)
  )
    return 'invalid';
  if (r.playedS < CASTLE_RANKING_LIMITS.minS) return 'too_short';
  if (r.playedS > duration + CASTLE_RANKING_LIMITS.slackS) return 'too_long';
  // Redondeo de la simulación a ms (igual que la RPC).
  const ms = Math.round(r.playedS * 1000);
  if (r.end === 'held' && ms < duration * 1000) return 'medal_too_early';
  if (r.medal === 'bronce' && ms < duration * 500) return 'medal_too_early';
  if (!Number.isSafeInteger(r.score) || r.score <= 0) return 'no_score';
  if (
    !Number.isFinite(r.castleLife) ||
    r.castleLife < 0 ||
    r.castleLife > r.castleMaxLife ||
    // La vida máxima es la de un nivel del castillo (sus mejoras: plan 015 T169).
    !defenseCastleMaxLives(DEFENSE_CONFIG).includes(r.castleMaxLife) ||
    (r.end === 'held' ? r.castleLife <= 0 : r.castleLife !== 0)
  )
    return 'invalid';
  if (
    r.medal !==
    defenseMedal({
      end: r.end,
      castleLife: r.castleLife,
      castleMaxLife: r.castleMaxLife,
      activeS: ms / 1000,
      durationS: duration,
    })
  )
    return 'invalid';
  const score = defenseScore({
    end: r.end,
    killPoints: r.killPoints,
    castleLife: r.castleLife,
    castleMaxLife: r.castleMaxLife,
  });
  if (score.total !== r.score || score.lifeBonus !== r.lifeBonus) return 'invalid';
  // «Llamar oleada» adelanta el calendario: sale lo de `playedS + wavesAheadS`.
  const ahead = r.wavesAheadS ?? 0;
  if (!Number.isFinite(ahead) || ahead < 0 || ahead > duration) return 'invalid';
  const spawned = new Map<DefenseEnemyKind, number>();
  for (const s of defenseSchedule(DEFENSE_CONFIG, r.runMin, r.difficulty)) {
    if (s.atS <= r.playedS + ahead + 1e-6) spawned.set(s.kind, (spawned.get(s.kind) ?? 0) + 1);
  }
  let kills = 0;
  let points = 0;
  for (const [kind, n] of Object.entries(r.killsByKind)) {
    const def = defenseEnemyDef(DEFENSE_CONFIG, kind as DefenseEnemyKind);
    if (!def || !Number.isSafeInteger(n) || n < 0 || n > (spawned.get(def.kind) ?? 0))
      return 'score_too_high';
    kills += n;
    points += n * def.points;
  }
  if (kills !== r.kills || points !== r.killPoints) return 'invalid';
  if (
    r.score >
    castleMaxKillPoints(r.runMin, r.difficulty) +
      (r.end === 'held' ? DEFENSE_CONFIG.score.lifeBonus : 0)
  )
    return 'score_too_high';
  return null;
}

export interface CastleBest {
  score: number;
  at: string;
  games: number;
}
export interface CastleBestStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
function readAll(storage: CastleBestStorage | null): Record<string, CastleBest> {
  try {
    const raw: unknown = JSON.parse(storage?.getItem(CASTLE_BEST_KEY) ?? '{}');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    return Object.fromEntries(
      Object.entries(raw).filter(
        ([, v]) =>
          v &&
          Number.isSafeInteger(v.score) &&
          v.score > 0 &&
          typeof v.at === 'string' &&
          Number.isSafeInteger(v.games) &&
          v.games > 0,
      ),
    );
  } catch {
    return {};
  }
}
export function browserCastleStorage(): CastleBestStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
export function readCastleBest(
  storage: CastleBestStorage | null,
  runMin: DefenseRunMin,
  difficulty: DifficultyId,
): CastleBest | null {
  return readAll(storage)[castleBoardKey(runMin, difficulty)] ?? null;
}
/** Sólo se escribe después de validar: devuelve null y no toca storage para partidas rechazadas. */
export function recordCastleBest(
  storage: CastleBestStorage | null,
  r: DefenseResult,
  at: string,
): { best: boolean; record: CastleBest } | null {
  if (castleRankRejection(r)) return null;
  const all = readAll(storage);
  const key = castleBoardKey(r.runMin, r.difficulty);
  const prev = all[key];
  const best = !prev || r.score > prev.score;
  const record = {
    score: best ? r.score : prev!.score,
    at: best ? at : prev!.at,
    games: (prev?.games ?? 0) + 1,
  };
  all[key] = record;
  try {
    storage?.setItem(CASTLE_BEST_KEY, JSON.stringify(all));
  } catch {
    /* Récord de esta visita. */
  }
  return { best, record };
}

/** Puntos de muestra propios de cada tabla, siempre bajo el tope. */
export const SAMPLE_CASTLE_SCORES: Readonly<Record<string, Readonly<Record<string, number>>>> =
  Object.fromEntries(
    DEFENSE_RUN_MINS.flatMap((m) =>
      CASTLE_DIFFICULTIES.map((d) => [
        castleBoardKey(m, d),
        {
          'muestra-pulpo-sonico': Math.round(castleMaxKillPoints(m, d) * 0.75),
          'muestra-la-del-castillo': Math.round(castleMaxKillPoints(m, d) * 0.5),
          'muestra-grumete-turron': Math.round(castleMaxKillPoints(m, d) * 0.2),
        },
      ]),
    ),
  );
export interface CastleRow {
  userId: string;
  nickname: string | null;
  score: number | null;
  position: number | null;
  isMine: boolean;
}
export function castleRanking(
  bestScore: number | null,
  runMin: DefenseRunMin,
  difficulty: DifficultyId,
): { rows: CastleRow[]; mine: CastleRow } {
  const scores = SAMPLE_CASTLE_SCORES[castleBoardKey(runMin, difficulty)] ?? {};
  const mine: CastleRow = {
    userId: '',
    nickname: null,
    score: bestScore,
    position: null,
    isMine: true,
  };
  const others: CastleRow[] = SAMPLE_CREW.flatMap((c) =>
    scores[c.userId] === undefined
      ? []
      : [
          {
            userId: c.userId,
            nickname: c.nickname,
            score: scores[c.userId]!,
            position: null,
            isMine: false,
          },
        ],
  );
  const scored = [...others, ...(bestScore === null ? [] : [mine])].sort(
    (a, b) => b.score! - a.score! || Number(b.isMine) - Number(a.isMine),
  );
  for (const r of scored) r.position = 1 + scored.filter((s) => s.score! > r.score!).length;
  return { rows: bestScore === null ? [...scored, mine] : scored, mine };
}
