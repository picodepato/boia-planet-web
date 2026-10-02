import { describe, expect, it } from 'vitest';
import { FixedStepLoop, lerp } from './loop';
import { DEFAULT_SHIP_CONFIG } from './ship/config';
import { type ShipInput, createShipState, stepShip } from './ship/controller';

/** Simula `seconds` alimentando el bucle con imágenes de `frameMs` y devuelve la posición renderizada. */
function renderedAfter(seconds: number, frameMs: number) {
  const loop = new FixedStepLoop(60);
  const s = createShipState(0, 0, -Math.PI / 2);
  const prev = { ...s };
  // Entrada no trivial: acelera y gira a la vez, para que la trayectoria sea curva.
  const input: ShipInput = { dirX: 1, dirY: -0.3, throttle: 1, drift: false };
  let t = 0;
  let alpha = 0;
  let steps = 0;
  while (t < seconds - 1e-9) {
    const dt = Math.min(frameMs / 1000, seconds - t);
    t += dt;
    alpha = loop.advance(dt, (step) => {
      Object.assign(prev, s);
      stepShip(s, input, DEFAULT_SHIP_CONFIG, step);
      steps++;
    });
  }
  return { x: lerp(prev.x, s.x, alpha), y: lerp(prev.y, s.y, alpha), steps };
}

describe('bucle de paso fijo a 60 Hz', () => {
  it('1 s con imágenes de 16 ms y de 33 ms da la misma posición (< 1 %)', () => {
    const a = renderedAfter(1, 16);
    const b = renderedAfter(1, 33);
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const travelled = Math.hypot(a.x, a.y);
    expect(travelled).toBeGreaterThan(50);
    expect(dist / travelled).toBeLessThan(0.01);
    expect(a.steps).toBe(60);
    expect(b.steps).toBe(60);
  });

  it('60 imágenes de 1/60 s son exactamente 60 pasos', () => {
    const loop = new FixedStepLoop(60);
    let n = 0;
    for (let i = 0; i < 60; i++) loop.advance(1 / 60, () => n++);
    expect(n).toBe(60);
  });

  it('una pausa larga no provoca una espiral de pasos', () => {
    const loop = new FixedStepLoop(60, 0.25);
    let n = 0;
    loop.advance(5, () => n++);
    expect(n).toBe(Math.round(0.25 * 60));
  });

  it('alpha queda en [0, 1)', () => {
    const loop = new FixedStepLoop(60);
    for (const dt of [0.001, 0.016, 0.033, 0.05, 0.1]) {
      const a = loop.advance(dt, () => {});
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(1);
    }
  });
});
