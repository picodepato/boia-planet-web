import {
  DEFAULT_SHIP_CONFIG,
  type ShipConfig,
  type ShipInput,
  createShipState,
  stepShip,
} from '@boia/engine/headless';
import { describe, expect, it } from 'vitest';
import {
  MAR_SHIP_CONFIG,
  MAR_STICK,
  TURBO_SPEED,
  VOYAGE_SPEED,
  boostedConfig,
  stickInput,
} from './steering';

const DT = 1 / 60;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * /mar antes de T54: la física por defecto con el radio de choque de /mar y
 * el joystick de entonces (zona muerta 8 px, acelerador (len − 8) / 56, sin
 * sensibilidad).
 */
const OLD_CFG: ShipConfig = { ...DEFAULT_SHIP_CONFIG, radius: 18 };
function oldStick(dx: number, dy: number): ShipInput {
  const len = Math.hypot(dx, dy);
  return { dirX: dx, dirY: dy, throttle: Math.min(1, (len - 8) / 56), drift: false };
}

/** Segundos hasta que el rumbo llega (±0,01 rad) a `target`; Infinity si no llega en 60 s. */
function timeToHeading(cfg: ShipConfig, input: ShipInput, target: number): number {
  const s = createShipState(0, 0, 0);
  for (let t = 0; t < 60; t += DT) {
    if (Math.abs(wrap(target - s.heading)) < 0.01) return t;
    stepShip(s, input, cfg, DT);
  }
  return Infinity;
}

interface Turn {
  /** Separación máxima de la línea de partida (u): el diámetro de la vuelta. */
  width: number;
  /** Segundos hasta dar la vuelta (180°). */
  time: number;
}

/**
 * Vuelta de 180° desde el crucero a `speed` u/s con rumbo este. `reverse`:
 * el joystick a fondo hacia atrás (oeste); si no, a fondo hacia un lado del
 * rumbo (la vuelta hacia delante de siempre), hasta haber girado 180°.
 */
function uTurn(cfg: ShipConfig, speed: number, reverse: boolean): Turn {
  const s = createShipState(0, 0, 0);
  s.vx = speed;
  let turned = 0;
  let width = 0;
  for (let t = 0; t < 30; t += DT) {
    // Ligeramente a la derecha de la popa: elige el lado del giro.
    const a = reverse ? Math.PI - 0.02 : s.heading + Math.PI / 2;
    const before = s.heading;
    stepShip(s, { dirX: Math.cos(a), dirY: Math.sin(a), throttle: 1, drift: false }, cfg, DT);
    turned += wrap(s.heading - before);
    width = Math.max(width, Math.abs(s.y));
    if (turned >= Math.PI - 0.03) return { width, time: t + DT };
  }
  throw new Error('no da la vuelta');
}

/** Radio de giro instantáneo (u) a `speed` u/s, con el joystick a fondo a `side` rad del rumbo. */
function turnRadius(cfg: ShipConfig, speed: number, side: number): number {
  const s = createShipState(0, 0, 0);
  s.vx = speed;
  stepShip(s, { dirX: Math.cos(side), dirY: Math.sin(side), throttle: 1, drift: false }, cfg, DT);
  return speed / (Math.abs(s.heading) / DT);
}

describe('gobierno del barco en /mar (T54)', () => {
  it('con un arrastre pequeño (justo pasada la zona muerta) gira 90° mucho antes que antes', () => {
    const drag = MAR_STICK.deadZone + 4;
    const now = stickInput(0, drag);
    expect(now).not.toBeNull();
    const before = timeToHeading(OLD_CFG, oldStick(0, drag), Math.PI / 2);
    const after = timeToHeading(MAR_SHIP_CONFIG, now!, Math.PI / 2);
    expect(after).toBeLessThan(before / 4);
    expect(after).toBeLessThan(1.5);
  });

  it('dentro de la zona muerta no hay entrada', () => {
    expect(stickInput(MAR_STICK.deadZone, 0)).toBeNull();
    expect(stickInput(0, MAR_STICK.deadZone + 1)?.throttle).toBeGreaterThan(0);
  });

  it('tirar hacia atrás yendo hacia delante da una vuelta más corta y más rápida', () => {
    const v = MAR_SHIP_CONFIG.maxSpeed;
    const forward = uTurn(MAR_SHIP_CONFIG, v, false);
    const reverse = uTurn(MAR_SHIP_CONFIG, v, true);
    expect(reverse.width).toBeLessThan(forward.width * 0.8);
    expect(reverse.time).toBeLessThan(forward.time);
    // Y más cerrada que la vuelta hacia atrás de antes.
    expect(reverse.width).toBeLessThan(uTurn(OLD_CFG, v, true).width * 0.6);
  });

  it('el turbo y el viaje no abren el círculo de giro', () => {
    const cruise = MAR_SHIP_CONFIG.maxSpeed;
    for (const k of [TURBO_SPEED, VOYAGE_SPEED]) {
      const cfg = boostedConfig(MAR_SHIP_CONFIG, k);
      // El radio de giro (velocidad / giro por segundo) a fondo hacia un lado
      // o hacia atrás es el mismo a la velocidad del turbo que a la de crucero.
      for (const side of [Math.PI / 2, Math.PI - 0.02]) {
        expect(turnRadius(cfg, cfg.maxSpeed, side)).toBeLessThanOrEqual(
          turnRadius(MAR_SHIP_CONFIG, cruise, side) * 1.001,
        );
      }
      // La vuelta entera: casi la de crucero (el turbo frena desde más
      // arriba), mucho más cerrada que la del turbo de antes, y tirar hacia
      // atrás sigue cerrándola.
      const fwd = uTurn(cfg, cfg.maxSpeed, false).width;
      expect(fwd).toBeLessThan(uTurn(MAR_SHIP_CONFIG, cruise, false).width * 1.05);
      const old = boostedConfig(OLD_CFG, k);
      expect(fwd).toBeLessThan(uTurn(old, old.maxSpeed, false).width * 0.6);
      expect(uTurn(cfg, cfg.maxSpeed, true).width).toBeLessThan(fwd);
    }
    // Sin `turnRadius` (antes) el turbo sí lo abría: la prueba mide algo.
    const old = boostedConfig(OLD_CFG, TURBO_SPEED);
    expect(turnRadius(old, old.maxSpeed, Math.PI / 2)).toBeGreaterThan(
      turnRadius(OLD_CFG, OLD_CFG.maxSpeed, Math.PI / 2) * 1.5,
    );
  });

  it('la sensibilidad táctil llega al barco como turnScale', () => {
    expect(stickInput(0, 40, 1.3)?.turnScale).toBe(1.3);
    const turned = (scale: number) => {
      const s = createShipState(0, 0, 0);
      s.vx = MAR_SHIP_CONFIG.maxSpeed;
      stepShip(s, stickInput(0, 40, scale)!, MAR_SHIP_CONFIG, DT);
      return s.heading;
    };
    expect(turned(1.5)).toBeGreaterThan(turned(1));
    expect(turned(0.5)).toBeLessThan(turned(1));
  });
});
