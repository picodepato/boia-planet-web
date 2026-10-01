import {
  DEFAULT_SHIP_CONFIG,
  IDLE_INPUT,
  type ShipConfig,
  type ShipInput,
} from '@boia/engine/headless';

/**
 * Gobierno del barco en /mar (T54), sin three.js ni DOM: la física con que
 * navega el planeta, el joystick táctil y el teclado pasados a `ShipInput`,
 * y la física del turbo. En el móvil el barco gira deprisa hacia donde se
 * apunta aunque el arrastre sea pequeño; tirar del joystick hacia atrás
 * yendo hacia delante da una vuelta corta; el turbo no abre el círculo.
 */

/** Giro a velocidad de crucero (rad/s). muestra */
const MAR_TURN_RATE = 3.4;

export const MAR_SHIP_CONFIG: ShipConfig = {
  ...DEFAULT_SHIP_CONFIG,
  // Radio de choque acorde con el barco que se ve (más grande que en el 2D).
  radius: 18,
  turnRate: MAR_TURN_RATE,
  minTurnFactor: 0.75,
  steerFloor: 0.8,
  // El círculo del crucero: el turbo y el viaje no lo abren.
  turnRadius: DEFAULT_SHIP_CONFIG.maxSpeed / MAR_TURN_RATE,
  reverseTurn: { turnBoost: 1.9, brake: 520 },
};

/** Joystick táctil: zona muerta y recorrido hasta el acelerador a fondo, en px CSS. muestra */
export const MAR_STICK = { deadZone: 8, range: 56 } as const;

/** Joystick (desplazamiento del dedo en px) a entrada del barco; `null` en la zona muerta. */
export function stickInput(dx: number, dy: number, turnScale = 1): ShipInput | null {
  const len = Math.hypot(dx, dy);
  if (len <= MAR_STICK.deadZone) return null;
  return {
    dirX: dx,
    dirY: dy,
    throttle: Math.min(1, (len - MAR_STICK.deadZone) / MAR_STICK.range),
    drift: false,
    turnScale,
  };
}

/** Flechas/WASD ya sumadas (-1, 0, 1 por eje) a entrada del barco. */
export function keysInput(dx: number, dy: number, turnScale = 1): ShipInput {
  if (!dx && !dy) return IDLE_INPUT;
  return { dirX: dx, dirY: dy, throttle: 1, drift: false, turnScale };
}

/** Velocidad del turbo (× la máxima). muestra */
export const TURBO_SPEED = 1.6;
/** Velocidad del viaje en turbo de «Entradas» (× la máxima): más que el turbo, que llegue pronto. muestra */
export const VOYAGE_SPEED = 2.6;
/** Aceleración en turbo y en viaje (× la normal). muestra */
const BOOST_ACCEL = 2.4;

/** Física con turbo o viaje (`k` × la velocidad máxima); el radio de giro no cambia. */
export function boostedConfig(cfg: ShipConfig, k: number): ShipConfig {
  return { ...cfg, maxSpeed: cfg.maxSpeed * k, acceleration: cfg.acceleration * BOOST_ACCEL };
}
