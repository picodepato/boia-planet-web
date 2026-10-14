import { describe, expect, it } from 'vitest';
import {
  AFTER_TUNING,
  AfterClock,
  afterGlow,
  afterOpen,
  afterPulse,
  fishPose,
} from './index';
import { alicanteHour } from '../characters';

/** Un instante en hora de Alicante, pasado a UTC por la propia `alicanteHour` (que usa Intl). */
const atAlicante = (isoLocal: string, utcOffsetH: number) =>
  new Date(new Date(`${isoLocal}Z`).getTime() - utcOffsetH * 3600_000);

describe('la ventana del after (03:00–07:00 Europe/Madrid)', () => {
  it('abre a las 03:00 en punto y cierra a las 07:00 en punto (verano, UTC+2)', () => {
    expect(afterOpen(atAlicante('2026-07-15T02:59:59', 2))).toBe(false);
    expect(afterOpen(atAlicante('2026-07-15T03:00:00', 2))).toBe(true);
    expect(afterOpen(atAlicante('2026-07-15T06:59:59', 2))).toBe(true);
    expect(afterOpen(atAlicante('2026-07-15T07:00:00', 2))).toBe(false);
  });

  it('lo mismo en invierno (UTC+1)', () => {
    expect(afterOpen(atAlicante('2026-01-15T02:59:00', 1))).toBe(false);
    expect(afterOpen(atAlicante('2026-01-15T03:00:00', 1))).toBe(true);
    expect(afterOpen(atAlicante('2026-01-15T06:59:00', 1))).toBe(true);
    expect(afterOpen(atAlicante('2026-01-15T07:00:00', 1))).toBe(false);
  });

  it('el día que los relojes adelantan (2026-03-29): a la 01:00Z son las 03:00 CEST', () => {
    // 00:59Z → 01:59 CET: cerrado. 01:00Z → 03:00 CEST (las 02:00 no existen): abierto.
    expect(alicanteHour(new Date('2026-03-29T00:59:00Z'))).toBe(1);
    expect(afterOpen(new Date('2026-03-29T00:59:00Z'))).toBe(false);
    expect(alicanteHour(new Date('2026-03-29T01:00:00Z'))).toBe(3);
    expect(afterOpen(new Date('2026-03-29T01:00:00Z'))).toBe(true);
    expect(afterOpen(new Date('2026-03-29T04:59:00Z'))).toBe(true); // 06:59 CEST
    expect(afterOpen(new Date('2026-03-29T05:00:00Z'))).toBe(false); // 07:00 CEST
  });

  it('el día que los relojes atrasan (2026-10-25): las 02:xx pasan dos veces y ninguna abre', () => {
    expect(alicanteHour(new Date('2026-10-25T00:30:00Z'))).toBe(2); // 02:30 CEST
    expect(afterOpen(new Date('2026-10-25T00:30:00Z'))).toBe(false);
    expect(alicanteHour(new Date('2026-10-25T01:30:00Z'))).toBe(2); // 02:30 CET
    expect(afterOpen(new Date('2026-10-25T01:30:00Z'))).toBe(false);
    expect(afterOpen(new Date('2026-10-25T02:00:00Z'))).toBe(true); // 03:00 CET
    expect(afterOpen(new Date('2026-10-25T05:59:00Z'))).toBe(true); // 06:59 CET
    expect(afterOpen(new Date('2026-10-25T06:00:00Z'))).toBe(false); // 07:00 CET
  });

  it('`?hora=` manda sobre el reloj', () => {
    const noon = new Date('2026-07-15T10:00:00Z');
    expect(afterOpen(noon)).toBe(false);
    expect(afterOpen(noon, 4)).toBe(true);
    expect(afterOpen(noon, 7)).toBe(false);
    expect(afterOpen(noon, 3)).toBe(true);
  });
});

describe('AfterClock', () => {
  const open = new Date('2026-07-15T02:00:00Z'); // 04:00 CEST
  const closed = new Date('2026-07-15T06:00:00Z'); // 08:00 CEST

  it('empieza cerrado sin aviso; abre con «open» y sube del agua en fadeS s', () => {
    const c = new AfterClock();
    expect(c.step(0.1, closed)).toEqual([]);
    expect(c.open).toBe(false);
    expect(c.fade).toBe(0);
    // Hasta el siguiente vistazo (1 s) no mira el reloj.
    expect(c.step(0.5, open)).toEqual([]);
    expect(c.step(0.6, open)).toEqual([{ type: 'open' }]);
    expect(c.open).toBe(true);
    // El paso que la abrió ya cuenta (0,6 s); el resto, en pasos de 0,5 s.
    expect(c.fade).toBeCloseTo(0.6 / AFTER_TUNING.fadeS, 5);
    let t = 0.6;
    while (c.fade < 1 && t < 60) {
      c.step(0.5, open);
      t += 0.5;
    }
    expect(t).toBeGreaterThanOrEqual(AFTER_TUNING.fadeS);
    expect(t).toBeLessThan(AFTER_TUNING.fadeS + 0.5);
    expect(c.fade).toBe(1);
  });

  it('entrando con el after abierto avisa «open» en el primer paso', () => {
    const c = new AfterClock();
    expect(c.step(0.1, open)).toEqual([{ type: 'open' }]);
  });

  it('cierra con «close» y se hunde aunque el barco esté allí; nunca repite avisos', () => {
    const c = new AfterClock();
    c.step(0.1, open);
    c.step(100, open);
    expect(c.fade).toBe(1);
    expect(c.step(1, closed)).toEqual([{ type: 'close' }]);
    expect(c.step(1, closed)).toEqual([]);
    expect(c.fade).toBeLessThan(1);
    c.step(100, closed);
    expect(c.fade).toBe(0);
  });

  it('con movimiento reducido aparece de golpe', () => {
    const c = new AfterClock();
    c.step(0.1, open, null, true);
    expect(c.fade).toBe(1);
    c.step(1, closed, null, true);
    expect(c.fade).toBe(0);
  });
});

describe('luces y peces', () => {
  it('el latido vale 1 en el pulso y baja hasta el siguiente', () => {
    const beat = 60 / AFTER_TUNING.bpm;
    expect(afterPulse(0)).toBeCloseTo(1, 5);
    expect(afterPulse(beat * 0.5)).toBeCloseTo(0.25, 5);
    expect(afterPulse(beat * 0.999)).toBeLessThan(0.01);
    expect(afterPulse(beat * 3)).toBeCloseTo(1, 3);
  });

  it('el neón brilla aunque el menú esté en día, y late sin apagarse', () => {
    for (let t = 0; t < 2; t += 0.05) {
      const g = afterGlow(0, t);
      expect(g).toBeGreaterThanOrEqual(AFTER_TUNING.glowFloor * (1 - AFTER_TUNING.pulse) - 1e-9);
      expect(g).toBeLessThanOrEqual(AFTER_TUNING.glowFloor + 1e-9);
    }
    expect(afterGlow(1, 0)).toBeCloseTo(1, 5);
  });

  it('los peces giran en corro a su radio y uno salta en cada pulso', () => {
    const R = 7;
    const out = { x: 0, y: 0, z: 0, yaw: 0 };
    const n = AFTER_TUNING.fish;
    for (let i = 0; i < n; i++) {
      fishPose(i, n, 0, R, out);
      expect(Math.hypot(out.x, out.z)).toBeCloseTo(R * AFTER_TUNING.fishRadius, 5);
    }
    // Determinista.
    const a = { ...fishPose(2, n, 3.3, R, out) };
    const b = { ...fishPose(2, n, 3.3, R, out) };
    expect(a).toEqual(b);
    // En el pulso k salta el pez k (y sólo él).
    const beat = 60 / AFTER_TUNING.bpm;
    const t = beat * 3 + beat * 0.3;
    const ys = Array.from({ length: n }, (_, i) => fishPose(i, n, t, R, out).y);
    const high = ys.map((y, i) => (y > 0.5 ? i : -1)).filter((i) => i >= 0);
    expect(high).toEqual([3]);
  });
});
