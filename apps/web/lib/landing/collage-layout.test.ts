import { describe, expect, it } from 'vitest';
import {
  type Box,
  COLLAGE_COLS,
  NUDGE_MAX,
  NUDGE_STEP,
  collageLayout,
  collageRows,
  nudgeAfterClose,
  packCollage,
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
    it(`en ${cols} columnas, cada pieza cabe y ninguna pisa la rejilla de otra`, () => {
      const cells = packCollage(items, cols);
      expect(cells).toHaveLength(items.length);
      const seen = new Set<string>();
      for (const c of cells) {
        expect(c.col).toBeGreaterThanOrEqual(1);
        expect(c.col + c.colSpan - 1).toBeLessThanOrEqual(cols);
        for (const k of cellsOf(c)) {
          expect(seen.has(k), k).toBe(false);
          seen.add(k);
        }
      }
      // Horizonte: la rejilla queda casi llena (pocos huecos).
      expect(seen.size / (cols * collageRows(cells))).toBeGreaterThan(0.7);
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
      expect(Math.abs(p.dx)).toBeLessThanOrEqual(9);
      expect(Math.abs(p.dy)).toBeLessThanOrEqual(9);
      expect(Math.abs(p.rotate)).toBeLessThanOrEqual(3.5);
    }
    // Algunas se mueven de verdad (si no, no se superpondrían).
    expect(collageLayout(items).some((p) => Math.abs(p.dx) > 2 || Math.abs(p.dy) > 2)).toBe(true);
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
