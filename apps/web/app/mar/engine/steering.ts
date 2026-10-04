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
 * Se explora a 15 nudos (T99) y Los Rápidos se corren a 22 (T109).
 */

/** Giro a velocidad de crucero (rad/s). muestra */
const MAR_TURN_RATE = 3.4;

// Preserve the original time-to-cruise and turn/braking proportions when
// slowing exploration from 22 to 15 knots (the 220 u/s handling baseline).
const CRUISE_SCALE = DEFAULT_SHIP_CONFIG.maxSpeed / 220;

export const MAR_SHIP_CONFIG: ShipConfig = {
  ...DEFAULT_SHIP_CONFIG,
  acceleration: DEFAULT_SHIP_CONFIG.acceleration * CRUISE_SCALE,
  brakeDeceleration: DEFAULT_SHIP_CONFIG.brakeDeceleration * CRUISE_SCALE,
  // Radio de choque acorde con el barco que se ve (más grande que en el 2D).
  radius: 18,
  turnRate: MAR_TURN_RATE,
  minTurnFactor: 0.75,
  steerFloor: 0.8,
  // El círculo del crucero: el turbo y el viaje no lo abren.
  turnRadius: DEFAULT_SHIP_CONFIG.maxSpeed / MAR_TURN_RATE,
  reverseTurn: { turnBoost: 1.9, brake: 520 * CRUISE_SCALE },
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

// --- Carrera a 22 nudos (T109) ------------------------------------------------------

/**
 * La misma física a otra velocidad de crucero (u/s): escala lo que va con la
 * velocidad (aceleración, frenos y radio de giro) y deja lo demás (giro por
 * segundo, agarre, radio de choque, costas). Los tiempos de giro y de llegar
 * al crucero son los mismos; las distancias, en proporción (como en T99).
 */
export function atCruiseSpeed(cfg: ShipConfig, maxSpeed: number): ShipConfig {
  const k = maxSpeed / cfg.maxSpeed;
  const out: ShipConfig = {
    ...cfg,
    maxSpeed,
    acceleration: cfg.acceleration * k,
    brakeDeceleration: cfg.brakeDeceleration * k,
  };
  if (cfg.turnRadius !== undefined) out.turnRadius = cfg.turnRadius * k;
  if (cfg.reverseTurn) out.reverseTurn = { ...cfg.reverseTurn, brake: cfg.reverseTurn.brake * k };
  return out;
}

/** Velocidad de carrera (u/s): 22 nudos, el crucero de antes de T99. muestra */
export const RACE_MAX_SPEED = 220;

/**
 * La física de Los Rápidos con el cronómetro en marcha: la de 22 nudos de
 * siempre, con todas sus proporciones (la de crucero, escalada de vuelta).
 */
export const RACE_SHIP_CONFIG: ShipConfig = atCruiseSpeed(MAR_SHIP_CONFIG, RACE_MAX_SPEED);

/**
 * La física de base del barco: la de carrera sólo con el cronómetro
 * corriendo (fase `racing`); en todo lo demás (explorar, la oferta, la
 * cuenta atrás, la tarjeta de meta, la partida del Cañón), la de crucero.
 */
export function baseShipConfig(racing: boolean): ShipConfig {
  return racing ? RACE_SHIP_CONFIG : MAR_SHIP_CONFIG;
}

/** Lo del runtime del mundo que cambia la física (impulsos y frenos). */
export interface ShipEffects {
  shipConfig(base: ShipConfig): ShipConfig;
}

/**
 * La física de un paso: la base (crucero o carrera), los efectos del mundo
 * (impulsos, frenos) y encima el turbo o el viaje (`boost` × la máxima; 1,
 * sin ellos). Así componen igual a 15 que a 22 nudos.
 */
export function stepShipConfig(base: ShipConfig, effects: ShipEffects, boost = 1): ShipConfig {
  const cfg = effects.shipConfig(base);
  return boost === 1 ? cfg : boostedConfig(cfg, boost);
}

/** Recorta la velocidad a `max` u/s sin cambiar su dirección. true si sobraba. */
export function capSpeed(ship: { vx: number; vy: number }, max: number): boolean {
  const v = Math.hypot(ship.vx, ship.vy);
  if (v <= max) return false;
  const k = max / v;
  ship.vx *= k;
  ship.vy *= k;
  return true;
}

/**
 * La física de base del barco de /mar a lo largo de la carrera (T109). Antes
 * de cada paso, `sync` con si el cronómetro corre: al empezar, 22 nudos; al
 * dejar de correr (meta, anulada, cambio de mundo, otra carrera…), 15 y la
 * velocidad que sobra se recorta en el acto al tope de ese momento (`cap`,
 * con los efectos y el turbo que sigan), para que no quede velocidad de
 * carrera ni el paso siguiente lo tome por un golpe.
 */
export class ShipHandling {
  private racingNow = false;

  /** La física de base de ahora. */
  get config(): ShipConfig {
    return baseShipConfig(this.racingNow);
  }

  /**
   * `racing`: si el cronómetro de la carrera corre. `cap(base)`: el tope del
   * próximo paso con esa base. Devuelve si cambió de física.
   */
  sync(
    racing: boolean,
    ship: { vx: number; vy: number },
    cap: (base: ShipConfig) => number,
  ): boolean {
    if (racing === this.racingNow) return false;
    this.racingNow = racing;
    if (!racing) capSpeed(ship, cap(this.config));
    return true;
  }
}
