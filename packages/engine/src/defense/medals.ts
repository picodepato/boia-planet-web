import { DEFENSE_CONFIG, type DefenseConfig } from './config';
import type { DefenseEndReason } from './sim';

/**
 * Medallas y puntuación de «Defensa del Castillo» (decisión 12 del plan 014):
 *
 * - **oro**: aguantar la duración elegida con más del 50 % de la vida del castillo;
 * - **plata**: aguantarla con el 50 % o menos;
 * - **bronce**: el castillo cae, pero después de la mitad de la duración.
 *
 * Caer antes de la mitad, abandonar o «Terminar partida» no da medalla.
 *
 * Puntos: los de cada enemigo que cae (más los bosses) y, si aguantó, un
 * bono por la vida que le queda al castillo (`score.lifeBonus` por toda).
 */

export type DefenseMedal = 'bronce' | 'plata' | 'oro';
export const DEFENSE_MEDALS: readonly DefenseMedal[] = ['bronce', 'plata', 'oro'];

export interface DefenseMedalInput {
  readonly end: DefenseEndReason | null;
  readonly castleLife: number;
  readonly castleMaxLife: number;
  /** s de tiempo activo jugado. */
  readonly activeS: number;
  readonly durationS: number;
}

export function defenseMedal(r: DefenseMedalInput): DefenseMedal | null {
  if (r.end === 'held') return r.castleLife / r.castleMaxLife > 0.5 ? 'oro' : 'plata';
  if (r.end === 'fallen') return r.activeS >= r.durationS / 2 ? 'bronce' : null;
  return null;
}

export interface DefenseScoreInput {
  readonly end: DefenseEndReason | null;
  readonly killPoints: number;
  readonly castleLife: number;
  readonly castleMaxLife: number;
}

export interface DefenseScore {
  readonly killPoints: number;
  readonly lifeBonus: number;
  readonly total: number;
}

export function defenseScore(
  r: DefenseScoreInput,
  cfg: DefenseConfig = DEFENSE_CONFIG,
): DefenseScore {
  const frac = r.castleMaxLife > 0 ? Math.min(1, Math.max(0, r.castleLife / r.castleMaxLife)) : 0;
  const lifeBonus = r.end === 'held' ? Math.round(cfg.score.lifeBonus * frac) : 0;
  return { killPoints: r.killPoints, lifeBonus, total: r.killPoints + lifeBonus };
}
