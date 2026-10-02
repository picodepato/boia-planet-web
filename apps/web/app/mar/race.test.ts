import {
  CircuitRace,
  type GhostRun,
  GhostRecorder,
  type RaceEvent,
  circuitFromWorld,
  circuitRecordId,
  ghostPose,
  medalFor,
} from '@boia/engine/circuit';
import { WorldRuntime, createShipState, stepShip } from '@boia/engine/headless';
import { createLocalRepository } from '@boia/store';
import { CIRCUIT_ID, WORLD_REGISTRY, type WorldConfig } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { finishLap } from '../../lib/mundo/circuit-hud';
import { marWorld } from './engine/compact';
import { MAR_SHIP_CONFIG } from './engine/steering';
import { periodOf, planetRect, shortest } from './engine/wrap';
import { ghostKey, lapTargets, loadGhost, raceCheckpoint, saveGhost, startPose } from './race';

/**
 * El Freu en /mar (T37, T61): un circuito cerrado de tres vueltas. Un piloto
 * sencillo (a fondo hacia la siguiente boia, como el teclado) lo corre con la
 * física y el runtime de /mar; las boias llegan por id de objeto, la meta da
 * medalla y la carrera se graba para el fantasma.
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
  let finish: BotRun['finish'] = null;
  let ghost: GhostRun | null = null;
  for (let i = 0; i < maxS * 60 && !finish; i++) {
    const t = i * dt;
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
    for (const e of runtime.drainEvents()) {
      if (e.type === 'checkpoint') out.push(...raceCheckpoint(race, e.objectId, t));
      if (e.type === 'content_open' && race.active) opened.push(e.objectId);
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
  return { events, finish, ghost, opened };
}

const run = botRace(world);

describe('El Freu en /mar: tres vueltas por las boias', () => {
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

  it('en los dos mundos (El Freu y El Penyal) el circuito es el mismo y se corre igual', () => {
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
