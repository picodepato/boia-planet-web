import { type MinigameController, STEP_S } from './controller';
import { COAST_Y, FaroSim } from './faro';
import type { MinigameInput, MinigameSim } from './types';

/**
 * Jugadores automáticos para las pruebas (`@boia/engine/minigames/testing`).
 * Leen el estado interno de la simulación, cosa que un jugador no puede:
 * sirven para llegar a cada final sin esperar en tiempo real.
 */

export type Bot = (sim: MinigameSim) => MinigameInput;

/** Faro: lleva el haz al pirata más cerca de la costa; destello si está a punto de llegar. */
export const faroExpert: Bot = (sim) => {
  const f = sim as FaroSim;
  const sailing = f.ships.filter((s) => s.state === 'sailing');
  if (!sailing.length) return {};
  const next = sailing.reduce((a, b) => (a.y > b.y ? a : b));
  return {
    aim: { x: next.x, y: next.y },
    action: f.flashes > 0 && next.y > COAST_Y - 0.08 && !f.isLit(next),
  };
};

/** Nada: deja pasar el tiempo. */
export const idle: Bot = () => ({});

/**
 * Juega una partida entera con paso fijo; `advance` mueve el reloj de la
 * autoridad al mismo ritmo (ms), como si pasara el tiempo de verdad.
 */
export function playHeadless(
  controller: MinigameController,
  bot: Bot,
  advance: (ms: number) => void = () => {},
  maxSeconds = 900,
): void {
  if (controller.phase !== 'playing') controller.start();
  for (let t = 0; t < maxSeconds && controller.phase === 'playing'; t += STEP_S) {
    advance(STEP_S * 1000);
    controller.tick(STEP_S, bot(controller.sim!));
  }
}

export { FaroSim };
