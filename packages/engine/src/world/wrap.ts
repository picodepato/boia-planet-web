/**
 * Las cuentas del mar que da la vuelta (D-22), sin three.js ni DOM: el
 * camino más corto en un periodo y llevar un punto dentro del rectángulo.
 * Las usan el barco (`ship/controller.ts`), el modo Survivors
 * (`survivors/`) y `/mar` (`apps/web/app/mar/engine/wrap.ts` las reexporta).
 */

/**
 * Diferencia `d` llevada al camino más corto en un mundo de periodo `period`
 * (resultado en [-period/2, period/2)). Con periodo no positivo, `d` tal cual.
 */
export function wrapDelta(d: number, period: number): number {
  if (!(period > 0)) return d;
  return d - period * Math.floor(d / period + 0.5);
}

/** Lleva `v` a [min, max) dando la vuelta (mundo que da la vuelta). */
export function wrapInto(v: number, min: number, max: number): number {
  const period = max - min;
  if (!(period > 0)) return v;
  const r = (v - min) % period;
  return (r < 0 ? r + period : r) + min;
}

/** El periodo de un mundo que da la vuelta: ancho y alto. */
export interface Period {
  w: number;
  h: number;
}

export const periodOf = (r: {
  left: number;
  right: number;
  top: number;
  bottom: number;
}): Period => ({ w: r.right - r.left, h: r.bottom - r.top });

/** De `a` a `b` por el camino más corto (sin periodo: en línea recta). */
export function shortest(
  a: { x: number; y: number },
  b: { x: number; y: number },
  period: Period | null,
): { dx: number; dy: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return period ? { dx: wrapDelta(dx, period.w), dy: wrapDelta(dy, period.h) } : { dx, dy };
}
