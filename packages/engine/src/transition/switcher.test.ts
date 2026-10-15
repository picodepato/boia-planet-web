import { WORLD_REGISTRY, type WorldConfig } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SHIP_CONFIG } from '../ship/config';
import { type ShipInput, createShipState, stepShip } from '../ship/controller';
import { WorldRuntime } from '../world/runtime';
import { WorldSwitcher } from './switcher';
import { FADE_MS, SwitchTimeline, VORTEX_DARK_MS, VORTEX_IN_MS, VORTEX_OUT_MS } from './timeline';

/**
 * Cambio de mundo por agujero negro (T41): el reloj del vórtice, un solo
 * mundo en escena aunque se cambie dos veces seguidas, y el barco y cada
 * lugar donde estaban. Los mundos y sus lugares se leen del registro.
 */

const worlds = WORLD_REGISTRY.ids().map((id) => WORLD_REGISTRY.get(id).config);
const FRAME = 1000 / 60;
const AHEAD: ShipInput = { dirX: 0, dirY: -1, throttle: 1, drift: false };

/** Espera a que se asienten las promesas pendientes. */
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Escenas de prueba: cuántas viven y cuál está puesta. */
function stage() {
  const live = new Set<string>();
  let n = 0;
  const make = (world: string) => {
    const id = `${world}#${++n}`;
    live.add(id);
    return { id, world, destroy: () => void live.delete(id) };
  };
  type Scene = ReturnType<typeof make>;
  let current = make('inicial');
  const switcher = new WorldSwitcher<Scene>({
    swap(next) {
      current.destroy();
      current = next;
    },
  });
  return { live, make, switcher, current: () => current };
}

/** Avanza fotogramas hasta que no haya transición (o `max`). */
async function runFrames(tick: (ms: number) => boolean, max = 600) {
  for (let i = 0; i < max; i++) {
    const free = tick(FRAME);
    await flush();
    if (free) return i;
  }
  throw new Error('la transición no termina');
}

describe('reloj del vórtice (T41)', () => {
  it('cae, se queda a oscuras hasta que el mundo está y se despliega', () => {
    const t = new SwitchTimeline();
    expect(t.active).toBe(false);
    t.begin('vortex');
    expect(t.phase).toBe('in');
    let last = 0;
    for (let ms = 0; ms < VORTEX_IN_MS - FRAME; ms += FRAME) {
      t.tick(FRAME);
      const d = t.pose().depth;
      expect(d).toBeGreaterThanOrEqual(last);
      last = d;
    }
    t.tick(FRAME * 2);
    expect(t.phase).toBe('dark');
    expect(t.pose().dark).toBe(1);
    // Sin el mundo nuevo, sigue a oscuras.
    t.tick(VORTEX_DARK_MS * 20);
    expect(t.phase).toBe('dark');
    t.release();
    expect(t.phase).toBe('out');
    t.tick(VORTEX_OUT_MS / 2);
    expect(t.pose().depth).toBeGreaterThan(0);
    expect(t.pose().depth).toBeLessThan(1);
    t.tick(VORTEX_OUT_MS / 2);
    expect(t.phase).toBe('idle');
    expect(t.pose().depth).toBe(0);
  });

  it('con movimiento reducido, un fundido de 300 ms sin vórtice', () => {
    const t = new SwitchTimeline();
    t.begin('fade');
    expect(t.phase).toBe('dark');
    expect(t.pose()).toMatchObject({ depth: 0, dark: 0, fade: 1 });
    t.release();
    t.tick(FADE_MS / 2);
    expect(t.pose().fade).toBeCloseTo(0.5);
    t.tick(FADE_MS / 2);
    expect(t.active).toBe(false);
  });

  it('otro cambio mientras se despliega vuelve a caer desde donde iba', () => {
    const t = new SwitchTimeline();
    t.begin('vortex');
    t.tick(VORTEX_IN_MS);
    t.release();
    t.tick(VORTEX_DARK_MS);
    t.tick(VORTEX_OUT_MS * 0.25);
    const depth = t.pose().depth;
    t.begin('vortex');
    expect(t.phase).toBe('in');
    // Sigue en el fondo del agujero, sin saltos hacia fuera.
    expect(t.pose().depth).toBeGreaterThan(0);
    expect(depth).toBeGreaterThan(0);
    t.tick(VORTEX_IN_MS);
    expect(t.phase).toBe('dark');
  });
});

describe('cambio de mundo (T41)', () => {
  it('dos cambios seguidos acaban en el último mundo, con una sola escena', async () => {
    const s = stage();
    const a = deferred<ReturnType<typeof s.make>>();
    const b = deferred<ReturnType<typeof s.make>>();
    const first = s.switcher.switchTo(() => a.promise, 'vortex');
    const second = s.switcher.switchTo(() => b.promise, 'vortex');
    // El segundo llega antes; el primero, tarde.
    b.resolve(s.make('segundo'));
    a.resolve(s.make('primero'));
    await runFrames((ms) => s.switcher.advance(ms));
    expect(await first).toBe(false);
    expect(await second).toBe(true);
    expect(s.current().world).toBe('segundo');
    expect([...s.live]).toEqual([s.current().id]);
    expect(s.switcher.locked).toBe(false);
  });

  it('un cambio durante el despliegue también acaba en el último, con una sola escena', async () => {
    const s = stage();
    const first = s.switcher.switchTo(async () => s.make('primero'), 'vortex');
    // Hasta que se abre el primero.
    while (s.switcher.timeline.phase !== 'out') {
      s.switcher.advance(FRAME);
      await flush();
    }
    expect(await first).toBe(true);
    const second = s.switcher.switchTo(async () => s.make('segundo'), 'vortex');
    await runFrames((ms) => s.switcher.advance(ms));
    expect(await second).toBe(true);
    expect(s.current().world).toBe('segundo');
    expect(s.live.size).toBe(1);
  });

  it('si el mundo nuevo no carga, se abre sobre el de antes', async () => {
    const s = stage();
    const before = s.current();
    const failed = s.switcher.switchTo(() => Promise.reject(new Error('sin red')), 'vortex');
    await expect(failed).rejects.toThrow('sin red');
    await runFrames((ms) => s.switcher.advance(ms));
    expect(s.current()).toBe(before);
    expect(s.live.size).toBe(1);
  });

  it('el barco y cada lugar siguen donde estaban; la entrada vuelve al terminar', async () => {
    expect(worlds.length).toBeGreaterThanOrEqual(2);
    const [from, to] = worlds as [WorldConfig, WorldConfig];
    const seed = 7;
    let runtime = new WorldRuntime(from, { seed });
    const ship = createShipState(from.spawn?.x ?? 0, from.spawn?.y ?? 0, -Math.PI / 2);
    const switcher = new WorldSwitcher<{ runtime: WorldRuntime; destroy(): void }>({
      swap(next) {
        runtime = next.runtime;
      },
    });
    const places = (rt: WorldRuntime) =>
      new Map(rt.objectStates().map((o) => [o.id, { x: o.x, y: o.y }]));
    const placesBefore = places(runtime);
    const shipBefore = { x: ship.x, y: ship.y, heading: ship.heading };

    // Un fotograma del juego: el jugador acelera todo el rato. Se anota dónde
    // está el barco al soltarse la entrada, antes de que ésta cuente.
    let released: typeof shipBefore | null = null;
    const frame = (ms: number) => {
      const free = switcher.advance(ms);
      if (free && !released) released = { x: ship.x, y: ship.y, heading: ship.heading };
      if (free) stepShip(ship, AHEAD, runtime.shipConfig(DEFAULT_SHIP_CONFIG), ms / 1000);
      return free;
    };
    const done = switcher.switchTo(
      async () => ({ runtime: new WorldRuntime(to, { seed }), destroy: () => {} }),
      'vortex',
    );
    // El jugador sigue acelerando durante toda la transición.
    for (let i = 0; i < 600 && switcher.locked; i++) {
      frame(FRAME);
      await flush();
    }
    expect(switcher.locked).toBe(false);
    expect(await done).toBe(true);

    expect(released).toEqual(shipBefore);
    const placesAfter = places(runtime);
    const shared = [...placesBefore.keys()].filter((id) => placesAfter.has(id));
    expect(shared.length).toBeGreaterThan(0);
    for (const id of shared) expect(placesAfter.get(id), id).toEqual(placesBefore.get(id));

    // Terminada la transición, la entrada vuelve a mover el barco.
    frame(FRAME);
    expect(ship.y).toBeLessThan(shipBefore.y);
  });
});
