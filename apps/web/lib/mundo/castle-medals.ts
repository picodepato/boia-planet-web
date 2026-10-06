import {
  DEFENSE_RUN_MINS,
  type DefenseMedal,
  type DefenseRunMin,
  type DifficultyId,
} from '@boia/engine/defense';
import { DIFFICULTY_IDS } from '@boia/engine/survivors';

/**
 * Las medallas de «Defensa del Castillo» (plan 014 T162, decisión 12): la
 * mejor de cada par duración × dificultad (5/7/10 min × Tranquila, Normal,
 * Tormenta).
 *
 * Se guardan en los contadores del progreso (`ProgressApi.counter` /
 * `increment`), como la campaña del Cañón (`canon-campaign.ts`): en modo
 * local, en este navegador; con cuenta, en la misma copia, que viaja con
 * `save_snapshot` y se mezcla tomando el mayor de cada contador. Un contador
 * por par con el rango de su mejor medalla (1 bronce, 2 plata, 3 oro): como
 * la mezcla se queda con el mayor, la mejor nunca se pierde. Sin tablas
 * nuevas.
 */

export const CASTLE_MEDAL_RANK: Readonly<Record<DefenseMedal, number>> = {
  bronce: 1,
  plata: 2,
  oro: 3,
};

const BY_RANK: readonly (DefenseMedal | null)[] = [null, 'bronce', 'plata', 'oro'];

/** El contador de un par: el rango de su mejor medalla (0 sin medalla). */
export function castleMedalCounter(runMin: DefenseRunMin, difficulty: DifficultyId): string {
  return `castillo:${runMin}-${difficulty}:medalla`;
}

/** La clave de un par en `CastleMedals`. */
export function castlePairKey(runMin: DefenseRunMin, difficulty: DifficultyId): string {
  return `${runMin}-${difficulty}`;
}

/** Lo que las medallas necesitan del progreso (`repo.progress`). */
export interface CastleMedalStore {
  counter(name: string): Promise<number>;
  increment(name: string, by?: number): Promise<number>;
}

/** La mejor medalla de cada par (`castlePairKey`), o null. */
export type CastleMedals = Readonly<Record<string, DefenseMedal | null>>;

export const EMPTY_CASTLE_MEDALS: CastleMedals = {};

/** Todos los pares, en orden (duración, luego dificultad). */
export function castlePairs(): { runMin: DefenseRunMin; difficulty: DifficultyId }[] {
  return DEFENSE_RUN_MINS.flatMap((runMin) =>
    DIFFICULTY_IDS.map((difficulty) => ({ runMin, difficulty })),
  );
}

function medalOfRank(rank: number): DefenseMedal | null {
  const r = Math.max(0, Math.min(3, Math.floor(rank)));
  return BY_RANK[r] ?? null;
}

/** Lee la mejor medalla de los nueve pares. */
export async function readCastleMedals(store: CastleMedalStore): Promise<CastleMedals> {
  const pairs = castlePairs();
  const ranks = await Promise.all(
    pairs.map((p) => store.counter(castleMedalCounter(p.runMin, p.difficulty))),
  );
  const out: Record<string, DefenseMedal | null> = {};
  pairs.forEach((p, i) => {
    out[castlePairKey(p.runMin, p.difficulty)] = medalOfRank(ranks[i] ?? 0);
  });
  return out;
}

/** La mejor medalla de un par, o null. */
export function castlePairMedal(
  medals: CastleMedals,
  runMin: DefenseRunMin,
  difficulty: DifficultyId,
): DefenseMedal | null {
  return medals[castlePairKey(runMin, difficulty)] ?? null;
}

/** La mejor de todas (para el «Tablón del faro»), o null. */
export function castleBestMedal(medals: CastleMedals): DefenseMedal | null {
  let best: DefenseMedal | null = null;
  for (const m of Object.values(medals)) {
    if (m && (!best || CASTLE_MEDAL_RANK[m] > CASTLE_MEDAL_RANK[best])) best = m;
  }
  return best;
}

/**
 * Apunta la medalla de una partida en su par si mejora la que había; la
 * mejor se queda. Devuelve la mejor del par después y si mejoró.
 */
export async function recordCastleMedal(
  store: CastleMedalStore,
  runMin: DefenseRunMin,
  difficulty: DifficultyId,
  medal: DefenseMedal | null,
): Promise<{ best: DefenseMedal | null; improved: boolean }> {
  const name = castleMedalCounter(runMin, difficulty);
  const before = Math.max(0, Math.floor(await store.counter(name)));
  const rank = medal ? CASTLE_MEDAL_RANK[medal] : 0;
  if (rank <= before) return { best: medalOfRank(before), improved: false };
  await store.increment(name, rank - before);
  return { best: medal, improved: true };
}
