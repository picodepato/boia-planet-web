import { COAST_X, CanonSim, type CanonFoe, canonShot, powerFor, pullFor } from './canon';
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

/** Cañón: el tiro (ángulo y potencia) que cae donde estará este intruso, o null. */
export function interceptFor(c: CanonSim, f: CanonFoe): { angle: number; power: number } | null {
  for (const angle of [0.7, 0.45, 1, 0.25]) {
    let x = f.x;
    let power: number | null = null;
    for (let i = 0; i < 6; i++) {
      power = powerFor(angle, x, c.config);
      if (power === null) break;
      x = f.x - f.speed * (canonShot(angle, power, c.config).tLand + STEP_S);
    }
    if (power !== null) return { angle, power };
  }
  return null;
}

/** Cañón: dispara al intruso más cerca de la playa que seguirá a tiro al caer la bola. */
export const canonExpert: Bot = (sim) => {
  const c = sim as CanonSim;
  if (c.reload > 0 || c.balls.length) return {};
  const targets = c.foes
    .filter((f) => f.state === 'swimming' && f.x > COAST_X + 0.02 && f.x < 1)
    .sort((a, b) => a.x - b.x);
  for (const f of targets) {
    const aim = interceptFor(c, f);
    if (!aim) continue;
    const t = canonShot(aim.angle, aim.power, c.config).tLand;
    if (f.kind === 'shark' && (f.submerged || f.diveTimer < t + 0.1)) continue;
    return { pull: pullFor(aim.angle, aim.power, c.config), action: true };
  }
  return {};
};

/** Cañón: dispara siempre lo más lejos posible de cualquier intruso. */
export const canonWaster: Bot = (sim) => {
  const c = sim as CanonSim;
  if (c.reload > 0) return {};
  const xs = c.foes.filter((f) => f.state === 'swimming').map((f) => f.x);
  let best = 0.3;
  let bestD = -1;
  for (let x = 0.3; x <= 1.2; x += 0.02) {
    const d = Math.min(Infinity, ...xs.map((fx) => Math.abs(fx - x)));
    if (d > bestD) {
      bestD = d;
      best = x;
    }
  }
  const angle = 0.7;
  const power = powerFor(angle, best, c.config);
  if (power === null) return {};
  return { pull: pullFor(angle, power, c.config), action: true };
};

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

export { CanonSim, FaroSim };
