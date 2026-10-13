import { describe, expect, it } from 'vitest';
import { SWELL_HEIGHT, SWELL_SETTLE_S, SwellView, swellProfile, swellTaper } from './swell';

describe('SwellView (T269)', () => {
  it('el perfil sube suave hacia la cresta y cae antes por detrás', () => {
    expect(swellProfile(0)).toBe(1);
    // Cara suave hacia el barco (u > 0): aún alta a media subida; caída corta atrás.
    expect(swellProfile(0.4)).toBeGreaterThan(swellProfile(-0.4));
    expect(swellProfile(1)).toBeLessThan(0.05);
    expect(swellProfile(-1)).toBeLessThan(0.01);
  });

  it('se estrecha hacia las puntas y nunca es negativa', () => {
    expect(swellTaper(0)).toBe(1);
    expect(swellTaper(1)).toBe(0);
    expect(swellTaper(-1)).toBe(0);
    expect(swellTaper(0.5)).toBeGreaterThan(swellTaper(0.9));
    expect(swellTaper(2)).toBe(0);
  });

  it('se esconde sin fuerza y se escala con ella', () => {
    const v = new SwellView();
    expect(v.group.visible).toBe(false);
    v.place(10, 20, 0.5, 16, 0, 0, false);
    expect(v.group.visible).toBe(false);
    v.place(10, 20, 0.5, 16, 1, 0, true);
    expect(v.group.visible).toBe(true);
    expect(v.group.scale.x).toBe(16);
    expect(v.group.scale.y).toBeCloseTo(SWELL_HEIGHT);
    expect(v.group.position.x).toBe(10);
    expect(v.group.rotation.y).toBe(0.5);
    v.hide();
    expect(v.group.visible).toBe(false);
  });

  it('al irse se hunde poco a poco donde estaba, sin desaparecer de golpe', () => {
    const v = new SwellView();
    v.place(10, 20, 0.5, 16, 1, 5, true);
    v.settle(5 + SWELL_SETTLE_S / 2);
    expect(v.group.visible).toBe(true);
    expect(v.group.scale.y).toBeCloseTo(SWELL_HEIGHT / 2);
    expect(v.group.position.x).toBe(10);
    v.settle(5 + SWELL_SETTLE_S + 0.01);
    expect(v.group.visible).toBe(false);
  });
});
