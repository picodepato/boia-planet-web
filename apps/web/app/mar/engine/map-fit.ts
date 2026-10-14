import type { WorldObject } from '@boia/world';
import { PerspectiveCamera, Vector3 } from 'three';
import { toScene } from './compress';
import { bendDrop, type Period } from './wrap';

/**
 * La cámara de la vista de mapa (la que abre el minimapa, zoom 1) y cómo se
 * pone para que quepan todas las islas (T279, Álvaro: «que se vean todas,
 * sin que ninguna quede cortada por los bordes»). Se calcula con las
 * posiciones reales de las islas y la pantalla, no con un número a ojo: la
 * distancia más corta (desde la de siempre) y lo que sube o baja la carta
 * para que cada isla y la punta de su rótulo caigan dentro de la zona libre
 * de mandos (`MAP_SAFE`).
 */

/** Inclinación de la cámara en la vista de mapa (rad bajo la horizontal). */
export const MAP_ELEV = 1.28;
/** Curva del planeta en la vista de mapa (casi plana; ver `BEND_NEAR` en mar3d.ts). muestra */
export const BEND_MAP = 0.00016;
/**
 * px que sube el planeta en la vista de mapa (T50): así el puerto y el
 * final de la ruta de boyas quedan por encima de la barra de abajo. Es lo
 * de partida: `mapFit` lo cambia lo justo si así caben las islas (T279).
 */
export const MAP_LIFT_PX = 48;
/** Altura (escena) de la punta del rótulo de una isla vista desde el mapa. */
export const MAP_LABEL_Y = 6;

/**
 * La zona de la pantalla (px desde cada borde) donde va cada isla en la
 * vista de mapa. Arriba, la barra de enlaces (hasta ~48 px en escritorio)
 * más un rótulo entero encima de su isla (47 px + la punta); abajo,
 * «Entradas» y el turbo; a los lados, un respiro. muestra
 */
export const MAP_SAFE = { top: 108, bottom: 76, side: 14 } as const;

export type MapSafe = { top: number; bottom: number; side: number };

/** Una isla en la escena: su centro y su radio. */
export interface MapIsland {
  x: number;
  z: number;
  r: number;
}

export interface MapView {
  fovDeg: number;
  width: number;
  height: number;
  /** Centro de la carta (escena). */
  center: { x: number; z: number };
}

/** Cómo va la cámara del mapa: su distancia y lo que sube la carta (px). */
export interface MapFit {
  dist: number;
  liftPx: number;
}

/** La cámara de la vista de mapa, como la pone `updateCamera` con zoom 1. */
export function mapCamera(dist: number, view: MapView, liftPx = MAP_LIFT_PX): PerspectiveCamera {
  const { fovDeg, width, height, center } = view;
  const camera = new PerspectiveCamera(fovDeg, width / height, 0.5, 50000);
  const t = Math.tan((fovDeg * Math.PI) / 360);
  const back = Math.cos(MAP_ELEV) * dist;
  const mapLift = (liftPx * 2 * dist * t) / height;
  const look = new Vector3(center.x, -bendDrop(BEND_MAP, back), center.z + mapLift);
  camera.position.set(look.x, Math.sin(MAP_ELEV) * dist, look.z + back);
  camera.lookAt(look);
  camera.updateMatrixWorld();
  return camera;
}

/** Un punto de la escena en la pantalla (px) con la curva del planeta del mapa. */
export function mapProject(
  camera: PerspectiveCamera,
  view: Pick<MapView, 'width' | 'height'>,
  x: number,
  y: number,
  z: number,
): { x: number; y: number } {
  const r = Math.hypot(x - camera.position.x, z - camera.position.z);
  const v = new Vector3(x, y - bendDrop(BEND_MAP, r), z).project(camera);
  return { x: (v.x * 0.5 + 0.5) * view.width, y: (-v.y * 0.5 + 0.5) * view.height };
}

/** La copia de `v` más cercana a `c` en un mundo que se repite cada `p`. */
export const wrapNear = (v: number, c: number, p: number) =>
  c + ((((v - c) % p) + p * 1.5) % p) - p / 2;

/** Las islas, cada una en la copia que se ve alrededor del centro de la carta. */
export function islandsAround(
  islands: readonly MapIsland[],
  center: { x: number; z: number },
  period: Period,
): MapIsland[] {
  return islands.map((i) => ({
    x: wrapNear(i.x, center.x, period.w),
    z: wrapNear(i.z, center.z, period.h),
    r: i.r,
  }));
}

/**
 * Las islas de un mundo (las de eventos y lugares, y la del náufrago) en la
 * escena, cada una en la copia de alrededor de `center`, con su radio.
 */
export function mapIslandsOf(
  objects: readonly WorldObject[],
  center: { x: number; z: number },
  period: Period,
): MapIsland[] {
  return islandsAround(
    objects
      .filter(
        (o) =>
          o.identity.active &&
          (o.identity.category === 'isla' || o.identity.category === 'naufrago'),
      )
      .map((o) => ({
        x: toScene(o.position.x),
        z: toScene(o.position.y),
        r: toScene(o.geometry.collision?.radius ?? o.geometry.activation?.radius ?? 12),
      })),
    center,
    period,
  );
}

/** Los puntos que tienen que verse de cada isla: sus cuatro bordes y la punta de su rótulo. */
function islandPoints(i: MapIsland): [number, number, number][] {
  return [
    [i.x, MAP_LABEL_Y, i.z],
    [i.x - i.r, 0, i.z],
    [i.x + i.r, 0, i.z],
    [i.x, 0, i.z - i.r],
    [i.x, 0, i.z + i.r],
  ];
}

/** Lo que ocupan las islas en pantalla (px) con la cámara a `dist` y la carta subida `liftPx`. */
export function mapExtent(
  dist: number,
  view: MapView,
  islands: readonly MapIsland[],
  liftPx = MAP_LIFT_PX,
): { left: number; right: number; top: number; bottom: number } {
  const camera = mapCamera(dist, view, liftPx);
  const out = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
  for (const i of islands)
    for (const [x, y, z] of islandPoints(i)) {
      const p = mapProject(camera, view, x, y, z);
      out.left = Math.min(out.left, p.x);
      out.right = Math.max(out.right, p.x);
      out.top = Math.min(out.top, p.y);
      out.bottom = Math.max(out.bottom, p.y);
    }
  return out;
}

/** ¿Caben todas (sus bordes y la punta de su rótulo) en la zona libre? */
export function mapFits(
  fit: MapFit,
  view: MapView,
  islands: readonly MapIsland[],
  safe: MapSafe = MAP_SAFE,
): boolean {
  const e = mapExtent(fit.dist, view, islands, fit.liftPx);
  const slack = 0.5;
  return (
    e.left >= safe.side - slack &&
    e.right <= view.width - safe.side + slack &&
    e.top >= safe.top - slack &&
    e.bottom <= view.height - safe.bottom + slack
  );
}

/**
 * Lo que sube la carta a distancia `dist` para que las islas queden dentro
 * por arriba y por abajo, lo más cerca posible de `MAP_LIFT_PX`; null si no
 * caben de alto (o de ancho) a esa distancia. Subir la carta un px la sube
 * casi un px en pantalla; se afina un par de veces.
 */
function liftFor(
  dist: number,
  view: MapView,
  islands: readonly MapIsland[],
  safe: MapSafe,
): number | null {
  let lift = MAP_LIFT_PX;
  for (let k = 0; k < 4; k++) {
    const e = mapExtent(dist, view, islands, lift);
    if (e.left < safe.side || e.right > view.width - safe.side) return null;
    const room = view.height - safe.bottom - safe.top - (e.bottom - e.top);
    if (room < 0) return null;
    // Cuánto bajar (+) o subir (−) la carta en pantalla para que quede dentro.
    const down =
      Math.max(0, safe.top - e.top) - Math.max(0, e.bottom - (view.height - safe.bottom));
    if (Math.abs(down) < 0.25) return lift;
    lift -= down;
  }
  return mapFits({ dist, liftPx: lift }, view, islands, safe) ? lift : null;
}

/**
 * Cómo va la cámara del mapa: a `base` (la distancia de siempre) si las
 * islas caben ahí, subiendo o bajando la carta lo justo; si no, la distancia
 * más corta con la que caben (hasta 3× `base`).
 */
export function mapFit(
  base: number,
  view: MapView,
  islands: readonly MapIsland[],
  safe: MapSafe = MAP_SAFE,
): MapFit {
  if (islands.length === 0) return { dist: base, liftPx: MAP_LIFT_PX };
  const at = liftFor(base, view, islands, safe);
  if (at !== null) return { dist: base, liftPx: at };
  let lo = base;
  let hi = base * 3;
  let best = liftFor(hi, view, islands, safe);
  if (best === null) return { dist: hi, liftPx: MAP_LIFT_PX };
  for (let k = 0; k < 24; k++) {
    const mid = (lo + hi) / 2;
    const l = liftFor(mid, view, islands, safe);
    if (l !== null) {
      hi = mid;
      best = l;
    } else lo = mid;
  }
  return { dist: hi, liftPx: best };
}
