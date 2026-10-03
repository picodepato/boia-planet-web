import {
  DEFAULT_INTRO_COPY,
  DEFAULT_TITLE_MOTION,
  EASINGS,
  type Easing,
  type Span,
  type TitleMotion,
  titleMotionErrors,
} from './config';
import { EASING_FNS, clamp01, ramp, type Viewport } from './math';

/**
 * Entrada 3D con el planeta de `/mar` (T57, plan 005; D-19, D-21). Código
 * puro: configuración versionada (REQ-ENT-015) y línea de tiempo
 * (configuración, vista, estado) → fotograma. La escena three.js, que se carga
 * bajo demanda, sólo pinta lo que dice el fotograma; así la variante reducida
 * y el último fotograma se prueban sin navegador.
 *
 * Plan 007 (T79): the landing is one continuous scroll. Acts:
 * 0. loading, only when it takes a while; the budget counts from the mount
 *    and only with the tab in view;
 * 1. appearance: the planet rises, grows and spins;
 * 2. rest (`pause`): the planet spins, «BOIA», «Zarpar», «Entradas» and the
 *    scroll hint are on screen. Nothing advances on its own. From here the
 *    page scrolls and the scroll position `s` (in viewport heights) drives
 *    the frame (`scrollFrame`): the dive of «Zarpar» scrubbed by `s`, then
 *    the sea rig fades in over the planet;
 * 3. «Zarpar» (T64, D-24): the timed dive into the port of `/mar`; the veil
 *    covers the view and the game opens.
 *
 * Units: times in ms; poses as fractions of the view (`fit`: planet
 * diameter as a multiple of the short side; `anchor`: centre, fractions of
 * width and height, may fall outside the view); angles in degrees; `s` in
 * viewport heights of scroll.
 */

export const PLANET_INTRO_VERSION = 6 as const;

export type IntroMode = 'intro' | 'reduced' | 'direct';
export type IntroAct = 'appear' | 'pause' | 'landing' | 'landed';

export interface PlanetPoseSpec {
  /** Diámetro del planeta como múltiplo del lado corto de la vista. */
  fit: number;
  /** Centro del planeta, fracciones de la vista (puede caer fuera: el horizonte). */
  anchor: readonly [number, number];
  /** Cuánto se inclina el polo norte hacia la cámara, grados. */
  tiltDeg: number;
}

export interface PlanetFraming {
  /** Se usa a partir de este ancho de vista (px CSS). */
  minWidth: number;
  /** The planet at rest (acts 1 and 2), where the CSS planet sits before the scene. */
  intro: PlanetPoseSpec;
  /** «BOIA» and the pills row: vertical centre, fraction of the height. */
  titleY: number;
  buttonY: number;
}

/** Scroll scrub of the hero (plan 007): spans in viewport heights of scroll. */
export interface ScrollSpec {
  /** The hero UI (title, pills, hint, corner labels) fades out. */
  uiOut: Span;
  /** The dive of «Zarpar», scrubbed: start and end of the camera path. */
  dive: readonly [number, number];
  /** The sea rig fades in over the planet (crossfade). */
  sea: readonly [number, number];
  /** The golden haze that hides the cut: rises, peaks, falls. */
  haze: readonly [number, number, number];
}

export interface PlanetIntroConfig {
  version: typeof PLANET_INTRO_VERSION;
  id: string;
  status: 'muestra' | 'aprobada';
  copy: {
    title: string;
    /** Botón de entrar. muestra: lo aprueba Álvaro (D-19, P9). */
    enter: string;
    loading: string;
  };
  /**
   * Plazo para tener la escena lista (three.js, el planeta y su primer
   * fotograma), contado desde el montaje y sólo con la pestaña visible. Si
   * se pasa, la versión estática.
   */
  loadBudgetMs: number;
  /**
   * Red de seguridad del script de arranque si la app nunca llega a montar la
   * escena (JavaScript roto o bloqueado), contada sólo con la pestaña visible.
   */
  bootCapMs: number;
  /** Acto 0: «Cargando» sólo si la carga pasa de este tiempo. */
  loading: { showAfterMs: number };
  /** Acto 1. */
  appear: {
    durationMs: number;
    easing: Easing;
    /** Sube desde tantas alturas de vista por debajo de su sitio. */
    riseFrom: number;
    /** Tamaño inicial como fracción del final. */
    growFrom: number;
  };
  /** Giro del planeta: segundos por vuelta. */
  spin: { periodS: number };
  /** Rest: the title and the hint fade in (no automatic advance, plan 007). */
  pause: { uiInMs: number };
  /**
   * Acto 3: «Zarpar» (T64): la zambullida hasta el puerto de salida de
   * `/mar`. El planeta gira hasta tener el puerto de cara y crece hasta
   * `diveFit`, con el puerto en `anchor`; el velo del mar cubre la vista en
   * el tramo `cover`. The same path is scrubbed by the scroll (`scroll.dive`).
   */
  landing: {
    durationMs: number;
    easing: Easing;
    /** Diámetro final del planeta como múltiplo del lado corto de la vista. */
    diveFit: number;
    /** Dónde queda el puerto al final, fracciones de la vista. */
    anchor: readonly [number, number];
    /** Tramo en el que se van título y botón. */
    uiOut: Span;
    /** Tramo en el que el velo del mar cubre la vista (acaba en 1). */
    cover: Span;
  };
  /** Static version (no scene): «Zarpar» is a fade to the veil of the sea. */
  reduced: { fadeMs: number; spinDeg: number };
  /** Nubes alrededor del planeta. */
  clouds: { count: number; seed: number; speed: number; lift: number };
  /** Islas sobre la esfera: tamaño respecto al mar de /mar y franja de latitudes del mapa. */
  islands: { scale: number; latTopDeg: number; latBottomDeg: number };
  framings: readonly PlanetFraming[];
  scroll: ScrollSpec;
  /** Movimiento del título 3D «BOIA» (T27). */
  title: TitleMotion;
}

/**
 * Configuración de muestra (T57; plan 007 T79: framings of T77 §5.1, the
 * scroll scrub of §7.2): todo `muestra` hasta verlo en móviles reales (D-19, P6).
 */
export const DEFAULT_PLANET_INTRO: PlanetIntroConfig = {
  version: PLANET_INTRO_VERSION,
  id: 'entrada-planeta-muestra-v6',
  status: 'muestra',
  copy: { ...DEFAULT_INTRO_COPY },
  loadBudgetMs: 9000,
  bootCapMs: 15000,
  loading: { showAfterMs: 250 },
  appear: { durationMs: 1400, easing: 'easeInOutCubic', riseFrom: 0.35, growFrom: 0.45 },
  spin: { periodS: 50 },
  pause: { uiInMs: 400 },
  landing: {
    durationMs: 1500,
    easing: 'easeInOutCubic',
    diveFit: 9,
    anchor: [0.5, 0.55],
    uiOut: [0, 0.15],
    cover: [0.72, 1],
  },
  reduced: { fadeMs: 400, spinDeg: 20 },
  clouds: { count: 9, seed: 7, speed: 1.6, lift: 0.16 },
  islands: { scale: 0.75, latTopDeg: 62, latBottomDeg: -38 },
  framings: [
    {
      minWidth: 0,
      intro: { fit: 0.78, anchor: [0.5, 0.47], tiltDeg: 22 },
      titleY: 0.14,
      buttonY: 0.74,
    },
    {
      minWidth: 600,
      intro: { fit: 0.62, anchor: [0.5, 0.47], tiltDeg: 22 },
      titleY: 0.13,
      buttonY: 0.8,
    },
    {
      minWidth: 900,
      intro: { fit: 0.62, anchor: [0.5, 0.47], tiltDeg: 22 },
      titleY: 0.12,
      buttonY: 0.84,
    },
  ],
  scroll: { uiOut: [0, 0.15], dive: [0, 0.92], sea: [0.84, 1], haze: [0.7, 0.88, 1.04] },
  title: DEFAULT_TITLE_MOTION,
};

export type PlanetConfigResult =
  { ok: true; config: PlanetIntroConfig } | { ok: false; error: string };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isFrac = (v: unknown): v is number => isNum(v) && v >= 0 && v <= 1;
const inRange = (v: unknown, lo: number, hi: number): v is number => isNum(v) && v >= lo && v <= hi;
const isSpan = (v: unknown): v is Span =>
  Array.isArray(v) && v.length === 2 && isFrac(v[0]) && isFrac(v[1]) && v[0] <= v[1];
/** Increasing numbers in [0, 2] (scroll positions in viewport heights). */
const isSteps = (v: unknown, n: number): boolean =>
  Array.isArray(v) &&
  v.length === n &&
  v.every((x, i) => inRange(x, 0, 2) && (i === 0 || x > (v[i - 1] as number)));
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isPose = (v: unknown): v is PlanetPoseSpec =>
  isObj(v) &&
  inRange(v.fit, 0.1, 8) &&
  Array.isArray(v.anchor) &&
  v.anchor.length === 2 &&
  inRange(v.anchor[0], -2, 3) &&
  inRange(v.anchor[1], -2, 4) &&
  inRange(v.tiltDeg, -90, 90);

/** Valida un documento de configuración de la entrada 3D, diciendo qué campo falla. */
export function validatePlanetIntro(input: unknown): PlanetConfigResult {
  const errors: string[] = [];
  const need = (cond: boolean, path: string, what: string) => {
    if (!cond) errors.push(`${path}: ${what}`);
  };
  const obj = (v: unknown, path: string): Obj => {
    if (isObj(v)) return v;
    errors.push(`${path}: objeto`);
    return {};
  };
  if (!isObj(input)) return { ok: false, error: 'la configuración no es un objeto' };
  const c = input;
  need(c.version === PLANET_INTRO_VERSION, 'version', `debe ser ${PLANET_INTRO_VERSION}`);
  need(isText(c.id), 'id', 'texto no vacío');
  need(c.status === 'muestra' || c.status === 'aprobada', 'status', 'muestra | aprobada');
  const copy = obj(c.copy, 'copy');
  for (const k of ['title', 'enter', 'loading'] as const) {
    need(isText(copy[k]), `copy.${k}`, 'texto no vacío');
  }
  need(inRange(c.loadBudgetMs, 1000, 30_000), 'loadBudgetMs', '1000–30000');
  need(
    inRange(c.bootCapMs, 1000, 60_000) && isNum(c.loadBudgetMs) && c.bootCapMs >= c.loadBudgetMs,
    'bootCapMs',
    '1000–60000 y ≥ loadBudgetMs',
  );
  need(inRange(obj(c.loading, 'loading').showAfterMs, 0, 2000), 'loading.showAfterMs', '0–2000');

  const appear = obj(c.appear, 'appear');
  need(inRange(appear.durationMs, 200, 6000), 'appear.durationMs', '200–6000');
  need(EASINGS.includes(appear.easing as Easing), 'appear.easing', EASINGS.join(' | '));
  need(inRange(appear.riseFrom, 0, 2), 'appear.riseFrom', '0–2');
  need(inRange(appear.growFrom, 0.05, 1), 'appear.growFrom', '0,05–1');
  need(inRange(obj(c.spin, 'spin').periodS, 4, 600), 'spin.periodS', '4–600');

  const pause = obj(c.pause, 'pause');
  need(inRange(pause.uiInMs, 0, 3000), 'pause.uiInMs', '0–3000');

  const landing = obj(c.landing, 'landing');
  need(inRange(landing.durationMs, 300, 6000), 'landing.durationMs', '300–6000');
  need(EASINGS.includes(landing.easing as Easing), 'landing.easing', EASINGS.join(' | '));
  need(inRange(landing.diveFit, 1, 40), 'landing.diveFit', '1–40');
  need(
    Array.isArray(landing.anchor) &&
      landing.anchor.length === 2 &&
      isFrac(landing.anchor[0]) &&
      isFrac(landing.anchor[1]),
    'landing.anchor',
    '[x, y] en 0..1',
  );
  need(isSpan(landing.uiOut), 'landing.uiOut', '[inicio, fin] en 0..1');
  need(isSpan(landing.cover) && landing.cover[1] === 1, 'landing.cover', '[inicio, 1] en 0..1');

  const reduced = obj(c.reduced, 'reduced');
  need(inRange(reduced.fadeMs, 0, 1000), 'reduced.fadeMs', '0–1000 (un fundido breve)');
  need(inRange(reduced.spinDeg, -360, 360), 'reduced.spinDeg', '±360');

  const clouds = obj(c.clouds, 'clouds');
  need(
    Number.isInteger(clouds.count) && inRange(clouds.count, 0, 40),
    'clouds.count',
    'entero 0–40',
  );
  need(isNum(clouds.seed), 'clouds.seed', 'número');
  need(inRange(clouds.speed, 0, 10), 'clouds.speed', '0–10');
  need(inRange(clouds.lift, 0, 1), 'clouds.lift', '0–1');

  const islands = obj(c.islands, 'islands');
  need(inRange(islands.scale, 0.1, 3), 'islands.scale', '0,1–3');
  need(
    inRange(islands.latTopDeg, -85, 85) &&
      inRange(islands.latBottomDeg, -85, 85) &&
      (islands.latTopDeg as number) > (islands.latBottomDeg as number),
    'islands.latTopDeg/latBottomDeg',
    '±85, arriba > abajo',
  );

  const scroll = obj(c.scroll, 'scroll');
  need(isSpan(scroll.uiOut), 'scroll.uiOut', '[inicio, fin] en 0..1');
  need(isSteps(scroll.dive, 2), 'scroll.dive', '[inicio, fin] crecientes en 0..2');
  need(
    isSteps(scroll.sea, 2) && (scroll.sea as number[])[1] === 1,
    'scroll.sea',
    '[inicio, 1]: the sea is in at one viewport',
  );
  need(isSteps(scroll.haze, 3), 'scroll.haze', '[sube, pico, baja] crecientes en 0..2');

  if (Array.isArray(c.framings) && c.framings.length > 0) {
    c.framings.forEach((f: unknown, i) => {
      const ok =
        isObj(f) &&
        inRange(f.minWidth, 0, Infinity) &&
        isPose(f.intro) &&
        isFrac(f.titleY) &&
        isFrac(f.buttonY);
      need(ok, `framings[${i}]`, '{ minWidth ≥ 0, intro, titleY, buttonY }');
    });
    const first = c.framings[0] as Obj | undefined;
    need(isObj(first) && first.minWidth === 0, 'framings[0].minWidth', 'debe ser 0');
    const widths = c.framings.map((f: unknown) => (isObj(f) ? f.minWidth : NaN));
    need(
      widths.every((w, i) => i === 0 || (w as number) > (widths[i - 1] as number)),
      'framings',
      'ordenados por minWidth creciente',
    );
  } else errors.push('framings: lista no vacía');

  errors.push(...titleMotionErrors(c.title));

  return errors.length > 0
    ? { ok: false, error: errors.join('\n') }
    : { ok: true, config: input as unknown as PlanetIntroConfig };
}

/** Encuadre para un ancho de vista: el último cuyo `minWidth` se cumple. */
export function pickPlanetFraming(config: PlanetIntroConfig, width: number): PlanetFraming {
  let chosen = config.framings[0]!;
  for (const f of config.framings) if (width >= f.minWidth) chosen = f;
  return chosen;
}

// --- Línea de tiempo -----------------------------------------------------------

/** Dónde y cómo se pinta el planeta: px CSS de la vista y radianes. */
export interface PlanetPose {
  x: number;
  y: number;
  radius: number;
  tilt: number;
  spin: number;
}

/** De qué encuadre sale la pose: un cambio de una a otra no es un movimiento de cámara. */
export type PoseSource = 'intro' | 'moving';

export interface IntroFrame {
  act: IntroAct;
  /** ms dentro del acto, recortados a su duración. */
  t: number;
  pose: PlanetPose;
  source: PoseSource;
  /** Opacidad del planeta (el fundido del movimiento reducido). */
  planet: number;
  /** Título «BOIA» y botón (HTML). */
  title: number;
  button: number;
  /** Velo del mar de `/mar` encima de todo (T64): llega a 1 al terminar de zarpar. */
  cover: number;
  /** The sea rig over the planet (0 at rest, 1 from one viewport of scroll on). */
  sea: number;
  /** The golden haze over everything while the dive crosses the atmosphere. */
  haze: number;
  /** Scroll position in viewport heights (0 outside the scroll-driven rest). */
  s: number;
  /** Light of the sea: 0 golden hour → 0.5 dusk → 1 night (set by the page). */
  light: number;
  /** Terminó: la zambullida acabó. */
  done: boolean;
}

/** Dónde está el puerto de salida de `/mar` en el planeta, radianes. */
export interface PlanetFocus {
  lon: number;
  lat: number;
}

/** Lo que lleva el controlador; la línea de tiempo sólo lo lee. */
export interface TimelineState {
  act: IntroAct;
  /** ms dentro del acto. */
  t: number;
  /** Giro acumulado del planeta, radianes (quieto mientras se zarpa o se baja). */
  spin: number;
  /** El puerto de salida (T64): la zambullida acaba con él de cara. Sin él, no gira. */
  focus?: PlanetFocus | null;
  /** Scroll position in viewport heights (rest only). */
  s?: number;
  /** Light of the sea, 0..1 (rest only). */
  light?: number;
}

const DEG = Math.PI / 180;

/** La pose de un encuadre en una vista. */
export function poseOf(spec: PlanetPoseSpec, vp: Viewport, spin: number): PlanetPose {
  const short = Math.min(vp.width, vp.height);
  return {
    x: spec.anchor[0] * vp.width,
    y: spec.anchor[1] * vp.height,
    radius: (spec.fit * short) / 2,
    tilt: spec.tiltDeg * DEG,
    spin,
  };
}

/** Radianes por ms del giro del planeta. */
export function spinRate(cfg: PlanetIntroConfig): number {
  return (2 * Math.PI) / (cfg.spin.periodS * 1000);
}

/**
 * El giro con el que el puerto queda de cara a la cámara (longitud 0 tras
 * girar), el más cercano a `spin`: al zarpar, nunca más de media vuelta.
 */
export function focusSpin(spin: number, focus: PlanetFocus): number {
  const TAU = 2 * Math.PI;
  const raw = -focus.lon - spin;
  return spin + (raw - TAU * Math.round(raw / TAU));
}

/** La pose final de la zambullida: el puerto de cara, grande, en su sitio de la vista. */
export function divePose(
  cfg: PlanetIntroConfig,
  vp: Viewport,
  spin: number,
  tilt: number,
  focus: PlanetFocus | null | undefined,
): PlanetPose {
  const short = Math.min(vp.width, vp.height);
  return {
    x: cfg.landing.anchor[0] * vp.width,
    y: cfg.landing.anchor[1] * vp.height,
    radius: (cfg.landing.diveFit * short) / 2,
    // Inclinar tanto como la latitud del puerto lo pone en el centro del disco.
    tilt: focus ? focus.lat : tilt,
    spin: focus ? focusSpin(spin, focus) : spin,
  };
}

/** Duración del acto (la pausa dura hasta que se pulsa). */
export function actDuration(cfg: PlanetIntroConfig, act: IntroAct, mode: IntroMode): number {
  if (act === 'appear') return mode === 'intro' ? cfg.appear.durationMs : 0;
  if (act === 'landing') return mode === 'reduced' ? cfg.reduced.fadeMs : cfg.landing.durationMs;
  if (act === 'pause') return Infinity;
  return 0;
}

/** Where the scroll is: at rest, diving, or on the sea (plan 007). */
export type ScrollPhase = 'rest' | 'dive' | 'sea';

export interface ScrollState {
  phase: ScrollPhase;
  /** Hero UI opacity (title, pills, hint, corner labels). */
  ui: number;
  /** Progress of the dive along the «Zarpar» path, 0..1 (linear in `s`). */
  dive: number;
  /** The sea rig over the planet, 0..1. */
  sea: number;
  haze: number;
}

/** Below this the hero is at rest; from `SEA_FROM` on, the sea phase. */
export const REST_UNTIL = 0.02;
export const SEA_FROM = 0.97;

/** The scroll position `s` (viewport heights) → what the hero shows. Pure. */
export function scrollState(cfg: PlanetIntroConfig, s: number): ScrollState {
  const sc = cfg.scroll;
  const span = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));
  const [h0, h1, h2] = sc.haze;
  const haze = s <= h1 ? ramp(s, [h0, h1]) : 1 - ramp(s, [h1, h2]);
  return {
    phase: s < REST_UNTIL ? 'rest' : s >= SEA_FROM ? 'sea' : 'dive',
    ui: 1 - ramp(s, sc.uiOut),
    dive: span(s, sc.dive[0], sc.dive[1]),
    sea: ramp(s, [sc.sea[0], sc.sea[1]]),
    haze,
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The dive of «Zarpar» at progress `u` (0..1 of its duration). */
function diveFrame(
  cfg: PlanetIntroConfig,
  vp: Viewport,
  s: TimelineState,
  u: number,
): Pick<IntroFrame, 'pose' | 'title' | 'cover' | 'done'> {
  const intro = poseOf(pickPlanetFraming(cfg, vp.width).intro, vp, s.spin);
  const e = EASING_FNS[cfg.landing.easing](u);
  const dive = divePose(cfg, vp, s.spin, intro.tilt, s.focus);
  return {
    pose: {
      x: lerp(intro.x, dive.x, e),
      y: lerp(intro.y, dive.y, e),
      // El radio crece en escala logarítmica: el acercamiento se siente parejo.
      radius: intro.radius * Math.pow(dive.radius / intro.radius, e),
      tilt: lerp(intro.tilt, dive.tilt, e),
      spin: lerp(s.spin, dive.spin, e),
    },
    title: 1 - ramp(u, cfg.landing.uiOut),
    cover: ramp(u, cfg.landing.cover),
    done: u >= 1,
  };
}

export function frameAt(
  cfg: PlanetIntroConfig,
  vp: Viewport,
  s: TimelineState,
  mode: IntroMode,
): IntroFrame {
  const framing = pickPlanetFraming(cfg, vp.width);
  const uiIn = cfg.pause.uiInMs > 0 ? clamp01(s.t / cfg.pause.uiInMs) : 1;
  const ui = uiIn * uiIn * (3 - 2 * uiIn);
  const intro = poseOf(framing.intro, vp, s.spin);
  const base = {
    source: 'intro' as const,
    planet: 1,
    cover: 0,
    sea: 0,
    haze: 0,
    s: 0,
    light: 0,
    done: false,
  };

  if (mode === 'reduced') {
    // Static version: no camera; «Zarpar» is a fade to the veil of `/mar` (T64).
    if (s.act !== 'landing') {
      return { ...base, act: 'pause', t: s.t, pose: intro, title: ui, button: ui };
    }
    const fade = cfg.reduced.fadeMs;
    const t = Math.max(0, Math.min(s.t, fade));
    const u = fade > 0 ? t / fade : 1;
    return {
      ...base,
      act: 'landing',
      t,
      pose: intro,
      title: 1 - u,
      button: 1 - u,
      cover: u,
      done: t >= fade,
    };
  }

  if (s.act === 'appear') {
    const dur = cfg.appear.durationMs;
    const e = EASING_FNS[cfg.appear.easing](clamp01(s.t / dur));
    const g = lerp(cfg.appear.growFrom, 1, e);
    return {
      ...base,
      act: 'appear',
      t: Math.min(s.t, dur),
      pose: {
        ...intro,
        y: intro.y + cfg.appear.riseFrom * vp.height * (1 - e),
        radius: intro.radius * g,
      },
      source: 'moving',
      title: 0,
      button: 0,
    };
  }

  if (s.act === 'landing') {
    // «Zarpar» (T64): del planeta entero a la zambullida en el puerto de salida.
    const dur = cfg.landing.durationMs;
    const t = Math.max(0, Math.min(s.t, dur));
    const d = diveFrame(cfg, vp, s, t / dur);
    return { ...base, ...d, act: 'landing', t, source: 'moving', button: d.title };
  }

  // Rest, driven by the scroll (plan 007).
  const scroll = Math.max(0, s.s ?? 0);
  const sc = scrollState(cfg, scroll);
  const shown = ui * sc.ui;
  const common = {
    ...base,
    act: 'pause' as const,
    t: s.t,
    title: shown,
    button: shown,
    sea: sc.sea,
    haze: sc.haze,
    s: scroll,
    light: clamp01(s.light ?? 0),
  };
  if (sc.dive <= 0) return { ...common, pose: intro };
  const d = diveFrame(cfg, vp, s, sc.dive);
  return { ...common, pose: d.pose, source: 'moving', planet: 1 - sc.sea };
}

/** Dos poses iguales (a medio píxel y a una milésima de radián). */
export function samePose(a: PlanetPose, b: PlanetPose): boolean {
  return (
    Math.abs(a.x - b.x) < 0.5 &&
    Math.abs(a.y - b.y) < 0.5 &&
    Math.abs(a.radius - b.radius) < 0.5 &&
    Math.abs(a.tilt - b.tilt) < 1e-3 &&
    Math.abs(a.spin - b.spin) < 1e-3
  );
}

/**
 * La vista cambió entre dos fotogramas: el planeta visible se movió o giró,
 * o la cámara bajó por el scroll (sirve para contar movimientos de cámara).
 */
export function viewMoved(a: IntroFrame, b: IntroFrame): boolean {
  if (Math.abs(a.s - b.s) > 1e-4) return true;
  if (a.planet <= 0 || b.planet <= 0) return false;
  return !samePose(a.pose, b.pose);
}
