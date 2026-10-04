import type { ShipConfig } from './config';

/** Turbo de /mar: segundos y multiplicadores de muestra, compartidos con el Cañón. */
export const TURBO_S = 2.4;
export const TURBO_COOLDOWN_S = 7;
export const TURBO_SPEED = 1.6;
const BOOST_ACCEL = 2.4;

export interface ShipEffects {
  shipConfig(base: ShipConfig): ShipConfig;
}

/** Física con turbo o viaje; conserva el radio de giro del crucero. */
export function boostedConfig(cfg: ShipConfig, k: number): ShipConfig {
  return { ...cfg, maxSpeed: cfg.maxSpeed * k, acceleration: cfg.acceleration * BOOST_ACCEL };
}

/** Efectos del mundo y, encima, turbo o viaje. */
export function stepShipConfig(base: ShipConfig, effects: ShipEffects, boost = 1): ShipConfig {
  const cfg = effects.shipConfig(base);
  return boost === 1 ? cfg : boostedConfig(cfg, boost);
}
