/**
 * Geometría de las torres (plan 014 T159), en el plano sin bordes que se
 * dan la vuelta de la arena. Las mismas pruebas que hacen las armas del
 * Cañón (`survivors/sim.ts`: el haz del Show de Láseres mide «a lo largo» y
 * «de través»; el cono del confeti, el ángulo), pero aquí sin el mar que se
 * repite: aquellas son privadas de su partida y van con `wrapDelta`.
 */

/** Ángulo llevado a [0, 2π). */
export function wrapAngle(a: number): number {
  const two = Math.PI * 2;
  return ((a % two) + two) % two;
}

/** Diferencia de ángulos en (−π, π]. */
export function angleDiff(a: number, b: number): number {
  let d = wrapAngle(a - b);
  if (d > Math.PI) d -= Math.PI * 2;
  return d;
}

/**
 * ¿Toca el círculo (cx, cy, r) el haz que sale de (ox, oy) hacia `angle`,
 * de largo `length` y medio ancho `halfWidth`?
 */
export function beamTouches(
  ox: number,
  oy: number,
  angle: number,
  length: number,
  halfWidth: number,
  cx: number,
  cy: number,
  r: number,
): boolean {
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const dx = cx - ox;
  const dy = cy - oy;
  const along = dx * ux + dy * uy;
  if (along < -r || along > length + r) return false;
  return Math.abs(-dx * uy + dy * ux) <= halfWidth + r;
}

/**
 * ¿Toca el círculo (cx, cy, r) el cono que sale de (ox, oy) hacia `angle`,
 * de alcance `range` y medio ángulo `halfAngle`? (El borde del círculo
 * cuenta: a su distancia, el círculo abre `asin(r/d)` más.)
 */
export function coneTouches(
  ox: number,
  oy: number,
  angle: number,
  range: number,
  halfAngle: number,
  cx: number,
  cy: number,
  r: number,
): boolean {
  const dx = cx - ox;
  const dy = cy - oy;
  const d = Math.hypot(dx, dy);
  if (d > range + r) return false;
  if (d <= r) return true;
  const spread = Math.asin(Math.min(1, r / d));
  return Math.abs(angleDiff(Math.atan2(dy, dx), angle)) <= halfAngle + spread;
}
