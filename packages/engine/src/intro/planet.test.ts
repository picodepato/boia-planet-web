import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLANET_INTRO as CFG,
  PLANET_INTRO_VERSION,
  divePose,
  focusSpin,
  frameAt,
  pickPlanetFraming,
  poseOf,
  validatePlanetIntro,
  viewMoved,
  type IntroAct,
  type IntroFrame,
  type PlanetFocus,
  type PlanetIntroConfig,
} from './planet';
import type { Viewport } from './math';

const VIEWPORTS: Viewport[] = [
  { width: 360, height: 640 },
  { width: 1280, height: 720 },
];

/** Un puerto de salida en el sur del planeta, al otro lado de la vista inicial. */
const PORT: PlanetFocus = { lon: 2.4, lat: -0.6 };

const at = (
  vp: Viewport,
  act: IntroAct,
  t: number,
  spin = 0,
  mode: 'intro' | 'reduced' = 'intro',
  focus: PlanetFocus | null = PORT,
) => frameAt(CFG, vp, { act, t, spin, focus }, mode);

/**
 * Hacia dónde mira un punto (lon, lat) del planeta con un giro y una
 * inclinación: como la escena (inclinación por fuera, giro por dentro).
 */
function facing(f: PlanetFocus, spin: number, tilt: number): [number, number, number] {
  const c = Math.cos(f.lat);
  const x0 = c * Math.sin(f.lon);
  const y0 = Math.sin(f.lat);
  const z0 = c * Math.cos(f.lon);
  // Giro sobre y.
  const x1 = x0 * Math.cos(spin) + z0 * Math.sin(spin);
  const z1 = -x0 * Math.sin(spin) + z0 * Math.cos(spin);
  // Inclinación sobre x.
  const y2 = y0 * Math.cos(tilt) - z1 * Math.sin(tilt);
  const z2 = y0 * Math.sin(tilt) + z1 * Math.cos(tilt);
  return [x1, y2, z2];
}

describe('configuración de la entrada 3D (REQ-ENT-015)', () => {
  it('la de serie es válida, de muestra, versionada y trae «BOIA» y «Zarpar» (REQ-ENT-003)', () => {
    const r = validatePlanetIntro(CFG);
    expect(r.ok, r.ok ? '' : r.error).toBe(true);
    expect(CFG.version).toBe(PLANET_INTRO_VERSION);
    expect(CFG.status).toBe('muestra');
    expect(CFG.copy.title).toBe('BOIA');
    expect(CFG.copy.enter).toBe('Zarpar');
    expect(CFG.pause.autoAdvance.enabled).toBe(false);
  });

  it('es corta: aparición y «Zarpar» en menos de 1,5 s cada uno', () => {
    expect(CFG.appear.durationMs).toBeLessThanOrEqual(1500);
    expect(CFG.landing.durationMs).toBeLessThanOrEqual(1500);
  });

  it('rechaza con el campo que falla', () => {
    const bad = (patch: Partial<PlanetIntroConfig>) => validatePlanetIntro({ ...CFG, ...patch });
    const r = bad({ loadBudgetMs: 10 });
    expect(r.ok).toBe(false);
    expect(r.ok ? '' : r.error).toMatch(/loadBudgetMs/);
    expect(bad({ bootCapMs: CFG.loadBudgetMs - 1 }).ok).toBe(false);
    expect(bad({ framings: [] }).ok).toBe(false);
    expect(bad({ version: 3 as never }).ok).toBe(false);
    expect(
      bad({ landing: { ...CFG.landing, cover: [0.5, 0.9] } }).ok,
      'el velo del mar cubre del todo al final',
    ).toBe(false);
    expect(bad({ landing: { ...CFG.landing, diveFit: 0 } }).ok).toBe(false);
    expect(validatePlanetIntro(null).ok).toBe(false);
  });

  it('los encuadres se eligen por ancho de vista', () => {
    expect(pickPlanetFraming(CFG, 360)).toBe(CFG.framings[0]);
    expect(pickPlanetFraming(CFG, 1280)).toBe(CFG.framings[1]);
  });
});

describe.each(VIEWPORTS)('línea de tiempo con el planeta, $width×$height', (vp) => {
  const f = pickPlanetFraming(CFG, vp.width);

  it('acto 1: el planeta sube desde abajo y crece hasta su sitio, sin título ni botón', () => {
    const a = at(vp, 'appear', 0);
    const b = at(vp, 'appear', CFG.appear.durationMs);
    const intro = poseOf(f.intro, vp, 0);
    expect(a.pose.y).toBeGreaterThan(intro.y);
    expect(a.pose.radius).toBeCloseTo(intro.radius * CFG.appear.growFrom);
    expect(b.pose).toEqual(intro);
    expect([a.title, a.button, a.content, a.cover]).toEqual([0, 0, 0, 0]);
  });

  it('acto 2: la pausa no avanza sola; título y botón entran y se quedan', () => {
    const early = at(vp, 'pause', 0);
    const late = at(vp, 'pause', 60_000);
    expect(early.title).toBe(0);
    expect(late.title).toBe(1);
    expect(late.button).toBe(1);
    expect(late.content).toBe(0);
    expect(late.cover).toBe(0);
    expect(late.done).toBe(false);
  });

  it('acto 3 (T64): la cámara se zambulle, sólo acercándose, hasta el puerto de cara (REQ-ENT-014)', () => {
    const steps = 40;
    const radii: number[] = [];
    for (let i = 0; i <= steps; i++) {
      radii.push(at(vp, 'landing', (CFG.landing.durationMs * i) / steps, 1).pose.radius);
    }
    expect(radii.every((r, i) => i === 0 || r >= radii[i - 1]!)).toBe(true);
    const last = at(vp, 'landing', CFG.landing.durationMs, 1);
    expect(last.done).toBe(true);
    expect(last.pose).toEqual(divePose(CFG, vp, 1, f.intro.tiltDeg * (Math.PI / 180), PORT));
    // Mucho más grande que la vista: se ve el puerto de cerca, no el planeta.
    expect(last.pose.radius * 2).toBeGreaterThan(Math.max(vp.width, vp.height) * 2);
    // El puerto mira a la cámara, en el sitio de la vista que dice la configuración.
    const [x, y, z] = facing(PORT, last.pose.spin, last.pose.tilt);
    expect(z).toBeCloseTo(1, 6);
    expect(Math.hypot(x, y)).toBeLessThan(1e-6);
    expect(last.pose.x).toBeCloseTo(CFG.landing.anchor[0] * vp.width);
    expect(last.pose.y).toBeCloseTo(CFG.landing.anchor[1] * vp.height);
    // Nunca más de media vuelta para encontrarlo.
    expect(Math.abs(last.pose.spin - 1)).toBeLessThanOrEqual(Math.PI);
  });

  it('título y botón se van al empezar a zarpar; el velo del mar cubre al final; la landing no entra', () => {
    const start = at(vp, 'landing', 0);
    const early = at(vp, 'landing', CFG.landing.durationMs * CFG.landing.uiOut[1]);
    const mid = at(vp, 'landing', CFG.landing.durationMs * 0.5);
    const end = at(vp, 'landing', CFG.landing.durationMs);
    expect(start.title).toBe(1);
    expect(start.cover).toBe(0);
    expect(early.title).toBe(0);
    expect(early.button).toBe(0);
    expect(mid.cover).toBe(0);
    expect(end.cover).toBe(1);
    for (const x of [start, early, mid, end]) expect(x.content).toBe(0);
  });

  it('sin puerto conocido, se zambulle igual sin girar', () => {
    const last = at(vp, 'landing', CFG.landing.durationMs, 0.7, 'intro', null);
    expect(last.pose.spin).toBe(0.7);
    expect(last.pose.tilt).toBeCloseTo(f.intro.tiltDeg * (Math.PI / 180));
    expect(last.cover).toBe(1);
  });

  it('movimiento reducido: planeta quieto, título y botón; al pulsar, fundido sin mover la cámara (REQ-ENT-010)', () => {
    const frames: IntroFrame[] = [];
    for (let t = 0; t <= 2000; t += 50) frames.push(at(vp, 'pause', t, 0.3, 'reduced'));
    for (let t = 0; t <= CFG.reduced.fadeMs; t += 10)
      frames.push(at(vp, 'landing', t, 0.3, 'reduced'));
    expect(frames.some((x, i) => i > 0 && viewMoved(frames[i - 1]!, x))).toBe(false);
    expect(frames.at(-1)!.done).toBe(true);
    // Un fundido al velo del mar (T64), con el planeta quieto donde estaba.
    expect(frames.at(-1)!.cover).toBe(1);
    expect(frames.at(-1)!.pose).toEqual(frames[0]!.pose);
    expect(frames.every((x) => x.planet >= 0 && x.planet <= 1)).toBe(true);
  });
});

it('los tiempos salen de la configuración: un «Zarpar» el doble de largo va a la mitad', () => {
  const vp = VIEWPORTS[0]!;
  const slow: PlanetIntroConfig = {
    ...CFG,
    landing: { ...CFG.landing, durationMs: CFG.landing.durationMs * 2 },
  };
  const a = frameAt(slow, vp, { act: 'landing', t: CFG.landing.durationMs, spin: 0 }, 'intro');
  const b = frameAt(CFG, vp, { act: 'landing', t: CFG.landing.durationMs / 2, spin: 0 }, 'intro');
  expect(a.pose.radius).toBeCloseTo(b.pose.radius);
});

it('el giro hacia el puerto es el más corto, en cualquier vuelta (T64)', () => {
  for (const spin of [-20, -3, 0, 0.5, 3.2, 7, 40]) {
    for (const lon of [-3, -1.5, 0, 1, 3.1]) {
      const s = focusSpin(spin, { lon, lat: 0 });
      expect(Math.abs(s - spin)).toBeLessThanOrEqual(Math.PI + 1e-9);
      const [, , z] = facing({ lon, lat: 0 }, s, 0);
      expect(z).toBeCloseTo(1, 9);
    }
  }
});
