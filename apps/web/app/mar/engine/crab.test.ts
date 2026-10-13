import { CRAB_BPM } from '@boia/engine/characters';
import { describe, expect, it } from 'vitest';
import { CRAB_LOOK, Crab } from './crab';

/**
 * El cangrejo bailarín (plan 029 T270): sin radio pasea; con la radio salta
 * al compás (arriba en medio del pulso, abajo en el pulso); tocarlo le saca
 * el giro con salto; con movimiento reducido se queda quieto.
 */

const DT = 1 / 60;
const BEAT = 60 / CRAB_BPM;

describe('Crab (T270)', () => {
  it('sin radio pasea; con la radio baila al compás', () => {
    const c = new Crab();
    c.update(DT, null, false);
    expect(c.visual).toBe('pasea');
    // En el pulso (fase 0) está abajo; a medio pulso, arriba.
    c.update(DT, { playing: true, elapsed: 0 }, false);
    expect(c.visual).toBe('baila');
    expect(c.body.position.y).toBeCloseTo(c.top, 3);
    c.update(DT, { playing: true, elapsed: BEAT / 2 }, false);
    expect(c.body.position.y).toBeCloseTo(c.top + CRAB_LOOK.hop, 3);
    c.update(DT, { playing: true, elapsed: BEAT }, false);
    expect(c.body.position.y).toBeCloseTo(c.top, 3);
    c.update(DT, { playing: false, elapsed: 5 }, false);
    expect(c.visual).toBe('pasea');
  });

  it('tocarlo: el giro con salto dura su tiempo y vuelve a lo que hacía', () => {
    const c = new Crab();
    c.tap();
    c.update(DT, null, false);
    expect(c.visual).toBe('giro');
    let top = 0;
    for (let i = 0; i < Math.round((CRAB_LOOK.specialS * 0.5) / DT); i++) {
      c.update(DT, null, false);
      top = Math.max(top, c.body.position.y - c.top);
    }
    expect(top).toBeGreaterThan(CRAB_LOOK.jump * 0.8);
    expect(c.body.rotation.y).toBeGreaterThan(Math.PI * 0.8);
    for (let i = 0; i < Math.round((CRAB_LOOK.specialS * 0.6) / DT); i++) c.update(DT, null, false);
    expect(c.visual).toBe('pasea');
    expect(c.body.rotation.y).toBeCloseTo(Math.sin(0) * 0.2, 0);
  });

  it('con movimiento reducido se queda quieto (y al tocarlo no gira)', () => {
    const c = new Crab();
    c.update(DT, { playing: true, elapsed: BEAT / 2 }, true);
    expect(c.visual).toBe('quieto');
    expect(c.body.position.y).toBe(c.top);
    c.tap();
    for (let i = 0; i < 10; i++) c.update(DT, null, true);
    expect(c.body.rotation.y).toBe(0);
    expect(c.body.position.y).toBe(c.top);
    c.dispose();
  });
});
