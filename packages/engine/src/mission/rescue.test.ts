import { WORLD_REGISTRY, type WorldConfig } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SHIP_CONFIG } from '../ship/config';
import { createShipState } from '../ship/controller';
import { WorldRuntime } from '../world/runtime';
import {
  BOARD_SECONDS,
  CROC_INTERVAL,
  LAND_SECONDS,
  type MissionEvent,
  type MissionHost,
  type Point,
  RescueMission,
  missionDestination,
  rescueMissionOf,
} from './rescue';

/**
 * La misión de la Boia Fiestera (T21, REQ-AVE-005…010) sobre el mundo por
 * defecto de verdad: cocodrilos que se sumergen uno a uno, rescate, a bordo,
 * entrega en su destino guardado por id y el mundo abierto después. Todo sale
 * de los datos del mapa, no de números escritos aquí.
 */

const worlds = WORLD_REGISTRY;
const world = worlds.get(worlds.defaultId).config;
const spec = rescueMissionOf(world)!;
const DT = 1 / 60;

function host(runtime: WorldRuntime) {
  const h = {
    runtime,
    passenger: false,
    moveObject: (id: string, x: number, y: number, z?: number) => runtime.moveObject(id, x, y, z),
    setObjectPresent: (id: string, on: boolean) => runtime.setObjectPresent(id, on),
    setObjectInteractive: (id: string, on: boolean) => runtime.setObjectInteractive(id, on),
    setPassenger: (on: boolean) => {
      h.passenger = on;
    },
  } satisfies MissionHost & Record<string, unknown>;
  return h;
}

/** Deja el barco quieto en `p` durante `seconds` y junta los eventos. */
function hold(m: RescueMission, h: MissionHost, p: Point, seconds: number): MissionEvent[] {
  const out: MissionEvent[] = [];
  for (let t = 0; t < seconds - 1e-9; t += DT) out.push(...m.step(h, p, DT));
  return out;
}

const far = { x: spec.home.x, y: spec.home.y + spec.crocRadius * 4 };
const betweenRadii = { x: spec.home.x, y: spec.home.y + (spec.crocRadius + spec.rescueRadius) / 2 };
const atHer = { x: spec.home.x, y: spec.home.y + spec.rescueRadius * 0.5 };

function fresh(w: WorldConfig = world) {
  const rt = new WorldRuntime(w);
  const h = host(rt);
  const m = new RescueMission(w, rescueMissionOf(w)!);
  return { rt, h, m };
}

describe('la misión sale de los datos del mapa', () => {
  it('personaje, cocodrilos de su zona, destino existente y arte de tripulante', () => {
    expect(spec.characterId).toBeDefined();
    expect(spec.crocIds.length).toBeGreaterThanOrEqual(3);
    expect(spec.crocIds.length).toBeLessThanOrEqual(4);
    expect(spec.crocRadius).toBeGreaterThan(spec.rescueRadius);
    const d = missionDestination(world, spec.destination);
    expect(d, 'el destino existe en el mundo').not.toBeNull();
    expect(d!.reward.points + d!.reward.coins).toBeGreaterThan(0);
    expect(spec.crewAsset).toMatch(/#tripulante$/);
  });

  it('el premio de la entrega lleva el código del destino (T59), y sin él no hay código', () => {
    const o = world.objects.find((x) => x.identity.id === spec.destination)!;
    const declared = (o.params?.missionReward as { discount?: string }).discount;
    expect(declared, 'la misión central da un código de entradas').toBeTruthy();
    expect(missionDestination(world, spec.destination)!.reward.discount).toBe(declared);
    const plain: WorldConfig = {
      ...world,
      objects: world.objects.map((x) =>
        x === o
          ? { ...x, params: { ...x.params, missionReward: { points: 1, coins: 1 } } }
          : x,
      ),
    };
    expect(missionDestination(plain, spec.destination)!.reward).toEqual({ points: 1, coins: 1 });
  });

  it('sin destino en el mapa no hay misión (REQ-AVE-010)', () => {
    const noDest: WorldConfig = {
      ...world,
      objects: world.objects.filter((o) => o.identity.id !== spec.destination),
    };
    expect(rescueMissionOf(noDest)).toBeNull();
  });

  it('cada mundo del registro juega la misma misión con su piel', () => {
    for (const s of worlds.list()) {
      const other = rescueMissionOf(worlds.get(s.id).config);
      expect(other?.missionId, s.id).toBe(spec.missionId);
      expect(other?.destination, s.id).toBe(spec.destination);
    }
  });
});

describe('los pasos van en orden', () => {
  it('no hace nada hasta saber lo guardado', () => {
    const { h, m } = fresh();
    expect(hold(m, h, atHer, 3)).toEqual([]);
    expect(m.phase).toBe('loading');
  });

  it('cocodrilos uno a uno, rescate, a bordo, entrega y mundo abierto', () => {
    const { rt, h, m } = fresh();
    m.restore(null);
    expect(m.phase).toBe('waiting');

    // Llegar al destino antes de rescatarla no entrega nada.
    const dest = missionDestination(world, spec.destination)!;
    expect(hold(m, h, dest.center, 1).filter((e) => e.type === 'delivered')).toEqual([]);

    // Dentro del radio de los cocodrilos: se sumergen de uno en uno, cada CROC_INTERVAL.
    const dives: number[] = [];
    let t = 0;
    for (; t < CROC_INTERVAL * (spec.crocIds.length + 2); t += DT) {
      for (const e of m.step(h, betweenRadii, DT)) if (e.type === 'croc_dive') dives.push(t);
    }
    expect(dives).toHaveLength(spec.crocIds.length);
    for (let i = 1; i < dives.length; i++) {
      expect(dives[i]! - dives[i - 1]!).toBeCloseTo(CROC_INTERVAL, 1);
    }
    for (const id of spec.crocIds) expect(rt.objectState(id)!.present).toBe(false);
    // Aún no la ha rescatado: está fuera del radio de rescate.
    expect(m.phase).toBe('waiting');

    // En el radio de rescate: sube a bordo con un saltito y sale el aviso.
    const ev = hold(m, h, atHer, BOARD_SECONDS + 0.2);
    expect(ev.map((e) => e.type).filter((x) => x === 'rescued' || x === 'boarded')).toEqual([
      'rescued',
      'boarded',
    ]);
    expect(ev.find((e) => e.type === 'rescued')).toMatchObject({
      character: spec.character,
      destination: spec.destination,
    });
    expect(m.phase).toBe('aboard');
    expect(h.passenger).toBe(true);
    expect(rt.objectState(spec.characterId)!.present).toBe(false);

    // Lejos del remanso, los cocodrilos vuelven a salir.
    hold(m, h, far, CROC_INTERVAL * (spec.crocIds.length + 2));
    for (const id of spec.crocIds) expect(rt.objectState(id)!.present).toBe(true);

    // En el destino, desde cualquier lado: baja y se queda en el nicho.
    const side = { x: dest.center.x - dest.radius * 0.9, y: dest.center.y };
    const land = hold(m, h, side, LAND_SECONDS + 0.2);
    expect(land.map((e) => e.type)).toEqual(['delivered', 'landed']);
    expect(land[0]).toMatchObject({ destination: spec.destination, reward: dest.reward });
    expect(m.phase).toBe('delivered');
    expect(h.passenger).toBe(false);
    const s = rt.objectState(spec.characterId)!;
    expect(s.present).toBe(true);
    expect({ x: s.x, y: s.y, z: s.z }).toEqual(dest.drop);

    // Mundo abierto: ya no pasa nada más, ni cerca de ella ni al volver al remanso.
    expect(hold(m, h, dest.center, 2).filter((e) => e.type !== 'croc_dive')).toEqual([]);
    expect(
      hold(m, h, atHer, 3).filter((e) => e.type !== 'croc_dive' && e.type !== 'croc_emerge'),
    ).toEqual([]);
  });

  it('con un cocodrilo aún arriba no sube a bordo', () => {
    const { h, m } = fresh();
    m.restore(null);
    // Directamente junto a ella: primero tienen que sumergirse todos.
    const ev: MissionEvent[] = [];
    let rescuedAt = -1;
    let lastDive = -1;
    for (let t = 0; t < CROC_INTERVAL * (spec.crocIds.length + 1) + BOARD_SECONDS; t += DT) {
      for (const e of m.step(h, atHer, DT)) {
        ev.push(e);
        if (e.type === 'croc_dive') lastDive = t;
        if (e.type === 'rescued') rescuedAt = t;
      }
    }
    expect(rescuedAt).toBeGreaterThanOrEqual(lastDive);
    expect(ev.filter((e) => e.type === 'croc_dive')).toHaveLength(spec.crocIds.length);
  });

  it('a bordo, la Fiestera no choca ni habla, y entregada tampoco', () => {
    const { rt, h, m } = fresh();
    m.restore({ step: 'delivered', destination: spec.destination });
    m.step(h, far, DT);
    const d = missionDestination(world, spec.destination)!;
    rt.drainEvents();
    // El barco pasa por encima del nicho: nada de su diálogo ni su colisión.
    rt.step(createShipState(d.drop.x, d.drop.y, 0), DEFAULT_SHIP_CONFIG, DT);
    expect(rt.drainEvents().filter((e) => e.objectId === spec.characterId)).toEqual([]);
    expect(rt.solidObstacles().some((o) => o.x === d.drop.x && o.y === d.drop.y)).toBe(false);
  });
});

describe('lo guardado manda', () => {
  it('rescatada en otra visita: vuelve a bordo, sin repetir el rescate', () => {
    const { rt, h, m } = fresh();
    m.restore({ step: 'rescued', destination: spec.destination });
    const ev = hold(m, h, atHer, 3);
    expect(ev.filter((e) => e.type === 'rescued' || e.type === 'boarded')).toEqual([]);
    expect(h.passenger).toBe(true);
    expect(rt.objectState(spec.characterId)!.present).toBe(false);
  });

  it('el destino guardado sobrevive al cambio de mundo y al del Admin', () => {
    const other = worlds.list().find((w) => w.id !== world.id);
    expect(other, 'hay otro mundo en el registro').toBeDefined();
    const otherWorld = worlds.get(other!.id).config;
    const { h, m } = fresh();
    m.restore(null);
    hold(m, h, betweenRadii, CROC_INTERVAL * (spec.crocIds.length + 1));
    hold(m, h, atHer, BOARD_SECONDS + 0.1);
    expect(m.phase).toBe('aboard');

    // Otro mundo, con runtime nuevo: sigue a bordo y con el mismo destino.
    expect(m.setWorld(otherWorld)).toBe(true);
    const rt2 = new WorldRuntime(otherWorld);
    const h2 = host(rt2);
    m.step(h2, far, DT);
    expect(h2.passenger).toBe(true);
    expect(rt2.objectState(spec.characterId)!.present).toBe(false);
    expect(m.destination).toBe(spec.destination);
    const d = missionDestination(otherWorld, spec.destination)!;
    const ev = hold(m, h2, d.center, LAND_SECONDS + 0.2).filter((e) => !e.type.startsWith('croc_'));
    expect(ev.map((e) => e.type)).toEqual(['delivered', 'landed']);
  });

  it('una partida empezada no cambia de destino si el mapa elige otro para las nuevas', () => {
    // El Admin mueve el destino de las partidas nuevas a otra isla (REQ-AVE-011).
    const newDest = world.objects.find(
      (o) => o.identity.category === 'isla' && o.identity.id !== spec.destination,
    )!;
    const moved: WorldConfig = {
      ...world,
      objects: world.objects.map((o) => {
        const params = { ...o.params };
        if (o.identity.id === spec.destination) delete params.missionDestination;
        if (o.identity.id === newDest.identity.id) params.missionDestination = spec.missionId;
        return { ...o, params };
      }),
    };
    expect(rescueMissionOf(moved)!.destination).toBe(newDest.identity.id);
    const { h, m } = fresh(moved);
    m.restore({ step: 'rescued', destination: spec.destination });
    expect(m.destination).toBe(spec.destination);
    const atNew = missionDestination(moved, newDest.identity.id)!;
    expect(hold(m, h, atNew.center, 1).filter((e) => e.type === 'delivered')).toEqual([]);
    const atOld = missionDestination(moved, spec.destination)!;
    expect(hold(m, h, atOld.center, 0.1).map((e) => e.type)).toContain('delivered');
  });
});
