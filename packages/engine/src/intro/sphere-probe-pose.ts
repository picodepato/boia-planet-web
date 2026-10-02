/**
 * PRUEBA DE TÉCNICA (T13, opción A de docs/propuestas/2026-09-28-intro-mini-mundo.md).
 * Calidad de usar y tirar: sirve para medir fps y decidir A/B, no es la
 * entrada. La entrada de verdad (T14) reescribirá esto en la línea de tiempo.
 *
 * Pose pura (sin Pixi) de la esfera falsa: el mundo real pintado en una
 * textura se proyecta en un disco como si fuera un planeta. `k` es la
 * curvatura (1 = esfera de radio `rho`, 0 = plano): la esfera tiene radio
 * `rho / k`, así que al bajar `k` a 0 la proyección tiende al isométrico
 * plano del juego sin corte. Unidades de mundo = px de pantalla del juego a
 * zoom 1 (`worldToScreen`).
 */

import { type WorldConfig, worldToScreen } from '@boia/world';
import { DEFAULT_INTRO_CONFIG, pickFraming } from './config';

export interface Vec2Like {
  x: number;
  y: number;
}

export interface SphereProbeParams {
  /** Centro de la región del mundo pintada en la textura (px de mundo). */
  texCenter: Vec2Like;
  /** Tamaño de la región pintada (px de mundo); ancho = 2·alto (equirectangular). */
  texSize: Vec2Like;
  /** Punto de aterrizaje (px de mundo). muestra: la isla de evento, como T03. */
  landing: Vec2Like;
  /** Inclinación de la esfera en reposo (rad): se ve un poco desde arriba. */
  idleLat: number;
  /** Segundos por vuelta del giro lento. */
  spinPeriodS: number;
  /** Diámetro del disco a k = 1 como fracción del lado corto de la vista. */
  fit: number;
  /** Centro del disco en reposo, fracciones de la vista. */
  idleAnchor: readonly [number, number];
  /** Encuadre de llegada: zoom y punto de la vista donde cae el aterrizaje. */
  framing: { zoom: number; anchor: readonly [number, number] };
  /** Parte del aterrizaje (0..1) en la que el planeta termina de girar hasta el punto. */
  turnShare: number;
  /** Tramo final del aterrizaje (0..1) en el que entra el mundo vivo encima. */
  liveFrom: number;
}

export interface SpherePose {
  /** Curvatura: 1 esfera, 0 plano. */
  k: number;
  /** px CSS por px de mundo. */
  zoom: number;
  /** Punto de la vista (px CSS) donde se pinta el punto delantero de la esfera. */
  center: Vec2Like;
  /** Longitud y latitud (rad) del punto delantero, relativas a `texCenter`. */
  front: Vec2Like;
  /** Opacidad del mundo vivo encima de la esfera (0 salvo al final). */
  liveAlpha: number;
  /** Plano exacto: `k` = 0, la proyección es la cámara del juego. */
  flat: boolean;
}

export interface View {
  width: number;
  height: number;
}

/** Radio de la esfera a k = 1: una vuelta = el ancho de la textura. */
export const rhoOf = (p: SphereProbeParams) => p.texSize.x / (2 * Math.PI);

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const wrapPi = (a: number) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));

/** Zoom con el que el disco (k = 1) mide `fit` del lado corto. */
export function idleZoom(p: SphereProbeParams, v: View): number {
  return (p.fit * Math.min(v.width, v.height)) / 2 / rhoOf(p);
}

/** Longitud del giro lento a los `t` segundos. */
export function spinAt(p: SphereProbeParams, t: number): number {
  return wrapPi((2 * Math.PI * t) / p.spinPeriodS);
}

/**
 * Acto 1: el mini-mundo sube desde abajo y crece hasta su tamaño. `e` en 0..1;
 * a partir de 1 es la pose de reposo (actos 1 y 2) con el giro `spin`.
 */
export function appearPose(p: SphereProbeParams, v: View, e: number, spin: number): SpherePose {
  const a = easeInOutCubic(clamp01(e));
  const z0 = idleZoom(p, v);
  return {
    k: 1,
    zoom: z0 * (0.35 + 0.65 * a),
    center: {
      x: v.width * p.idleAnchor[0],
      y: v.height * p.idleAnchor[1] + (1 - a) * v.height * 0.75,
    },
    front: { x: spin, y: p.idleLat },
    liveAlpha: 0,
    flat: false,
  };
}

/** Curvatura del aterrizaje en función del progreso `e` (0..1): 1 → 0, sin retroceder. */
export function landingK(e: number): number {
  const a = easeInOutCubic(clamp01(e));
  return (1 - a) * (1 - a);
}

/**
 * Acto 3: aterrizaje. El planeta gira hasta dejar el punto de aterrizaje
 * delante (en `turnShare`), el zoom sube hacia el encuadre de llegada y `k`
 * baja de 1 a 0 a la vez. En e = 1 la pose es la cámara plana del juego con
 * el aterrizaje en `framing.anchor`.
 */
export function landingPose(
  p: SphereProbeParams,
  v: View,
  e: number,
  spinAtStart: number,
): SpherePose {
  const t = clamp01(e);
  const a = easeInOutCubic(t);
  const k = landingK(t);
  const rho = rhoOf(p);
  const z0 = idleZoom(p, v);
  const zoom = z0 * Math.pow(p.framing.zoom / z0, a);
  const center = {
    x: v.width * (p.idleAnchor[0] + (p.framing.anchor[0] - p.idleAnchor[0]) * a),
    y: v.height * (p.idleAnchor[1] + (p.framing.anchor[1] - p.idleAnchor[1]) * a),
  };
  // Ángulos del aterrizaje a la curvatura actual: (L − C)·k/rho → 0 con k.
  const target = {
    x: ((p.landing.x - p.texCenter.x) * k) / rho,
    y: ((p.landing.y - p.texCenter.y) * k) / rho,
  };
  const turn = easeInOutCubic(clamp01(t / p.turnShare));
  // El giro de partida, por el camino corto hasta el objetivo.
  const lon0 = target.x + wrapPi(spinAtStart - target.x);
  const front = {
    x: lon0 + (target.x - lon0) * turn,
    y: p.idleLat + (target.y - p.idleLat) * turn,
  };
  return {
    k,
    zoom,
    center,
    front,
    liveAlpha: smoothstep(p.liveFrom, 1, t),
    flat: k < 1e-4,
  };
}

/** Progreso del aterrizaje en el que la curvatura vale `k` (para capturas). */
export function landingProgressForK(k: number): number {
  const target = 1 - Math.sqrt(clamp01(k));
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (easeInOutCubic(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Lo mismo que hace el shader, en CPU: qué punto del mundo (px de mundo) se
 * ve en el píxel `s` (px CSS relativos a `center`), o `null` fuera del disco.
 * Sirve para probar que en k = 0 la proyección es la cámara plana.
 */
export function worldPointAt(p: SphereProbeParams, pose: SpherePose, s: Vec2Like) {
  const w = { x: s.x / pose.zoom, y: s.y / pose.zoom };
  if (pose.flat) return { x: p.landing.x + w.x, y: p.landing.y + w.y };
  const R = rhoOf(p) / pose.k;
  const q = { x: w.x / R, y: w.y / R };
  const r2 = q.x * q.x + q.y * q.y;
  if (r2 >= 1) return null;
  const z = Math.sqrt(1 - r2);
  const cl = Math.cos(pose.front.y);
  const sl = Math.sin(pose.front.y);
  const g = { x: q.x, y: q.y * cl + z * sl, z: -q.y * sl + z * cl };
  const lon = pose.front.x + Math.atan2(g.x, g.z);
  const lat = Math.asin(Math.max(-1, Math.min(1, g.y)));
  return { x: p.texCenter.x + lon * R, y: p.texCenter.y + lat * R };
}

/**
 * Parámetros de la prueba para un mundo: la textura cubre el mundo entero
 * (más tierra a los lados) en proporción 2:1, centrada en el mundo; el
 * aterrizaje es el primer objeto con entradas (la isla de evento) y el
 * encuadre de llegada es el de T03 para ese ancho de vista. Todo `muestra`.
 */
export function sphereProbeParams(world: WorldConfig, viewWidth: number): SphereProbeParams {
  const b = world.bounds;
  const top = worldToScreen({ x: b.left, y: b.top });
  const bottom = worldToScreen({ x: b.right, y: b.bottom });
  const height = bottom.y - top.y;
  const island = world.objects.find((o) => o.behaviors.some((x) => x.type === 'ticket'));
  const landing = island
    ? worldToScreen(island.position)
    : { x: (top.x + bottom.x) / 2, y: (top.y + bottom.y) / 2 };
  const framing = pickFraming(DEFAULT_INTRO_CONFIG, viewWidth);
  return {
    texCenter: { x: (b.left + b.right) / 2, y: (top.y + bottom.y) / 2 },
    texSize: { x: 2 * height, y: height },
    landing,
    idleLat: 0.28,
    spinPeriodS: 24,
    fit: 0.62,
    idleAnchor: [0.5, 0.5],
    framing: { zoom: framing.zoom, anchor: framing.anchor },
    turnShare: 0.55,
    liveFrom: 0.86,
  };
}
