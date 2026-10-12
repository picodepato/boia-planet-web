import { WEATHER_KINDS } from '@boia/engine/weather';
import { describe, expect, it } from 'vitest';
import { type MoodId, cloneMood, moods } from './palette';
import { FLASH_MAX, RAIN_DROPS, WEATHER_LOOK, rainCount, weatherFog, weatherMood } from './weather';

/** El tiempo encima del momento del día (plan 029 T268). */

const all = moods();
const luma = (c: { r: number; g: number; b: number }) => c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;

describe('weatherMood', () => {
  it('sin episodio ni destello, el momento del menú tal cual (y sin tocarlo)', () => {
    for (const id of Object.keys(all) as MoodId[]) {
      const base = all[id];
      const before = cloneMood(base);
      const out = weatherMood(cloneMood(base), base, null, 0, 0);
      expect(out.sky.getHex()).toBe(base.sky.getHex());
      expect(out.fog.getHex()).toBe(base.fog.getHex());
      expect(out.sunI).toBe(base.sunI);
      expect(out.hemi).toBe(base.hemi);
      expect(out.stars).toBe(base.stars);
      // Lo de fuera no cambia.
      expect(base.sky.getHex()).toBe(before.sky.getHex());
      for (const kind of WEATHER_KINDS) {
        const zero = weatherMood(cloneMood(base), base, kind, 0, 0);
        expect(zero.sky.getHex(), `${id} ${kind}`).toBe(base.sky.getHex());
      }
    }
  });

  it('la tormenta oscurece el cielo y apaga el sol y las estrellas', () => {
    for (const id of Object.keys(all) as MoodId[]) {
      const base = all[id];
      const out = weatherMood(cloneMood(base), base, 'tormenta', 1);
      expect(luma(out.sky), id).toBeLessThan(luma(base.sky));
      expect(out.sunI).toBeLessThan(base.sunI);
      expect(out.stars).toBe(0);
    }
  });

  it('la calima tiñe la niebla de naranja y apaga el sol', () => {
    const base = all.dia;
    const out = weatherMood(cloneMood(base), base, 'calima', 1);
    // Más rojo que azul: naranja.
    expect(out.fog.r).toBeGreaterThan(out.fog.b);
    expect(base.fog.r).toBeLessThan(base.fog.b);
    expect(out.sunI).toBeLessThan(base.sunI);
  });

  it('un destello aclara sin llegar nunca al blanco', () => {
    const base = all.noche;
    const out = weatherMood(cloneMood(base), base, 'tormenta', 1, 1);
    const dark = weatherMood(cloneMood(base), base, 'tormenta', 1, 0);
    expect(luma(out.sky)).toBeGreaterThan(luma(dark.sky));
    expect(out.hemi).toBeGreaterThan(dark.hemi);
    expect(FLASH_MAX).toBeLessThanOrEqual(0.5);
    for (const c of [out.sky, out.fog, out.zenith]) expect(luma(c)).toBeLessThan(0.8);
  });

  it('la niebla se acerca con la tormenta y la calima, y vuelve con el episodio a 0', () => {
    expect(weatherFog(null, 1)).toBe(1);
    expect(weatherFog('tormenta', 0)).toBe(1);
    expect(weatherFog('tormenta', 1)).toBe(WEATHER_LOOK.tormenta.fog);
    expect(weatherFog('calima', 1)).toBeLessThan(1);
  });

  it('el viento empuja sólo con levante; la lluvia, sólo en la tormenta', () => {
    expect(WEATHER_LOOK.levante.drift).toBeGreaterThan(0);
    expect(WEATHER_LOOK.tormenta.drift).toBe(0);
    expect(WEATHER_LOOK.calima.drift).toBe(0);
    expect(WEATHER_LOOK.tormenta.rain).toBeGreaterThan(0);
    expect(WEATHER_LOOK.levante.rain).toBe(0);
    expect(WEATHER_LOOK.calima.rain).toBe(0);
  });

  it('menos gotas en calidad baja o con movimiento reducido', () => {
    expect(rainCount('alta', false)).toBe(RAIN_DROPS.alta);
    expect(rainCount('baja', false)).toBeLessThan(rainCount('alta', false));
    expect(rainCount('alta', true)).toBeLessThan(rainCount('alta', false));
    expect(rainCount('baja', true)).toBeLessThan(rainCount('baja', false));
  });
});
