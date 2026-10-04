import type { Rect, WorldConfig } from '@boia/world';
import type { CircleObstacle } from '../ship/controller';
import { solidObstaclesOf } from '../world/runtime';
import { wrapDelta, wrapInto } from '../world/wrap';
import { SpatialGrid } from './grid';

/**
 * El mar donde se juega: el periodo del planeta de `/mar` (que da la vuelta)
 * y las islas como círculos sólidos, los mismos con los que choca el barco.
 */
export interface SurvivorsWorld {
  /** El periodo del mar que da la vuelta (en `/mar`, `planetRect(bounds)`). */
  bounds: Rect;
  /** Islas y decorado sólido. */
  obstacles: readonly CircleObstacle[];
  /** Dónde está el barco al empezar (la partida empieza donde está). */
  start: { x: number; y: number; heading?: number };
}

/**
 * El mar de la partida a partir del mundo de `/mar`: las islas son los
 * obstáculos sólidos del runtime (`solidObstaclesOf`, la regla COLISIÓN de
 * cada objeto con `collisionRuleOf`), las mismas con las que choca el
 * barco, más los círculos sólidos propios de `/mar` (`extra`: el castillo,
 * la Explanada…).
 */
export function survivorsWorldOf(
  world: WorldConfig,
  period: Rect,
  start: SurvivorsWorld['start'],
  extra: readonly { x: number; y: number; radius: number }[] = [],
): SurvivorsWorld {
  return {
    bounds: period,
    obstacles: [...solidObstaclesOf(world), ...extra.map((c) => ({ ...c }))],
    start,
  };
}

/**
 * Las islas en una rejilla, para consultar sólo las cercanas. Como no se
 * mueven, cada celda guarda de antemano las islas que pasan a menos de
 * `reach` u de ella: una consulta de radio ≤ `reach` es leer una lista.
 */
export class IslandIndex {
  readonly grid: SpatialGrid;
  readonly maxRadius: number;
  /** Radio de consulta que las listas por celda cubren. */
  readonly reach: number;
  private readonly w: number;
  private readonly h: number;
  private readonly scratch: number[] = [];
  private readonly cells: (readonly number[])[];
  private static readonly EMPTY: readonly number[] = [];

  constructor(
    readonly bounds: Rect,
    readonly obstacles: readonly CircleObstacle[],
    cell: number,
    reach = 0,
  ) {
    this.w = bounds.right - bounds.left;
    this.h = bounds.bottom - bounds.top;
    this.reach = Math.max(0, reach);
    this.grid = new SpatialGrid(bounds, cell, obstacles.length);
    let max = 0;
    obstacles.forEach((o, i) => {
      this.grid.insert(i, o.x, o.y);
      if (o.radius > max) max = o.radius;
    });
    this.maxRadius = max;
    const g = this.grid;
    this.cells = Array.from({ length: g.cols * g.rows }, () => IslandIndex.EMPTY);
    obstacles.forEach((o, i) => {
      const r = o.radius + this.reach;
      const cx0 = Math.floor((o.x - r - bounds.left) / g.cellW);
      const cx1 = Math.floor((o.x + r - bounds.left) / g.cellW);
      const cy0 = Math.floor((o.y - r - bounds.top) / g.cellH);
      const cy1 = Math.floor((o.y + r - bounds.top) / g.cellH);
      const nx = Math.min(g.cols, cx1 - cx0 + 1);
      const ny = Math.min(g.rows, cy1 - cy0 + 1);
      for (let j = 0; j < ny; j++) {
        const row = (((cy0 + j) % g.rows) + g.rows) % g.rows;
        for (let k = 0; k < nx; k++) {
          const col = (((cx0 + k) % g.cols) + g.cols) % g.cols;
          const c = row * g.cols + col;
          let list = this.cells[c] as number[];
          if (list === IslandIndex.EMPTY) {
            list = [];
            this.cells[c] = list;
          }
          list.push(i);
        }
      }
    });
  }

  /**
   * Índices de las islas que pueden tocar el círculo (x, y, r). Con
   * r ≤ `reach`, la lista ya hecha de su celda (no modificarla); si no, una
   * consulta a la rejilla en `out`.
   */
  near(x: number, y: number, r: number, out: number[]): readonly number[] {
    if (r <= this.reach) {
      const g = this.grid;
      const col = Math.min(
        g.cols - 1,
        Math.floor((wrapInto(x, this.bounds.left, this.bounds.right) - this.bounds.left) / g.cellW),
      );
      const row = Math.min(
        g.rows - 1,
        Math.floor((wrapInto(y, this.bounds.top, this.bounds.bottom) - this.bounds.top) / g.cellH),
      );
      return this.cells[row * g.cols + col]!;
    }
    return this.grid.query(x, y, r + this.maxRadius, out);
  }

  /** ¿Cae el círculo (x, y, r) sobre alguna isla? (r = 0: ¿el punto es tierra?) */
  onLand(x: number, y: number, r = 0): boolean {
    const near = this.near(x, y, r, this.scratch);
    for (const i of near) {
      const o = this.obstacles[i]!;
      const dx = wrapDelta(x - o.x, this.w);
      const dy = wrapDelta(y - o.y, this.h);
      const min = o.radius + r;
      if (dx * dx + dy * dy < min * min) return true;
    }
    return false;
  }

  /**
   * Lleva el círculo (x, y, r) al agua: lo saca de cada isla que pisa por el
   * camino más corto (varias pasadas, por si al salir de una entra en otra).
   * Devuelve el punto o null si sigue en tierra.
   */
  toWater(x: number, y: number, r: number, margin = 2): { x: number; y: number } | null {
    let px = x;
    let py = y;
    for (let pass = 0; pass < 6; pass++) {
      let moved = false;
      const near = this.near(px, py, r + margin, this.scratch);
      for (const i of near) {
        const o = this.obstacles[i]!;
        const dx = wrapDelta(px - o.x, this.w);
        const dy = wrapDelta(py - o.y, this.h);
        const min = o.radius + r + margin;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2);
        const nx = d > 1e-6 ? dx / d : 0;
        const ny = d > 1e-6 ? dy / d : 1;
        px += nx * min - dx;
        py += ny * min - dy;
        moved = true;
      }
      if (!moved) return { x: px, y: py };
    }
    return this.onLand(px, py, r) ? null : { x: px, y: py };
  }
}
