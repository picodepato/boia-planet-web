import type { DefensePathDef } from './config';

/**
 * El camino de los enemigos (decisión 5 del plan 014; v2, decisión 7 del
 * plan 015): una polilínea que se recorre por distancia. Sale de
 * `DefensePathDef` (los mismos datos en todas las partidas) y del radio del
 * castillo, como un trazo de tortuga alrededor del castillo, que está en
 * (0, 0):
 *
 * - `orbit`: rodea el castillo (en el sentido `direction`) hasta un ángulo,
 *   con el radio cambiando poco a poco (una espiral);
 * - `u`: una curva en U hacia el castillo: entra recto `depth` u, da media
 *   vuelta en un semicírculo de radio `radius` y sale recto, paralelo, hasta
 *   el radio en que entró. Dentro de la U cabe una isla que alcanza los dos
 *   lados; entre dos U seguidas queda otra U al revés (abierta al castillo);
 * - `zigzag`: tramos rectos de `legLength` u hacia el castillo, girando
 *   `angleRad` a un lado y al otro (esquinas vivas; en cada ángulo cabe una
 *   isla);
 * - de la última punta, recto hasta la muralla.
 *
 * Empieza en el vórtice (`outerRadius` u del castillo, a `startAngleRad`).
 * Que no se corte y que haya sitio entre tramos lo miran las pruebas.
 */

export interface PathPoint {
  x: number;
  y: number;
}

/** Un punto del camino a una distancia: posición, rumbo (rad) y la normal a la izquierda. */
export interface PathSample {
  x: number;
  y: number;
  heading: number;
  /** Normal unitaria (a la izquierda del sentido de avance). */
  nx: number;
  ny: number;
}

/** Una esquina viva del camino (para las boyas de la carrera de acento). */
export interface PathCorner {
  x: number;
  y: number;
  /** u del vórtice a la esquina. */
  distance: number;
  /** rad que gira el camino ahí (con signo). */
  turnRad: number;
}

/** Una curva en U hacia el castillo: el centro de su semicírculo (dentro de la U). */
export interface PathUTurn {
  /** Centro del semicírculo: el sitio de dentro de la U. */
  x: number;
  y: number;
  /** u del radio del semicírculo (la mitad de lo que separa sus dos lados). */
  radius: number;
  /** u del vórtice a la mitad de la media vuelta. */
  distance: number;
  /** u de cada lado recto de la U. */
  depth: number;
}

export interface DefensePath {
  /** Los vértices de la polilínea, del vórtice a la muralla. */
  readonly points: readonly PathPoint[];
  /** u del vórtice a cada vértice (`cum[0]` = 0). */
  readonly cum: readonly number[];
  /** El tramo de `DefensePathDef.legs` de cada vértice (−1: el recto final a la muralla). */
  readonly legOf: readonly number[];
  /** u totales. */
  readonly length: number;
  /** El vórtice: donde aparece cada enemigo. */
  readonly start: PathPoint & { heading: number };
  /** La muralla: donde llegan. */
  readonly end: PathPoint;
  readonly width: number;
  readonly corners: readonly PathCorner[];
  /** Las curvas en U hacia el castillo, en orden. */
  readonly uTurns: readonly PathUTurn[];
  /** El punto a `distance` u del vórtice (acotado al camino); escribe en `out` si se da. */
  sampleAt(distance: number, out?: PathSample): PathSample;
  /** u de (x, y) a la línea central del camino (para no construir encima). */
  distanceTo(x: number, y: number): number;
}

/** Construye el camino. `castleRadius`: donde acaba (la muralla). */
export function buildDefensePath(def: DefensePathDef, castleRadius: number): DefensePath {
  // Se traza en un marco propio (vórtice en +x, giro en +ángulo) y luego se
  // lleva al de la partida (`startAngleRad`, `direction`).
  const step = def.sampleStep;
  const raw: PathPoint[] = [{ x: def.outerRadius, y: 0 }];
  const legOf: number[] = [0];
  const uRaw: { cx: number; cy: number; radius: number; index: number; depth: number }[] = [];
  let cx = def.outerRadius;
  let cy = 0;
  /** Ángulo recorrido alrededor del castillo (sin dar la vuelta a 2π). */
  let phi = 0;
  const push = (x: number, y: number, leg: number) => {
    const p = raw[raw.length - 1]!;
    if (Math.hypot(x - p.x, y - p.y) < 1e-6) return;
    raw.push({ x, y });
    legOf.push(leg);
    cx = x;
    cy = y;
  };
  /** El ángulo de (x, y) más cerca de `phi` (sin saltos de 2π). */
  const unwrap = (x: number, y: number) => {
    const a = Math.atan2(y, x);
    return a + 2 * Math.PI * Math.round((phi - a) / (2 * Math.PI));
  };
  const straight = (x: number, y: number, leg: number) => {
    const n = Math.max(1, Math.ceil(Math.hypot(x - cx, y - cy) / step));
    const x0 = cx;
    const y0 = cy;
    for (let i = 1; i <= n; i++) push(x0 + ((x - x0) * i) / n, y0 + ((y - y0) * i) / n, leg);
    phi = unwrap(cx, cy);
  };

  def.legs.forEach((leg, li) => {
    if (leg.kind === 'orbit') {
      const r0 = Math.hypot(cx, cy);
      const phi0 = phi;
      const dPhi = leg.toAngleRad - phi0;
      const arc = Math.abs(dPhi) * Math.max(r0, leg.toRadius);
      const n = Math.max(1, Math.ceil(Math.hypot(arc, leg.toRadius - r0) / step));
      for (let i = 1; i <= n; i++) {
        const a = phi0 + (dPhi * i) / n;
        const r = r0 + ((leg.toRadius - r0) * i) / n;
        push(r * Math.cos(a), r * Math.sin(a), li);
      }
      phi = leg.toAngleRad;
    } else if (leg.kind === 'u') {
      const r0 = Math.hypot(cx, cy);
      const ux = -cx / r0; // hacia el castillo
      const uy = -cy / r0;
      const tx = uy; // hacia delante (sentido de la vuelta)
      const ty = -ux;
      const ax = cx + ux * leg.depth;
      const ay = cy + uy * leg.depth;
      straight(ax, ay, li);
      const ccx = ax + tx * leg.radius;
      const ccy = ay + ty * leg.radius;
      const n = Math.max(4, Math.ceil((Math.PI * leg.radius) / step));
      const at = raw.length - 1;
      for (let i = 1; i <= n; i++) {
        const s = (Math.PI * i) / n;
        push(
          ccx + leg.radius * (-tx * Math.cos(s) + ux * Math.sin(s)),
          ccy + leg.radius * (-ty * Math.cos(s) + uy * Math.sin(s)),
          li,
        );
      }
      uRaw.push({
        cx: ccx,
        cy: ccy,
        radius: leg.radius,
        index: at + Math.round(n / 2),
        depth: leg.depth,
      });
      // Sale hacia fuera, paralelo a la entrada, hasta el radio en que entró.
      const bu = cx * ux + cy * uy;
      const b2 = cx * cx + cy * cy;
      const s = bu + Math.sqrt(Math.max(0, bu * bu - b2 + r0 * r0));
      straight(cx - ux * s, cy - uy * s, li);
    } else {
      // Zigzag hacia el castillo: medio tramo, tramos enteros y medio tramo.
      for (let k = 0; k <= leg.legs; k++) {
        const len = k === 0 || k === leg.legs ? leg.legLength / 2 : leg.legLength;
        const base = Math.atan2(-cy, -cx);
        const a = base + (k % 2 === 0 ? leg.angleRad : -leg.angleRad);
        straight(cx + Math.cos(a) * len, cy + Math.sin(a) * len, li);
      }
    }
  });
  // Recto hasta la muralla.
  const rEnd = Math.hypot(cx, cy);
  if (rEnd > castleRadius) straight((cx / rEnd) * castleRadius, (cy / rEnd) * castleRadius, -1);

  // Al marco de la partida.
  const ca = Math.cos(def.startAngleRad);
  const sa = Math.sin(def.startAngleRad);
  const map = (p: PathPoint): PathPoint => {
    const y = p.y * def.direction;
    return { x: p.x * ca - y * sa, y: p.x * sa + y * ca };
  };
  const points = raw.map(map);

  const cum: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1]!;
    const q = points[i]!;
    cum.push(cum[i - 1]! + Math.hypot(q.x - p.x, q.y - p.y));
  }
  const length = cum[cum.length - 1]!;

  const corners: PathCorner[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i - 1]!;
    const q = points[i]!;
    const r = points[i + 1]!;
    const a1 = Math.atan2(q.y - p.y, q.x - p.x);
    const a2 = Math.atan2(r.y - q.y, r.x - q.x);
    let d = a2 - a1;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    if (Math.abs(d) >= def.cornerMinRad)
      corners.push({ x: q.x, y: q.y, distance: cum[i]!, turnRad: d });
  }

  const uTurns: PathUTurn[] = uRaw.map((u) => ({
    ...map({ x: u.cx, y: u.cy }),
    radius: u.radius,
    distance: cum[u.index]!,
    depth: u.depth,
  }));

  /** Índice del tramo que contiene `d` (búsqueda binaria). */
  const segmentOf = (d: number): number => {
    let lo = 0;
    let hi = points.length - 2;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (cum[mid]! <= d) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };

  const sampleAt = (
    distance: number,
    out: PathSample = { x: 0, y: 0, heading: 0, nx: 0, ny: 0 },
  ): PathSample => {
    const d = Math.min(length, Math.max(0, distance));
    const i = segmentOf(d);
    const p = points[i]!;
    const q = points[i + 1]!;
    const segLen = cum[i + 1]! - cum[i]!;
    const t = segLen > 0 ? (d - cum[i]!) / segLen : 0;
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const inv = segLen > 0 ? 1 / segLen : 0;
    out.x = p.x + dx * t;
    out.y = p.y + dy * t;
    out.heading = Math.atan2(dy, dx);
    out.nx = -dy * inv;
    out.ny = dx * inv;
    return out;
  };

  const distanceTo = (x: number, y: number): number => {
    let best = Infinity;
    for (let i = 0; i < points.length - 1; i++) {
      const p = points[i]!;
      const q = points[i + 1]!;
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const l2 = dx * dx + dy * dy;
      const t = l2 > 0 ? Math.min(1, Math.max(0, ((x - p.x) * dx + (y - p.y) * dy) / l2)) : 0;
      const d = Math.hypot(x - (p.x + dx * t), y - (p.y + dy * t));
      if (d < best) best = d;
    }
    return best;
  };

  const first = points[0]!;
  const second = points[1]!;
  return {
    points,
    cum,
    legOf,
    length,
    start: { x: first.x, y: first.y, heading: Math.atan2(second.y - first.y, second.x - first.x) },
    end: points[points.length - 1]!,
    width: def.width,
    corners,
    uTurns,
    sampleAt,
    distanceTo,
  };
}
