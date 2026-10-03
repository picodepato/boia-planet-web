/**
 * La carretera de Los Rápidos mientras dura la carrera: el trazado cerrado de
 * una vuelta con un ancho, las boyitas que lo marcan a los lados y el
 * temporizador de «te saliste». Puro (sin three ni React): lo prueba
 * `road.test.ts` y lo usan `mar-client` y `Mar3D`. Todo en u de motor.
 */

import { type Period, shortest } from './engine/wrap';

type Point = { x: number; y: number };

/** Medio ancho de la carretera (u de motor): de la línea de boias a cada boyita lateral. muestra */
export const ROAD_HALF_WIDTH = 180;
/** Separación entre boyitas de un mismo lado (u de motor). muestra */
export const ROAD_MARK_STEP = 100;
/** s para volver a la carretera antes de que se acabe la carrera. */
export const OFFROAD_GRACE = 5;
/**
 * Lo que tiene que acercarse a la carretera (u de motor/s) para que la cuenta
 * se pare: volver de verdad, no rozar un obstáculo a la deriva. muestra
 */
export const OFFROAD_RETURN_SPEED = 60;

function distToSegment(a: Point, b: Point, p: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

/**
 * Distancia de `p` al trazado `path` (una línea quebrada, abierta). Con
 * `period`, el planeta da la vuelta: cada tramo se mide contra la copia de
 * `p` más cercana a él (el barco que sale por un borde entra por el otro).
 */
export function distToPath(path: Point[], p: Point, period: Period | null = null): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const d = shortest(mid, p, period);
    best = Math.min(best, distToSegment(a, b, { x: mid.x + d.dx, y: mid.y + d.dy }));
  }
  return best;
}

/** ¿Está `p` fuera de la carretera? */
export function isOffRoad(path: Point[], p: Point, halfWidth = ROAD_HALF_WIDTH): boolean {
  return path.length > 1 && distToPath(path, p) > halfWidth;
}

/** Rumbo unitario del tramo a → b, o null si es un punto. */
function dirOf(a: Point, b: Point): Point | null {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  return len === 0 ? null : { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
}

/**
 * Las boyitas de los dos lados del trazado: una cada `step` por cada tramo, a
 * `halfWidth` de la línea (la derecha de la marcha y la izquierda), y en cada
 * vértice un arco de boyitas por fuera de la curva, también cada `step`. Sin
 * ese arco, en una curva cerrada las del tramo que llega y las del que sale
 * quedan lejos y el borde se abre (T96: por debajo de la boia 8 y por encima
 * de la 3, por donde se salía del circuito). Con el trazado cerrado (la
 * salida es también la meta), la salida es un vértice más. Las que caerían
 * dentro de la carretera (el lado de dentro de una curva, un cruce) se
 * quitan, y las que quedan casi juntas se dejan en una.
 */
export function roadMarks(
  path: Point[],
  halfWidth = ROAD_HALF_WIDTH,
  step = ROAD_MARK_STEP,
): { right: Point[]; left: Point[] } {
  const out = { right: [] as Point[], left: [] as Point[] };
  const taken: Point[] = [];
  const put = (side: 'right' | 'left', p: Point) => {
    if (distToPath(path, p) < halfWidth * 0.95) return;
    if (taken.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < step * 0.5)) return;
    taken.push(p);
    out[side].push(p);
  };
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const d = dirOf(a, b);
    if (!d) continue;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.round(len / step));
    // Con k = 0 se pone la del vértice de salida del tramo; el último vértice, al final.
    for (let k = 0; k <= steps; k++) {
      const x = a.x + d.x * len * (k / steps);
      const y = a.y + d.y * len * (k / steps);
      put('right', { x: x - d.y * halfWidth, y: y + d.x * halfWidth });
      put('left', { x: x + d.y * halfWidth, y: y - d.x * halfWidth });
    }
  }
  // Los arcos de los vértices: de la normal del tramo que llega a la del que sale.
  const n = path.length;
  const closed =
    n > 2 && Math.hypot(path[0]!.x - path[n - 1]!.x, path[0]!.y - path[n - 1]!.y) < 1e-6;
  for (let i = closed ? 0 : 1; i < n - 1; i++) {
    const v = path[i]!;
    const prev = i === 0 ? path[n - 2]! : path[i - 1]!;
    const din = dirOf(prev, v);
    const dout = dirOf(v, path[i + 1]!);
    if (!din || !dout) continue;
    for (const side of ['right', 'left'] as const) {
      const s = side === 'right' ? 1 : -1;
      const from = Math.atan2(din.x * s, -din.y * s);
      let turn = Math.atan2(dout.x * s, -dout.y * s) - from;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      const pieces = Math.ceil((Math.abs(turn) * halfWidth) / step);
      for (let k = 1; k < pieces; k++) {
        const a = from + (turn * k) / pieces;
        put(side, { x: v.x + Math.cos(a) * halfWidth, y: v.y + Math.sin(a) * halfWidth });
      }
    }
  }
  return out;
}

/**
 * El tiempo que le queda a quien se salió: empieza al salir y se agota a los
 * `grace` s fuera. Mientras vuelve (se acerca a la carretera a más de
 * `OFFROAD_RETURN_SPEED`) la cuenta se para: el barco gira ancho y sólo dar la vuelta ya gasta casi
 * 5 s. Al volver a la carretera se reinicia (la carrera sigue con su reloj).
 */
export class OffRoad {
  private left: number | null = null;
  private last = Number.POSITIVE_INFINITY;

  constructor(
    private readonly grace = OFFROAD_GRACE,
    private readonly halfWidth = ROAD_HALF_WIDTH,
  ) {}

  /** s que le quedan fuera de la carretera, o null si va por ella. */
  get remaining(): number | null {
    return this.left;
  }

  /** Avanza `dt` s a `dist` u de la carretera; devuelve true cuando se acaba el tiempo. */
  step(dt: number, dist: number): boolean {
    const last = this.last;
    this.last = dist;
    if (dist <= this.halfWidth) {
      this.left = null;
      return false;
    }
    const back = this.left !== null && dt > 0 && (last - dist) / dt > OFFROAD_RETURN_SPEED;
    this.left = Math.max(0, (this.left ?? this.grace) - (back ? 0 : dt));
    return this.left <= 0;
  }

  reset(): void {
    this.left = null;
    this.last = Number.POSITIVE_INFINITY;
  }
}
