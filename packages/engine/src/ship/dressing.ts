import type { Vec2 } from '@boia/world';
import type { LoadedShipManifest } from '../manifest-loader';

/**
 * Cosméticos que se pintan sobre el barco (T40, REQ-IDE-030/031): una bandera
 * en el tope del mástil y el color de la estela. Sólo cambian cómo se ve: la
 * física del barco (velocidad, drift, colisiones, radio) no los lee nunca
 * (REQ-IDE-032). Sin Pixi: la vista 3D usa los mismos datos.
 */

export type FlagPattern = 'solid' | 'stripes' | 'checker';

export interface FlagLook {
  /** Color principal y secundario (borde, franja o cuadro), 0xRRGGBB. */
  colors: readonly [number, number];
  pattern: FlagPattern;
}

export interface ShipDressing {
  flag: FlagLook | null;
  /** Tinte de la espuma de la estela; null, blanca. */
  wakeTint: number | null;
}

export const NO_DRESSING: ShipDressing = { flag: null, wakeTint: null };

/** El manifiesto del barco con sus cosméticos: lo que recibe `Game.setShip`. */
export type DressedShip = LoadedShipManifest & { dressing?: ShipDressing | null };

/** Tamaño de la bandera en px de la imagen del barco (256 px). muestra */
export const FLAG_SIZE = { w: 30, h: 20 } as const;

/**
 * Las cuatro esquinas de la bandera, en px de pantalla relativos al pivote:
 * cuelga del tope del mástil y ondea hacia popa (de la roda a la estela). Una
 * vista de frente o de espaldas la enseña casi de canto, pero nunca menos de
 * la mitad de ancho, para que se lea.
 */
export function flagQuad(mast: Vec2, toStern: Vec2, scale: number): [Vec2, Vec2, Vec2, Vec2] {
  const len = Math.hypot(toStern.x, toStern.y) || 1;
  let dx = toStern.x / len;
  const dy = (toStern.y / len) * 0.35;
  if (Math.abs(dx) < 0.5) dx = dx < 0 ? -0.5 : 0.5;
  const w = FLAG_SIZE.w * scale;
  const h = FLAG_SIZE.h * scale;
  const tip = { x: mast.x + dx * w, y: mast.y + dy * w };
  return [{ x: mast.x, y: mast.y }, tip, { x: tip.x, y: tip.y + h }, { x: mast.x, y: mast.y + h }];
}

/** Punto de la bandera en (u, v) ∈ [0, 1]²: u a lo largo (del mástil a la punta), v hacia abajo. */
export function flagPoint(q: readonly [Vec2, Vec2, Vec2, Vec2], u: number, v: number): Vec2 {
  const top = { x: q[0].x + (q[1].x - q[0].x) * u, y: q[0].y + (q[1].y - q[0].y) * u };
  const bottom = { x: q[3].x + (q[2].x - q[3].x) * u, y: q[3].y + (q[2].y - q[3].y) * u };
  return { x: top.x + (bottom.x - top.x) * v, y: top.y + (bottom.y - top.y) * v };
}

/**
 * Las piezas de color de la bandera: cada una, un cuadrilátero y su color.
 * `solid`: un paño; `stripes`: dos franjas; `checker`: 3 × 2 cuadros.
 */
export function flagPieces(
  q: readonly [Vec2, Vec2, Vec2, Vec2],
  look: FlagLook,
): { points: Vec2[]; color: number }[] {
  const cell = (u0: number, u1: number, v0: number, v1: number, color: number) => ({
    points: [
      flagPoint(q, u0, v0),
      flagPoint(q, u1, v0),
      flagPoint(q, u1, v1),
      flagPoint(q, u0, v1),
    ],
    color,
  });
  const [a, b] = look.colors;
  if (look.pattern === 'stripes') return [cell(0, 1, 0, 0.5, a), cell(0, 1, 0.5, 1, b)];
  if (look.pattern === 'checker') {
    const out = [];
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 2; j++)
        out.push(cell(i / 3, (i + 1) / 3, j / 2, (j + 1) / 2, (i + j) % 2 ? b : a));
    return out;
  }
  return [cell(0, 1, 0, 1, a)];
}
