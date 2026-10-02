import type { Rect } from '@boia/world';

/**
 * El planeta de agua de `/mar` (D-22, REQ-MUN-038), sin three.js: el
 * rectángulo que da la vuelta, el camino más corto, el piloto automático y
 * la curva del horizonte. Lo que pinta está en `planet.ts`; esto se prueba
 * sin navegador. Medidas en u de motor salvo donde se diga.
 */

/**
 * Agua de más alrededor de lo que hay en el mar antes de dar la vuelta (u).
 * T50: los límites ya se ajustan a lo que ocupa el mar (`contentBounds` en
 * `compact.ts`) y el margen es corto: lo justo para que dos cosas de lados
 * opuestos no se toquen al dar la vuelta. Así la última isla queda a un
 * paso del puerto (la ruta de boyas cierra por ahí). Las posiciones del
 * mapa compartido no cambian (REQ-MUN-035). muestra
 */
export const PLANET_MARGIN = { side: 150, top: 150, bottom: 150 } as const;

/** El periodo del planeta: lo que hay (ya a escala del mar 3D) con su margen. */
export function planetRect(bounds: Rect): Rect {
  return {
    left: bounds.left - PLANET_MARGIN.side,
    right: bounds.right + PLANET_MARGIN.side,
    top: bounds.top - PLANET_MARGIN.top,
    bottom: bounds.bottom + PLANET_MARGIN.bottom,
  };
}

/** Diferencia `d` por el camino más corto en un periodo `p` (p ≤ 0: sin vuelta). */
export function wrapD(d: number, p: number): number {
  if (!(p > 0)) return d;
  return d - p * Math.floor(d / p + 0.5);
}

/**
 * Cuánto se puede arrastrar la carta (vista de mapa) desde su centro, en un
 * eje (T65): hasta ver su borde si no cabe en la pantalla (`view` < `period`)
 * y, si cabe entera, sólo un poco (`slack` del periodo). Así la carta no se
 * va de la pantalla y lo que está cerca del borde no salta al otro lado.
 */
export const MAP_PAN_SLACK = 0.12;

export function mapPanLimit(period: number, view: number, slack = MAP_PAN_SLACK): number {
  if (!(period > 0)) return 0;
  return Math.max(period * slack, (period - Math.max(0, view)) / 2);
}

/** `v` dentro de [min, max) dando la vuelta. */
export function wrapIn(v: number, min: number, max: number): number {
  const p = max - min;
  if (!(p > 0)) return v;
  const r = (v - min) % p;
  return (r < 0 ? r + p : r) + min;
}

export interface Period {
  w: number;
  h: number;
}

export const periodOf = (r: Rect): Period => ({ w: r.right - r.left, h: r.bottom - r.top });

/** De `a` a `b` por el camino más corto (sin periodo: en línea recta). */
export function shortest(
  a: { x: number; y: number },
  b: { x: number; y: number },
  period: Period | null,
): { dx: number; dy: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return period ? { dx: wrapD(dx, period.w), dy: wrapD(dy, period.h) } : { dx, dy };
}

export interface Circle {
  x: number;
  y: number;
  radius: number;
}

export interface SteerResult {
  dirX: number;
  dirY: number;
  throttle: number;
  /** Llegó (a menos de `arrive` u del destino). */
  arrived: boolean;
  /** u que faltan, por el camino que toma. */
  distance: number;
}

/**
 * Piloto automático: rumbo al destino por el camino más corto (dando la
 * vuelta al planeta si es más corto) y apartándose de lo sólido que hay
 * delante. Puro: lo usa `Mar3D` y se prueba solo.
 */
export function steer(
  ship: { x: number; y: number },
  target: { x: number; y: number },
  obstacles: readonly Circle[],
  opts: { shipRadius: number; period: Period | null; arrive?: number },
): SteerResult {
  const { dx: tx, dy: ty } = shortest(ship, target, opts.period);
  const dist = Math.hypot(tx, ty);
  if (dist < (opts.arrive ?? 34))
    return { dirX: 0, dirY: 0, throttle: 0, arrived: true, distance: dist };
  const dx = tx / dist;
  const dy = ty / dist;
  const look = Math.min(dist, 420);
  let sx = 0;
  let sy = 0;
  for (const o of obstacles) {
    const { dx: ox, dy: oy } = shortest(ship, o, opts.period);
    const proj = ox * dx + oy * dy;
    if (proj < -o.radius || proj > look + o.radius) continue;
    const lat = ox * -dy + oy * dx;
    const clear = o.radius + opts.shipRadius + 36;
    if (Math.abs(lat) >= clear) continue;
    const push =
      ((clear - Math.abs(lat)) / clear) * (1 - (Math.max(0, proj) / (look + clear)) * 0.6);
    const side = lat > 0 ? -1 : 1;
    sx += -dy * side * push * 1.8;
    sy += dx * side * push * 1.8;
  }
  const throttle = Math.max(0.35, Math.min(1, dist / 260));
  return { dirX: dx + sx, dirY: dy + sy, throttle, arrived: false, distance: dist };
}

/**
 * Saca el barco de los círculos sólidos del decorado propio de `/mar` (el
 * castillo, la Explanada, la cueva), que no son lugares del mapa compartido
 * y por eso no están en el runtime. Rebote suave, como un obstáculo. Muta `s`.
 */
export function pushOut(
  s: { x: number; y: number; vx: number; vy: number },
  circles: readonly Circle[],
  shipRadius: number,
  period: Period | null,
  restitution = 0.25,
): boolean {
  let hit = false;
  for (const c of circles) {
    const { dx, dy } = shortest(c, s, period);
    const min = c.radius + shipRadius;
    const d2 = dx * dx + dy * dy;
    if (d2 >= min * min) continue;
    const d = Math.sqrt(d2);
    const nx = d > 1e-6 ? dx / d : 0;
    const ny = d > 1e-6 ? dy / d : 1;
    s.x += nx * min - dx;
    s.y += ny * min - dy;
    const vn = s.vx * nx + s.vy * ny;
    if (vn < 0) {
      s.vx -= (1 + restitution) * vn * nx;
      s.vy -= (1 + restitution) * vn * ny;
    }
    hit = true;
  }
  return hit;
}

// --- La curva del planeta (unidades de escena) -------------------------------

/**
 * La superficie cae `bend · r²` a distancia horizontal `r` de la cámara: una
 * esfera de radio 1 / (2·bend) vista de cerca. El mismo cálculo va en el
 * shader (`planet.ts`); aquí, para rótulos, toques y lo que se oculta.
 */
export const bendDrop = (bend: number, r: number) => bend * r * r;

/**
 * Dónde toca el agua curvada un rayo desde la cámara (altura `camY`) con
 * dirección (dx, dy, dz) normalizada: distancia a lo largo del rayo, o
 * `null` si pasa por encima del horizonte (entonces `horizon` es el punto
 * del rayo más cercano al agua, para poner rumbo hacia allí).
 */
export function rayOnPlanet(
  camY: number,
  dx: number,
  dy: number,
  dz: number,
  bend: number,
): { t: number; hit: boolean } {
  const a2 = dx * dx + dz * dz;
  const qa = bend * a2;
  if (qa < 1e-12) return dy < 0 ? { t: -camY / dy, hit: true } : { t: 0, hit: false };
  // qa·t² + dy·t + camY = 0
  const disc = dy * dy - 4 * qa * camY;
  if (disc < 0) return { t: Math.max(0, -dy / (2 * qa)), hit: false };
  const t = (-dy - Math.sqrt(disc)) / (2 * qa);
  return t > 0 ? { t, hit: true } : { t: Math.max(0, -dy / (2 * qa)), hit: false };
}

/**
 * ¿Tapa el planeta un punto a distancia horizontal `r` de la cámara y altura
 * `y` (ya curvada)? La línea de vista baja por debajo del agua en algún sitio.
 */
export function behindPlanet(camY: number, r: number, y: number, bend: number): boolean {
  if (bend <= 0 || r <= 1e-6) return false;
  const slope = (y - camY) / r;
  // f(s) = camY + slope·s + bend·s², mínimo en s* = −slope / (2·bend).
  const s = -slope / (2 * bend);
  if (s <= 0 || s >= r) return false;
  return camY + slope * s + bend * s * s < 0;
}
