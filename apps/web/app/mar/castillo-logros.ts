import type { DefenseResult } from '@boia/engine/defense';
import { CASTLE_GAME, type ProgressApi } from '@boia/store';
import { type AchievementSignal, emitSignalsCompleted } from '../../lib/mundo/achievements';

/**
 * Los logros de «Defensa del Castillo» (plan 015 T176, decisión 16): ganar
 * (aguantar la partida entera) en cada dificultad, y Tormenta de 10 min. La
 * señal es `win_minigame` del castillo con su dificultad y su duración; el
 * catálogo (`@boia/store`) dice qué logro pide qué y qué regala (el
 * Cañoncito, la Estela del vórtice).
 */

/**
 * La señal de una partida acabada, o ninguna: sólo una victoria que cuenta.
 * No cuenta una partida de atajo donde los atajos no dan premio (`counts`
 * falso, como la medalla), ni «Terminar partida» o un abandono (no aguantan).
 */
export function castleSignals(result: DefenseResult | null, counts: boolean): AchievementSignal[] {
  if (!result || !counts || result.end !== 'held') return [];
  return [
    {
      trigger: 'win_minigame',
      game: CASTLE_GAME,
      difficulty: result.difficulty,
      runMin: result.runMin,
    },
  ];
}

/** Un logro que la partida acaba de completar, para la tarjeta final. */
export interface CastleUnlock {
  id: string;
  title: string;
  /** El nombre del cosmético que regala (la mascota, la estela), o null. */
  prize: string | null;
}

/**
 * Apunta las señales y devuelve lo completado ahora, con el nombre de lo que
 * regala. El premio llega al reclamarlo en «Logros», como siempre.
 */
export async function recordCastleWin(
  repo: { readonly progress: ProgressApi },
  signals: readonly AchievementSignal[],
): Promise<CastleUnlock[]> {
  if (signals.length === 0) return [];
  const done = await emitSignalsCompleted(repo, signals);
  if (done.length === 0) return [];
  const shop = await repo.progress.shop();
  return done.map((a) => {
    const key = a.reward.cosmeticKey;
    return {
      id: a.definition.id,
      title: a.definition.title,
      prize: key ? (shop.find((i) => i.cosmetic.id === key)?.cosmetic.name ?? key) : null,
    };
  });
}
