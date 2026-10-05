import type { DefensePathDef } from './config';

/**
 * El camino de los enemigos (decisión 5 del plan 014): una polilínea que se
 * recorre por distancia. Sale de `DefensePathDef` (los mismos datos en todas
 * las partidas) y del radio del castillo:
 *
 * - una espiral de Arquímedes de `outerRadius` a `innerRadius` en `turns`
 *   vueltas, desde el vórtice (`startAngleRad`);
 * - las secciones `s` le suman una onda radial a los dos lados (eses) y las
 *   `zigzag`, dientes rectos hacia el castillo (esquinas vivas);
 * - de la punta de la espiral, recto hasta la muralla.
 *
 * El castillo está en (0, 0). Como cada punto de la espiral tiene un ángulo
 * mayor que el anterior, el camino no se corta mientras las vueltas no se
 * toquen (lo mira la prueba).
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

export interface DefensePath {
  /** Los vértices de la polilínea, del vórtice a la muralla. */
  readonly points: readonly PathPoint[];
  /** u del vórtice a cada vértice (`cum[0]` = 0). */
  readonly cum: readonly number[];
  /** La vuelta (0…`turns`) de cada vértice; el tramo recto final repite la última. */
  readonly turnOf: readonly number[];
  /** u totales. */
  readonly length: number;
  /** El vórtice: donde aparece cada enemigo. */
  readonly start: PathPoint & { heading: number };
  /** La muralla: donde llegan. */
  readonly end: PathPoint;
  readonly width: number;
  readonly corners: readonly PathCorner[];
  /** El punto a `distance` u del vórtice (acotado al camino); escribe en `out` si se da. */
  sampleAt(distance: number, out?: PathSample): PathSample;
  /** u de (x, y) a la línea central del camino (para no construir encima). */
  distanceTo(x: number, y: number): number;
}

/** Desvío radial de las secciones en la vuelta `turn`. */
function offsetAt(def: DefensePathDef, turn: number): number {
  let off = 0;
  for (const s of def.sections) {
    if (turn < s.fromTurn || turn > s.toTurn) continue;
    const u = (turn - s.fromTurn) / (s.toTurn - s.fromTurn);
    if (s.kind === 's') off += s.amplitude * Math.sin(2 * Math.PI * s.waves * u);
    else {
      // Diente: 0 → 1 → 0 en cada uno; hacia el castillo.
      const p = (u * s.waves) % 1;
      const tri = p < 0.5 ? p * 2 : (1 - p) * 2;
      off -= s.amplitude * tri;
    }
  }
  return off;
}

/** Las vueltas donde hay una esquina del zigzag (puntas y valles), para muestrearlas exactas. */
function zigzagKnots(def: DefensePathDef): number[] {
  const knots: number[] = [];
  for (const s of def.sections) {
    if (s.kind !== 'zigzag') continue;
    const n = Math.round(s.waves * 2);
    for (let i = 0; i <= n; i++) knots.push(s.fromTurn + ((s.toTurn - s.fromTurn) * i) / n);
  }
  return knots;
}

/** Construye el camino. `castleRadius`: donde acaba (la muralla). */
export function buildDefensePath(def: DefensePathDef, castleRadius: number): DefensePath {
  const totalRad = def.turns * 2 * Math.PI;
  const steps = Math.max(8, Math.ceil(totalRad / def.sampleStepRad));
  const turns = new Set<number>();
  for (let i = 0; i <= steps; i++) turns.add((def.turns * i) / steps);
  for (const k of zigzagKnots(def)) turns.add(k);
  const sorted = [...turns]
    .sort((a, b) => a - b)
    .filter((t, i, all) => i === 0 || t - all[i - 1]! > 1e-7);

  const points: PathPoint[] = [];
  const turnOf: number[] = [];
  const radiusAt = (turn: number) =>
    def.outerRadius +
    ((def.innerRadius - def.outerRadius) * turn) / def.turns +
    offsetAt(def, turn);
  for (const turn of sorted) {
    const a = def.startAngleRad + def.direction * turn * 2 * Math.PI;
    const r = radiusAt(turn);
    points.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
    turnOf.push(turn);
  }
  // Recto hasta la muralla.
  const lastA = def.startAngleRad + def.direction * totalRad;
  const lastR = radiusAt(def.turns);
  const legSteps = Math.max(1, Math.ceil((lastR - castleRadius) / 40));
  for (let i = 1; i <= legSteps; i++) {
    const r = lastR + ((castleRadius - lastR) * i) / legSteps;
    points.push({ x: r * Math.cos(lastA), y: r * Math.sin(lastA) });
    turnOf.push(def.turns);
  }

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
    turnOf,
    length,
    start: { x: first.x, y: first.y, heading: Math.atan2(second.y - first.y, second.x - first.x) },
    end: points[points.length - 1]!,
    width: def.width,
    corners,
    sampleAt,
    distanceTo,
  };
}
