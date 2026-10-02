import { describe, expect, it } from 'vitest';
import { FIRST_SECTOR_BUDGET, readAtlasIndex, worldBudgets } from '../../../tools/atlas/budget';
import { requestedQuality } from '../lib/mundo/streaming';

/**
 * REQ-ARQ-014 (T47): el primer sector de cada mundo cabe en 5 MB antes de
 * jugar, incluso sin atlas (los PNG de `art/`, el peor caso), y con los
 * atlas si están construidos (`pnpm atlas`).
 */
describe('presupuesto del primer sector', () => {
  it('sin atlas (PNG sueltos), cada mundo ≤ 5 MB y sólo con sus sectores cercanos', () => {
    const rows = worldBudgets(null);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.mode).toBe('png');
      expect(r.total, r.world).toBeLessThanOrEqual(FIRST_SECTOR_BUDGET);
      expect(r.sectors[0], r.world).toBe('puerto');
      expect(r.sectors, r.world).not.toContain('ultima');
    }
  });

  it('con los atlas construidos, pesa menos que sin ellos', () => {
    const index = readAtlasIndex();
    if (!index || Object.keys(index.worlds).length === 0) return;
    const png = new Map(worldBudgets(null).map((r) => [r.world, r.total]));
    for (const r of worldBudgets(index)) {
      expect(r.mode).toBe('atlas');
      expect(r.total, r.world).toBeLessThan(png.get(r.world)!);
    }
  });
});

describe('?calidad=', () => {
  it('fuerza baja o alta; cualquier otra cosa lo deja al dispositivo', () => {
    expect(requestedQuality('?calidad=baja')).toBe('baja');
    expect(requestedQuality('?calidad=alta')).toBe('alta');
    expect(requestedQuality('?calidad=media')).toBeNull();
    expect(requestedQuality('')).toBeNull();
  });
});
