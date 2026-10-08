/**
 * Dónde va cada pieza del collage de la Galería (plan 019 T216, decisión 8):
 * fotos y clips algo superpuestos, sin textos. Sin E/S ni DOM: el servidor
 * pinta el collage ya colocado (sin JavaScript también se ve) y el navegador
 * sólo añade los empujones tras cerrar una pieza.
 *
 * - `collageLayout`: rejilla de `cols` columnas cuadradas; cada pieza ocupa
 *   2–5 columnas según su forma y cae en el hueco más alto (horizonte), así
 *   no quedan agujeros grandes. Luego un desplazamiento y un giro pequeños,
 *   fijos por id, la sacan un poco de la rejilla y la montan sobre las
 *   vecinas: el «algo superpuestos» lo ponen esos desplazamientos.
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
  /** Desplazamiento fijo, en % de su propio tamaño, y giro en grados. */
  dx: number;
  dy: number;
  rotate: number;
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

/** Cuántas columnas ocupa una pieza: las apaisadas más, las altas menos; algo de azar fijo. */
const SPANS = [
  [4, 5],
  [3, 4],
  [2, 3],
] as const;

function spanFor(item: CollageItem, cols: number): number {
  const aspect = item.width / item.height;
  const r = seeded(item.id, cols);
  // Columnas por forma (apaisada, cuadrada, alta), cada una con dos tallas al azar fijo.
  const [a, b] = SPANS[aspect >= 1.2 ? 0 : aspect <= 0.85 ? 2 : 1]!;
  return Math.max(1, Math.min(cols, r < 0.5 ? a! : b!));
}

/**
 * Colocación en horizonte: cada pieza va al tramo de columnas donde deja
 * menos hueco debajo (luego, el más bajo; luego, el de la izquierda). Puede
 * ocupar una columna más o menos de la que pide su forma si así encaja mejor.
 */
export function packCollage(items: readonly CollageItem[], cols: number): CollageCell[] {
  const heights = new Array<number>(cols).fill(0);
  return items.map((item) => {
    const wanted = spanFor(item, cols);
    let best: { score: number; col: number; top: number; colSpan: number; rowSpan: number } | null =
      null;
    for (const colSpan of [wanted, wanted - 1, wanted + 1]) {
      if (colSpan < Math.min(2, cols) || colSpan > cols) continue;
      const rowSpan = Math.max(1, Math.round((colSpan * item.height) / item.width));
      for (let c = 0; c + colSpan <= cols; c++) {
        const span = heights.slice(c, c + colSpan);
        const top = Math.max(...span);
        const waste = span.reduce((sum, h) => sum + top - h, 0);
        // El hueco pesa más que la altura; cambiar de tamaño, un poco.
        const score = waste * 4 + top * 2 + (colSpan === wanted ? 0 : 3);
        if (!best || score < best.score) best = { score, col: c, top, colSpan, rowSpan };
      }
    }
    const b = best!;
    for (let c = b.col; c < b.col + b.colSpan; c++) heights[c] = b.top + b.rowSpan;
    return { col: b.col + 1, row: b.top + 1, colSpan: b.colSpan, rowSpan: b.rowSpan };
  });
}

/** Cuántas filas ocupa la rejilla entera. */
export function collageRows(cells: readonly CollageCell[]): number {
  return cells.reduce((m, c) => Math.max(m, c.row + c.rowSpan - 1), 0);
}

export function collageLayout(items: readonly CollageItem[]): CollagePiece[] {
  const narrow = packCollage(items, COLLAGE_COLS.narrow);
  const wide = packCollage(items, COLLAGE_COLS.wide);
  return items.map((item, i) => ({
    id: item.id,
    narrow: narrow[i]!,
    wide: wide[i]!,
    // Hasta un 9 % fuera de su sitio y 3,5° de giro: se montan sin taparse del todo.
    dx: round((seeded(item.id, 1) - 0.5) * 18),
    dy: round((seeded(item.id, 2) - 0.5) * 18),
    rotate: round((seeded(item.id, 3) - 0.5) * 7),
    z: 1 + Math.floor(seeded(item.id, 4) * items.length),
  }));
}

const round = (n: number) => Math.round(n * 10) / 10;

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
    if (!touches) continue;
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
