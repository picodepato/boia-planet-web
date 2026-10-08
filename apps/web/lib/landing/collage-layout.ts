/**
 * Dónde va cada pieza del collage de la Galería (plan 019 T216, decisión 8):
 * fotos y clips algo superpuestos, sin textos. Sin E/S ni DOM: el servidor
 * pinta el collage ya colocado (sin JavaScript también se ve) y el navegador
 * sólo añade los empujones tras cerrar una pieza.
 *
 * - `collageLayout`: rejilla de `cols` columnas cuadradas; cada pieza tiene
 *   una talla (grande, mediana, pequeña; plan 020 T234: tamaños claramente
 *   distintos) que, con su forma, dice cuántas columnas ocupa, y cae en el
 *   hueco más alto (horizonte). Luego un desplazamiento, un giro y una
 *   escala, fijos por id, la sacan de la rejilla y la montan sobre las
 *   vecinas; las pequeñas, más, y encima de las grandes.
 * - `dragOffset` / `isDrag`: arrastrar una pieza la aparta (y deja ver la de
 *   debajo) sin sacarla del collage; un toque sin arrastre la abre.
 * - `nudgeAfterClose`: al cerrar una pieza, las que la tocan se apartan un
 *   poco de ella y la pieza baja al fondo, para que se vean otras fotos.
 */

export interface CollageItem {
  id: string;
  width: number;
  height: number;
}

export interface CollageCell {
  /** Columna y fila de inicio (1…), y cuántas ocupa. */
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

export interface CollagePiece {
  id: string;
  /** La rejilla estrecha (móvil) y la ancha (escritorio). */
  narrow: CollageCell;
  wide: CollageCell;
  size: CollageSize;
  /** Desplazamiento fijo, en % de su propio tamaño, giro en grados y escala. */
  dx: number;
  dy: number;
  rotate: number;
  scale: number;
  /** Orden de apilado inicial. */
  z: number;
}

/** Columnas de cada rejilla (las mismas que usa collage.css). */
export const COLLAGE_COLS = { narrow: 6, wide: 12 } as const;

/** Un número de 0 a 1, fijo para cada texto (FNV-1a). */
export function seeded(text: string, salt = 0): number {
  let h = 0x811c9dc5 ^ salt;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 0x100000000;
}

/** La talla de cada pieza: la que dice cuánto ocupa y cuánto se sale de su sitio. */
export type CollageSize = 'big' | 'mid' | 'small';

/**
 * Tallas en orden: así cualquier selección corta (la de la home, 4–6 fotos)
 * ya mezcla una grande, medianas y pequeñas. Fija por posición.
 */
const SIZE_CYCLE: readonly CollageSize[] = [
  'big',
  'small',
  'mid',
  'small',
  'mid',
  'big',
  'small',
  'small',
  'mid',
];

export function sizeAt(index: number): CollageSize {
  return SIZE_CYCLE[index % SIZE_CYCLE.length]!;
}

/** Columnas por talla y forma (apaisada, cuadrada, alta), en cada rejilla. */
const SPANS: Record<number, Record<CollageSize, readonly [number, number, number]>> = {
  6: { big: [6, 4, 4], mid: [4, 3, 3], small: [3, 2, 2] },
  12: { big: [7, 6, 4], mid: [5, 4, 3], small: [3, 3, 2] },
};

function spanFor(item: CollageItem, size: CollageSize, cols: number): number {
  const aspect = item.width / item.height;
  const shape = aspect >= 1.2 ? 0 : aspect <= 0.85 ? 2 : 1;
  const table = SPANS[cols];
  // Otra rejilla (sólo en pruebas): la mitad, un tercio o un quinto de las columnas.
  const span = table
    ? table[size][shape]
    : Math.round(cols * (size === 'big' ? 0.5 : size === 'mid' ? 0.33 : 0.2));
  return Math.max(1, Math.min(cols, span));
}

/** Cuántas filas puede montarse cada talla sobre lo que tiene encima (solape de verdad). */
export const SIZE_LIFT: Record<CollageSize, number> = { big: 0, mid: 1, small: 1 };

/**
 * Colocación en horizonte: cada pieza va al tramo de columnas donde deja
 * menos hueco debajo (luego, el más bajo; luego, una a la izquierda y otra
 * a la derecha). Puede
 * ocupar una columna más o menos de la que pide su talla si así encaja
 * mejor (una pequeña, nunca menos de 2; una grande, nunca más). Las
 * medianas y las pequeñas suben `SIZE_LIFT` filas sobre la pieza de encima:
 * en la rejilla se pisan de verdad (las áreas de CSS grid pueden cruzarse),
 * y así tapan los huecos que deja el horizonte. Entre las `PACK_LOOKAHEAD`
 * siguientes va primero la que mejor encaja (el orden de un collage no importa
 * mucho), saltándose cada pieza una vez como mucho.
 */
/** Entre cuántas piezas siguientes se elige la que mejor tapa el hueco más bajo. */
export const PACK_LOOKAHEAD = 3;

interface Placement {
  score: number;
  col: number;
  top: number;
  colSpan: number;
  rowSpan: number;
}

/** El mejor sitio para la pieza `i` sobre el horizonte `heights`. */
function placeFor(item: CollageItem, i: number, heights: readonly number[]): Placement {
  const cols = heights.length;
  const size = sizeAt(i);
  const wanted = spanFor(item, size, cols);
  // Cada talla, en su franja: una mediana nunca baja a pequeña ni una grande a mediana.
  const least = Math.min(wanted, size === 'big' ? cols - 2 : size === 'mid' ? 3 : 2);
  const spans = [wanted, wanted - 1, wanted + 1].filter(
    (n) => n >= least && (size !== 'big' || n <= wanted),
  );
  let best: Placement | null = null;
  for (const colSpan of spans) {
    if (colSpan < Math.min(2, cols) || colSpan > cols) continue;
    const rowSpan = Math.max(1, Math.round((colSpan * item.height) / item.width));
    // A igualdad, una pieza a la izquierda y la siguiente a la derecha: no se amontonan en un lado.
    const starts = Array.from({ length: cols - colSpan + 1 }, (_, k) => k);
    if (i % 2 === 1) starts.reverse();
    for (const c of starts) {
      const span = heights.slice(c, c + colSpan);
      const high = Math.max(...span);
      const low = Math.min(...span);
      // Sube sobre la de encima, pero sin dejar su hueco más arriba de lo que había.
      const top = Math.max(0, Math.max(low, high - SIZE_LIFT[size]));
      const waste = span.reduce((sum, h) => sum + Math.max(0, top - h), 0);
      // No dejar al lado una tira de una sola columna: ninguna pieza cabe ahí (mínimo 2).
      const strip = (from: number, step: number) => {
        let n = 0;
        for (let k = from; k >= 0 && k < cols && heights[k]! <= top; k += step) n++;
        return n;
      };
      const slivers = (strip(c - 1, -1) === 1 ? 1 : 0) + (strip(c + colSpan, 1) === 1 ? 1 : 0);
      // El hueco pesa más que la altura; cambiar de tamaño, un poco.
      const score = waste * 4 + top * 2 + slivers * 5 + (colSpan === wanted ? 0 : 3);
      if (!best || score < best.score) best = { score, col: c, top, colSpan, rowSpan };
    }
  }
  return best!;
}

export function packCollage(items: readonly CollageItem[], cols: number): CollageCell[] {
  const heights = new Array<number>(cols).fill(0);
  const cells: CollageCell[] = new Array(items.length);
  const pending = items.map((_, i) => i);
  const skipped = new Set<number>();
  while (pending.length > 0) {
    // De las siguientes, la que mejor encaja ahora (a igualdad, la que va antes).
    // Una pieza se salta una vez como mucho: las grandes no se van todas al final.
    let pick = 0;
    let best = placeFor(items[pending[0]!]!, pending[0]!, heights);
    const look = skipped.has(pending[0]!) ? 1 : Math.min(PACK_LOOKAHEAD, pending.length);
    for (let k = 1; k < look; k++) {
      const p = placeFor(items[pending[k]!]!, pending[k]!, heights);
      if (p.score < best.score) {
        best = p;
        pick = k;
      }
    }
    if (pick > 0) skipped.add(pending[0]!);
    const [i] = pending.splice(pick, 1);
    for (let c = best.col; c < best.col + best.colSpan; c++) heights[c] = best.top + best.rowSpan;
    cells[i!] = { col: best.col + 1, row: best.top + 1, colSpan: best.colSpan, rowSpan: best.rowSpan };
  }
  return cells;
}

/** Cuántas filas ocupa la rejilla entera. */
export function collageRows(cells: readonly CollageCell[]): number {
  return cells.reduce((m, c) => Math.max(m, c.row + c.rowSpan - 1), 0);
}

/** Cuánto se sale cada talla de su sitio (% de su tamaño), cuánto gira y crece. */
export const SIZE_LOOSE: Record<CollageSize, { shift: number; tilt: number; scale: number }> = {
  big: { shift: 6, tilt: 2.5, scale: 1.04 },
  mid: { shift: 14, tilt: 4, scale: 1.12 },
  small: { shift: 22, tilt: 6, scale: 1.2 },
};

export function collageLayout(items: readonly CollageItem[]): CollagePiece[] {
  const narrow = packCollage(items, COLLAGE_COLS.narrow);
  const wide = packCollage(items, COLLAGE_COLS.wide);
  const n = items.length;
  return items.map((item, i) => {
    const size = sizeAt(i);
    const loose = SIZE_LOOSE[size];
    // Las pequeñas encima de las medianas, y éstas de las grandes: se montan como en un collage.
    const layer = size === 'big' ? 0 : size === 'mid' ? 1 : 2;
    return {
      id: item.id,
      narrow: narrow[i]!,
      wide: wide[i]!,
      size,
      // En el borde del collage (en cualquiera de las dos rejillas) sólo se sale hacia dentro:
      // no tapa el título de encima ni se va de la pantalla.
      dx: inward(
        round((seeded(item.id, 1) - 0.5) * 2 * loose.shift),
        narrow[i]!.col === 1 || wide[i]!.col === 1,
        edgeRight(narrow[i]!, COLLAGE_COLS.narrow) || edgeRight(wide[i]!, COLLAGE_COLS.wide),
      ),
      dy: inward(
        round((seeded(item.id, 2) - 0.5) * 2 * loose.shift),
        narrow[i]!.row === 1 || wide[i]!.row === 1,
        false,
      ),
      rotate: round((seeded(item.id, 3) - 0.5) * 2 * loose.tilt),
      scale: loose.scale,
      z: 1 + layer * n + Math.floor(seeded(item.id, 4) * n),
    };
  });
}

const round = (n: number) => Math.round(n * 10) / 10;

const edgeRight = (c: CollageCell, cols: number) => c.col + c.colSpan - 1 === cols;

/** Un desplazamiento que no sale por el borde de arriba/izquierda (`low`) ni por el de abajo/derecha (`high`). */
function inward(d: number, low: boolean, high: boolean): number {
  if (low && high) return 0;
  if (low) return Math.abs(d);
  if (high) return -Math.abs(d);
  return d;
}

/** Un rectángulo en pantalla (el de `getBoundingClientRect`). */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Lo que el navegador añade a cada pieza: empujón en px y orden de apilado. */
export interface Nudge {
  x: number;
  y: number;
  /** La movió la mano (arrastre): los empujones ya no la tocan. */
  dragged?: boolean;
  /** Orden de apilado que sustituye al inicial (sólo la que se cerró lo cambia). */
  z?: number;
}

/** Hasta dónde puede acabar una pieza de su sitio tras muchos empujones (px). */
export const NUDGE_MAX = 28;
/** Cuánto se aparta cada vecina en cada cierre (px). */
export const NUDGE_STEP = 10;

/**
 * Tras cerrar `closedId`: cada pieza que se monta sobre ella (o casi, a
 * `reach` px) se aparta `NUDGE_STEP` px en la dirección que une los centros,
 * sin pasar de `NUDGE_MAX` desde su sitio; la cerrada baja al fondo (por
 * debajo de todas) y las demás conservan su orden. Devuelve el estado nuevo, sin tocar el viejo.
 */
export function nudgeAfterClose(
  closedId: string,
  boxes: ReadonlyMap<string, Box>,
  current: ReadonlyMap<string, Nudge>,
  baseZ: ReadonlyMap<string, number>,
  reach = 16,
): Map<string, Nudge> {
  const next = new Map(current);
  const closed = boxes.get(closedId);
  if (!closed) return next;
  const cx = closed.left + closed.width / 2;
  const cy = closed.top + closed.height / 2;
  const zOf = (id: string) => current.get(id)?.z ?? baseZ.get(id) ?? 0;
  const minZ = Math.min(...[...boxes.keys()].map(zOf));
  for (const [id, box] of boxes) {
    const was = current.get(id) ?? { x: 0, y: 0 };
    if (id === closedId) {
      next.set(id, { ...was, z: minZ - 1 });
      continue;
    }
    const touches =
      box.left < closed.left + closed.width + reach &&
      box.left + box.width > closed.left - reach &&
      box.top < closed.top + closed.height + reach &&
      box.top + box.height > closed.top - reach;
    if (!touches || was.dragged) continue;
    let vx = box.left + box.width / 2 - cx;
    let vy = box.top + box.height / 2 - cy;
    const len = Math.hypot(vx, vy);
    if (len < 0.5) {
      // Centros iguales: hacia abajo a la derecha, siempre igual.
      vx = 1;
      vy = 1;
    }
    const k = NUDGE_STEP / (Math.hypot(vx, vy) || 1);
    next.set(id, {
      x: clamp(was.x + vx * k, NUDGE_MAX),
      y: clamp(was.y + vy * k, NUDGE_MAX),
      ...(was.z === undefined ? {} : { z: was.z }),
    });
  }
  return next;
}

const clamp = (n: number, max: number) => Math.round(Math.max(-max, Math.min(max, n)) * 10) / 10;

/** Cuántos px hay que mover el dedo o el ratón para que sea arrastre y no toque. */
export const DRAG_THRESHOLD = 6;

/** ¿Es arrastre? (si no, al soltar es un toque y abre la pieza). */
export function isDrag(dx: number, dy: number, threshold = DRAG_THRESHOLD): boolean {
  return Math.hypot(dx, dy) >= threshold;
}

/**
 * Dónde queda una pieza arrastrada: su empujón al empezar (`start`) más lo
 * que se movió el puntero (`delta`), sin que la pieza (`piece`, su caja en
 * pantalla al empezar) salga de `bounds` (la caja del collage). Si ya
 * estaba fuera por un lado, no se la obliga a volver, sólo a no salir más.
 */
export function dragOffset(
  start: { x: number; y: number },
  delta: { x: number; y: number },
  piece: Box,
  bounds: Box,
): { x: number; y: number } {
  // lo ≤ 0 ≤ hi salvo si ya estaba fuera: entonces el límite es quedarse donde está.
  const axis = (d: number, lo: number, hi: number) =>
    Math.max(Math.min(0, lo), Math.min(Math.max(0, hi), d));
  const dx = axis(
    delta.x,
    bounds.left - piece.left,
    bounds.left + bounds.width - (piece.left + piece.width),
  );
  const dy = axis(
    delta.y,
    bounds.top - piece.top,
    bounds.top + bounds.height - (piece.top + piece.height),
  );
  return { x: Math.round(start.x + dx), y: Math.round(start.y + dy) };
}
