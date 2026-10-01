import { CircuitRace, circuitFromWorld, circuitRecordId } from '@boia/engine/circuit';
import { createLocalRepository } from '@boia/store';
import { CIRCUIT_ID, WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { finishLap } from '../../lib/mundo/circuit-hud';
import { marWorld } from './engine/compact';
import { raceCheckpoint } from './race';

/**
 * El Freu en /mar (T37): los arcos llegan por id de objeto y la vuelta
 * recuerda su rama, así que el logro oculto del atajo también se completa
 * aquí, y el récord se guarda.
 */

const world = marWorld(WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config);
const spec = circuitFromWorld(world, CIRCUIT_ID)!;
const byOrder = (order: number) =>
  spec.gates.filter((g) => g.order === order).map((g) => g.objectId);

describe('raceCheckpoint', () => {
  it('un objeto que no es arco no hace nada', () => {
    const race = new CircuitRace(spec);
    expect(raceCheckpoint(race, 'puerto', 1)).toEqual([]);
    expect(race.active).toBe(false);
  });

  it('una vuelta por cada rama termina con esa rama en la ruta, y el atajo completa su logro', async () => {
    const repo = createLocalRepository({ storage: null, watch: false });
    const defs = await repo.content.list('achievements');
    const shortcut = defs.find(
      (d) =>
        d.trigger === 'complete_circuit' &&
        typeof (d.triggerParams as Record<string, unknown>).via === 'string',
    )!;
    const via = (shortcut.triggerParams as Record<string, unknown>).via as string;
    const branches = byOrder(2);
    expect(branches).toContain(via);

    for (const branch of branches) {
      const race = new CircuitRace(spec);
      const [start] = byOrder(0);
      raceCheckpoint(race, start!, 0);
      race.tick(spec.countdown);
      const t = spec.countdown;
      raceCheckpoint(race, byOrder(1)[0]!, t + 5);
      raceCheckpoint(race, branch, t + 10);
      for (let o = 3; o < spec.finishOrder; o++) raceCheckpoint(race, byOrder(o)[0]!, t + 10 + o);
      const events = raceCheckpoint(race, byOrder(spec.finishOrder)[0]!, t + 60);
      const finish = events.find((e) => e.type === 'finish');
      expect(finish?.type).toBe('finish');
      if (finish?.type !== 'finish') continue;
      expect(finish.route).toContain(branch);

      const lap = await finishLap(repo.progress, spec, finish.ms, finish.route);
      const ids = lap.achievements.map((n) => n.id);
      if (branch === via) expect(ids).toContain(`logro:${shortcut.id}`);
      else expect(ids).not.toContain(`logro:${shortcut.id}`);
    }
    // El récord de la vuelta se guarda con una clave que el repositorio acepta.
    expect(await repo.progress.record(circuitRecordId(spec))).not.toBeNull();
  });
});
