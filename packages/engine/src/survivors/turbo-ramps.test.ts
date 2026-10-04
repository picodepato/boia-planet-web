import { WORLD_REGISTRY, type WorldConfig, type WorldObject } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { BoatJump, jumpOf } from '../circuit/jump';
import { TURBO_COOLDOWN_S, TURBO_S, TURBO_SPEED } from '../ship/boost';
import { DEFAULT_SHIP_CONFIG } from '../ship/config';
import { type ShipInput, createShipState, shipSpeed, stepShip } from '../ship/controller';
import { WorldRuntime } from '../world/runtime';
import { SURVIVORS_CONFIG, SURVIVORS_STEP_S, survivorsShipConfig } from './config';
import { type SurvivorsGame, type SurvivorsInput, createSurvivors } from './sim';
import { type SurvivorsWorld, survivorsWorldOf } from './world';

const dt = SURVIVORS_STEP_S;
const ahead: ShipInput = { dirX: 1, dirY: 0, throttle: 1, drift: false };
const source = WORLD_REGISTRY.get('arcilla').config;
const quiet = () => ({ ...structuredClone(SURVIVORS_CONFIG), acts: [] });
const sea = (interactives: WorldObject[] = []): SurvivorsWorld => ({
  bounds: { left: -4000, right: 4000, top: -4000, bottom: 4000 },
  obstacles: [],
  start: { x: 0, y: 0, heading: 0 },
  interactives,
});
const object = (category: string, x = 0): WorldObject => {
  const original = source.objects.find(
    (o) => o.identity.active && o.identity.category === category,
  )!;
  return { ...structuredClone(original), position: { ...original.position, x, y: 0 } };
};
const steps = (game: SurvivorsGame, n: number, input: SurvivorsInput = { ship: ahead }) => {
  for (let k = 0; k < n; k++) game.step(input);
};

describe('T124: turbo, impulsos y rampas del Cañón', () => {
  it('el turbo acelera y al expirar frena suavemente hasta el crucero', () => {
    const game = createSurvivors(quiet(), 7, sea());
    steps(game, 120);
    const cruise = shipSpeed(game.snapshot().player);
    game.step({ ship: ahead, turbo: true });
    steps(game, Math.round(TURBO_S / dt) - 1);
    expect(shipSpeed(game.snapshot().player)).toBeCloseTo(cruise * TURBO_SPEED);
    // El primer paso después del fin mantiene el exceso, sin un recorte de golpe.
    const before = shipSpeed(game.snapshot().player);
    game.step({ ship: ahead });
    const after = shipSpeed(game.snapshot().player);
    const cfg = survivorsShipConfig(DEFAULT_SHIP_CONFIG, SURVIVORS_CONFIG.handling, 0);
    expect(before - after).toBeLessThanOrEqual(cfg.brakeDeceleration * dt + 1e-8);
    expect(after).toBeGreaterThan(cruise);
    expect(game.snapshot().player.impact).toBe(0);
    steps(game, 120);
    expect(shipSpeed(game.snapshot().player)).toBeCloseTo(cruise);
  });

  it('un impulso acelera al pasar y decae sin choque', () => {
    const pad = object('impulso');
    const game = createSurvivors(quiet(), 7, sea([pad]));
    game.step({ ship: ahead });
    expect(shipSpeed(game.snapshot().player)).toBeCloseTo(DEFAULT_SHIP_CONFIG.maxSpeed * 1.5);
    const cfg = survivorsShipConfig(DEFAULT_SHIP_CONFIG, SURVIVORS_CONFIG.handling, 0);
    let expired = false;
    for (let k = 0; k < 240; k++) {
      const before = shipSpeed(game.snapshot().player);
      game.step({ ship: ahead });
      const s = game.snapshot();
      if (s.movement.boostFactor === 1 && before > cfg.maxSpeed) {
        expired = true;
        expect(before - shipSpeed(s.player)).toBeLessThanOrEqual(cfg.brakeDeceleration * dt + 1e-8);
        expect(s.player.impact).toBe(0);
      }
    }
    expect(expired).toBe(true);
    expect(shipSpeed(game.snapshot().player)).toBeCloseTo(cfg.maxSpeed);
  });

  it('el cooldown dura lo mismo que navegando, rechaza repeticiones y se congela en pausa', () => {
    const game = createSurvivors(quiet(), 7, sea());
    game.step({ ship: ahead, turbo: true });
    const first = game.snapshot().movement;
    game.step({ ship: ahead, turbo: true });
    expect(game.snapshot().movement.turboS).toBeCloseTo(first.turboS - dt);
    const paused = structuredClone(game.snapshot().movement);
    game.setPaused(true);
    steps(game, 600, { ship: ahead, turbo: true });
    expect(game.snapshot().movement).toEqual(paused);
    game.setPaused(false);
    steps(game, Math.round(TURBO_COOLDOWN_S / dt) - 2);
    expect(game.snapshot().movement.cooldownS).toBeCloseTo(0);
    game.step({ ship: ahead, turbo: true });
    expect(game.snapshot().movement.turboS).toBeCloseTo(TURBO_S - dt);
  });

  it('el impulso y el turbo multiplican también la velocidad de la carta', () => {
    const config = quiet();
    config.upgrades = [{ ...config.upgrades.find((u) => u.stat === 'speedBonus')!, amount: 0.2 }];
    const game = createSurvivors(config, 4, sea([object('impulso', 100)]));
    game.spawnNote(0, 0, game.snapshot().xp.toNext);
    game.step();
    expect(game.status).toBe('card');
    game.step({ choose: 0, ship: ahead, turbo: true });
    steps(game, 90);
    expect(game.snapshot().stats.speedBonus).toBe(0.2);
    expect(shipSpeed(game.snapshot().player)).toBeCloseTo(150 * 1.2 * 1.5 * TURBO_SPEED);
  });

  it('una carta congela turbo/cooldown y no consume pulsaciones hasta elegir', () => {
    const world = sea();
    world.start.turboCooldownS = 1;
    const game = createSurvivors(quiet(), 8, world);
    game.step({ turbo: true });
    expect(game.snapshot().movement.turboS).toBe(0);
    steps(game, 60);
    game.step({ ship: ahead, turbo: true });
    const p = game.snapshot().player;
    game.spawnNote(p.x, p.y, game.snapshot().xp.toNext);
    game.step({ ship: ahead });
    expect(game.status).toBe('card');
    const frozen = structuredClone(game.snapshot().movement);
    steps(game, 180, { turbo: true });
    expect(game.snapshot().movement).toEqual(frozen);
    game.step({ choose: 0, ship: ahead });
    expect(game.snapshot().movement.cooldownS).toBeCloseTo(frozen.cooldownS - dt);
  });

  it('lee un impulso por la copia más cercana del mundo que da la vuelta', () => {
    const world = sea([object('impulso', 3990)]);
    world.start.x = -3990;
    const game = createSurvivors(quiet(), 2, world);
    game.step();
    expect(game.snapshot().movement.boostFactor).toBe(1.5);
    expect(shipSpeed(game.snapshot().player)).toBeCloseTo(225);
  });

  it('la rampa conserva BoatJump y el contacto enemigo daña en pleno salto', () => {
    const ramp = object('rampa');
    const config = quiet();
    config.player.bailPerS = 0;
    const game = createSurvivors(config, 9, sea([ramp]));
    const visual = new BoatJump();
    visual.launch(ramp.identity.id, jumpOf(ramp)!, dt);
    expect(game.step({ ship: ahead }).some((e) => e.type === 'jump')).toBe(true);
    steps(game, 20);
    expect(game.snapshot().movement.airborne).toBe(true);
    expect(game.snapshot().movement.jumpHeight).toBeCloseTo(visual.height(21 * dt));
    const p = game.snapshot().player;
    game.spawnEnemy('crab', p.x, p.y);
    game.step();
    expect(game.snapshot().movement.airborne).toBe(true);
    expect(game.snapshot().water.level).toBeGreaterThan(0);
    const frozen = structuredClone(game.snapshot().movement);
    game.setPaused(true);
    steps(game, 120);
    expect(game.snapshot().movement).toEqual(frozen);
    game.setPaused(false);
    const events = [];
    for (let k = 0; k < 120; k++) events.push(...game.step({ ship: ahead }));
    expect(events.filter((e) => e.type === 'splash')).toHaveLength(1);
    expect(game.snapshot().movement.airborne).toBe(false);
  });

  it('el disparo de un pirata también daña al barco en pleno salto de rampa', () => {
    const ramp = object('rampa');
    const config = quiet();
    config.player.bailPerS = 0;
    config.weapons.canon!.damage = 0;
    config.enemies.pirate!.speed = 0;
    config.enemies.pirate!.shooter!.cooldownS = 0.05;
    const game = createSurvivors(config, 9, sea([ramp]));
    game.step({ ship: ahead });
    steps(game, 5);
    expect(game.snapshot().movement.airborne).toBe(true);
    const p = game.snapshot().player;
    const standoff = config.enemies.pirate!.shooter!.standoff;
    game.spawnEnemy('pirate', p.x + standoff * 0.5, p.y + 60);
    let hitInAir = false;
    for (let k = 0; k < 120 && !hitInAir; k++) {
      const airborne = game.snapshot().movement.airborne;
      const events = game.step({ ship: ahead });
      hitInAir = airborne && events.some((e) => e.type === 'hit' && e.enemy === 'pirate');
    }
    expect(hitInAir).toBe(true);
    expect(game.snapshot().water.level).toBeGreaterThan(0);
  });

  it('las boias conservan su boost sin iniciar ni adelantar una carrera', () => {
    const buoy = source.objects.find((o) =>
      o.behaviors.some((b) => b.type === 'checkpoint' && b.params.boost > 0),
    )!;
    const world: WorldConfig = {
      ...source,
      bounds: sea().bounds,
      objects: [{ ...buoy, position: { ...buoy.position, x: 0, y: 0 } }],
    };
    const game = createSurvivors(quiet(), 3, survivorsWorldOf(world, world.bounds, sea().start));
    const runtime = new WorldRuntime(world, { wrap: true });
    const ship = createShipState(0, 0, 0);
    runtime.step(ship, DEFAULT_SHIP_CONFIG, dt);
    game.step();
    expect(shipSpeed(game.snapshot().player)).toBeCloseTo(shipSpeed(ship));
    expect(game.snapshot().movement.boostFactor).toBe(runtime.speedFactor());
  });

  it('misma semilla y replay con turbo, rampas y boosts da snapshots idénticos en cada paso', () => {
    const world = sea([object('rampa'), object('impulso', 250)]);
    world.start.turboCooldownS = 0.8;
    const config = structuredClone(SURVIVORS_CONFIG);
    config.player.waterCapacity = 1e12;
    const a = createSurvivors(config, 17, world);
    const b = createSurvivors(config, 17, world);
    for (let k = 0; k < 900; k++) {
      const input = {
        ship: ahead,
        choose: 0,
        turbo: k === 20 || k === 450,
        pause: k >= 80 && k < 100,
      };
      expect(a.step(input)).toEqual(b.step(input));
      expect(a.snapshot()).toEqual(b.snapshot());
      expect(a.stateHash()).toBe(b.stateHash());
    }
  });

  it('navegar mantiene el recorte predeterminado; sólo survivors pide caída suave', () => {
    const ship = createShipState(0, 0, 0);
    ship.vx = 240;
    stepShip(ship, ahead, DEFAULT_SHIP_CONFIG, dt);
    expect(shipSpeed(ship)).toBe(150);
  });
});
