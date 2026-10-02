import { pickFraming, type IntroConfig } from './config';
import { clamp01, ramp, type Viewport } from './math';
import { portCamera, revealCamera, type PortReveal } from './port';
import {
  appearPose,
  landingAnchor,
  landingPose,
  spinAt,
  type IntroGeometry,
  type SpherePose,
} from './sphere';

/**
 * Línea de tiempo de la entrada «mini-mundo»: función pura de
 * (configuración, geometría, vista, estado) → fotograma. No sabe de Pixi ni
 * del DOM; la escena sólo pinta lo que dice el fotograma. Así el último
 * fotograma se puede comparar con el encuadre de la landing (REQ-ENT-014) y
 * la variante reducida se puede probar sin navegador (REQ-ENT-010).
 *
 * Actos (D-19, REQ-ENT-006): aparición (el mini-mundo sube, crece y gira),
 * pausa (sigue girando; título y botón; no avanza sola), aterrizaje (gira
 * hasta el punto, acerca y aplana k 1 → 0; el mundo vivo toma el relevo y la
 * landing entra encima) y llegada.
 */

export type IntroMode = 'intro' | 'reduced' | 'direct';
export type IntroAct = 'appear' | 'pause' | 'landing' | 'landed' | 'explore';

/** Dónde va la entrada: lo lleva el controlador, la línea de tiempo sólo lo lee. */
export interface TimelineState {
  act: IntroAct;
  /** ms dentro del acto. */
  t: number;
  /** ms de giro acumulados (actos 1 y 2); en el aterrizaje, los que había al pulsar. */
  spinMs: number;
}

/** El punto de mundo (x, y) se pinta en el punto de pantalla (ax, ay), con `zoom` px por px de mundo. */
export interface Camera {
  x: number;
  y: number;
  zoom: number;
  ax: number;
  ay: number;
}

export interface IntroFrame {
  act: IntroAct;
  /** ms dentro del acto, recortados a su duración. */
  t: number;
  /** Pose de la esfera (mini-mundo). */
  sphere: SpherePose;
  /** Opacidad de la esfera. */
  planet: number;
  /** Opacidad y longitud (rad) de la capa de nubes. */
  clouds: number;
  cloudLon: number;
  /** Opacidad del mundo vivo (el del juego) encima de la esfera. */
  live: number;
  /** Cámara del mundo vivo: la misma que la esfera ya plana. */
  camera: Camera;
  /** Título «BOIA» y botón de entrar (HTML). */
  title: number;
  button: number;
  /** Contenido de la landing (HTML). */
  content: number;
  /** Llegó: la cámara está en el encuadre de la landing. */
  done: boolean;
}

/** Encuadre de la landing: el punto de aterrizaje en el ancla del dispositivo. */
export function landingCamera(cfg: IntroConfig, geo: IntroGeometry, vp: Viewport): Camera {
  const f = pickFraming(cfg, vp.width);
  const a = landingAnchor(cfg, vp);
  return { x: geo.landing.x, y: geo.landing.y, zoom: f.zoom, ax: a.x, ay: a.y };
}

function finalFrame(cfg: IntroConfig, geo: IntroGeometry, vp: Viewport, t: number): IntroFrame {
  return {
    act: 'landed',
    t,
    sphere: landingPose(cfg, geo, vp, 1, 0),
    planet: 0,
    clouds: 0,
    cloudLon: 0,
    live: 1,
    camera: landingCamera(cfg, geo, vp),
    title: 0,
    button: 0,
    content: 1,
    done: true,
  };
}

/** Duración del acto (el reposo no tiene: dura hasta que se pulsa). */
export function actDuration(cfg: IntroConfig, act: IntroAct, mode: IntroMode): number {
  if (act === 'appear') return mode === 'intro' ? cfg.appear.durationMs : 0;
  if (act === 'landing') return mode === 'intro' ? cfg.landing.durationMs : cfg.reduced.fadeMs;
  if (act === 'pause') return Infinity;
  return 0;
}

export function frameAt(
  cfg: IntroConfig,
  geo: IntroGeometry,
  vp: Viewport,
  s: TimelineState,
  mode: IntroMode,
): IntroFrame {
  if (mode === 'direct' || s.act === 'landed') return finalFrame(cfg, geo, vp, 0);
  const uiIn = cfg.pause.uiInMs > 0 ? clamp01(s.t / cfg.pause.uiInMs) : 1;
  const ui = uiIn * uiIn * (3 - 2 * uiIn);
  const landed = landingCamera(cfg, geo, vp);

  if (mode === 'reduced') {
    // Mini-mundo quieto (sin subir ni girar), título y botón; al pulsar, un
    // fundido corto a la llegada. Ni la esfera ni el mundo vivo se mueven.
    const sphere = appearPose(cfg, geo, vp, 1, 0);
    const base = {
      sphere,
      planet: 1,
      clouds: cfg.clouds.opacity,
      cloudLon: 0,
      live: 0,
      camera: landed,
      done: false,
    };
    if (s.act !== 'landing') {
      return { ...base, act: 'pause', t: s.t, title: ui, button: ui, content: 0 };
    }
    const fade = cfg.reduced.fadeMs;
    const t = Math.max(0, Math.min(s.t, fade));
    if (t >= fade) return finalFrame(cfg, geo, vp, t);
    const u = fade > 0 ? t / fade : 1;
    return {
      ...base,
      act: 'landing',
      t,
      planet: 1,
      clouds: cfg.clouds.opacity * (1 - u),
      live: u,
      title: 1 - u,
      button: 1 - u,
      content: u,
    };
  }

  if (s.act === 'appear' || s.act === 'pause') {
    const spin = spinAt(cfg, s.spinMs);
    const appear = s.act === 'appear';
    const e = appear ? clamp01(s.t / cfg.appear.durationMs) : 1;
    return {
      act: s.act,
      t: appear ? Math.min(s.t, cfg.appear.durationMs) : s.t,
      sphere: appearPose(cfg, geo, vp, e, spin),
      planet: 1,
      clouds: cfg.clouds.opacity,
      cloudLon: spin * cfg.clouds.speed,
      live: 0,
      camera: landed,
      title: appear ? 0 : ui,
      button: appear ? 0 : ui,
      content: 0,
      done: false,
    };
  }

  // Aterrizaje.
  const dur = cfg.landing.durationMs;
  const t = Math.max(0, Math.min(s.t, dur));
  if (t >= dur) return finalFrame(cfg, geo, vp, t);
  const e = t / dur;
  const L = cfg.landing;
  const spin0 = spinAt(cfg, s.spinMs);
  const sphere = landingPose(cfg, geo, vp, e, spin0);
  const live = ramp(e, L.live);
  const out = 1 - ramp(e, L.uiOut);
  return {
    act: 'landing',
    t,
    sphere,
    planet: live < 1 ? 1 : 0,
    clouds: cfg.clouds.opacity * (1 - ramp(e, L.cloudsOut)),
    // Las nubes siguen al suelo, con la deriva que llevaban al pulsar.
    cloudLon: sphere.front.x + spin0 * (cfg.clouds.speed - 1),
    live,
    camera: {
      x: geo.landing.x,
      y: geo.landing.y,
      zoom: sphere.zoom,
      ax: sphere.center.x,
      ay: sphere.center.y,
    },
    title: out,
    button: out,
    content: ramp(e, L.content),
    done: false,
  };
}

/** Tramo del alejamiento en el que se aparta la landing (su HTML). */
export const EXPLORE_CONTENT_OUT = [0, 0.3] as const;

/**
 * EXPLORAR (T28, D-20 punto 6): desde el encuadre de llegada, la cámara se
 * aleja un poco hasta el encuadre del puerto, el del juego al empezar, con
 * el barco en la salida. La landing se aparta al principio; el mundo vivo
 * sigue igual. `game` es la vista del juego (la ventana) si no es la escena.
 */
export function exploreFrame(
  cfg: IntroConfig,
  geo: IntroGeometry,
  reveal: PortReveal,
  vp: Viewport,
  t: number,
  game: Viewport = vp,
): IntroFrame {
  const base = finalFrame(cfg, geo, vp, 0);
  const dur = reveal.durationMs;
  const time = Math.max(0, Math.min(t, dur));
  const e = dur > 0 ? time / dur : 1;
  return {
    ...base,
    act: 'explore',
    t: time,
    camera: revealCamera(base.camera, portCamera(reveal, game), vp, e, reveal.easing),
    content: 1 - ramp(e, EXPLORE_CONTENT_OUT),
    done: e >= 1,
  };
}

/** Dos cámaras son iguales (a medio píxel de pantalla). */
export function sameCamera(a: Camera, b: Camera): boolean {
  return (
    Math.abs(a.zoom - b.zoom) < 1e-6 &&
    Math.abs(a.ax - b.ax) < 0.5 &&
    Math.abs(a.ay - b.ay) < 0.5 &&
    Math.abs((a.x - b.x) * a.zoom) < 0.5 &&
    Math.abs((a.y - b.y) * a.zoom) < 0.5
  );
}

/** Dos poses de la esfera son iguales (a medio píxel y a una milésima de radián). */
export function samePose(a: SpherePose, b: SpherePose): boolean {
  return (
    Math.abs(a.k - b.k) < 1e-6 &&
    Math.abs(a.zoom - b.zoom) < 1e-6 &&
    Math.abs(a.center.x - b.center.x) < 0.5 &&
    Math.abs(a.center.y - b.center.y) < 0.5 &&
    Math.abs(a.front.x - b.front.x) < 1e-3 &&
    Math.abs(a.front.y - b.front.y) < 1e-3
  );
}

/**
 * La vista cambió entre dos fotogramas: se movió la esfera visible o la
 * cámara del mundo visible (sirve para contar movimientos de cámara).
 */
export function viewMoved(a: IntroFrame, b: IntroFrame): boolean {
  // Una capa que entra o sale fundiéndose no es un movimiento de cámara.
  if (a.planet > 0 && b.planet > 0 && !samePose(a.sphere, b.sphere)) return true;
  if (a.live > 0 && b.live > 0 && !sameCamera(a.camera, b.camera)) return true;
  return false;
}
