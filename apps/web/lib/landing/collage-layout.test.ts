import { describe, expect, it } from 'vitest';
import {
  type Box,
  COLLAGE_COLS,
  DRAG_THRESHOLD,
  NUDGE_MAX,
  NUDGE_STEP,
  SIZE_LIFT,
  SIZE_LOOSE,
  collageLayout,
  collageRows,
  dragOffset,
  isDrag,
  nudgeAfterClose,
  packCollage,
  sizeAt,
} from './collage-layout';

const items = Array.from({ length: 14 }, (_, i) => ({
  id: `pieza-${i}`,
  width: [4, 3, 16, 9, 1][i % 5]!,
  height: [3, 4, 9, 16, 1][i % 5]!,
}));

/** Celdas que ocupa cada pieza en la rejilla. */
function cellsOf(c: { col: number; row: number; colSpan: number; rowSpan: number }) {
  const out: string[] = [];
  for (let x = c.col; x < c.col + c.colSpan; x++)
    for (let y = c.row; y < c.row + c.rowSpan; y++) out.push(`${x}:${y}`);
  return out;
}

describe('collage de la Galería: colocación (T216)', () => {
  for (const cols of Object.values(COLLAGE_COLS)) {
    it(`en ${cols} columnas, cada pieza cabe; sólo se pisan medianas y pequeñas, como mucho SIZE_LIFT filas`, () => {
      const cells = packCollage(items, cols);
      expect(cells).toHaveLength(items.length);
      const owner = new Map<string, number>();
      cells.forEach((c, i) => {
        expect(c.col).toBeGreaterThanOrEqual(1);
        expect(c.col + c.colSpan - 1).toBeLessThanOrEqual(cols);
        for (const k of cellsOf(c)) owner.set(k, i);
      });
      // Cada solape: la fila de arriba de una mediana o pequeña sobre el pie de otra.
      cells.forEach((a, i) =>
        cells.forEach((b, j) => {
          if (i >= j) return;
          const shared = cellsOf(a).filter((k) => cellsOf(b).includes(k));
          if (shared.length === 0) return;
          const rows = shared.map((k) => Number(k.split(':')[1]));
          const [upper, lower, li] = a.row < b.row ? [a, b, j] : [b, a, i];
          expect(sizeAt(li), `${i}/${j}`).not.toBe('big');
          for (const y of rows) {
            expect(y - lower.row).toBeLessThan(SIZE_LIFT[sizeAt(li)]);
            expect(y).toBeLessThanOrEqual(upper.row + upper.rowSpan - 1);
          }
        }),
      );
      // Horizonte: la rejilla queda bastante llena (lo que falta lo tapan los desplazamientos).
      expect(owner.size / (cols * collageRows(cells))).toBeGreaterThan(0.65);
    });
  }

  it('respeta la forma: una apaisada es más ancha que alta y una alta, al revés', () => {
    const [wide, tall] = packCollage(
      [
        { id: 'a', width: 16, height: 9 },
        { id: 'b', width: 9, height: 16 },
      ],
      COLLAGE_COLS.wide,
    );
    expect(wide!.colSpan).toBeGreaterThan(wide!.rowSpan);
    expect(tall!.rowSpan).toBeGreaterThan(tall!.colSpan);
  });

  it('es fija: el mismo contenido da el mismo collage (servidor y navegador iguales)', () => {
    expect(collageLayout(items)).toEqual(collageLayout(items.map((i) => ({ ...i }))));
    for (const p of collageLayout(items)) {
      const loose = SIZE_LOOSE[p.size];
      expect(Math.abs(p.dx)).toBeLessThanOrEqual(loose.shift);
      expect(Math.abs(p.dy)).toBeLessThanOrEqual(loose.shift);
      expect(Math.abs(p.rotate)).toBeLessThanOrEqual(loose.tilt);
      expect(p.scale).toBe(loose.scale);
    }
    // Algunas se mueven de verdad (si no, no se superpondrían).
    expect(collageLayout(items).some((p) => Math.abs(p.dx) > 2 || Math.abs(p.dy) > 2)).toBe(true);
  });
});

describe('collage: tamaños claramente distintos y superpuestos (T234)', () => {
  const area = (c: { colSpan: number; rowSpan: number }) => c.colSpan * c.rowSpan;

  for (const n of [4, 5, 6, items.length]) {
    it(`con ${n} piezas (la home, la ficha del mundo, la Galería) hay grandes y pequeñas`, () => {
      const layout = collageLayout(items.slice(0, n));
      const sizes = new Set(layout.map((p) => p.size));
      expect(sizes.has('big')).toBe(true);
      expect(sizes.has('small')).toBe(true);
      for (const grid of ['narrow', 'wide'] as const) {
        const areas = layout.map((p) => area(p[grid]));
        // La mayor ocupa al menos el triple que la menor: se nota a simple vista.
        expect(Math.max(...areas)).toBeGreaterThanOrEqual(3 * Math.min(...areas));
      }
    });
  }

  it('a igual forma, una grande ocupa más columnas que una mediana, y ésta que una pequeña', () => {
    const square = Array.from({ length: 9 }, (_, i) => ({ id: `c-${i}`, width: 1, height: 1 }));
    for (const cols of Object.values(COLLAGE_COLS)) {
      const cells = packCollage(square, cols);
      const span = (size: string) =>
        Math.max(...cells.filter((_, i) => sizeAt(i) === size).map((c) => c.colSpan));
      expect(span('big')).toBeGreaterThan(span('mid'));
      expect(span('mid')).toBeGreaterThanOrEqual(span('small'));
    }
  });

  it('las pequeñas se salen más de su sitio y quedan encima de las grandes', () => {
    expect(SIZE_LOOSE.small.shift).toBeGreaterThan(SIZE_LOOSE.big.shift);
    expect(SIZE_LOOSE.small.scale).toBeGreaterThan(1);
    const layout = collageLayout(items);
    const zs = (size: string) => layout.filter((p) => p.size === size).map((p) => p.z);
    expect(Math.min(...zs('small'))).toBeGreaterThan(Math.max(...zs('big')));
    expect(Math.min(...zs('mid'))).toBeGreaterThan(Math.max(...zs('big')));
  });

  it('en el borde sólo se sale hacia dentro: no tapa el título ni se va de la pantalla', () => {
    for (const n of [4, 5, items.length]) {
      for (const p of collageLayout(items.slice(0, n))) {
        if (p.narrow.row === 1 || p.wide.row === 1) expect(p.dy, p.id).toBeGreaterThanOrEqual(0);
        if (p.narrow.col === 1 || p.wide.col === 1) expect(p.dx, p.id).toBeGreaterThanOrEqual(0);
        const right =
          p.narrow.col + p.narrow.colSpan - 1 === COLLAGE_COLS.narrow ||
          p.wide.col + p.wide.colSpan - 1 === COLLAGE_COLS.wide;
        if (right && !(p.narrow.col === 1 || p.wide.col === 1))
          expect(p.dx, p.id).toBeLessThanOrEqual(0);
      }
    }
  });
});

describe('collage: arrastrar una pieza (T234)', () => {
  const bounds: Box = { left: 0, top: 0, width: 400, height: 600 };
  const piece: Box = { left: 100, top: 100, width: 100, height: 100 };

  it('un movimiento corto es un toque (abre); a partir del umbral, arrastre', () => {
    expect(isDrag(0, 0)).toBe(false);
    expect(isDrag(DRAG_THRESHOLD - 1, 0)).toBe(false);
    expect(isDrag(DRAG_THRESHOLD, 0)).toBe(true);
    expect(isDrag(-4, -5)).toBe(true);
  });

  it('sigue al puntero desde donde estaba', () => {
    expect(dragOffset({ x: 0, y: 0 }, { x: 40, y: -30 }, piece, bounds)).toEqual({ x: 40, y: -30 });
    expect(dragOffset({ x: 10, y: 5 }, { x: 40, y: 30 }, piece, bounds)).toEqual({ x: 50, y: 35 });
  });

  it('no sale del collage por ningún lado', () => {
    expect(dragOffset({ x: 0, y: 0 }, { x: 999, y: 999 }, piece, bounds)).toEqual({
      x: 200,
      y: 400,
    });
    expect(dragOffset({ x: 0, y: 0 }, { x: -999, y: -999 }, piece, bounds)).toEqual({
      x: -100,
      y: -100,
    });
  });

  it('si ya asomaba por un lado, no salta dentro: sólo no sale más', () => {
    const out: Box = { left: -10, top: 100, width: 100, height: 100 };
    expect(dragOffset({ x: 0, y: 0 }, { x: -50, y: 0 }, out, bounds)).toEqual({ x: 0, y: 0 });
    expect(dragOffset({ x: 0, y: 0 }, { x: 30, y: 0 }, out, bounds)).toEqual({ x: 30, y: 0 });
  });

  it('una pieza arrastrada ya no la mueven los empujones al cerrar otra', () => {
    const boxes = new Map<string, Box>([
      ['cerrada', { left: 100, top: 100, width: 100, height: 100 }],
      ['movida', { left: 190, top: 100, width: 100, height: 100 }],
    ]);
    const moved = new Map([['movida', { x: 120, y: 0, z: 9, dragged: true }]]);
    const next = nudgeAfterClose('cerrada', boxes, moved, new Map());
    expect(next.get('movida')).toEqual({ x: 120, y: 0, z: 9, dragged: true });
  });
});

describe('collage de la Galería: empujón al cerrar (T216)', () => {
  const box = (left: number, top: number, size = 100): Box => ({
    left,
    top,
    width: size,
    height: size,
  });
  const boxes = new Map<string, Box>([
    ['cerrada', box(100, 100)],
    ['derecha', box(190, 100)],
    ['abajo', box(100, 195)],
    ['lejos', box(600, 600)],
  ]);
  const baseZ = new Map([
    ['cerrada', 3],
    ['derecha', 1],
    ['abajo', 2],
    ['lejos', 4],
  ]);

  it('las vecinas se apartan de la cerrada; las lejanas no se mueven; la cerrada baja al fondo', () => {
    const next = nudgeAfterClose('cerrada', boxes, new Map(), baseZ);
    expect(next.get('derecha')!.x).toBeCloseTo(NUDGE_STEP, 0);
    expect(Math.abs(next.get('derecha')!.y)).toBeLessThan(1);
    expect(next.get('abajo')!.y).toBeCloseTo(NUDGE_STEP, 0);
    expect(next.has('lejos')).toBe(false);
    expect(next.get('cerrada')!.z).toBeLessThan(Math.min(...baseZ.values()));
    expect(next.get('cerrada')!.x).toBe(0);
  });

  it('muchos cierres no las sacan más de NUDGE_MAX de su sitio', () => {
    let state = new Map();
    for (let i = 0; i < 20; i++) state = nudgeAfterClose('cerrada', boxes, state, baseZ);
    expect(state.get('derecha').x).toBe(NUDGE_MAX);
    expect(state.get('abajo').y).toBe(NUDGE_MAX);
  });

  it('no cambia el estado que recibe', () => {
    const before = new Map([['derecha', { x: 1, y: 2 }]]);
    nudgeAfterClose('cerrada', boxes, before, baseZ);
    expect(before.get('derecha')).toEqual({ x: 1, y: 2 });
  });
});
