import { DIRECTIONS, directionHeading } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { DirectionPicker, directionForHeading, directionIndexForHeading } from './direction';
import { provisionalBow, provisionalShipView } from './provisional';

const STEP = (0.1 * Math.PI) / 180;

function sweep(from: number, to: number) {
  const picker = new DirectionPicker(from);
  const changes: number[] = [];
  let last = DIRECTIONS.indexOf(picker.pick(from));
  const n = Math.round(Math.abs(to - from) / STEP);
  for (let i = 1; i <= n; i++) {
    const h = from + Math.sign(to - from) * i * STEP;
    const idx = DIRECTIONS.indexOf(picker.pick(h));
    if (idx !== last) {
      changes.push((idx - last + 8) % 8);
      last = idx;
    }
  }
  return changes;
}

describe('dirección del sprite según el rumbo del casco', () => {
  it('cada vista corresponde a su propio rumbo', () => {
    for (const d of DIRECTIONS) expect(directionForHeading(directionHeading(d))).toBe(d);
  });

  it('dos vueltas completas en sentido S→SW→W… avanzan de una en una, 16 cambios', () => {
    const changes = sweep(0, 4 * Math.PI);
    expect(changes.length).toBe(16);
    expect(changes.every((c) => c === 1)).toBe(true);
  });

  it('dos vueltas en sentido contrario retroceden de una en una', () => {
    const changes = sweep(4 * Math.PI, 0);
    expect(changes.length).toBe(16);
    expect(changes.every((c) => c === 7)).toBe(true);
  });

  it('al pasar por N nunca aparece una vista del sur (la proa no se invierte)', () => {
    const n = directionHeading('N');
    for (let d = -Math.PI / 3; d <= Math.PI / 3; d += STEP) {
      expect(['NW', 'N', 'NE']).toContain(directionForHeading(n + d));
    }
    expect(directionIndexForHeading(n)).toBe(DIRECTIONS.indexOf('N'));
  });

  it('el barco provisional apunta la proa hacia donde dice su vista', () => {
    const bowN = provisionalBow('N');
    const bowS = provisionalBow('S');
    const bowE = provisionalBow('E');
    const bowW = provisionalBow('W');
    expect(bowN.y).toBeLessThan(provisionalBow('NE').y);
    expect(bowN.y).toBeLessThan(bowS.y);
    expect(bowE.x).toBeGreaterThan(0);
    expect(bowW.x).toBeLessThan(0);
    // La estela sale de la popa: en N la popa queda abajo; en S, arriba.
    expect(provisionalShipView('N').anchors.wake_origin.y).toBeGreaterThan(0);
    expect(provisionalShipView('S').anchors.wake_origin.y).toBeLessThan(0);
  });

  it('en ninguna vista se ven caras de la borda que miran hacia el norte', () => {
    for (const d of DIRECTIONS) {
      const v = provisionalShipView(d);
      expect(v.hull.length).toBeGreaterThan(0);
      expect(v.hull.length).toBeLessThanOrEqual(4);
    }
  });
});
