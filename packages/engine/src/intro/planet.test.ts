import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLANET_INTRO as CFG,
  PLANET_INTRO_VERSION,
  frameAt,
  heroFrame,
  pickPlanetFraming,
  poseOf,
  validatePlanetIntro,
  viewMoved,
  type IntroAct,
  type IntroFrame,
  type PlanetIntroConfig,
} from './planet';
import type { Viewport } from './math';

const VIEWPORTS: Viewport[] = [
  { width: 360, height: 640 },
  { width: 1280, height: 720 },
];

const at = (
  vp: Viewport,
  act: IntroAct,
  t: number,
  spin = 0,
  mode: 'intro' | 'reduced' = 'intro',
) => frameAt(CFG, vp, { act, t, spin }, mode);

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
      bad({ landing: { ...CFG.landing, content: [0.5, 0.9] } }).ok,
      'la landing entra del todo al final',
    ).toBe(false);
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
    expect([a.title, a.button, a.content]).toEqual([0, 0, 0]);
  });

  it('acto 2: la pausa no avanza sola; título y botón entran y se quedan', () => {
    const early = at(vp, 'pause', 0);
    const late = at(vp, 'pause', 60_000);
    expect(early.title).toBe(0);
    expect(late.title).toBe(1);
    expect(late.button).toBe(1);
    expect(late.content).toBe(0);
    expect(late.done).toBe(false);
  });

  it('acto 3: el planeta baja hasta el horizonte del hero, sólo acercándose, y acaba en él (REQ-ENT-014)', () => {
    const steps = 40;
    const radii: number[] = [];
    for (let i = 0; i <= steps; i++) {
      radii.push(at(vp, 'landing', (CFG.landing.durationMs * i) / steps, 1).pose.radius);
    }
    expect(radii.every((r, i) => i === 0 || r >= radii[i - 1]!)).toBe(true);
    const last = at(vp, 'landing', CFG.landing.durationMs, 1);
    expect(last.done).toBe(true);
    const hero = heroFrame(CFG, vp, 1 + (CFG.landing.extraSpinDeg * Math.PI) / 180);
    expect(last.pose).toEqual(hero.pose);
    // El horizonte: el planeta no cabe y su borde de arriba queda dentro de la vista.
    expect(hero.pose.radius * 2).toBeGreaterThan(vp.width);
    const top = hero.pose.y - hero.pose.radius;
    expect(top).toBeGreaterThan(0);
    expect(top).toBeLessThan(vp.height * 0.6);
  });

  it('título y botón se van al empezar a zarpar; la landing sólo entra al final', () => {
    const start = at(vp, 'landing', 0);
    const early = at(vp, 'landing', CFG.landing.durationMs * CFG.landing.uiOut[1]);
    const mid = at(vp, 'landing', CFG.landing.durationMs * 0.5);
    expect(start.title).toBe(1);
    expect(early.title).toBe(0);
    expect(early.button).toBe(0);
    expect(mid.content).toBe(0);
    expect(at(vp, 'landing', CFG.landing.durationMs).content).toBe(1);
  });

  it('movimiento reducido: planeta quieto, título y botón; al pulsar, fundido sin mover la cámara (REQ-ENT-010)', () => {
    const frames: IntroFrame[] = [];
    for (let t = 0; t <= 2000; t += 50) frames.push(at(vp, 'pause', t, 0.3, 'reduced'));
    for (let t = 0; t <= CFG.reduced.fadeMs; t += 10)
      frames.push(at(vp, 'landing', t, 0.3, 'reduced'));
    expect(frames.some((x, i) => i > 0 && viewMoved(frames[i - 1]!, x))).toBe(false);
    expect(frames.at(-1)!.done).toBe(true);
    expect(frames.at(-1)!.source).toBe('hero');
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
