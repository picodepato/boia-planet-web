import { EASING_FNS, clamp01, type Vec2Like, type Viewport } from './math';
import { pickFraming, type IntroConfig } from './config';

/**
 * Esfera falsa del mini-mundo (opción A de T13, D-19), en puro: el mundo real
 * pintado en una textura se proyecta en un disco como si fuera un planeta.
 * `k` es la curvatura (1 = esfera de radio `rho`, 0 = plano): la esfera
 * tiene radio `rho / k`, así que al bajar `k` a 0 la proyección tiende al
 * isométrico plano del juego sin corte. Unidades de mundo = px de pantalla
 * del juego a zoom 1 (`worldToScreen`).
 *
 * La escena Pixi hace lo mismo en un shader; `worldPointAt` es su copia en
 * CPU para las pruebas.
 */

/**
 * Lo que la esfera necesita del mundo, en px de juego a zoom 1. Lo calcula la
 * web al construir la página (sin cargar el mundo en la ruta crítica).
 */
export interface IntroGeometry {
  /** px de pantalla por px de arte a escala de juego (ilustración ligera). */
  artScale: number;
  /** Centro de la región del mundo pintada en la textura. */
  texCenter: Vec2Like;
  /**
   * Tamaño de la región pintada: `x` es una vuelta entera al planeta; `y`
   * incluye el mar de relleno arriba y abajo (más allá de los polos, con
   * k < 1, se ve mar y no el borde opuesto del mundo).
   */
  texSize: Vec2Like;
  /** Alto del mundo sin relleno: a k = 1 la esfera muestra justo esto de polo a polo. */
  worldHeight: number;
  /** Punto de aterrizaje. */
  landing: Vec2Like;
}

/** Mar de relleno por encima y por debajo del mundo, fracción de su alto. */
export const SEA_PAD = 0.25;

/**
 * Geometría de la esfera a partir de la caja del mundo en pantalla (px de
 * juego) y del punto de aterrizaje ya proyectado. La vuelta al planeta mide
 * dos altos del mundo (textura equirectangular 2:1, como la prueba de T13).
 */
export function introGeometry(input: {
  artScale: number;
  /** Caja del mundo en px de juego a zoom 1. */
  box: { left: number; right: number; top: number; bottom: number };
  landing: Vec2Like;
}): IntroGeometry {
  const { box } = input;
  const height = box.bottom - box.top;
  return {
    artScale: input.artScale,
    texCenter: { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 },
    texSize: { x: 2 * height, y: height * (1 + 2 * SEA_PAD) },
    worldHeight: height,
    landing: { x: input.landing.x, y: input.landing.y },
  };
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
  /** Plano exacto: `k` = 0, la proyección es la cámara del juego. */
  flat: boolean;
}

/** Radio de la esfera a k = 1: una vuelta = el ancho de la textura. */
export const rhoOf = (g: IntroGeometry) => g.texSize.x / (2 * Math.PI);

const wrapPi = (a: number) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));

/** Zoom con el que el disco (k = 1) mide `planetFit` del lado corto. */
export function idleZoom(cfg: IntroConfig, g: IntroGeometry, v: Viewport): number {
  const f = pickFraming(cfg, v.width);
  return (f.planetFit * Math.min(v.width, v.height)) / 2 / rhoOf(g);
}

/** Longitud del giro lento tras `ms` de giro (actos 1 y 2). */
export function spinAt(cfg: IntroConfig, ms: number): number {
  return wrapPi((2 * Math.PI * ms) / 1000 / cfg.spin.periodS);
}

const tiltOf = (cfg: IntroConfig) => (cfg.spin.tiltDeg * Math.PI) / 180;

/**
 * Actos 1 y 2: el mini-mundo sube desde abajo y crece hasta su tamaño. `e`
 * en 0..1; en 1 es la pose de reposo, con el giro `spin`.
 */
export function appearPose(
  cfg: IntroConfig,
  g: IntroGeometry,
  v: Viewport,
  e: number,
  spin: number,
): SpherePose {
  const a = EASING_FNS[cfg.appear.easing](clamp01(e));
  const f = pickFraming(cfg, v.width);
  const z0 = idleZoom(cfg, g, v);
  return {
    k: 1,
    zoom: z0 * (cfg.appear.growFrom + (1 - cfg.appear.growFrom) * a),
    center: {
      x: v.width * f.planetAnchor[0],
      y: v.height * f.planetAnchor[1] + (1 - a) * v.height * cfg.appear.riseFrom,
    },
    front: { x: spin, y: tiltOf(cfg) },
    flat: false,
  };
}

/** Curvatura del aterrizaje en función del progreso `e` (0..1): 1 → 0, sin retroceder. */
export function landingK(cfg: IntroConfig, e: number): number {
  const a = EASING_FNS[cfg.landing.easing](clamp01(e));
  return (1 - a) * (1 - a);
}

/** Punto de la vista (px CSS, enteros) donde queda el punto de aterrizaje al llegar. */
export function landingAnchor(cfg: IntroConfig, v: Viewport): Vec2Like {
  const f = pickFraming(cfg, v.width);
  return { x: Math.round(f.anchor[0] * v.width), y: Math.round(f.anchor[1] * v.height) };
}

/**
 * Acto 3: el mini-mundo gira hasta dejar el punto de aterrizaje delante (en
 * `turnShare`), el zoom sube hacia el encuadre de llegada y `k` baja de 1 a 0
 * a la vez. En e = 1 la pose es la cámara plana del juego con el aterrizaje
 * en el ancla del encuadre.
 */
export function landingPose(
  cfg: IntroConfig,
  g: IntroGeometry,
  v: Viewport,
  e: number,
  spinAtStart: number,
): SpherePose {
  const t = clamp01(e);
  const ease = EASING_FNS[cfg.landing.easing];
  const a = ease(t);
  const k = landingK(cfg, t);
  const rho = rhoOf(g);
  const f = pickFraming(cfg, v.width);
  const z0 = idleZoom(cfg, g, v);
  const zoom = t >= 1 ? f.zoom : z0 * Math.pow(f.zoom / z0, a);
  const from = { x: v.width * f.planetAnchor[0], y: v.height * f.planetAnchor[1] };
  const to = landingAnchor(cfg, v);
  const center = t >= 1 ? to : { x: from.x + (to.x - from.x) * a, y: from.y + (to.y - from.y) * a };
  // Ángulos del aterrizaje a la curvatura actual: (L − C)·k/rho → 0 con k.
  const target = {
    x: ((g.landing.x - g.texCenter.x) * k) / rho,
    y: ((g.landing.y - g.texCenter.y) * k) / rho,
  };
  const turn = ease(clamp01(t / cfg.landing.turnShare));
  // El giro de partida, por el camino corto hasta el objetivo.
  const lon0 = target.x + wrapPi(spinAtStart - target.x);
  const tilt = tiltOf(cfg);
  return {
    k,
    zoom,
    center,
    front: { x: lon0 + (target.x - lon0) * turn, y: tilt + (target.y - tilt) * turn },
    flat: k < 1e-4,
  };
}

/**
 * Lo mismo que hace el shader, en CPU: qué punto del mundo (px de mundo) se
 * ve en el píxel `s` (px CSS relativos a `center`), o `null` fuera del disco.
 */
export function worldPointAt(g: IntroGeometry, pose: SpherePose, s: Vec2Like): Vec2Like | null {
  const w = { x: s.x / pose.zoom, y: s.y / pose.zoom };
  if (pose.flat) return { x: g.landing.x + w.x, y: g.landing.y + w.y };
  const R = rhoOf(g) / pose.k;
  const q = { x: w.x / R, y: w.y / R };
  const r2 = q.x * q.x + q.y * q.y;
  if (r2 >= 1) return null;
  const z = Math.sqrt(1 - r2);
  const cl = Math.cos(pose.front.y);
  const sl = Math.sin(pose.front.y);
  const gy = q.y * cl + z * sl;
  const gz = -q.y * sl + z * cl;
  const lon = pose.front.x + Math.atan2(q.x, gz);
  const lat = Math.asin(Math.max(-1, Math.min(1, gy)));
  return { x: g.texCenter.x + lon * R, y: g.texCenter.y + lat * R };
}
