/**
 * Empaquetado de sprites en hojas de atlas (T47), sin E/S: estanterías por
 * alto decreciente. Lo usa `tools/atlas/build.ts`; está aquí para probarlo.
 */

export interface PackInput {
  w: number;
  h: number;
}

export interface Placement {
  /** Índice en la lista de entrada. */
  index: number;
  page: number;
  x: number;
  y: number;
}

export interface PackResult {
  placements: Placement[];
  /** Tamaño justo de cada hoja (múltiplo de 4). */
  pages: { w: number; h: number }[];
}

/** Lado máximo de una hoja: cabe en la GPU de cualquier móvil (≥ 2048). */
export const ATLAS_PAGE = 2048;
/** px transparentes entre sprites, para que el filtrado no mezcle vecinos. */
export const ATLAS_PADDING = 2;

const up4 = (n: number) => Math.ceil(n / 4) * 4;

/**
 * Coloca los rectángulos en hojas de `size` × `size` como mucho. Un sprite
 * mayor que la hoja no cabe: lanza (el atlas no debe recortar arte).
 */
export function packRects(
  items: readonly PackInput[],
  size = ATLAS_PAGE,
  padding = ATLAS_PADDING,
): PackResult {
  const order = items
    .map((it, index) => ({ ...it, index }))
    .sort((a, b) => b.h - a.h || b.w - a.w || a.index - b.index);
  const placements: Placement[] = [];
  const pages: { w: number; h: number }[] = [];
  let page = -1;
  let x = 0;
  let y = 0;
  let row = 0;
  const newPage = () => {
    page++;
    pages.push({ w: 0, h: 0 });
    x = 0;
    y = 0;
    row = 0;
  };
  for (const it of order) {
    const w = it.w + padding;
    const h = it.h + padding;
    if (it.w > size || it.h > size) {
      throw new Error(`sprite de ${it.w}×${it.h} mayor que la hoja de ${size}`);
    }
    if (page < 0) newPage();
    if (x + it.w > size) {
      // Siguiente estantería.
      y += row;
      x = 0;
      row = 0;
    }
    if (y + it.h > size) newPage();
    placements.push({ index: it.index, page, x, y });
    const p = pages[page]!;
    p.w = Math.max(p.w, up4(x + it.w));
    p.h = Math.max(p.h, up4(y + it.h));
    x += w;
    row = Math.max(row, h);
  }
  placements.sort((a, b) => a.index - b.index);
  return { placements, pages };
}
