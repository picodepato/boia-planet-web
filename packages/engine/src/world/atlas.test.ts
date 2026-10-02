import { describe, expect, it } from 'vitest';
import { ATLAS_INDEX_VERSION, parseAtlasIndex, sectorSheets } from './atlas-index';
import { ATLAS_PADDING, packRects } from './atlas-pack';

/** Atlas por sector (T47): el empaquetado y el índice que lee el motor. */

describe('packRects', () => {
  const sizes = [
    { w: 1130, h: 399 },
    { w: 341, h: 313 },
    { w: 178, h: 93 },
    ...Array.from({ length: 40 }, (_, i) => ({ w: 60 + i * 3, h: 80 + (i % 7) * 11 })),
  ];

  it('no solapa sprites y no se sale de la hoja', () => {
    const size = 1200;
    const { placements, pages } = packRects(sizes, size);
    expect(placements).toHaveLength(sizes.length);
    for (const p of placements) {
      const s = sizes[p.index]!;
      expect(p.x + s.w).toBeLessThanOrEqual(pages[p.page]!.w);
      expect(p.y + s.h).toBeLessThanOrEqual(pages[p.page]!.h);
      expect(pages[p.page]!.w).toBeLessThanOrEqual(size);
      expect(pages[p.page]!.h).toBeLessThanOrEqual(size);
    }
    for (const a of placements) {
      for (const b of placements) {
        if (a === b || a.page !== b.page) continue;
        const sa = sizes[a.index]!;
        const sb = sizes[b.index]!;
        const apart =
          a.x + sa.w + ATLAS_PADDING <= b.x ||
          b.x + sb.w + ATLAS_PADDING <= a.x ||
          a.y + sa.h + ATLAS_PADDING <= b.y ||
          b.y + sb.h + ATLAS_PADDING <= a.y;
        expect(apart).toBe(true);
      }
    }
  });

  it('abre otra hoja cuando no cabe y devuelve el orden de entrada', () => {
    const big = Array.from({ length: 5 }, () => ({ w: 900, h: 900 }));
    const { placements, pages } = packRects(big, 1024);
    expect(pages).toHaveLength(5);
    expect(placements.map((p) => p.index)).toEqual([0, 1, 2, 3, 4]);
  });

  it('un sprite mayor que la hoja es un error, no un recorte', () => {
    expect(() => packRects([{ w: 3000, h: 10 }], 2048)).toThrow();
  });
});

describe('índice de atlas', () => {
  const sheet = { url: 'a/puerto.alta.0.json', image: 'a/puerto.alta.0.webp', bytes: 10, keys: ['k'] };
  const valid = {
    version: ATLAS_INDEX_VERSION,
    source: 'x',
    worlds: { a: { sectors: { puerto: { alta: [sheet] } }, singles: { c: { url: 'c.webp', bytes: 3 } } } },
  };

  it('lee un índice válido y usa la otra calidad si falta la pedida', () => {
    const idx = parseAtlasIndex(valid)!;
    expect(idx.worlds.a!.singles.c!.url).toBe('c.webp');
    expect(sectorSheets(idx.worlds.a, 'puerto', 'baja')).toEqual([sheet]);
    expect(sectorSheets(idx.worlds.a, 'otro', 'alta')).toEqual([]);
    expect(sectorSheets(null, 'puerto', 'alta')).toEqual([]);
  });

  it('rechaza otra versión o una hoja mal formada', () => {
    expect(parseAtlasIndex({ ...valid, version: 99 })).toBeNull();
    expect(
      parseAtlasIndex({
        ...valid,
        worlds: { a: { sectors: { puerto: { alta: [{ url: 1 }] } }, singles: {} } },
      }),
    ).toBeNull();
    expect(parseAtlasIndex(null)).toBeNull();
  });
});
