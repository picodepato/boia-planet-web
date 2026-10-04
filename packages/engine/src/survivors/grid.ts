import { wrapInto } from '../world/wrap';

/**
 * Rejilla espacial de un mar que da la vuelta: cada cosa (enemigo, bala,
 * nota, isla) se guarda por su centro en una celda, y una consulta devuelve
 * los índices de las celdas que tocan un círculo, por el lado más corto. El
 * que consulta mide la distancia exacta (con `wrapDelta`) y el radio de lo
 * guardado va sumado al de la consulta.
 *
 * Las celdas reparten el periodo a partes iguales (el ancho de celda se
 * ajusta para que quepa un número entero), así el índice da la vuelta con
 * un simple módulo. Vaciarla sólo toca las celdas usadas: se puede
 * reconstruir en cada paso sin recorrer la rejilla entera.
 */
export class SpatialGrid {
  readonly cols: number;
  readonly rows: number;
  readonly cellW: number;
  readonly cellH: number;
  private readonly left: number;
  private readonly top: number;
  private readonly right: number;
  private readonly bottom: number;
  private readonly head: Int32Array;
  private next: Int32Array;
  private readonly used: Int32Array;
  private usedCount = 0;
  private size = 0;

  constructor(
    bounds: { left: number; right: number; top: number; bottom: number },
    cell: number,
    capacity = 256,
  ) {
    const w = bounds.right - bounds.left;
    const h = bounds.bottom - bounds.top;
    this.left = bounds.left;
    this.top = bounds.top;
    this.right = bounds.right;
    this.bottom = bounds.bottom;
    this.cols = Math.max(1, Math.floor(w / cell));
    this.rows = Math.max(1, Math.floor(h / cell));
    this.cellW = w / this.cols;
    this.cellH = h / this.rows;
    this.head = new Int32Array(this.cols * this.rows).fill(-1);
    this.used = new Int32Array(this.cols * this.rows);
    this.next = new Int32Array(Math.max(1, capacity));
  }

  /** Vacía la rejilla (sólo las celdas usadas). */
  clear(): void {
    for (let i = 0; i < this.usedCount; i++) this.head[this.used[i]!] = -1;
    this.usedCount = 0;
    this.size = 0;
  }

  private col(x: number): number {
    const c = Math.floor((wrapInto(x, this.left, this.right) - this.left) / this.cellW);
    return c >= this.cols ? this.cols - 1 : c;
  }

  private row(y: number): number {
    const r = Math.floor((wrapInto(y, this.top, this.bottom) - this.top) / this.cellH);
    return r >= this.rows ? this.rows - 1 : r;
  }

  /** Guarda el índice `index` (≥ 0) en la celda de (x, y). */
  insert(index: number, x: number, y: number): void {
    if (index >= this.next.length) {
      const grown = new Int32Array(Math.max(index + 1, this.next.length * 2));
      grown.set(this.next);
      this.next = grown;
    }
    const c = this.row(y) * this.cols + this.col(x);
    if (this.head[c] === -1) this.used[this.usedCount++] = c;
    this.next[index] = this.head[c]!;
    this.head[c] = index;
    this.size++;
  }

  /** Cuántas cosas hay guardadas. */
  get count(): number {
    return this.size;
  }

  /**
   * Deja en `out` (que vacía) los índices guardados en las celdas que toca el
   * círculo de centro (x, y) y radio `r`, cada uno una vez. Devuelve `out`.
   */
  query(x: number, y: number, r: number, out: number[]): number[] {
    out.length = 0;
    const cx0 = Math.floor((x - r - this.left) / this.cellW);
    const cx1 = Math.floor((x + r - this.left) / this.cellW);
    const cy0 = Math.floor((y - r - this.top) / this.cellH);
    const cy1 = Math.floor((y + r - this.top) / this.cellH);
    const nx = Math.min(this.cols, cx1 - cx0 + 1);
    const ny = Math.min(this.rows, cy1 - cy0 + 1);
    for (let j = 0; j < ny; j++) {
      const row = ((((cy0 + j) % this.rows) + this.rows) % this.rows) * this.cols;
      for (let i = 0; i < nx; i++) {
        const col = (((cx0 + i) % this.cols) + this.cols) % this.cols;
        for (let k = this.head[row + col]!; k !== -1; k = this.next[k]!) out.push(k);
      }
    }
    return out;
  }
}
