import type { DefenseRunMin, DifficultyId } from '@boia/engine/defense';
import { DEFENSE_RUN_MINS } from '@boia/engine/defense';
import type { BossId } from '@boia/engine/survivors';
import { type MessageKey, t } from '../i18n';
import { CANON_RANKING_VERSION, canonBoardBosses } from './ranking-canon';
import { CASTLE_DIFFICULTIES, CASTLE_RANKING_VERSION } from './ranking-castle';
import { boardKey } from './ranking-global';

/**
 * Las tablas del Cañón y del Castillo que ofrece el ranking del menú (plan
 * 017 T188, decisión 2): el Cañón, una por boss final (Fantasma, Kraken); el
 * Castillo, una por duración y dificultad (3 × 3). Salen de la configuración
 * de cada juego: un boss o una duración nueva es una tabla más sin tocar el
 * panel.
 */

/** Una tabla del Cañón o del Castillo, con los tipos de cada juego (es un `RankingBoard`). */
export type ScoreBoard =
  | { kind: 'canon'; boss: BossId; version: number }
  | { kind: 'castle'; runMin: DefenseRunMin; difficulty: DifficultyId; version: number };

export interface BoardOption {
  /** `boardKey` de la tabla (el valor del desplegable). */
  key: string;
  label: string;
  board: ScoreBoard;
}

/** Nombre corto de cada boss en el desplegable; si falta, el largo del juego. */
const BOSS_LABEL: Partial<Record<BossId, MessageKey>> = {
  fantasma: 'ranking.canon.board.fantasma',
  kraken: 'ranking.canon.board.kraken',
};

const DIFFICULTY_LABEL: Record<DifficultyId, MessageKey> = {
  tranquila: 'survivors.dificultad.tranquila',
  normal: 'survivors.dificultad.normal',
  tormenta: 'survivors.dificultad.tormenta',
};

export function bossLabel(boss: BossId): string {
  const key = BOSS_LABEL[boss] ?? (`survivors.boss.${boss}` as MessageKey);
  return t(key);
}

/** Las tablas del Cañón: un boss final por acto, en orden. */
export function canonBoardOptions(bosses: readonly BossId[] = canonBoardBosses()): BoardOption[] {
  return bosses.map((boss) => {
    const board = { kind: 'canon', boss, version: CANON_RANKING_VERSION } as const;
    return { key: boardKey(board), label: bossLabel(boss), board };
  });
}

/** Las tablas del Castillo: cada dificultad con cada duración (Tranquila · 5 min…). */
export function castleBoardOptions(
  runMins: readonly DefenseRunMin[] = DEFENSE_RUN_MINS,
  difficulties: readonly DifficultyId[] = CASTLE_DIFFICULTIES,
): BoardOption[] {
  return difficulties.flatMap((difficulty) =>
    runMins.map((runMin) => {
      const board = { kind: 'castle', runMin, difficulty, version: CASTLE_RANKING_VERSION } as const;
      return {
        key: boardKey(board),
        label: t('ranking.castle.board', {
          dificultad: t(DIFFICULTY_LABEL[difficulty]),
          min: runMin,
        }),
        board,
      };
    }),
  );
}
