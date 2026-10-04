import { BoatJump, type JumpEvent, rampsOf } from '../circuit/jump';
import { configHash } from '../minigames/rng';
import { TURBO_COOLDOWN_S, TURBO_S, TURBO_SPEED, stepShipConfig } from '../ship/boost';
import type { ShipConfig } from '../ship/config';
import { type ShipInput, type ShipState, collideShip, stepShip } from '../ship/controller';
import { WorldRuntime } from '../world/runtime';
import type { SurvivorsWorld } from './world';

export interface MovementView {
  readonly turboS: number;
  readonly cooldownS: number;
  readonly boostFactor: number;
  readonly airborne: boolean;
  readonly jumpHeight: number;
  readonly jumpPitch: number;
}

/** Movimiento del jugador: reloj activo, runtime de circuito aislado y salto sólo visual. */
export class SurvivorsMovement {
  private readonly runtime: WorldRuntime;
  private readonly ramps: ReturnType<typeof rampsOf>;
  private readonly jump = new BoatJump();
  private turboLeft = 0;
  private turboCool = 0;
  private time = 0;
  private history = '';

  constructor(
    private readonly world: SurvivorsWorld,
    seed: number,
  ) {
    const circuit = {
      id: 'survivors-circuit',
      version: 1,
      sectors: [],
      bounds: world.bounds,
      objects: [...(world.interactives ?? [])],
    };
    this.runtime = new WorldRuntime(circuit, { wrap: true, seed });
    this.ramps = rampsOf(circuit);
    // Dato inicial del replay, no una mutación del estado después de crear la partida.
    this.turboCool = Math.max(0, world.start.turboCooldownS ?? 0);
  }

  snapshot(): MovementView {
    return {
      turboS: this.turboLeft,
      cooldownS: this.turboCool,
      boostFactor: this.runtime.speedFactor(),
      airborne: this.jump.airborne,
      jumpHeight: this.jump.height(this.time),
      jumpPitch: this.jump.pitch(this.time),
    };
  }

  /** Incluye la historia de contactos y su reloj, además del estado visible. */
  state(): unknown {
    return { ...this.snapshot(), time: this.time, history: this.history };
  }

  step(
    ship: ShipState,
    input: ShipInput,
    press: boolean,
    base: ShipConfig,
    dt: number,
  ): JumpEvent[] {
    if (press && this.turboCool <= 1e-6) {
      this.turboLeft = TURBO_S;
      this.turboCool = TURBO_COOLDOWN_S;
    }
    const cfg = stepShipConfig(base, this.runtime, this.turboLeft > 0 ? TURBO_SPEED : 1);
    this.turboLeft = Math.max(0, this.turboLeft - dt);
    this.turboCool = Math.max(0, this.turboCool - dt);
    this.time += dt;
    stepShip(ship, input, cfg, dt, { smoothSpeedLimit: true });
    collideShip(
      ship,
      { bounds: this.world.bounds, obstacles: this.world.obstacles, wrap: true },
      base,
      dt,
    );
    // Igual que navegando: el impulso inmediato usa el crucero (con las cartas),
    // y la física del siguiente paso compone efectos + turbo por encima.
    this.runtime.step(ship, base, dt);
    const events: JumpEvent[] = [];
    for (const e of this.runtime.drainEvents()) {
      this.history = configHash([this.history, this.time, e]);
      if (e.type !== 'effect' || e.effect !== 'boost') continue;
      const ramp = this.ramps.get(e.objectId);
      if (ramp) events.push(...this.jump.launch(e.objectId, ramp, this.time));
    }
    events.push(...this.jump.tick(this.time));
    return events;
  }
}
