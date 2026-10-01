import type { Rect } from '@boia/world';

/**
 * El mar de `/mar` enrollado en una esfera (T57): código puro, sin three.js.
 * `/mar` es un planeta de agua que da la vuelta en las dos direcciones (un
 * toro curvado en la GPU, `app/mar/engine/planet.ts`); para verlo entero
 * desde fuera, la entrada lo pone en una esfera de verdad:
 *
 * - la x del mapa es la longitud y da la vuelta entera, como en `/mar`, con
 *   la circunferencia del ecuador igual al periodo del mar: las islas
 *   conservan su tamaño y sus distancias de este a oeste;
 * - la y es la latitud, del norte del mapa (`latTop`) al sur (`latBottom`):
 *   una franja, porque una esfera no da la vuelta en dos sentidos.
 *
 * Unidades: las del mar 3D (unidades de escena de three.js); ángulos en
 * radianes. Ejes: y hacia el polo norte, z hacia la cámara en longitud 0.
 */

export type Vec3 = [number, number, number];

export interface SphereMap {
  /** Radio de la esfera, unidades de escena. */
  radius: number;
  rect: Rect;
  latTop: number;
  latBottom: number;
}

export function sphereMap(rect: Rect, latTopDeg: number, latBottomDeg: number): SphereMap {
  return {
    radius: (rect.right - rect.left) / (2 * Math.PI),
    rect,
    latTop: (latTopDeg * Math.PI) / 180,
    latBottom: (latBottomDeg * Math.PI) / 180,
  };
}

/** Longitud y latitud de un punto del mar (x, y en unidades de escena). */
export function lonLat(m: SphereMap, x: number, y: number): { lon: number; lat: number } {
  const fx = (x - m.rect.left) / (m.rect.right - m.rect.left);
  const fy = (y - m.rect.top) / (m.rect.bottom - m.rect.top);
  return {
    lon: (fx - 0.5) * 2 * Math.PI,
    lat: m.latTop + (m.latBottom - m.latTop) * Math.min(1, Math.max(0, fy)),
  };
}

/** Dirección unitaria de una longitud y latitud. */
export function dirOf(lon: number, lat: number): Vec3 {
  const c = Math.cos(lat);
  return [c * Math.sin(lon), Math.sin(lat), c * Math.cos(lon)];
}

/**
 * Marco local de un punto de la superficie: `up` (la normal), `east` y
 * `south`, para colocar una isla con su sur (+z local) hacia el sur, como en
 * el mar: (x, y, z) locales → (este, arriba, sur), una rotación sin espejo.
 */
export function frameAt(up: Vec3): { up: Vec3; east: Vec3; south: Vec3 } {
  // Norte en el plano tangente (en los polos, cualquiera).
  let nx = -up[0] * up[1];
  let ny = 1 - up[1] * up[1];
  let nz = -up[2] * up[1];
  let l = Math.hypot(nx, ny, nz);
  if (l < 1e-6) {
    nx = 0;
    ny = 0;
    nz = -1;
    l = 1;
  }
  const north: Vec3 = [nx / l, ny / l, nz / l];
  // este = norte × arriba
  const east: Vec3 = [
    north[1] * up[2] - north[2] * up[1],
    north[2] * up[0] - north[0] * up[2],
    north[0] * up[1] - north[1] * up[0],
  ];
  return { up, east, south: [-north[0], -north[1], -north[2]] };
}

/**
 * Lleva un punto local de una pieza (x este, y altura, z sur; ya escalado) a
 * la esfera de radio `radius`, doblándolo sobre la superficie: la distancia
 * horizontal se mide sobre el arco, así una isla ancha se apoya en el agua de
 * borde a borde en vez de quedarse plana y flotando.
 */
export function wrapPoint(
  frame: { up: Vec3; east: Vec3; south: Vec3 },
  radius: number,
  x: number,
  y: number,
  z: number,
  out: Vec3 = [0, 0, 0],
): Vec3 {
  const { up, east, south } = frame;
  const tx = east[0] * x + south[0] * z;
  const ty = east[1] * x + south[1] * z;
  const tz = east[2] * x + south[2] * z;
  const d = Math.hypot(tx, ty, tz);
  const r = radius + y;
  if (d < 1e-9) {
    out[0] = up[0] * r;
    out[1] = up[1] * r;
    out[2] = up[2] * r;
    return out;
  }
  const a = d / radius;
  const c = Math.cos(a);
  const s = Math.sin(a) / d;
  out[0] = (up[0] * c + tx * s) * r;
  out[1] = (up[1] * c + ty * s) * r;
  out[2] = (up[2] * c + tz * s) * r;
  return out;
}

/** Ángulo (rad) entre dos direcciones unitarias. */
export function arc(a: Vec3, b: Vec3): number {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return Math.acos(Math.min(1, Math.max(-1, dot)));
}
