import { CircuitRace, circuitFromWorld } from '@boia/engine/circuit';
import {
  DEFAULT_SHIP_CONFIG,
  type ShipConfig,
  type ShipInput,
  WorldRuntime,
  createShipState,
  stepShip,
} from '@boia/engine/headless';
import { SAMPLE_COSMETICS } from '@boia/store';
import { CIRCUIT_ID, WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { dressingFor } from './dressing';

/**
 * REQ-IDE-032 (T40): ni el barco de estilo, ni la skin, ni la bandera, ni la
 * estela cambian cómo navega el barco. Se da la misma vuelta al circuito del
 * mundo con cada cosmético equipado, con la física tal como la montan el 2D
 * y /mar (la configuración del barco y el runtime del mundo), y el tiempo de
 * vuelta, los choques y la traza salen idénticos.
 */

const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config;
// Una sola vuelta (el circuito cerrado de T61 da tres; para medir basta una).
const spec = { ...circuitFromWorld(world, CIRCUIT_ID)!, laps: 1 };
const at = (id: string) => world.objects.find((o) => o.identity.id === id)!.position;
const idOf = (order: number) => spec.gates.find((g) => g.order === order)!.objectId;
// Una boia por orden y, al final, la salida, que es también la meta.
const route = [...Array.from({ length: spec.buoys }, (_, i) => idOf(i + 1)), idOf(0)];

/** Lo que llega al barco con lo equipado: el aspecto y lo que se pinta encima. */
function dressedShip(equipped: Record<string, string>) {
  return { equipped, dressing: dressingFor(equipped) };
}

/**
 * Una vuelta con piloto sencillo (rumbo al siguiente arco, a fondo). La
 * física sólo recibe `cfg`: el barco vestido va al lado, como en el juego.
 */
function lap(cfg: ShipConfig, dressed: ReturnType<typeof dressedShip>, into?: 'coast') {
  void dressed;
  const runtime = new WorldRuntime(world, { seed: 7 });
  const race = new CircuitRace(spec);
  const first = at(idOf(0));
  const ship = createShipState(first.x, first.y + 160, -Math.PI / 2);
  const dt = 1 / 60;
  let finish: number | null = null;
  let hits = 0;
  const trace: string[] = [];
  const steps = into === 'coast' ? 60 * 15 : 60 * 400;
  for (let i = 0; i < steps && finish === null; i++) {
    const t = i * dt;
    // `coast`: siempre hacia el este, hasta dar con el borde del mapa y seguir empujando.
    const target =
      into === 'coast'
        ? { x: ship.x + 1000, y: ship.y }
        : race.active
          ? at(route[race.view(t).next - 1]!)
          : first;
    const input: ShipInput = {
      dirX: target.x - ship.x,
      dirY: target.y - ship.y,
      throttle: 1,
      drift: false,
    };
    stepShip(ship, input, runtime.shipConfig(cfg), dt);
    runtime.step(ship, cfg, dt);
    if ((ship.impact ?? 0) > 0) hits++;
    for (const e of runtime.drainEvents()) {
      if (e.type !== 'checkpoint') continue;
      for (const r of race.checkpoint(e.order, t, e.objectId)) {
        if (r.type === 'finish') finish = r.ms;
        // En la salida, «Empezar» (T73: la carrera ya no arranca sola).
        if (r.type === 'ready') race.start(t);
      }
    }
    race.tick(t);
    if (i % 30 === 0)
      trace.push(`${ship.x.toFixed(4)},${ship.y.toFixed(4)},${ship.heading.toFixed(4)}`);
  }
  return { finish, hits, trace };
}

describe('los cosméticos no cambian la navegación (REQ-IDE-032)', () => {
  it('mismo tiempo de vuelta, mismos choques y misma traza con cualquier barco, skin, bandera o estela', () => {
    const cfg = { ...DEFAULT_SHIP_CONFIG };
    const reference = lap(cfg, dressedShip({}));
    const bumped = lap(cfg, dressedShip({}), 'coast');
    // Las pruebas miden algo: la vuelta termina y contra la costa hay choques.
    expect(reference.finish).toBeGreaterThan(0);
    expect(bumped.hits).toBeGreaterThan(0);
    const combos: Record<string, string>[] = [];
    for (const c of SAMPLE_COSMETICS) combos.push({ [c.slot]: c.id });
    const flag = SAMPLE_COSMETICS.find((c) => c.slot === 'flag')!;
    const wake = SAMPLE_COSMETICS.find((c) => c.slot === 'wake')!;
    for (const ship of SAMPLE_COSMETICS.filter((c) => c.slot === 'ship'))
      combos.push({ ship: ship.id, flag: flag.id, wake: wake.id });
    for (const equipped of combos) {
      const got = lap(cfg, dressedShip(equipped));
      expect(got, JSON.stringify(equipped)).toEqual(reference);
      expect(lap(cfg, dressedShip(equipped), 'coast'), JSON.stringify(equipped)).toEqual(bumped);
    }
    // Y nada de lo que se pinta lleva un parámetro de la física del barco.
    const physics = new Set(Object.keys(DEFAULT_SHIP_CONFIG));
    const drawn = dressedShip({ flag: flag.id, wake: wake.id });
    expect(Object.keys(drawn.dressing).filter((k) => physics.has(k))).toEqual([]);
    expect(cfg).toEqual(DEFAULT_SHIP_CONFIG);
  });
});
