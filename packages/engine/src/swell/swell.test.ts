import { describe, expect, it } from 'vitest';
import {
  SWELL_TUNING,
  type BoatMotion,
  type SwellEvent,
  SwellClock,
  crossesSwell,
  placeSwell,
  swellParam,
  swellRng,
  swellStrength,
} from './index';

const DT = 1 / 30;
const T = SWELL_TUNING;

const boat = (over: Partial<BoatMotion> = {}): BoatMotion => ({
  x: 0,
  y: 0,
  heading: 0,
  speed: 150,
  maxSpeed: 150,
  turbo: false,
  ...over,
});

/** Avanza `seconds` s con el barco quieto en su sitio (o el que diga `at`). */
function run(
  clock: SwellClock,
  seconds: number,
  opts: { busy?: (t: number) => boolean; motion?: Partial<BoatMotion> } = {},
): { t: number; e: SwellEvent }[] {
  const out: { t: number; e: SwellEvent }[] = [];
  const n = Math.round(seconds / DT);
  for (let i = 1; i <= n; i++) {
    const t = i * DT;
    const m = boat(opts.motion);
    for (const e of clock.step(DT, opts.busy?.(t) ?? false, m, m)) out.push({ t, e });
  }
  return out;
}

const spawns = (log: { t: number; e: SwellEvent }[]) => log.filter((x) => x.e.type === 'spawn');

describe('SwellClock: cuándo sale (T269)', () => {
  it('la primera ola sale a los 1-2 min de mar libre, no antes', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const clock = new SwellClock({ rng: swellRng(seed) });
      // El barco va en marcha pero sin cruzar nada: la ola se va sola.
      const first = spawns(run(clock, T.everyMax + 2))[0];
      expect(first, `semilla ${seed}`).toBeDefined();
      expect(first!.t).toBeGreaterThanOrEqual(T.everyMin - DT);
      expect(first!.t).toBeLessThanOrEqual(T.everyMax + DT);
    }
  });

  it('es determinista con la misma semilla', () => {
    const a = spawns(run(new SwellClock({ rng: swellRng(7) }), 400)).map((x) => x.t);
    const b = spawns(run(new SwellClock({ rng: swellRng(7) }), 400)).map((x) => x.t);
    expect(a.length).toBeGreaterThan(1);
    expect(a).toEqual(b);
  });

  it('no sale con el barco parado: espera a que se mueva', () => {
    const clock = new SwellClock({ rng: swellRng(3) });
    expect(spawns(run(clock, 300, { motion: { speed: 0 } }))).toHaveLength(0);
    expect(spawns(run(clock, 1))).toHaveLength(1);
  });

  it('nunca sale durante una partida, ni hasta pasada la calma de después', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const clock = new SwellClock({ rng: swellRng(seed) });
      const busyUntil = 400;
      const log = run(clock, 600, { busy: (t) => t < busyUntil });
      for (const x of spawns(log)) {
        expect(x.t, `semilla ${seed}`).toBeGreaterThanOrEqual(busyUntil + T.afterBusy - 2 * DT);
      }
      expect(spawns(log).length).toBeGreaterThan(0);
    }
  });

  it('una ola en pie se va al empezar una partida', () => {
    const clock = new SwellClock({ rng: swellRng(2) });
    clock.spawn({ x: 0, y: 0, heading: 0, speed: 150 });
    expect(clock.swell).not.toBeNull();
    const m = boat();
    const ev = clock.step(DT, true, m, m);
    expect(ev.map((e) => e.type)).toEqual(['gone']);
    expect(clock.swell).toBeNull();
  });

  it('una ola sin cruzar se va a los `life` s', () => {
    const clock = new SwellClock({ rng: swellRng(2) });
    clock.spawn({ x: 0, y: 0, heading: 0, speed: 150 });
    // El barco queda quieto muy lejos (de lado): no la cruza.
    const log: SwellEvent[] = [];
    const m = boat({ y: 5000 });
    for (let i = 0; i < Math.round((T.life + 1) / DT); i++)
      log.push(...clock.step(DT, false, m, m));
    expect(log.map((e) => e.type)).toEqual(['gone']);
  });
});

describe('placeSwell: dónde sale (T269)', () => {
  it('delante del barco, de cara, a la distancia mínima o a `aheadS` s de marcha', () => {
    const lento = placeSwell({ x: 100, y: 50 }, 0, 10, 0);
    expect(lento.x).toBeCloseTo(100 + T.minAhead);
    expect(lento.y).toBeCloseTo(50);
    expect(lento.nx).toBeCloseTo(-1);
    const rapido = placeSwell({ x: 0, y: 0 }, Math.PI / 2, 400, 0);
    expect(rapido.x).toBeCloseTo(0);
    expect(rapido.y).toBeCloseTo(400 * T.aheadS);
    expect(rapido.ny).toBeCloseTo(-1);
  });

  it('el desvío no la saca del cono de delante', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const clock = new SwellClock({ rng: swellRng(seed) });
      const heading = (seed / 30) * Math.PI * 2;
      clock.spawn({ x: 10, y: -20, heading, speed: 150 });
      const s = clock.swell!;
      const dx = s.x - 10;
      const dy = s.y + 20;
      expect(dx * Math.cos(heading) + dy * Math.sin(heading)).toBeGreaterThan(0);
    }
  });
});

describe('crossesSwell: cruzar la cresta (T269)', () => {
  const swell = { x: 500, y: 0, nx: -1, ny: 0, halfLength: 260 };

  it('cruza al pasar de un lado al otro dentro del largo de la cresta', () => {
    expect(crossesSwell(swell, { x: 450, y: 0 }, { x: 550, y: 0 })).toBe(true);
    expect(crossesSwell(swell, { x: 450, y: 200 }, { x: 550, y: 200 })).toBe(true);
  });

  it('también al revés', () => {
    expect(crossesSwell(swell, { x: 550, y: 0 }, { x: 450, y: 0 })).toBe(true);
  });

  it('no cruza si queda del mismo lado o pasa por fuera de la cresta', () => {
    expect(crossesSwell(swell, { x: 100, y: 0 }, { x: 200, y: 0 })).toBe(false);
    expect(crossesSwell(swell, { x: 450, y: 400 }, { x: 550, y: 400 })).toBe(false);
    expect(crossesSwell(swell, { x: 450, y: -400 }, { x: 550, y: -400 })).toBe(false);
  });

  it('cuenta el punto exacto del cruce, aunque el paso sea largo', () => {
    // Entra en diagonal: a mitad del paso ya está fuera de la cresta.
    expect(crossesSwell(swell, { x: 400, y: 0 }, { x: 600, y: 600 })).toBe(false);
    expect(crossesSwell(swell, { x: 400, y: -200 }, { x: 600, y: 200 })).toBe(true);
  });

  it('el mar da la vuelta: cruza por el otro lado del borde', () => {
    const period = { w: 10000, h: 10000 };
    const edge = { x: 9900, y: 0, nx: -1, ny: 0, halfLength: 260 };
    expect(crossesSwell(edge, { x: 9850, y: 0 }, { x: 9950, y: 0 }, period)).toBe(true);
    // El barco ya dio la vuelta (x pequeña) y la ola sigue en el borde.
    const wrapped = { x: 20, y: 0, nx: -1, ny: 0, halfLength: 260 };
    expect(crossesSwell(wrapped, { x: 9990, y: 0 }, { x: 50, y: 0 }, period)).toBe(true);
    expect(crossesSwell(wrapped, { x: 9990, y: 0 }, { x: 50, y: 0 })).toBe(false);
  });
});

describe('SwellClock: cruzar y la vuelta (T269)', () => {
  /** Barco a 150 u/s hacia la ola recién levantada hasta que la cruza. */
  function sail(turbo: boolean, seed = 1) {
    const clock = new SwellClock({ rng: swellRng(seed) });
    clock.spawn({ x: 0, y: 0, heading: 0, speed: 150 });
    let x = 0;
    const events: SwellEvent[] = [];
    for (let i = 0; i < 30 * 20 && !events.some((e) => e.type === 'cross'); i++) {
      const prev = { x, y: 0 };
      x += 150 * DT;
      events.push(...clock.step(DT, false, boat({ x, turbo }), prev));
    }
    return { clock, events };
  }

  it('un barco parado en su camino también la cruza: la cresta avanza hacia él', () => {
    const clock = new SwellClock({ rng: swellRng(1) });
    clock.spawn({ x: 0, y: 0, heading: 0, speed: 150 });
    const events: SwellEvent[] = [];
    const still = boat({ x: 0, speed: 0 });
    for (let i = 0; i < 30 * 30 && !events.some((e) => e.type === 'cross'); i++) {
      events.push(...clock.step(DT, false, still, still));
    }
    expect(events.filter((e) => e.type === 'cross')).toHaveLength(1);
  });

  it('cruzarla da un `cross` y la ola se va', () => {
    const { clock, events } = sail(false);
    const cross = events.filter((e) => e.type === 'cross');
    expect(cross).toHaveLength(1);
    expect(clock.swell).toBeNull();
  });

  it('la vuelta sólo con turbo', () => {
    const a = sail(false).events.find((e) => e.type === 'cross');
    const b = sail(true).events.find((e) => e.type === 'cross');
    expect(a && 'flip' in a && a.flip).toBe(false);
    expect(b && 'flip' in b && b.flip).toBe(true);
  });

  it('una ola aún baja (recién nacida) no lanza el barco', () => {
    const clock = new SwellClock({ rng: swellRng(1) });
    clock.spawn({ x: 0, y: 0, heading: 0, speed: 150 });
    clock.swell!.age = 0.2;
    clock.swell!.x = 100;
    const ev = clock.step(DT, false, boat({ x: 150 }), { x: 50, y: 0 });
    expect(ev.filter((e) => e.type === 'cross')).toHaveLength(0);
  });

  it('no hay `cross` durante una partida', () => {
    const clock = new SwellClock({ rng: swellRng(1) });
    clock.spawn({ x: 0, y: 0, heading: 0, speed: 150 });
    clock.swell!.x = 100;
    const ev = clock.step(DT, true, boat({ x: 150 }), { x: 50, y: 0 });
    expect(ev.filter((e) => e.type === 'cross')).toHaveLength(0);
  });

  it('sin novedades no crea listas nuevas (se llama en cada fotograma del móvil)', () => {
    const clock = new SwellClock({ rng: swellRng(1) });
    const m = boat();
    const a = clock.step(DT, false, m, m);
    const b = clock.step(DT, false, m, m);
    expect(a).toHaveLength(0);
    expect(b).toBe(a);
    clock.spawn({ x: 0, y: 0, heading: 0, speed: 150 });
    const far = boat({ x: -5000 });
    expect(clock.step(DT, false, far, far)).toBe(a);
  });

  it('el vuelo: con vuelta es más alto y largo; con movimiento reducido, bajo y sin vuelta', () => {
    const clock = new SwellClock();
    const normal = clock.jumpFor(false, false);
    const vuelta = clock.jumpFor(true, false);
    const quieto = clock.jumpFor(true, true);
    expect(normal.flip).toBe(false);
    expect(vuelta.flip).toBe(true);
    expect(vuelta.height).toBeGreaterThan(normal.height);
    expect(vuelta.duration).toBeGreaterThan(normal.duration);
    expect(quieto.flip).toBe(false);
    expect(quieto.height).toBeLessThan(normal.height);
  });
});

describe('ayudas', () => {
  it('la fuerza sube, se mantiene y baja', () => {
    expect(swellStrength(0, 24, 3)).toBe(0);
    expect(swellStrength(1.5, 24, 3)).toBeGreaterThan(0);
    expect(swellStrength(12, 24, 3)).toBe(1);
    expect(swellStrength(24, 24, 3)).toBe(0);
    expect(swellStrength(22.5, 24, 3)).toBeLessThan(1);
  });

  it('?ola=1 trae una ola; sin él, o con 0, no', () => {
    expect(swellParam('?ola=1')).toBe(true);
    expect(swellParam('?ola')).toBe(false);
    expect(swellParam('?ola=0')).toBe(false);
    expect(swellParam('')).toBe(false);
  });
});
