import { DEFENSE_STEP_S } from './config';
import type { DefenseGame } from './sim';

/** Las velocidades de la partida (decisión 10 del plan 015: ×1 y ×2). */
export type DefenseTimeScale = 1 | 2;
export const DEFENSE_TIME_SCALES: readonly DefenseTimeScale[] = [1, 2];

/**
 * El reloj que la web alimenta con tiempo real, como `SurvivorsClock` en el
 * Cañón: dice cuántos pasos fijos tocan. Pestaña oculta: todo es pausa; un
 * hueco entre imágenes mayor que `maxFrameS`: lo que sobra es pausa.
 *
 * Con `scale` 2 (×2) cada segundo real da los pasos de dos: la partida es la
 * misma paso a paso, sólo va más deprisa (vale en el ranking). La pausa se
 * cuenta siempre en tiempo real.
 */
export class DefenseClock {
  private acc = 0;
  private timeScale: DefenseTimeScale = 1;

  constructor(private readonly maxFrameS = 0.25) {}

  /** Fracción (0…1) del paso siguiente ya transcurrida (para pintar entre pasos). */
  get alpha(): number {
    return Math.min(1, Math.max(0, this.acc / DEFENSE_STEP_S));
  }

  /** ×1 o ×2. */
  get scale(): DefenseTimeScale {
    return this.timeScale;
  }

  set scale(v: DefenseTimeScale) {
    this.timeScale = v === 2 ? 2 : 1;
  }

  /** Pasos fijos que hay que dar ahora (cada uno con `game.step(input)`). */
  frame(game: DefenseGame, realDtS: number, hidden = false): number {
    if (game.ended) return 0;
    const dt = Number.isFinite(realDtS) ? Math.max(0, realDtS) : 0;
    if (hidden) {
      this.acc = 0;
      game.elapsePause(dt);
      return 0;
    }
    const counted = Math.min(dt, this.maxFrameS);
    if (dt > counted) game.elapsePause(dt - counted);
    if (game.ended) return 0;
    this.acc += counted * this.timeScale;
    const n = Math.floor(this.acc / DEFENSE_STEP_S + 1e-9);
    this.acc = Math.max(0, this.acc - n * DEFENSE_STEP_S);
    return n;
  }
}
