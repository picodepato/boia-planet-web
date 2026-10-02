import { describe, expect, it } from 'vitest';
import { DEFAULT_SHIP_CONFIG } from './ship/config';
import { DEFAULT_WAKE, type WakeEmitter, WakeSystem } from './wake';

const emitter = (speed: number, drifting = false): WakeEmitter => ({
  x: 0,
  y: 0,
  heading: 0,
  speed,
  maxSpeed: 200,
  drifting,
});

function countAfter(e: WakeEmitter, seconds: number) {
  const w = new WakeSystem();
  let emitted = 0;
  let prev = 0;
  for (let i = 0; i < seconds * 60; i++) {
    w.update(1 / 60, e);
    emitted += Math.max(0, w.particles.length - prev);
    prev = w.particles.length;
  }
  return { w, emitted };
}

describe('estela', () => {
  it('parado no emite; más velocidad, más partículas; el drift aún más', () => {
    expect(countAfter(emitter(0), 1).w.particles.length).toBe(0);
    const slow = countAfter(emitter(60), 0.5).emitted;
    const fast = countAfter(emitter(200), 0.5).emitted;
    const drift = countAfter(emitter(200, true), 0.5).emitted;
    expect(fast).toBeGreaterThan(slow);
    expect(drift).toBeGreaterThan(fast);
  });

  it('las partículas se desvanecen: al parar, la estela desaparece', () => {
    const w = new WakeSystem();
    for (let i = 0; i < 60; i++) w.update(1 / 60, emitter(200, true));
    expect(w.particles.length).toBeGreaterThan(0);
    for (let i = 0; i < 60 * 3; i++) w.update(1 / 60, emitter(0));
    expect(w.particles.length).toBe(0);
  });
});

/** Intensidad leída tras `seconds` de pasos con el emisor que da `at(t)`. */
function readAfter(at: (t: number) => WakeEmitter, seconds = 0.5) {
  const w = new WakeSystem();
  const n = Math.round(seconds * 60);
  for (let i = 0; i < n; i++) w.update(1 / 60, at(i / 60));
  return { w, reading: w.reading() };
}

describe('estela reactiva (REQ-MUN-004)', () => {
  const straight = () => emitter(150);
  // El mismo barco avanzando por la línea que marca su velocidad.
  const moving =
    (speed: number, heading = 0) =>
    (t: number): WakeEmitter => ({
      ...emitter(speed),
      x: Math.cos(heading) * speed * t,
      y: Math.sin(heading) * speed * t,
      heading,
    });

  it('girando, la estela crece respecto a ir en recto', () => {
    const base = readAfter(straight).reading;
    const turn = readAfter((t) => ({ ...emitter(150), heading: t * DEFAULT_WAKE.turnRef })).reading;
    expect(turn.turnRate).toBeCloseTo(DEFAULT_WAKE.turnRef, 6);
    expect(turn.intensity).toBeGreaterThan(base.intensity);
  });

  it('con boost (por encima de la velocidad máxima) crece aún más', () => {
    const max = readAfter(() => emitter(200)).reading;
    const boost = readAfter(() => emitter(200 * 1.6)).reading;
    expect(boost.boost).toBeGreaterThan(0);
    expect(boost.intensity).toBeGreaterThan(max.intensity);
  });

  it('un choque salpica: la velocidad cae de golpe y sale un anillo de espuma', () => {
    const w = new WakeSystem();
    const run = moving(180);
    for (let i = 0; i < 29; i++) w.update(1 / 60, run(i / 60));
    let count = w.particles.length;
    w.update(1 / 60, run(29 / 60));
    const before = w.reading();
    const normalStep = w.particles.length - count;
    count = w.particles.length;
    // Contra la costa: el barco se queda casi quieto donde estaba.
    w.update(1 / 60, { ...run(30 / 60), speed: 20 });
    const hit = w.reading();
    expect(hit.impact).toBeGreaterThan(DEFAULT_WAKE.impactMin);
    expect(w.particles.length - count).toBeGreaterThan(normalStep);
    // Con el barco ya casi parado, la estela del golpe supera a la de ir en recto.
    expect(hit.intensity).toBeGreaterThan(w.intensity({ ...emitter(20) }));
    expect(before.impact).toBe(0);
  });

  it('frenar soltando el mando, acabar un boost o teletransportarse no es un choque', () => {
    const brake = new WakeSystem();
    let speed = 200;
    for (let i = 0; i < 90; i++) {
      speed = Math.max(0, speed - DEFAULT_SHIP_CONFIG.brakeDeceleration / 60);
      brake.update(1 / 60, emitter(speed));
      expect(brake.reading().impact).toBe(0);
    }

    const boost = new WakeSystem();
    boost.update(1 / 60, emitter(320));
    boost.update(1 / 60, emitter(200));
    expect(boost.reading().impact).toBe(0);

    const jump = new WakeSystem();
    jump.update(1 / 60, emitter(200));
    jump.update(1 / 60, { ...emitter(0), x: 5000, y: 5000 });
    expect(jump.reading().impact).toBe(0);
  });
});
