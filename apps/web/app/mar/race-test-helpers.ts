import {
  BoatJump,
  CircuitRace,
  type GhostRun,
  GhostRecorder,
  type JumpEvent,
  type RaceEvent,
  type RacePhase,
  circuitFromWorld,
  rampsOf,
} from '@boia/engine/circuit';
import { WorldRuntime, createShipState, shipSpeed, stepShip } from '@boia/engine/headless';
import { CIRCUIT_ID, type WorldConfig } from '@boia/world';
import { ShipHandling, TURBO_SPEED, stepShipConfig } from './engine/steering';
import { periodOf, planetRect, shortest } from './engine/wrap';
import { lapTargets, raceCheckpoint, startPose } from './race';

/**
 * El piloto de las pruebas de Los Rápidos (T37, T61, T73; sacado de
 * `race.test.ts` en plan 015 T176 para medir también el umbral de «Rápido»):
 * corre la carrera con la física y el runtime de /mar, a fondo hacia la
 * siguiente boia, como el teclado.
 */

export interface BotRun {
  events: RaceEvent[];
  finish: Extract<RaceEvent, { type: 'finish' }> | null;
  ghost: GhostRun | null;
  /** Lo que el runtime emitió además de las boias (paneles que anularían la carrera). */
  opened: string[];
  /** Saltos y chapuzones de las rampas, en orden. */
  jumps: JumpEvent[];
  /** Avisos de la salida sin carrera (`ready`): cada uno, un «¿Empezar?». */
  ready: number;
  /** Cada paso: la fase al empezarlo, la velocidad máxima de base y la velocidad al acabarlo. */
  steps: { phase: RacePhase; base: number; speed: number }[];
  /** Velocidad al cruzar la meta y justo después, ya sin la física de carrera (T109). */
  atFinish: number;
  afterFinish: number;
  /** Tope de crucero justo después de la meta (con los impulsos del mundo que sigan) y su factor. */
  cruiseCap: number;
  effects: number;
}

/**
 * Una carrera entera con el piloto: cuenta atrás quieto en la salida y luego a fondo.
 * `aim` (plan 015 T176): un error de puntería en radianes a cada instante de
 * la carrera, para el modelo de jugador normal (`race-rapido.test.ts`); sin
 * él, el piloto apunta justo a la boia.
 */
export function botRace(
  w: WorldConfig,
  maxS = 200,
  useTurbo = false,
  aim?: (t: number) => number,
): BotRun {
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
  const handling = new ShipHandling();
  const steps: BotRun['steps'] = [];
  let ready = 0;
  let finish: BotRun['finish'] = null;
  let ghost: GhostRun | null = null;
  let last = 0;
  for (let i = 0; i < maxS * 60 && !finish; i++) {
    const t = i * dt;
    last = t;
    const v = race.view(t);
    // Explicit pulses: 2.4 s every 10 s, conservatively beyond the UI's 7 s cooldown.
    const turbo = useTurbo && race.racing && (race.elapsedMs(t) / 1000) % 10 < 2.4;
    const boost = turbo ? TURBO_SPEED : 1;
    // Como Mar3D antes de cada paso: la física de carrera sólo con el cronómetro corriendo.
    handling.sync(race.racing, ship, (base) => stepShipConfig(base, runtime, boost).maxSpeed);
    if (v.phase === 'countdown') {
      Object.assign(ship, { ...hold, vx: 0, vy: 0 });
    } else {
      const target = v.phase === 'idle' ? hold : targets[v.next - 1]!;
      const { dx, dy } = shortest(ship, target, period);
      const off = aim && v.phase === 'racing' ? aim(t) : 0;
      const c = Math.cos(off);
      const sn = Math.sin(off);
      stepShip(
        ship,
        { dirX: dx * c - dy * sn, dirY: dx * sn + dy * c, throttle: 1, drift: false },
        stepShipConfig(handling.config, runtime, boost),
        dt,
      );
    }
    runtime.step(ship, handling.config, dt);
    steps.push({ phase: v.phase, base: handling.config.maxSpeed, speed: shipSpeed(ship) });
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
  // El paso siguiente a la meta: vuelve el crucero y la velocidad que sobra se recorta.
  const atFinish = shipSpeed(ship);
  handling.sync(race.racing, ship, (base) => stepShipConfig(base, runtime).maxSpeed);
  const afterFinish = shipSpeed(ship);
  const cruiseCap = stepShipConfig(handling.config, runtime).maxSpeed;
  const effects = runtime.speedFactor();
  const speeds = { atFinish, afterFinish, cruiseCap, effects };
  return { events, finish, ghost, opened, jumps, ready, steps, ...speeds };
}
