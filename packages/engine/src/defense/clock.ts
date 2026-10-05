import { DEFENSE_STEP_S } from './config';
import type { DefenseGame } from './sim';

/**
 * El reloj que la web alimenta con tiempo real, como `SurvivorsClock` en el
 * Cañón: dice cuántos pasos fijos tocan. Pestaña oculta: todo es pausa; un
 * hueco entre imágenes mayor que `maxFrameS`: lo que sobra es pausa.
 */
export class DefenseClock {
  private acc = 0;

  constructor(private readonly maxFrameS = 0.25) {}

  /** Fracción (0…1) del paso siguiente ya transcurrida (para pintar entre pasos). */
  get alpha(): number {
    return Math.min(1, Math.max(0, this.acc / DEFENSE_STEP_S));
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
    this.acc += counted;
    const n = Math.floor(this.acc / DEFENSE_STEP_S + 1e-9);
    this.acc = Math.max(0, this.acc - n * DEFENSE_STEP_S);
    return n;
  }
}
