import { SURVIVORS_STEP_S } from './config';
import type { SurvivorsGame } from './sim';

/**
 * El reloj que la web alimenta con tiempo real (s entre imágenes y si la
 * pestaña está oculta) y que dice cuántos pasos fijos tocan. La simulación
 * sólo avanza en pasos activos; lo demás cuenta como pausa en la partida:
 *
 * - pestaña oculta: todo el hueco es pausa (`elapsePause`);
 * - un hueco entre imágenes mayor que `maxFrameS` (el navegador congeló la
 *   página): lo que pasa de `maxFrameS` es pausa;
 * - pausa manual o carta de nivel abierta: los pasos se dan igual y la
 *   partida los cuenta como pausa (`step` en pausa).
 *
 * Una pausa seguida de más de `maxPauseS` (5 min) abandona la partida.
 */
export class SurvivorsClock {
  private acc = 0;

  constructor(private readonly maxFrameS = 0.25) {}

  /** Pasos fijos que hay que dar ahora (cada uno con `game.step(input)`). */
  frame(game: SurvivorsGame, realDtS: number, hidden = false): number {
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
    const n = Math.floor(this.acc / SURVIVORS_STEP_S + 1e-9);
    this.acc = Math.max(0, this.acc - n * SURVIVORS_STEP_S);
    return n;
  }
}
