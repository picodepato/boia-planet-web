import {
  BoatJump,
  CircuitRace,
  type GhostRun,
  GhostRecorder,
  type JumpEvent,
  type RaceEvent,
  circuitFromWorld,
  circuitRecordId,
  ghostPose,
  medalFor,
  rampsOf,
} from '@boia/engine/circuit';
import { WorldRuntime, createShipState, stepShip } from '@boia/engine/headless';
import { createLocalRepository } from '@boia/store';
import { CIRCUIT_ID, WORLD_REGISTRY, type WorldConfig } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { finishLap } from '../../lib/mundo/circuit-hud';
import { footprintOf, marWorld } from './engine/compact';
import { MAR_SHIP_CONFIG } from './engine/steering';
import { periodOf, planetRect, shortest } from './engine/wrap';
import { ghostKey, lapTargets, loadGhost, raceCheckpoint, saveGhost, startPose } from './race';

/**
 * Los Rápidos en /mar (T37, T61, T73): un circuito cerrado de tres vueltas.
 * Un piloto sencillo (a fondo hacia la siguiente boia, como el teclado) lo
 * corre con la física y el runtime de /mar; en la salida pulsa «Empezar» (la
 * carrera ya no arranca sola), las boias llegan por id de objeto, las rampas
 * lo lanzan al aire y caer salpica, la meta da medalla y la carrera se graba
 * para el fantasma.
 */

const worlds = WORLD_REGISTRY.ids().map((id) => ({
  id,
  world: marWorld(WORLD_REGISTRY.get(id).config),
}));
const world = worlds[0]!.world;
const spec = circuitFromWorld(world, CIRCUIT_ID)!;

interface BotRun {
  events: RaceEvent[];
  finish: Extract<RaceEvent, { type: 'finish' }> | null;
  ghost: GhostRun | null;
  /** Lo que el runtime emitió además de las boias (paneles que anularían la carrera). */
  opened: string[];
  /** Saltos y chapuzones de las rampas, en orden. */
  jumps: JumpEvent[];
  /** Avisos de la salida sin carrera (`ready`): cada uno, un «¿Empezar?». */
  ready: number;
}

/** Una carrera entera con el piloto: cuenta atrás quieto en la salida y luego a fondo. */
function botRace(w: WorldConfig, maxS = 200): BotRun {
  const s = circuitFromWorld(w, CIRCUIT_ID)!;
  const rect = planetRect(w.bounds);
  const period = periodOf(rect);
  const runtime = new WorldRuntime({ ...w, bounds: rect }, { wrap: true, seed: 3 });
  const race = new CircuitRace(s);
  const targets = lapTargets(w, s);
  const hold = startPose(w, s)!;
  const ship = createShipState(hold.x, hold.y + 400, -Math.PI / 2);
  const rec = new GhostRecorder();
  const dt = 1 / 60;
  const events: RaceEvent[] = [];
  const opened: string[] = [];
  const jumps: JumpEvent[] = [];
  const ramps = rampsOf(w);
  const jump = new BoatJump();
  let ready = 0;
  let finish: BotRun['finish'] = null;
  let ghost: GhostRun | null = null;
  let last = 0;
  for (let i = 0; i < maxS * 60 && !finish; i++) {
    const t = i * dt;
    last = t;
    const v = race.view(t);
    if (v.phase === 'countdown') {
      Object.assign(ship, { ...hold, vx: 0, vy: 0 });
    } else {
      const target = v.phase === 'idle' ? hold : targets[v.next - 1]!;
      const { dx, dy } = shortest(ship, target, period);
      stepShip(
        ship,
        { dirX: dx, dirY: dy, throttle: 1, drift: false },
        runtime.shipConfig(MAR_SHIP_CONFIG),
        dt,
      );
    }
    runtime.step(ship, MAR_SHIP_CONFIG, dt);
    const out = race.tick(t);
    jumps.push(...jump.tick(t));
    for (const e of runtime.drainEvents()) {
      if (e.type === 'checkpoint') out.push(...raceCheckpoint(race, e.objectId, t));
      if (e.type === 'content_open' && race.active) opened.push(e.objectId);
      const ramp = e.type === 'effect' && e.effect === 'boost' ? ramps.get(e.objectId) : undefined;
      if (ramp) jumps.push(...jump.launch(e.objectId, ramp, t));
    }
    // En la salida, «Empezar» (T73: la carrera ya no arranca sola).
    if (out.some((e) => e.type === 'ready')) {
      ready++;
      out.push(...race.start(t));
    }
    if (race.racing) rec.sample(race.elapsedMs(t), ship);
    for (const e of out) {
      events.push(e);
      if (e.type === 'go') rec.reset();
      if (e.type === 'finish') {
        finish = e;
        ghost = rec.finish(e.ms, ship);
      }
    }
  }
  // Si la meta llega en pleno salto, el chapuzón cae un poco después.
  for (let k = 1; jump.airborne && k <= 5 * 60; k++) jumps.push(...jump.tick(last + k * dt));
  return { events, finish, ghost, opened, jumps, ready };
}

const run = botRace(world);

describe('Los Rápidos en /mar: tres vueltas por las boias', () => {
  it('una vuelta pasa por cada boia en orden y vuelve a la salida', () => {
    const targets = lapTargets(world, spec);
    expect(targets).toHaveLength(spec.buoys + 1);
    expect(targets.at(-1)!.id).toBe(spec.gates.find((g) => g.order === 0)!.objectId);
    expect(spec.laps).toBe(3);
  });

  it('el piloto termina las tres vueltas, sin abrir paneles por el camino, y gana medalla', () => {
    expect(run.finish, 'llega a meta').not.toBeNull();
    const types = run.events.map((e) => e.type);
    expect(types.filter((t) => t === 'checkpoint')).toHaveLength(spec.buoys * spec.laps);
    expect(types.filter((t) => t === 'lap')).toHaveLength(spec.laps - 1);
    expect(types).not.toContain('missed');
    expect(run.finish!.laps).toHaveLength(spec.laps);
    // Nada del camino abre un panel (abrirlo anularía la carrera, REQ-AVE-032).
    expect(run.opened).toEqual([]);
    // El piloto, sin turbo, gana al menos el bronce; el oro pide turbo e impulsos.
    const medal = medalFor(run.finish!.ms, spec.medals);
    expect(medal).not.toBeNull();
    expect(medal).not.toBe('gold');
  });

  it('la salida no arranca sola (T73): avisa, el piloto pulsa «Empezar» y luego cuenta atrás', () => {
    const types = run.events.map((e) => e.type);
    expect(types.slice(0, 3)).toEqual(['ready', 'countdown', 'go']);
    expect(run.ready).toBe(1);
  });

  it('cada rampa lanza al barco en cada vuelta y al caer salpica (T73)', () => {
    const ramps = rampsOf(world);
    expect(ramps.size).toBeGreaterThanOrEqual(2);
    const jumps = run.jumps.filter((e) => e.type === 'jump');
    const splashes = run.jumps.filter((e) => e.type === 'splash');
    expect(jumps).toHaveLength(ramps.size * spec.laps);
    expect(splashes).toHaveLength(jumps.length);
    // Despegue y chapuzón, siempre en ese orden y de la misma rampa.
    run.jumps.forEach((e, i) => {
      expect(e.type).toBe(i % 2 ? 'splash' : 'jump');
      if (i % 2) expect(e.objectId).toBe(run.jumps[i - 1]!.objectId);
    });
    expect(new Set(jumps.map((e) => e.objectId))).toEqual(new Set(ramps.keys()));
  });

  it('en los dos mundos (Los Rápidos y El Penyal) el circuito es el mismo y se corre igual', () => {
    expect(worlds.length).toBeGreaterThanOrEqual(2);
    for (const w of worlds.slice(1)) {
      const s = circuitFromWorld(w.world, CIRCUIT_ID)!;
      expect(s.gates).toEqual(spec.gates);
      expect(circuitRecordId(s)).toBe(circuitRecordId(spec));
      expect(botRace(w.world).finish?.ms, w.id).toBe(run.finish!.ms);
    }
  });

  it('la grabación de la carrera es el fantasma: repite el recorrido del piloto', () => {
    const g = run.ghost!;
    expect(g.ms).toBe(run.finish!.ms);
    const start = startPose(world, spec)!;
    const at0 = ghostPose(g, 0)!;
    expect(Math.hypot(at0.x - start.x, at0.y - start.y)).toBeLessThan(1);
    // A media carrera va lejos de la salida y a la meta vuelve a ella.
    const mid = ghostPose(g, g.ms / 2)!;
    expect(Math.hypot(mid.x - start.x, mid.y - start.y)).toBeGreaterThan(100);
    const end = ghostPose(g, g.ms)!;
    const reach = world.objects.find((o) => o.identity.id === 'circuito')!.geometry.activation!
      .radius;
    expect(Math.hypot(end.x - start.x, end.y - start.y)).toBeLessThan(reach + 60);
    expect(ghostPose(g, g.ms + 1)).toBeNull();
  });
});

/** Distancia de `p` al segmento `a`–`b` y fracción del segmento en su punto más cercano. */
function toSegment(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return { d: Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y), t };
}

describe('Los Rápidos v3 (T73): el trazado por el mapa de /mar', () => {
  const start = startPose(world, spec)!;
  /** Las boias de una vuelta, de la salida a la salida. */
  const course = [start, ...lapTargets(world, spec)];
  const legs = course.slice(0, -1).map((a, i) => ({ a, b: course[i + 1]! }));
  const active = world.objects.filter((o) => o.identity.active);
  const pads = active.filter((o) => o.identity.category === 'impulso' || o.identity.category === 'rampa');
  const islands = active.filter((o) => o.identity.category === 'isla');
  const obstacles = active.filter(
    (o) =>
      o.position.zone === 'circuito' &&
      o.behaviors.some((b) => b.type === 'collision' && b.params.mode !== 'boost'),
  );
  const pos = (o: (typeof active)[number]) => ({ x: o.position.x, y: o.position.y });

  it('cada impulso y cada rampa va entre dos boias seguidas y apunta a la siguiente', () => {
    expect(pads.filter((o) => o.identity.category === 'impulso').length).toBeGreaterThanOrEqual(3);
    expect(pads.filter((o) => o.identity.category === 'rampa').length).toBeGreaterThanOrEqual(2);
    for (const o of pads) {
      const p = pos(o);
      const leg = legs.find(({ a, b }) => {
        const s = toSegment(p, a, b);
        return s.d < 20 && s.t > 0.15 && s.t < 0.85;
      });
      expect(leg, `${o.identity.id}: en mitad de un tramo`).toBeDefined();
      const want = Math.atan2(leg!.b.y - p.y, leg!.b.x - p.x);
      const heading = o.params?.heading as number;
      const off = Math.atan2(Math.sin(heading - want), Math.cos(heading - want));
      expect(Math.abs(off), `${o.identity.id}: hacia la boia siguiente`).toBeLessThan(0.1);
      // Y dan impulso al pasar (las rampas, además, el salto).
      expect(o.behaviors.some((b) => b.type === 'collision' && b.params.mode === 'boost')).toBe(true);
      if (o.identity.category === 'rampa') expect(rampsOf(world).has(o.identity.id)).toBe(true);
    }
  });

  it('el camino no entra en el radio de ninguna isla y nada del circuito pisa una', () => {
    const ship = MAR_SHIP_CONFIG.radius;
    for (const isl of islands) {
      const c = pos(isl);
      const reach = isl.geometry.proximityRadius ?? 0;
      for (const [i, { a, b }] of legs.entries()) {
        expect(toSegment(c, a, b).d, `tramo ${i} y ${isl.identity.id}`).toBeGreaterThan(reach + ship);
      }
      for (const o of [...pads, ...obstacles]) {
        const d = Math.hypot(o.position.x - c.x, o.position.y - c.y);
        expect(d, `${o.identity.id} y ${isl.identity.id}`).toBeGreaterThan(footprintOf(isl) + 60);
      }
    }
  });

  it('más largo y repartido: las boias cubren buena parte del ancho y del alto del mapa', () => {
    const xs = course.map((p) => p.x);
    const ys = course.map((p) => p.y);
    const b = world.bounds;
    expect((Math.max(...xs) - Math.min(...xs)) / (b.right - b.left)).toBeGreaterThan(0.6);
    expect((Math.max(...ys) - Math.min(...ys)) / (b.bottom - b.top)).toBeGreaterThan(0.55);
    // Pasa por el este y por el oeste, por el norte y por el sur de la Isla de Halloween (el centro).
    const center = pos(islands.find((o) => o.identity.id === 'halloween')!);
    expect(xs.some((x) => x < center.x - 500) && xs.some((x) => x > center.x + 500)).toBe(true);
    expect(ys.some((y) => y < center.y - 500) && ys.some((y) => y > center.y + 500)).toBe(true);
  });

  it('obstáculos por el camino: junto a la mayoría de los tramos hay una roca, una medusa o un cocodrilo', () => {
    const near = new Set<number>();
    for (const o of obstacles) {
      legs.forEach(({ a, b }, i) => {
        if (toSegment(pos(o), a, b).d < 120) near.add(i);
      });
    }
    expect(near.size).toBeGreaterThan(legs.length / 2);
    // Pero no tapan el paso: ninguno a menos de su radio más el del barco de la línea recta.
    for (const o of obstacles.filter((x) => x.identity.category !== 'cocodrilo')) {
      const r = footprintOf(o) + MAR_SHIP_CONFIG.radius;
      for (const { a, b } of legs) expect(toSegment(pos(o), a, b).d, o.identity.id).toBeGreaterThan(r);
    }
  });
});

describe('el fantasma guardado en el navegador', () => {
  const memory = () => {
    const m = new Map<string, string>();
    return {
      m,
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
    };
  };

  it('se guarda la mejor carrera y se lee tal cual; una peor no la pisa', () => {
    const store = memory();
    const g = run.ghost!;
    expect(loadGhost(store, spec)).toBeNull();
    expect(saveGhost(store, spec, g)).toBe(true);
    expect(loadGhost(store, spec)).toEqual(g);
    expect(saveGhost(store, spec, { ...g, ms: g.ms + 1 })).toBe(false);
    expect(loadGhost(store, spec)!.ms).toBe(g.ms);
    expect(saveGhost(store, spec, { ...g, ms: g.ms - 1 })).toBe(true);
    // Por circuito y versión, como el récord.
    expect([...store.m.keys()]).toEqual([ghostKey(spec)]);
    expect(ghostKey(spec)).toContain(circuitRecordId(spec));
  });

  it('sin almacenamiento, o con algo roto guardado, no hay fantasma (ni error)', () => {
    expect(loadGhost(null, spec)).toBeNull();
    expect(saveGhost(null, spec, run.ghost!)).toBe(false);
    const store = memory();
    store.setItem(ghostKey(spec), '{roto');
    expect(loadGhost(store, spec)).toBeNull();
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error('lleno');
      },
    };
    expect(saveGhost(full, spec, run.ghost!)).toBe(false);
  });
});

describe('raceCheckpoint', () => {
  it('un objeto que no es del circuito no hace nada', () => {
    const race = new CircuitRace(spec);
    expect(raceCheckpoint(race, 'puerto', 1)).toEqual([]);
    expect(race.active).toBe(false);
  });

  it('la meta guarda el récord con una clave que el repositorio acepta y cuenta para los logros', async () => {
    const repo = createLocalRepository({ storage: null, watch: false });
    const f = run.finish!;
    const lap = await finishLap(repo.progress, spec, f.ms, f.route);
    expect(lap.best).toBe(true);
    expect(lap.bestMs).toBe(f.ms);
    expect(await repo.progress.record(circuitRecordId(spec))).toEqual(
      expect.objectContaining({ bestMs: f.ms }),
    );
    expect(lap.achievements.length).toBeGreaterThan(0);
  });
});

// Para afinar las medallas a mano: `MEDIR=1 pnpm exec vitest run app/mar/race.test.ts`.
if (process.env.MEDIR) {
  it('mide', () => {
    console.log('total', run.finish?.ms, 'vueltas', run.finish?.laps, 'medallas', spec.medals);
  });
}
