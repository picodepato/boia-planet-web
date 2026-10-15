import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WIND_DIR } from './weather';
import { waterShaders } from './water';
import {
  CALM_FAR,
  CALM_NEAR,
  LIVELY_SEA,
  MAX_PITCH,
  MAX_ROLL,
  NO_ROCK,
  SEA_WAVES,
  SEA_WAVE_MAX,
  WAVES_GLSL,
  WIND_SWELL,
  boatRock,
  shoreCalm,
  shoreDistance,
  waveAmplitude,
  waveAt,
} from './waves';

describe('el oleaje de /mar (plan 032 T298, REQ-MUN-003)', () => {
  it('altura y pendiente deterministas: mismo sitio y momento, mismo agua; nunca más que la suma de crestas', () => {
    const a = waveAt(12.3, -40.1, 7.25, 1);
    const b = waveAt(12.3, -40.1, 7.25, 1);
    expect(a).toEqual(b);
    // Se mueve: otro momento, otra altura.
    expect(waveAt(12.3, -40.1, 8.9, 1).h).not.toBeCloseTo(a.h, 3);
    for (let i = 0; i < 200; i++) {
      const w = waveAt(i * 3.7, i * -5.3, i * 0.41, 1);
      expect(Math.abs(w.h)).toBeLessThanOrEqual(SEA_WAVE_MAX + 1e-9);
    }
    // La amplitud escala la altura y la pendiente.
    const half = waveAt(12.3, -40.1, 7.25, 0.5);
    expect(half.h).toBeCloseTo(a.h / 2, 9);
    expect(half.gx).toBeCloseTo(a.gx / 2, 9);
  });

  it('la pendiente es la derivada de la altura (lo que inclina el barco es lo que se ve)', () => {
    const e = 1e-4;
    for (const [x, z, t] of [
      [3, 4, 1],
      [-20, 7.5, 13.2],
      [101, -66, 0.3],
    ] as const) {
      const w = waveAt(x, z, t, 1);
      const dx = (waveAt(x + e, z, t, 1).h - waveAt(x - e, z, t, 1).h) / (2 * e);
      const dz = (waveAt(x, z + e, t, 1).h - waveAt(x, z - e, t, 1).h) / (2 * e);
      expect(w.gx).toBeCloseTo(dx, 5);
      expect(w.gz).toBeCloseTo(dz, 5);
    }
  });

  it('la ola mayor va a favor del viento', () => {
    const big = [...SEA_WAVES].sort((p, q) => q.amp - p.amp)[0]!;
    expect(big.dx).toBeCloseTo(WIND_DIR.x, 9);
    expect(big.dz).toBeCloseTo(WIND_DIR.y, 9);
  });

  it('amplitud cero con movimiento reducido, en la vista de mapa y con el interruptor apagado', () => {
    const base = { on: true, reduced: false, mapK: 0, wind: 0 };
    expect(waveAmplitude(base)).toBe(1);
    expect(waveAmplitude({ ...base, reduced: true })).toBe(0);
    expect(waveAmplitude({ ...base, mapK: 1 })).toBe(0);
    expect(waveAmplitude({ ...base, on: false })).toBe(0);
    expect(waveAmplitude({ ...base, wind: 1 })).toBeCloseTo(1 + WIND_SWELL, 9);
    // Con amplitud cero, el agua está plana en todas partes.
    expect(waveAt(5, 5, 3, 0)).toEqual({ h: 0, gx: 0, gz: 0 });
  });

  it('calma junto a las islas y los muelles: cero pegado a la orilla, entero en mar abierto', () => {
    expect(shoreCalm(-3)).toBe(0);
    expect(shoreCalm(0)).toBe(0);
    expect(shoreCalm(CALM_NEAR)).toBe(0);
    expect(shoreCalm(CALM_FAR)).toBe(1);
    expect(shoreCalm(500)).toBe(1);
    const mid = shoreCalm((CALM_NEAR + CALM_FAR) / 2);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    // La distancia a la orilla da la vuelta al mar (el puerto al otro lado del borde está cerca).
    const shores = [{ x: 98, z: 0, r: 4 }];
    expect(shoreDistance(-98, 0, shores, { w: 200, h: 200 })).toBeCloseTo(0, 9);
    // Un barco en el muelle (dentro del radio de la isla del puerto) no se mece nada.
    const rock = boatRock(
      -98,
      0,
      0.3,
      4,
      shoreCalm(shoreDistance(-98, 0, shores, { w: 200, h: 200 })),
    );
    expect(rock).toEqual(NO_ROCK);
  });

  it('el barco: sube con el agua y su cabeceo y balanceo nunca pasan de los topes', () => {
    let maxP = 0;
    let maxR = 0;
    for (let i = 0; i < 400; i++) {
      const x = i * 1.37;
      const z = i * -2.11;
      const t = i * 0.173;
      const heading = i * 0.61;
      // Hasta con el doble de ola (más que el Levante), los topes aguantan.
      const r = boatRock(x, z, heading, t, 2);
      expect(Math.abs(r.pitch)).toBeLessThanOrEqual(MAX_PITCH);
      expect(Math.abs(r.roll)).toBeLessThanOrEqual(MAX_ROLL);
      expect(r.heave).toBeCloseTo(waveAt(x, z, t, 2).h, 9);
      maxP = Math.max(maxP, Math.abs(r.pitch));
      maxR = Math.max(maxR, Math.abs(r.roll));
    }
    // Y se mece de verdad.
    expect(maxP).toBeGreaterThan(MAX_PITCH / 2);
    expect(maxR).toBeGreaterThan(MAX_ROLL / 4);
    expect(boatRock(1, 2, 0, 3, 0)).toBe(NO_ROCK);
  });

  it('proa arriba cuando el agua sube por delante; de costado, balanceo y no cabeceo', () => {
    // Rumbo de la ola mayor y un sitio donde su cresta viene por delante.
    const big = SEA_WAVES[0]!;
    const heading = Math.atan2(big.dz, big.dx);
    let found = false;
    for (let i = 0; i < 200 && !found; i++) {
      const s = i * 0.37;
      const w = waveAt(big.dx * s, big.dz * s, 0, 1);
      const along = w.gx * big.dx + w.gz * big.dz;
      if (along > 0.03) {
        const r = boatRock(big.dx * s, big.dz * s, heading, 0, 1);
        expect(r.pitch).toBeGreaterThan(0);
        found = true;
      }
    }
    expect(found).toBe(true);
  });
});

describe('el interruptor del oleaje (T298)', () => {
  it('está encendido por defecto', () => {
    expect(LIVELY_SEA).toBe(true);
  });

  it('sin olas, los shaders del agua no llevan nada de oleaje (el mar de antes)', () => {
    const off = waterShaders(false);
    for (const src of [off.vertex, off.fragment]) {
      expect(src).not.toContain('seaWave');
      expect(src).not.toContain('uWaveAmp');
    }
    // El vértice de antes: sólo curva el planeta.
    expect(off.vertex).toMatch(/vWorld = world\.xyz;\s*vec3 bent = planetCurve\(world\.xyz\);/);
    const on = waterShaders(true);
    expect(on.vertex).toContain('world.y += seaWave(');
    expect(on.fragment).toContain('seaWave(p, uTime');
    // Quitando lo añadido, el fragmento con olas es el de siempre.
    expect(on.fragment.length).toBeGreaterThan(off.fragment.length);
  });

  it('/mar sólo pide olas y mece el barco a través del interruptor (apagado: agua sin olas y vaivén de siempre)', () => {
    const src = readFileSync(new URL('./mar3d.ts', import.meta.url), 'utf8');
    expect(src).toContain("createWater({ waves: LIVELY_SEA && this.quality !== 'baja' })");
    expect(src).toContain('this.water.waves ? this.rockOnWaves(x, z, h) : NO_ROCK');
    // La amplitud sólo se escribe si el shader tiene olas.
    expect(src).toMatch(/if \(this\.water\.waves\) \{\s*this\.waveAmp = waveAmplitude/);
  });

  it('el shader se genera de las mismas olas que mecen el barco', () => {
    for (const w of SEA_WAVES) {
      expect(WAVES_GLSL).toContain(String((Math.PI * 2) / w.length));
      expect(WAVES_GLSL).toContain(String((Math.PI * 2) / w.period));
    }
  });
});

describe('el oleaje nunca da NaN al barco (plan 032 T305)', () => {
  // La única cuenta del oleaje que hace la CPU mueve el barco (no hay malla
  // de olas: la altura del agua está en el shader). Si diera NaN, el casco y
  // lo que le sigue se irían del mapa. Los casos raros de /mar: sin orillas,
  // una orilla mal medida, el planeta sin medida, mucho tiempo de agua.
  const finiteRock = (r: { heave: number; pitch: number; roll: number }) =>
    [r.heave, r.pitch, r.roll].every(Number.isFinite);

  it('la calma de la orilla es un número entre 0 y 1 en los casos raros', () => {
    type Shore = { x: number; z: number; r: number };
    const period = { w: 800, h: 600 };
    const cases: [number, number, Shore[], { w: number; h: number }][] = [
      [10, 20, [], period],
      [10, 20, [{ x: 0, z: 0, r: Number.NaN }], period],
      [
        10,
        20,
        [
          { x: Number.NaN, z: 0, r: 5 },
          { x: 30, z: 20, r: 5 },
        ],
        period,
      ],
      [10, 20, [{ x: 0, z: 0, r: 5 }], { w: 0, h: 0 }],
      [1e9, -1e9, [{ x: 0, z: 0, r: 5 }], period],
    ];
    for (const [x, z, shores, p] of cases) {
      const calm = shoreCalm(shoreDistance(x, z, shores, p));
      expect(Number.isNaN(calm)).toBe(false);
      expect(calm).toBeGreaterThanOrEqual(0);
      expect(calm).toBeLessThanOrEqual(1);
    }
  });

  it('el vaivén es finito con cualquier amplitud del fotograma y mucho tiempo de agua', () => {
    for (const wind of [0, 0.5, 1, 7, -3]) {
      for (const mapK of [0, 0.4, 1, 2]) {
        const amp = waveAmplitude({ on: true, reduced: false, mapK, wind });
        expect(Number.isFinite(amp)).toBe(true);
        for (const t of [0, 1e3, 1e7]) {
          expect(finiteRock(boatRock(123.4, -56.7, 2.1, t, amp))).toBe(true);
        }
      }
    }
  });
});
