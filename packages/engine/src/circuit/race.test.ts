import { CIRCUIT_ID, CIRCUIT_VERSION, WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import {
  CircuitRace,
  type RecordSink,
  circuitFromWorld,
  circuitRecordId,
  formatRaceTime,
  legacyCircuitRecordId,
  readRecord,
  submitRecord,
} from './race';

const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config;
const spec = circuitFromWorld(world, CIRCUIT_ID)!;

/** Una vuelta: salida en t0, arcos cada 5 s por la rama que toque. */
function lap(race: CircuitRace, t0: number, branch: 'segura' | 'atajo', finishAt: number) {
  const events = [...race.checkpoint(0, t0)];
  const go = t0 + spec.countdown;
  events.push(...race.tick(go));
  events.push(...race.checkpoint(1, go + 5));
  events.push(...race.checkpoint(2, go + (branch === 'atajo' ? 10 : 12)));
  events.push(...race.checkpoint(3, go + finishAt - 5));
  events.push(...race.checkpoint(spec.finishOrder, go + finishAt));
  return events;
}

describe('El Freu en los datos del mundo', () => {
  it('salida, CP1, las dos ramas con el mismo orden, CP2 y meta; versión del circuito', () => {
    expect(spec.version).toBe(CIRCUIT_VERSION);
    const orders = spec.gates.map((g) => g.order).sort();
    expect(orders).toEqual([0, 1, 2, 2, 3, 4]);
    expect(spec.finishOrder).toBe(4);
    expect(circuitRecordId(spec)).toBe(`circuito:${CIRCUIT_ID}:v${CIRCUIT_VERSION}`);
    // Clave estable del repositorio: minúsculas, cifras y `-_:./` (sin la @ de antes).
    expect(circuitRecordId(spec)).toMatch(/^[a-z0-9]+([-_:./][a-z0-9]+)*$/);
    expect(legacyCircuitRecordId(spec)).toBe(`circuito:${CIRCUIT_ID}@v${CIRCUIT_VERSION}`);
  });
});

describe('carrera', () => {
  it('cuenta atrás, arcos en orden y meta con el tiempo desde «¡Ya!»', () => {
    const race = new CircuitRace(spec);
    const events = lap(race, 100, 'segura', 58.25);
    expect(events.map((e) => e.type)).toEqual([
      'countdown',
      'go',
      'checkpoint',
      'checkpoint',
      'checkpoint',
      'finish',
    ]);
    expect(events.at(-1)).toEqual({ type: 'finish', ms: 58250, route: [] });
    expect(race.active).toBe(false);
  });

  it('por el atajo vale igual', () => {
    const race = new CircuitRace(spec);
    expect(lap(race, 0, 'atajo', 51).at(-1)).toEqual({ type: 'finish', ms: 51000, route: [] });
  });

  it('con el id de cada arco, la meta dice por qué rama se pasó', () => {
    const race = new CircuitRace(spec);
    const shortcut = spec.gates.filter((g) => g.order === 2).map((g) => g.objectId);
    expect(shortcut).toHaveLength(2);
    const [a, b] = shortcut as [string, string];
    const at = (order: number) => spec.gates.find((g) => g.order === order)!.objectId;
    race.checkpoint(0, 0, at(0));
    race.tick(spec.countdown);
    race.checkpoint(1, spec.countdown + 5, at(1));
    race.checkpoint(2, spec.countdown + 10, a);
    // La otra rama después ya no cuenta (fuera de orden).
    race.checkpoint(2, spec.countdown + 11, b);
    race.checkpoint(3, spec.countdown + 20, at(3));
    const end = race.checkpoint(spec.finishOrder, spec.countdown + 30, at(spec.finishOrder));
    expect(end.at(-1)).toEqual({
      type: 'finish',
      ms: 30_000,
      route: [at(1), a, at(3), at(spec.finishOrder)],
    });
    // Una vuelta nueva empieza con la ruta vacía.
    race.checkpoint(0, 100, at(0));
    race.tick(100 + spec.countdown);
    for (const o of [1, 2, 3]) race.checkpoint(o, 110 + o);
    expect(race.checkpoint(spec.finishOrder, 120).at(-1)).toMatchObject({ route: [] });
  });

  it('un arco fuera de orden no cuenta y la meta sin pasar por todos tampoco', () => {
    const race = new CircuitRace(spec);
    race.checkpoint(0, 0);
    race.tick(spec.countdown);
    expect(race.checkpoint(3, 10)).toEqual([]);
    expect(race.checkpoint(spec.finishOrder, 20)).toEqual([]);
    expect(race.view(20).next).toBe(1);
  });

  it('antes de «¡Ya!» los arcos no cuentan', () => {
    const race = new CircuitRace(spec);
    race.checkpoint(0, 0);
    expect(race.checkpoint(1, 1)).toEqual([]);
    expect(race.view(1).phase).toBe('countdown');
    expect(race.view(1).countdown).toBeCloseTo(spec.countdown - 1);
  });

  it('abrir un panel, ocultar la pestaña o teletransportarse anula el intento', () => {
    for (const reason of ['panel', 'hidden', 'teleport'] as const) {
      const race = new CircuitRace(spec);
      race.checkpoint(0, 0);
      race.tick(spec.countdown);
      race.checkpoint(1, 5);
      expect(race.invalidate(reason)).toEqual({ type: 'invalid', reason });
      expect(race.checkpoint(2, 8)).toEqual([]);
      expect(race.checkpoint(spec.finishOrder, 30)).toEqual([]);
    }
    expect(new CircuitRace(spec).invalidate('panel')).toBeNull();
  });

  it('una vuelta eterna caduca', () => {
    const race = new CircuitRace(spec);
    race.checkpoint(0, 0);
    race.tick(spec.countdown);
    expect(race.tick(spec.countdown + spec.maxDuration + 1)).toEqual([
      { type: 'invalid', reason: 'timeout' },
    ]);
  });

  it('el tiempo se lee pequeño: segundos con décima o minutos', () => {
    expect(formatRaceTime(58_250)).toBe('58,2 s');
    expect(formatRaceTime(62_300)).toBe('1:02,3');
  });
});

describe('récord local', () => {
  it('se guarda por circuito y versión, y sólo mejora', async () => {
    const records = new Map<string, number>();
    const sink: RecordSink = {
      record: async (id) => (records.has(id) ? { bestMs: records.get(id)! } : null),
      submitTime: async (id, ms) => {
        const prev = records.get(id);
        const best = prev === undefined || ms < prev;
        if (best) records.set(id, ms);
        return { best, record: { bestMs: records.get(id)! } };
      },
    };
    expect(await submitRecord(sink, spec, 60_000)).toEqual({ best: true, bestMs: 60_000 });
    expect(await submitRecord(sink, spec, 65_000)).toEqual({ best: false, bestMs: 60_000 });
    expect(await submitRecord(sink, spec, 55_000)).toEqual({ best: true, bestMs: 55_000 });
    expect(await submitRecord(sink, { ...spec, version: 2 }, 70_000)).toEqual({
      best: true,
      bestMs: 70_000,
    });
  });
});

describe('récord guardado con la clave de antes (T37)', () => {
  const sinkWith = (records: Map<string, number>): RecordSink => ({
    record: async (id) => (records.has(id) ? { bestMs: records.get(id)! } : null),
    submitTime: async (id, ms) => {
      const prev = records.get(id);
      const best = prev === undefined || ms < prev;
      if (best) records.set(id, ms);
      return { best, record: { bestMs: records.get(id)! } };
    },
  });

  it('se sigue leyendo y cuenta para el récord', async () => {
    const records = new Map([[legacyCircuitRecordId(spec), 50_000]]);
    const sink = sinkWith(records);
    expect(await readRecord(sink, spec)).toEqual({ bestMs: 50_000 });
    expect(await submitRecord(sink, spec, 55_000)).toEqual({ best: false, bestMs: 50_000 });
    expect(await readRecord(sink, spec)).toEqual({ bestMs: 50_000 });
    expect(await submitRecord(sink, spec, 45_000)).toEqual({ best: true, bestMs: 45_000 });
    expect(records.get(circuitRecordId(spec))).toBe(45_000);
    expect(await readRecord(sink, spec)).toEqual({ bestMs: 45_000 });
  });

  it('si leer la clave vieja falla, vale la nueva', async () => {
    const records = new Map<string, number>();
    const sink = sinkWith(records);
    const strict: RecordSink = {
      submitTime: sink.submitTime,
      record: async (id) => {
        if (id.includes('@')) throw new Error('clave no válida');
        return sink.record(id);
      },
    };
    expect(await submitRecord(strict, spec, 60_000)).toEqual({ best: true, bestMs: 60_000 });
    expect(await readRecord(strict, spec)).toEqual({ bestMs: 60_000 });
  });
});
