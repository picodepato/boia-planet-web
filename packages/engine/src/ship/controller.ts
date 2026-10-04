import type { Rect } from '@boia/world';
import { clamp, damp, wrapAngle } from '../math';
import { wrapDelta, wrapInto } from '../world/wrap';
import type { ShipConfig } from './config';

export { wrapDelta, wrapInto };

export interface ShipState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Rumbo del casco en el plano del agua (0 = este, π/2 = hacia el espectador). */
  heading: number;
  drifting: boolean;
  /**
   * u/s con que el casco chocó en el último paso (componente de la velocidad
   * contra la costa o el obstáculo); 0 sin choque. Lo pone a 0 `stepShip` y
   * lo sube `collideShip`: para el golpe sonoro y quien quiera reaccionar.
   */
  impact?: number;
}

/** Lo que pide el jugador en un paso, ya pasado a coordenadas de mundo. */
export interface ShipInput {
  /** Dirección deseada en el plano del agua; se normaliza. (0, 0) = sin rumbo. */
  dirX: number;
  dirY: number;
  /** 0..1. 0 = soltar: frena suave. */
  throttle: number;
  drift: boolean;
  /**
   * Multiplica el giro máximo del casco: la sensibilidad de los controles
   * (REQ-MUN-008). Sin valor, 1.
   */
  turnScale?: number;
}

export const IDLE_INPUT: ShipInput = { dirX: 0, dirY: 0, throttle: 0, drift: false };

export interface CircleObstacle {
  x: number;
  y: number;
  radius: number;
  /** Restitución propia (rebote); sin valor, `cfg.obstacleRestitution`. */
  restitution?: number;
}

export interface ShipEnvironment {
  bounds: Rect;
  obstacles: readonly CircleObstacle[];
  /**
   * Mundo que da la vuelta (el planeta de agua de `/mar`, D-22): sin costas
   * ni corriente; quien sale por un lado vuelve por el opuesto y los
   * obstáculos se miden por el camino más corto. Sin ella (por defecto,
   * `/juego`), costas y límites como siempre (REQ-MUN-011).
   */
  wrap?: boolean;
}

export function createShipState(x: number, y: number, heading = -Math.PI / 2): ShipState {
  return { x, y, vx: 0, vy: 0, heading, drifting: false, impact: 0 };
}

export function shipSpeed(s: ShipState): number {
  return Math.hypot(s.vx, s.vy);
}

function approach(v: number, target: number, rate: number): number {
  return v < target ? Math.min(target, v + rate) : Math.max(target, v - rate);
}

/** Integra un paso de física del barco (sin colisiones). Muta `s`. */
export function stepShip(
  s: ShipState,
  input: ShipInput,
  cfg: ShipConfig,
  dt: number,
  options: { smoothSpeedLimit?: boolean } = {},
): void {
  const len = Math.hypot(input.dirX, input.dirY);
  const throttle = len > 1e-6 ? clamp(input.throttle, 0, 1) : 0;
  const drifting = input.drift && throttle > 0;
  s.drifting = drifting;
  s.impact = 0;

  const speed = shipSpeed(s);
  let align = 1;
  // 0..1: cuánto de espaldas se pide el rumbo yendo hacia delante (vuelta corta).
  let back = 0;
  if (throttle > 0) {
    const target = Math.atan2(input.dirY, input.dirX);
    const delta = wrapAngle(target - s.heading);
    const speedFactor =
      cfg.minTurnFactor + (1 - cfg.minTurnFactor) * clamp(speed / (0.5 * cfg.maxSpeed), 0, 1);
    const steer =
      cfg.steerFloor === undefined ? throttle : cfg.steerFloor + (1 - cfg.steerFloor) * throttle;
    let turnRate = cfg.turnRate * speedFactor;
    // Más rápido que el crucero, el giro crece con la velocidad: mismo círculo.
    if (cfg.turnRadius) turnRate = Math.max(turnRate, speed / cfg.turnRadius);
    if (cfg.reverseTurn && s.vx * Math.cos(s.heading) + s.vy * Math.sin(s.heading) > 0) {
      back = clamp((Math.abs(delta) - Math.PI / 2) / (Math.PI / 2), 0, 1);
      turnRate *= 1 + (cfg.reverseTurn.turnBoost - 1) * back;
    }
    const maxTurn =
      turnRate * (drifting ? cfg.drift.turnMultiplier : 1) * (input.turnScale ?? 1) * steer * dt;
    s.heading = wrapAngle(s.heading + clamp(delta, -maxTurn, maxTurn));
    // Con el rumbo pedido muy de espaldas, gira antes de acelerar.
    align = clamp((Math.cos(wrapAngle(target - s.heading)) + 0.5) / 1.5, 0.15, 1);
  }

  const fx = Math.cos(s.heading);
  const fy = Math.sin(s.heading);
  let vF = s.vx * fx + s.vy * fy;
  let vL = -s.vx * fy + s.vy * fx;

  // La quilla anula el deslizamiento lateral y devuelve parte como avance.
  // Más rápido que el crucero (con `turnRadius`), agarra en proporción: el
  // derrape no abre el círculo.
  const over = cfg.turnRadius ? Math.max(1, speed / (cfg.turnRadius * cfg.turnRate)) : 1;
  const grip = (drifting ? cfg.drift.lateralGrip : cfg.lateralGrip) * over;
  // En la vuelta corta el deslizamiento se pierde (frena) en vez de empujar.
  const toForward = (drifting ? cfg.drift.gripToForward : cfg.gripToForward) * (1 - back);
  const removed = vL * damp(grip, dt);
  vL -= removed;
  vF += Math.abs(removed) * toForward * (vF >= 0 ? 1 : -1);

  if (throttle > 0) {
    const targetSpeed = cfg.maxSpeed * throttle * align;
    // Girando fuerte por encima del crucero frena en proporción: el círculo no
    // se abre. `turning` es 0 con el rumbo pedido delante y 1 a partir de ~60°.
    const turning = clamp((1 - align) * 3, 0, 1);
    const brake =
      (cfg.brakeDeceleration + (cfg.reverseTurn?.brake ?? 0) * back) *
      (1 + (over * over - 1) * turning);
    const rate = vF < targetSpeed ? cfg.acceleration : brake;
    vF = approach(vF, targetSpeed, rate * dt);
  } else {
    vF = approach(vF, 0, cfg.brakeDeceleration * dt);
  }

  s.vx = fx * vF - fy * vL;
  s.vy = fy * vF + fx * vL;
  // Tope absoluto: ni el derrape ni deslizar por una costa superan la máxima.
  const v = Math.hypot(s.vx, s.vy);
  // En el Cañón, al expirar un impulso se pierde el exceso con el freno normal.
  // El comportamiento predeterminado de navegar/correr conserva su tope absoluto.
  const limit = options.smoothSpeedLimit
    ? Math.max(cfg.maxSpeed, speed - cfg.brakeDeceleration * dt)
    : cfg.maxSpeed;
  if (v > limit) {
    s.vx *= limit / v;
    s.vy *= limit / v;
  }

  s.x += s.vx * dt;
  s.y += s.vy * dt;
}

/**
 * Colisiones: costas laterales y borde inferior deslizan con poca
 * restitución; el borde superior está abierto y, pasado, una corriente
 * suave devuelve el barco (§49.7); los obstáculos circulares rebotan suave.
 * Muta `s`. Devuelve si hubo contacto y deja en `s.impact` la velocidad
 * del golpe (la mayor de este paso), para el sonido y la estela.
 */
export function collideShip(
  s: ShipState,
  env: ShipEnvironment,
  cfg: ShipConfig,
  dt: number,
): boolean {
  const r = cfg.radius;
  const b = env.bounds;
  if (env.wrap) return collideWrapped(s, env, cfg);
  let hit = false;
  let impact = s.impact ?? 0;

  if (s.x < b.left + r) {
    s.x = b.left + r;
    if (s.vx < 0) {
      impact = Math.max(impact, -s.vx);
      s.vx = -s.vx * cfg.wallRestitution;
    }
    hit = true;
  } else if (s.x > b.right - r) {
    s.x = b.right - r;
    if (s.vx > 0) {
      impact = Math.max(impact, s.vx);
      s.vx = -s.vx * cfg.wallRestitution;
    }
    hit = true;
  }
  if (s.y > b.bottom - r) {
    s.y = b.bottom - r;
    if (s.vy > 0) {
      impact = Math.max(impact, s.vy);
      s.vy = -s.vy * cfg.wallRestitution;
    }
    hit = true;
  }

  const beyondTop = b.top - s.y;
  if (beyondTop > 0) {
    // Corriente que arrastra el barco de vuelta: mueve el agua, no el casco,
    // así el freno no la anula y no hay vaivén. Mínimo 15 % para que siempre
    // termine de devolverlo.
    const k = clamp(beyondTop / cfg.openEdgeSoftZone, 0.15, 1);
    s.y += cfg.openEdgeCurrent * k * dt;
  }

  for (const o of env.obstacles) {
    const dx = s.x - o.x;
    const dy = s.y - o.y;
    const minDist = o.radius + r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= minDist * minDist) continue;
    const d = Math.sqrt(d2);
    // Centro exactamente encima: empuja hacia el espectador.
    const nx = d > 1e-6 ? dx / d : 0;
    const ny = d > 1e-6 ? dy / d : 1;
    s.x = o.x + nx * minDist;
    s.y = o.y + ny * minDist;
    const vn = s.vx * nx + s.vy * ny;
    if (vn < 0) {
      impact = Math.max(impact, -vn);
      const e = o.restitution ?? cfg.obstacleRestitution;
      s.vx -= (1 + e) * vn * nx;
      s.vy -= (1 + e) * vn * ny;
    }
    hit = true;
  }
  s.impact = impact;
  return hit;
}

/** `collideShip` en un mundo que da la vuelta: sin bordes, obstáculos por el lado más cerca. */
function collideWrapped(s: ShipState, env: ShipEnvironment, cfg: ShipConfig): boolean {
  const b = env.bounds;
  const w = b.right - b.left;
  const h = b.bottom - b.top;
  const r = cfg.radius;
  let hit = false;
  for (const o of env.obstacles) {
    if (pushOutWrapped(s, r, o, w, h, o.restitution ?? cfg.obstacleRestitution)) hit = true;
  }
  s.x = wrapInto(s.x, b.left, b.right);
  s.y = wrapInto(s.y, b.top, b.bottom);
  return hit;
}

/** Un cuerpo circular que se mueve por el agua: el barco, un enemigo, una nota. */
export interface MovingBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/**
 * Saca un cuerpo de radio `r` de un obstáculo circular por el camino más
 * corto de un mundo de periodo `w`×`h` (periodo no positivo: sin vuelta) y
 * le quita la velocidad contra él con restitución `restitution` (0: desliza
 * por el contorno). Es la colisión del barco con las islas en `/mar`
 * (`collideShip` con `wrap`), compartida con los enemigos del modo
 * Survivors. No lleva el cuerpo dentro del periodo. Muta `s`; devuelve si
 * hubo contacto.
 */
export function pushOutWrapped(
  s: MovingBody,
  r: number,
  o: CircleObstacle,
  w: number,
  h: number,
  restitution: number,
): boolean {
  const dx = wrapDelta(s.x - o.x, w);
  const dy = wrapDelta(s.y - o.y, h);
  const minDist = o.radius + r;
  const d2 = dx * dx + dy * dy;
  if (d2 >= minDist * minDist) return false;
  const d = Math.sqrt(d2);
  const nx = d > 1e-6 ? dx / d : 0;
  const ny = d > 1e-6 ? dy / d : 1;
  s.x += nx * minDist - dx;
  s.y += ny * minDist - dy;
  const vn = s.vx * nx + s.vy * ny;
  if (vn < 0) {
    s.vx -= (1 + restitution) * vn * nx;
    s.vy -= (1 + restitution) * vn * ny;
  }
  return true;
}
