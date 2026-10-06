import {
  CIRCUIT_ID,
  CIRCUIT_LAPS,
  CIRCUIT_MEDALS,
  CIRCUIT_VERSION,
  WORLD_REGISTRY,
  type WorldConfig,
} from '@boia/world';
import { describe, expect, it } from 'vitest';
import { GhostRecorder, decodeGhost, encodeGhost, ghostPose } from './ghost';
import {
  CircuitRace,
  type CircuitSpec,
  DEFAULT_CIRCUIT_LAPS,
  DEFAULT_CIRCUIT_MEDALS,
  MEDALS,
  type RaceEvent,
  type RecordSink,
  circuitFromWorld,
  circuitRecordId,
  formatRaceTime,
  legacyCircuitRecordId,
  medalFor,
  nextMedal,
  readRecord,
  submitRecord,
} from './race';

const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config;
const spec = circuitFromWorld(world, CIRCUIT_ID)!;
const idOf = (order: number) => spec.gates.find((g) => g.order === order)!.objectId;

/** Llega a la salida en `t0`, pulsa «Empezar» y devuelve el instante de «¡Ya!». */
function start(race: CircuitRace, t0 = 0): number {
  race.checkpoint(0, t0, idOf(0));
  race.start(t0);
  const go = t0 + spec.countdown;
  race.tick(go);
  return go;
}

/** Una vuelta entera desde `t` (s), una boia cada `every` s y la salida al final. */
function lap(race: CircuitRace, t: number, every = 2): { events: RaceEvent[]; end: number } {
  const events: RaceEvent[] = [];
  for (let o = 1; o <= spec.buoys; o++) events.push(...race.checkpoint(o, t + o * every, idOf(o)));
  const end = t + (spec.buoys + 1) * every;
  events.push(...race.checkpoint(0, end, idOf(0)));
  return { events, end };
}

describe('Los Rápidos en los datos del mundo', () => {
  it('una salida que es también meta, boias numeradas en orden, vueltas y medallas; versión del circuito', () => {
    expect(spec.version).toBe(CIRCUIT_VERSION);
    const orders = spec.gates.map((g) => g.order).sort((a, b) => a - b);
    expect(orders).toEqual(Array.from({ length: spec.buoys + 1 }, (_, i) => i));
    expect(spec.buoys).toBeGreaterThanOrEqual(4);
    expect(spec.laps).toBe(CIRCUIT_LAPS);
    expect(spec.medals).toEqual(CIRCUIT_MEDALS);
    expect(circuitRecordId(spec)).toBe(`circuito:${CIRCUIT_ID}:v${CIRCUIT_VERSION}`);
    // Clave estable del repositorio: minúsculas, cifras y `-_:./` (sin la @ de antes).
    expect(circuitRecordId(spec)).toMatch(/^[a-z0-9]+([-_:./][a-z0-9]+)*$/);
    expect(legacyCircuitRecordId(spec)).toBe(`circuito:${CIRCUIT_ID}@v${CIRCUIT_VERSION}`);
  });

  it('sin vueltas ni medallas válidas en la salida, valen las de por defecto', () => {
    const bare: WorldConfig = {
      ...world,
      objects: world.objects.map((o) =>
        o.identity.id === idOf(0)
          ? { ...o, params: { ...o.params, laps: 0, medals: { gold: 9, silver: 5, bronze: 1 } } }
          : o,
      ),
    };
    const s = circuitFromWorld(bare, CIRCUIT_ID)!;
    expect(s.laps).toBe(DEFAULT_CIRCUIT_LAPS);
    expect(s.medals).toEqual(DEFAULT_CIRCUIT_MEDALS);
  });
});

describe('carrera de tres vueltas', () => {
  it('cuenta atrás, boias en orden, vuelta al pasar por la salida y meta tras la última vuelta', () => {
    const race = new CircuitRace(spec);
    const events = [...race.checkpoint(0, 100, idOf(0)), ...race.start(100)];
    events.push(...race.tick(100 + spec.countdown));
    let t = 100 + spec.countdown;
    for (let l = 0; l < spec.laps; l++) {
      const r = lap(race, t);
      events.push(...r.events);
      t = r.end;
    }
    const types = events.map((e) => e.type);
    expect(types.slice(0, 3)).toEqual(['ready', 'countdown', 'go']);
    expect(types.filter((x) => x === 'checkpoint')).toHaveLength(spec.buoys * spec.laps);
    expect(events.filter((e) => e.type === 'lap')).toEqual(
      Array.from({ length: spec.laps - 1 }, (_, i) => ({
        type: 'lap',
        lap: i + 1,
        lapMs: (spec.buoys + 1) * 2000,
        ms: (i + 1) * (spec.buoys + 1) * 2000,
      })),
    );
    const lapMs = (spec.buoys + 1) * 2000;
    expect(events.at(-1)).toEqual({
      type: 'finish',
      ms: lapMs * spec.laps,
      laps: Array.from({ length: spec.laps }, () => lapMs),
      route: Array.from({ length: spec.buoys }, (_, i) => idOf(i + 1)),
    });
    expect(race.active).toBe(false);
  });

  it('la vista dice la vuelta y la boia que tocan', () => {
    const race = new CircuitRace(spec);
    const go = start(race);
    race.checkpoint(1, go + 1, idOf(1));
    expect(race.view(go + 2)).toMatchObject({
      phase: 'racing',
      elapsedMs: 2000,
      next: 2,
      lap: 1,
      laps: spec.laps,
      buoys: spec.buoys,
    });
  });

  it('saltarse una boia no cuenta la vuelta: la salida avisa de la que falta', () => {
    const race = new CircuitRace(spec);
    const go = start(race);
    race.checkpoint(1, go + 2, idOf(1));
    // La 2 se queda sin pasar: la 3 no cuenta y la salida tampoco cierra la vuelta.
    expect(race.checkpoint(3, go + 4, idOf(3))).toEqual([]);
    expect(race.checkpoint(0, go + 8, idOf(0))).toEqual([{ type: 'missed', order: 2, lap: 1 }]);
    expect(race.view(go + 8)).toMatchObject({ lap: 1, next: 2 });
    // Con todas las boias, la vuelta sí cuenta.
    for (let o = 2; o <= spec.buoys; o++) race.checkpoint(o, go + 8 + o, idOf(o));
    expect(race.checkpoint(0, go + 20, idOf(0))).toEqual([
      { type: 'lap', lap: 1, lapMs: 20_000, ms: 20_000 },
    ]);
    // Rozar la salida al empezar una vuelta (sin boias aún) no avisa de nada.
    expect(race.checkpoint(0, go + 21, idOf(0))).toEqual([]);
  });

  it('llegar a la salida no arranca la carrera: avisa (`ready`) y espera a «Empezar» (T73)', () => {
    const race = new CircuitRace(spec);
    expect(race.checkpoint(0, 10, idOf(0))).toEqual([{ type: 'ready' }]);
    expect(race.active).toBe(false);
    // Sin empezar, ni el reloj ni las boias hacen nada; cada llegada vuelve a avisar.
    expect(race.tick(20)).toEqual([]);
    expect(race.checkpoint(1, 21, idOf(1))).toEqual([]);
    expect(race.view(21)).toMatchObject({ phase: 'idle', elapsedMs: null, countdown: null });
    expect(race.checkpoint(0, 30, idOf(0))).toEqual([{ type: 'ready' }]);
    // «Empezar»: cuenta atrás desde ese instante; durante ella la salida ya no avisa.
    expect(race.start(31)).toEqual([{ type: 'countdown', goAt: 31 + spec.countdown }]);
    expect(race.checkpoint(0, 32, idOf(0))).toEqual([]);
    expect(race.tick(31 + spec.countdown)).toEqual([{ type: 'go' }]);
  });

  it('antes de «¡Ya!» las boias no cuentan', () => {
    const race = new CircuitRace(spec);
    race.start(0);
    expect(race.checkpoint(1, 1)).toEqual([]);
    expect(race.view(1).phase).toBe('countdown');
    expect(race.view(1).countdown).toBeCloseTo(spec.countdown - 1);
  });

  it('`start` arranca la cuenta atrás (una vez)', () => {
    const race = new CircuitRace(spec);
    expect(race.start(5)).toEqual([{ type: 'countdown', goAt: 5 + spec.countdown }]);
    expect(race.start(6)).toEqual([]);
  });

  it('abrir un panel, ocultar la pestaña o teletransportarse anula el intento', () => {
    for (const reason of ['panel', 'hidden', 'teleport'] as const) {
      const race = new CircuitRace(spec);
      const go = start(race);
      race.checkpoint(1, go + 2);
      expect(race.invalidate(reason)).toEqual({ type: 'invalid', reason });
      expect(race.checkpoint(2, go + 4)).toEqual([]);
      expect(race.active).toBe(false);
    }
    expect(new CircuitRace(spec).invalidate('panel')).toBeNull();
  });

  it('una carrera eterna caduca', () => {
    const race = new CircuitRace(spec);
    const go = start(race);
    expect(race.tick(go + spec.maxDuration + 1)).toEqual([{ type: 'invalid', reason: 'timeout' }]);
  });

  it('el tiempo se lee pequeño: segundos con décima o minutos', () => {
    expect(formatRaceTime(58_250)).toBe('58,2 s');
    expect(formatRaceTime(62_300)).toBe('1:02,3');
  });
});

describe('medallas', () => {
  const m = spec.medals;

  it('oro, plata y bronce por tiempo total; más lento que el bronce, ninguna', () => {
    expect(m.gold).toBeLessThan(m.silver);
    expect(m.silver).toBeLessThan(m.bronze);
    expect(medalFor(m.gold - 1, m)).toBe('gold');
    expect(medalFor(m.gold, m)).toBe('gold');
    expect(medalFor(m.gold + 1, m)).toBe('silver');
    expect(medalFor(m.silver, m)).toBe('silver');
    expect(medalFor(m.silver + 1, m)).toBe('bronze');
    expect(medalFor(m.bronze, m)).toBe('bronze');
    expect(medalFor(m.bronze + 1, m)).toBeNull();
  });

  it('la siguiente medalla a por la que ir', () => {
    expect(nextMedal(m.bronze + 1, m)).toBe('bronze');
    expect(nextMedal(m.bronze, m)).toBe('silver');
    expect(nextMedal(m.silver, m)).toBe('gold');
    expect(nextMedal(m.gold, m)).toBeNull();
    expect(MEDALS).toEqual(['gold', 'silver', 'bronze']);
  });
});

describe('fantasma', () => {
  /** Una carrera grabada a 60 pasos por segundo: un barco que da vueltas a un círculo. */
  function recorded(ms: number) {
    const rec = new GhostRecorder();
    const pose = (t: number) => ({
      x: 1000 + Math.cos(t / 2000) * 300,
      y: -500 + Math.sin(t / 2000) * 300,
      heading: t / 2000 + Math.PI / 2,
    });
    for (let t = 0; t <= ms; t += 1000 / 60) rec.sample(t, pose(t));
    return { run: rec.finish(ms, pose(ms))!, pose };
  }

  it('repite la mejor carrera guardada: donde iba el barco en cada instante', () => {
    const { run, pose } = recorded(30_000);
    const back = decodeGhost(encodeGhost(run))!;
    expect(back).toEqual(run);
    for (const t of [0, 1234, 15_000, 29_950]) {
      const g = ghostPose(back, t)!;
      const p = pose(t);
      // Una muestra se toma en el primer paso tras su instante (1/60 s a 150 u/s: < 3 u).
      expect(Math.hypot(g.x - p.x, g.y - p.y), `t=${t}`).toBeLessThan(5);
      const dh = Math.atan2(Math.sin(g.heading - p.heading), Math.cos(g.heading - p.heading));
      expect(Math.abs(dh)).toBeLessThan(0.02);
    }
    // Pasada su meta, el fantasma ya no está.
    expect(ghostPose(back, 30_001)).toBeNull();
    expect(ghostPose(back, -1)).toBeNull();
  });

  it('una grabación rota o vacía no es un fantasma', () => {
    expect(decodeGhost(null)).toBeNull();
    expect(decodeGhost('no')).toBeNull();
    expect(decodeGhost(JSON.stringify({ v: 1, ms: 10, step: 100, points: [1, 2] }))).toBeNull();
    expect(decodeGhost(JSON.stringify({ v: 2, ms: 10, step: 100, points: [1, 2, 3] }))).toBeNull();
    expect(new GhostRecorder().finish(1000)).toBeNull();
  });

  it('una muestra por paso de grabación, aunque el reloj salte', () => {
    const rec = new GhostRecorder(100);
    rec.sample(0, { x: 0, y: 0, heading: 0 });
    rec.sample(350, { x: 10, y: 0, heading: 0 });
    expect(rec.samples).toBe(4);
    rec.reset();
    expect(rec.samples).toBe(0);
  });
});

describe('récord local', () => {
  it('se guarda el tiempo total por circuito y versión, y sólo mejora', async () => {
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
    const next: CircuitSpec = { ...spec, version: spec.version + 1 };
    expect(await submitRecord(sink, next, 70_000)).toEqual({ best: true, bestMs: 70_000 });
    expect(await readRecord(sink, spec)).toEqual({ bestMs: 55_000 });
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
