import { EASINGS, type Easing, type Span, type TitleMotion, DEFAULT_INTRO_CONFIG } from './config';
import { EASING_FNS, clamp01, ramp, type Viewport } from './math';

/**
 * Entrada 3D con el planeta de `/mar` (T57, plan 005; D-19, D-21). Código
 * puro: configuración versionada (REQ-ENT-015) y línea de tiempo
 * (configuración, vista, estado) → fotograma. La escena three.js, que se carga
 * bajo demanda, sólo pinta lo que dice el fotograma; así la variante reducida
 * y el último fotograma se prueban sin navegador.
 *
 * Actos, cortos:
 * 0. carga, sólo si hace falta (boia dibujada y «Cargando»); el plazo cuenta
 *    desde que se monta la escena y sólo con la pestaña a la vista;
 * 1. aparición: el planeta sube, crece y gira;
 * 2. pausa: sigue girando; entran las letras «BOIA» y «Zarpar» (no avanza
 *    sola salvo el avance automático, apagado);
 * 3. zarpar (T64, D-24): el planeta se vuelve hacia el puerto de salida de
 *    `/mar` y la cámara se zambulle en él; un velo con el color del mar de
 *    `/mar` cubre la vista y se entra en el juego. «Saltar animación» y «Solo
 *    quiero ver las entradas» llevan a la landing, con el horizonte del
 *    planeta girando despacio detrás del hero.
 *
 * Unidades: tiempos en ms; poses en fracciones de la vista (`fit`: diámetro
 * del planeta como múltiplo del lado corto; `anchor`: centro, fracciones de
 * ancho y alto, puede salirse de la vista); ángulos en grados.
 */

export const PLANET_INTRO_VERSION = 5 as const;

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
  /** Actos 1 y 2: el planeta entero en el centro. */
  intro: PlanetPoseSpec;
  /** Landing: el horizonte del planeta detrás del hero. */
  hero: PlanetPoseSpec;
  /** Título «BOIA» y botón: centro vertical, fracción del alto. */
  titleY: number;
  buttonY: number;
}

export interface PlanetIntroConfig {
  version: typeof PLANET_INTRO_VERSION;
  id: string;
  status: 'muestra' | 'aprobada';
  copy: {
    title: string;
    /** Botón de entrar. muestra: lo aprueba Álvaro (D-19, P9). */
    enter: string;
    /** Enlace a Tickets visible desde el primer momento (REQ-ENT-002). */
    ticketsOnly: string;
    loading: string;
  };
  /**
   * Plazo para tener la escena lista (three.js, el planeta y su primer
   * fotograma), contado desde el montaje y sólo con la pestaña visible. Si
   * se pasa, landing ligera.
   */
  loadBudgetMs: number;
  /**
   * Red de seguridad del script de arranque si la app nunca llega a montar la
   * escena (JavaScript roto o bloqueado), contada sólo con la pestaña visible.
   */
  bootCapMs: number;
  /** Acto 0: la boia y «Cargando» sólo si la carga pasa de este tiempo. */
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
  /** Acto 2. */
  pause: {
    uiInMs: number;
    autoAdvance: { enabled: boolean; afterMs: number };
  };
  /**
   * Acto 3: «Zarpar» (T64): la zambullida hasta el puerto de salida de
   * `/mar`. El planeta gira hasta tener el puerto de cara y crece hasta
   * `diveFit`, con el puerto en `anchor`; el velo del mar cubre la vista en
   * el tramo `cover`.
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
  /** Movimiento reducido: planeta quieto; al pulsar, un fundido al velo del mar. */
  reduced: { fadeMs: number; spinDeg: number };
  /** Nubes alrededor del planeta. */
  clouds: { count: number; seed: number; speed: number; lift: number };
  /** Islas sobre la esfera: tamaño respecto al mar de /mar y franja de latitudes del mapa. */
  islands: { scale: number; latTopDeg: number; latBottomDeg: number };
  framings: readonly PlanetFraming[];
  /** Movimiento del título 3D «BOIA» (T27). */
  title: TitleMotion;
}

/** Configuración de muestra (T57): todo `muestra` hasta verlo en móviles reales (D-19, P6). */
export const DEFAULT_PLANET_INTRO: PlanetIntroConfig = {
  version: PLANET_INTRO_VERSION,
  id: 'entrada-planeta-muestra-v5',
  status: 'muestra',
  copy: { ...DEFAULT_INTRO_CONFIG.copy },
  loadBudgetMs: 9000,
  bootCapMs: 15000,
  loading: { showAfterMs: 250 },
  appear: { durationMs: 1400, easing: 'easeInOutCubic', riseFrom: 0.35, growFrom: 0.45 },
  spin: { periodS: 50 },
  pause: { uiInMs: 400, autoAdvance: { enabled: false, afterMs: 8000 } },
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
      hero: { fit: 3.4, anchor: [0.5, 1.4], tiltDeg: 58 },
      titleY: 0.14,
      buttonY: 0.82,
    },
    {
      minWidth: 900,
      intro: { fit: 0.62, anchor: [0.5, 0.5], tiltDeg: 22 },
      hero: { fit: 3, anchor: [0.5, 2], tiltDeg: 60 },
      titleY: 0.12,
      buttonY: 0.86,
    },
  ],
  title: DEFAULT_INTRO_CONFIG.title,
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
  for (const k of ['title', 'enter', 'ticketsOnly', 'loading'] as const) {
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
  const auto = obj(pause.autoAdvance, 'pause.autoAdvance');
  need(typeof auto.enabled === 'boolean', 'pause.autoAdvance.enabled', 'true | false');
  need(inRange(auto.afterMs, 1000, 120_000), 'pause.autoAdvance.afterMs', '1000–120000');

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

  if (Array.isArray(c.framings) && c.framings.length > 0) {
    c.framings.forEach((f: unknown, i) => {
      const ok =
        isObj(f) &&
        inRange(f.minWidth, 0, Infinity) &&
        isPose(f.intro) &&
        isPose(f.hero) &&
        isFrac(f.titleY) &&
        isFrac(f.buttonY);
      need(ok, `framings[${i}]`, '{ minWidth ≥ 0, intro, hero, titleY, buttonY }');
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

  need(isObj(c.title), 'title', 'movimiento del título');

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
export type PoseSource = 'intro' | 'hero' | 'moving';

export interface IntroFrame {
  act: IntroAct;
  /** ms dentro del acto, recortados a su duración. */
  t: number;
  pose: PlanetPose;
  source: PoseSource;
  /** Opacidad del planeta (el fundido del movimiento reducido). */
  planet: number;
  /** Título «BOIA» y botón (HTML), contenido de la landing (HTML). */
  title: number;
  button: number;
  content: number;
  /** Velo del mar de `/mar` encima de todo (T64): llega a 1 al terminar de zarpar. */
  cover: number;
  /** Terminó: el planeta está en el encuadre del hero, o la zambullida acabó. */
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
  /** Giro acumulado del planeta, radianes (quieto mientras se zarpa). */
  spin: number;
  /** El puerto de salida (T64): la zambullida acaba con él de cara. Sin él, no gira. */
  focus?: PlanetFocus | null;
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
  if (act === 'landing') return mode === 'intro' ? cfg.landing.durationMs : cfg.reduced.fadeMs;
  if (act === 'pause') return Infinity;
  return 0;
}

/** El encuadre de la landing: el horizonte del planeta detrás del hero. */
export function heroFrame(cfg: PlanetIntroConfig, vp: Viewport, spin: number, t = 0): IntroFrame {
  return {
    act: 'landed',
    t,
    pose: poseOf(pickPlanetFraming(cfg, vp.width).hero, vp, spin),
    source: 'hero',
    planet: 1,
    title: 0,
    button: 0,
    content: 1,
    cover: 0,
    done: true,
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function frameAt(
  cfg: PlanetIntroConfig,
  vp: Viewport,
  s: TimelineState,
  mode: IntroMode,
): IntroFrame {
  if (mode === 'direct' || s.act === 'landed') return heroFrame(cfg, vp, s.spin);
  const framing = pickPlanetFraming(cfg, vp.width);
  const uiIn = cfg.pause.uiInMs > 0 ? clamp01(s.t / cfg.pause.uiInMs) : 1;
  const ui = uiIn * uiIn * (3 - 2 * uiIn);
  const intro = poseOf(framing.intro, vp, s.spin);

  if (mode === 'reduced') {
    // Planeta quieto, título y botón; al pulsar, un fundido al velo del mar
    // de `/mar` y se entra en el juego (T64). Nada se mueve.
    const base = { pose: intro, source: 'intro' as const, planet: 1, content: 0 };
    if (s.act !== 'landing') {
      return { ...base, act: 'pause', t: s.t, title: ui, button: ui, cover: 0, done: false };
    }
    const fade = cfg.reduced.fadeMs;
    const t = Math.max(0, Math.min(s.t, fade));
    const u = fade > 0 ? t / fade : 1;
    return {
      ...base,
      act: 'landing',
      t,
      title: 1 - u,
      button: 1 - u,
      cover: u,
      done: t >= fade,
    };
  }

  if (s.act === 'appear' || s.act === 'pause') {
    const appear = s.act === 'appear';
    const dur = cfg.appear.durationMs;
    const e = appear ? EASING_FNS[cfg.appear.easing](clamp01(s.t / dur)) : 1;
    const g = lerp(cfg.appear.growFrom, 1, e);
    return {
      act: s.act,
      t: appear ? Math.min(s.t, dur) : s.t,
      pose: {
        ...intro,
        y: intro.y + cfg.appear.riseFrom * vp.height * (1 - e),
        radius: intro.radius * g,
      },
      source: appear ? 'moving' : 'intro',
      planet: 1,
      title: appear ? 0 : ui,
      button: appear ? 0 : ui,
      content: 0,
      cover: 0,
      done: false,
    };
  }

  // «Zarpar» (T64): del planeta entero a la zambullida en el puerto de salida.
  const dur = cfg.landing.durationMs;
  const t = Math.max(0, Math.min(s.t, dur));
  const e = EASING_FNS[cfg.landing.easing](t / dur);
  const dive = divePose(cfg, vp, s.spin, intro.tilt, s.focus);
  const out = 1 - ramp(t / dur, cfg.landing.uiOut);
  return {
    act: 'landing',
    t,
    pose: {
      x: lerp(intro.x, dive.x, e),
      y: lerp(intro.y, dive.y, e),
      // El radio crece en escala logarítmica: el acercamiento se siente parejo.
      radius: intro.radius * Math.pow(dive.radius / intro.radius, e),
      tilt: lerp(intro.tilt, dive.tilt, e),
      spin: lerp(s.spin, dive.spin, e),
    },
    source: 'moving',
    planet: 1,
    title: out,
    button: out,
    content: 0,
    cover: ramp(t / dur, cfg.landing.cover),
    done: t >= dur,
  };
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
 * La vista cambió entre dos fotogramas: el planeta visible se movió o giró
 * (sirve para contar movimientos de cámara). Pasar de un encuadre a otro en
 * un fundido no cuenta: es un corte, no un movimiento.
 */
export function viewMoved(a: IntroFrame, b: IntroFrame): boolean {
  if (a.planet <= 0 || b.planet <= 0) return false;
  if (a.source !== b.source && a.source !== 'moving' && b.source !== 'moving') return false;
  return !samePose(a.pose, b.pose);
}
