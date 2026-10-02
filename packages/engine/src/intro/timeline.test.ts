import { describe, expect, it } from 'vitest';
import { DEFAULT_INTRO_CONFIG as CFG, pickFraming } from './config';
import { idleZoom, landingAnchor, rhoOf, spinAt, worldPointAt } from './sphere';
import { realGeometry } from './test-fixtures';
import { frameAt, landingCamera, sameCamera, samePose, viewMoved, type IntroAct } from './timeline';
import type { Viewport } from './math';

const geo = realGeometry();
const VIEWPORTS: Viewport[] = [
  { width: 360, height: 640 },
  { width: 1280, height: 720 },
];
const at = (vp: Viewport, act: IntroAct, t: number, spinMs = 0, mode = 'intro' as const) =>
  frameAt(CFG, geo, vp, { act, t, spinMs }, mode);
const steps = (total: number, n: number) =>
  Array.from({ length: n + 1 }, (_, i) => (total * i) / n);

describe.each(VIEWPORTS)('línea de tiempo en tres actos, $width×$height', (vp) => {
  it('acto 1: el mini-mundo sube desde abajo y crece hasta su sitio, sin título ni botón', () => {
    const first = at(vp, 'appear', 0);
    const last = at(vp, 'appear', CFG.appear.durationMs);
    const rest = at(vp, 'pause', 0);
    expect(first.sphere.center.y).toBeGreaterThan(last.sphere.center.y);
    expect(first.sphere.zoom).toBeLessThan(last.sphere.zoom);
    expect(last.sphere.zoom).toBeCloseTo(idleZoom(CFG, geo, vp), 9);
    expect(samePose(last.sphere, rest.sphere)).toBe(true);
    for (const t of steps(CFG.appear.durationMs, 40)) {
      const f = at(vp, 'appear', t);
      expect(f.sphere.k).toBe(1);
      expect(f.title).toBe(0);
      expect(f.button).toBe(0);
      expect(f.content).toBe(0);
      expect(f.live).toBe(0);
    }
    // El disco en reposo cabe en la vista.
    expect(2 * rhoOf(geo) * last.sphere.zoom).toBeLessThanOrEqual(Math.min(vp.width, vp.height));
  });

  it('actos 1 y 2: gira despacio y las nubes giran más deprisa que el suelo', () => {
    const a = at(vp, 'pause', 0, 1000);
    const b = at(vp, 'pause', 0, 2000);
    const ground = b.sphere.front.x - a.sphere.front.x;
    const clouds = b.cloudLon - a.cloudLon;
    expect(ground).toBeCloseTo(spinAt(CFG, 1000), 9);
    expect(ground).toBeGreaterThan(0);
    expect(clouds / ground).toBeCloseTo(CFG.clouds.speed, 9);
    expect(CFG.clouds.speed).toBeGreaterThan(1);
  });

  it('acto 2: la pausa no avanza sola; título y botón entran y se quedan', () => {
    for (const t of [0, 1000, 60_000, 3_600_000]) {
      const f = at(vp, 'pause', t, t);
      expect(f.act).toBe('pause');
      expect(f.done).toBe(false);
      expect(f.content).toBe(0);
      expect(f.sphere.k).toBe(1);
    }
    expect(at(vp, 'pause', 0).title).toBe(0);
    expect(at(vp, 'pause', CFG.pause.uiInMs).title).toBe(1);
    expect(at(vp, 'pause', CFG.pause.uiInMs).button).toBe(1);
  });

  it('acto 3: k baja de 1 a 0 sin retroceder y el zoom sólo acerca', () => {
    const ts = steps(CFG.landing.durationMs, 120);
    const frames = ts.map((t) => at(vp, 'landing', t, 12_345));
    expect(frames[0]!.sphere.k).toBe(1);
    expect(frames.at(-1)!.sphere.k).toBe(0);
    for (let i = 1; i < frames.length; i++) {
      const [prev, f] = [frames[i - 1]!, frames[i]!];
      expect(f.sphere.k).toBeLessThanOrEqual(prev.sphere.k);
      expect(f.sphere.zoom).toBeGreaterThanOrEqual(prev.sphere.zoom - 1e-9);
      // A 60 fps ningún fotograma acerca más de un 3 %: sin túnel de zoom.
      expect(f.sphere.zoom / prev.sphere.zoom).toBeLessThan(1.03);
    }
  });

  it('el último fotograma es exactamente el encuadre de la landing (REQ-ENT-014)', () => {
    const f = at(vp, 'landing', CFG.landing.durationMs, 777);
    const cam = landingCamera(CFG, geo, vp);
    const framing = pickFraming(CFG, vp.width);
    expect(f.done).toBe(true);
    expect(f.camera).toEqual(cam);
    expect(cam.zoom).toBe(framing.zoom);
    expect({ x: cam.ax, y: cam.ay }).toEqual(landingAnchor(CFG, vp));
    expect({ x: cam.x, y: cam.y }).toEqual(geo.landing);
    expect(f.live).toBe(1);
    expect(f.planet).toBe(0);
    expect(f.content).toBe(1);
    expect(f.title + f.button + f.clouds).toBe(0);
    // Y es el mismo que el de una visita directa: nada salta al terminar.
    expect(frameAt(CFG, geo, vp, { act: 'landed', t: 0, spinMs: 0 }, 'direct')).toEqual({
      ...f,
      t: 0,
    });
    // El fotograma de justo antes ya está ahí (a medio píxel): sin salto final.
    const before = at(vp, 'landing', CFG.landing.durationMs - 1, 777);
    expect(Math.abs(before.camera.ax - cam.ax)).toBeLessThan(0.5);
    expect(Math.abs(before.camera.ay - cam.ay)).toBeLessThan(0.5);
    expect(before.camera.zoom / cam.zoom).toBeCloseTo(1, 4);
  });

  it('el mundo vivo entra cuando la esfera ya coincide con el plano (< 0,5 px)', () => {
    const t = CFG.landing.live[0] * CFG.landing.durationMs;
    const f = at(vp, 'landing', t, 4321);
    expect(f.live).toBe(0);
    const flat = { ...f.sphere, flat: true, k: 0 };
    for (const [sx, sy] of [
      [0, 0],
      [-vp.width / 2, -vp.height / 3],
      [vp.width / 2, vp.height / 2],
    ] as const) {
      const s = { x: sx, y: sy };
      const onSphere = worldPointAt(geo, f.sphere, s)!;
      const onPlane = worldPointAt(geo, flat, s)!;
      const px = Math.hypot(onSphere.x - onPlane.x, onSphere.y - onPlane.y) * f.sphere.zoom;
      expect(px).toBeLessThan(0.5);
    }
  });

  it('título y botón se van al empezar el aterrizaje; la landing sólo entra al final', () => {
    const L = CFG.landing;
    for (const t of steps(L.durationMs, 60)) {
      const f = at(vp, 'landing', t);
      const e = t / L.durationMs;
      if (e >= L.uiOut[1]) expect(f.title + f.button).toBe(0);
      if (e < L.content[0]) expect(f.content).toBe(0);
      if (e >= L.cloudsOut[1]) expect(f.clouds).toBe(0);
    }
  });

  it('movimiento reducido: mini-mundo quieto, título y botón; al pulsar, fundido sin mover la cámara (REQ-ENT-010)', () => {
    const r = (act: IntroAct, t: number) =>
      frameAt(CFG, geo, vp, { act, t, spinMs: 99_999 }, 'reduced');
    const frames = [
      r('pause', 0),
      r('pause', 5000),
      ...steps(CFG.reduced.fadeMs, 10).map((t) => r('landing', t)),
    ];
    for (let i = 1; i < frames.length; i++) {
      expect(viewMoved(frames[i - 1]!, frames[i]!)).toBe(false);
    }
    expect(samePose(frames[0]!.sphere, frames[1]!.sphere)).toBe(true);
    expect(frames[1]!.title).toBe(1);
    expect(frames[1]!.content).toBe(0);
    const end = frames.at(-1)!;
    expect(end.done).toBe(true);
    expect(sameCamera(end.camera, landingCamera(CFG, geo, vp))).toBe(true);
    expect(r('landing', CFG.reduced.fadeMs / 2).content).toBeCloseTo(0.5, 9);
  });
});

it('los tiempos salen de la configuración: un aterrizaje el doble de largo va a la mitad', () => {
  const vp = VIEWPORTS[0]!;
  const slow = { ...CFG, landing: { ...CFG.landing, durationMs: CFG.landing.durationMs * 2 } };
  const a = frameAt(CFG, geo, vp, { act: 'landing', t: 500, spinMs: 0 }, 'intro');
  const b = frameAt(slow, geo, vp, { act: 'landing', t: 1000, spinMs: 0 }, 'intro');
  expect(b.sphere.k).toBeCloseTo(a.sphere.k, 12);
  expect(b.sphere.zoom).toBeCloseTo(a.sphere.zoom, 12);
});
