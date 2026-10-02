import {
  EASINGS,
  SHIP_VIEWS,
  type Easing,
  type Framing,
  type IntroConfig,
  type ShipView,
} from './config';
import { EASING_FNS, clamp01, type Vec2Like, type Viewport } from './math';

/**
 * EXPLORAR descubre el puerto (T28, D-20 punto 6, REQ-ENT-012). Código puro:
 * la entrada aterriza en el punto de aterrizaje del mundo activo y, al pulsar
 * EXPLORAR, la cámara se aleja un poco y deja el puerto con el barco dentro
 * justo como lo enseña el juego al empezar; entonces la escena pasa a /juego.
 *
 * Datos de cada mundo (`WorldIntro`): el encuadre de llegada, qué parte del
 * mapa se enrolla en el mini-mundo y cuánto dura el alejamiento. Los puntos
 * (aterrizaje, salida del barco, puerto) son del mapa compartido y el Admin
 * los mueve (`mapa:entrada`, `mapa:salida`, `mapa:puerto`, T26). Todo es
 * `muestra` hasta que Hernán y Álvaro lo vean en móviles reales.
 */

/**
 * Franja de tierra que la cámara del juego deja ver bajo el borde de abajo
 * del mapa (`BOTTOM_LAND_PX` en `game.ts`; una prueba vigila que coincidan).
 */
export const GAME_BOTTOM_LAND_PX = 56;

/** Encuadre de llegada de un mundo: zoom y ancla del aterrizaje a partir de un ancho. */
export interface ArrivalFraming {
  minWidth: number;
  /** Múltiplo de la escala de juego; más de 1 para que EXPLORAR se aleje hasta la del juego. */
  zoom: number;
  /** Punto de la vista (fracciones) donde cae el punto de aterrizaje. */
  anchor: readonly [number, number];
}

export interface WorldIntro {
  /** Encuadre de llegada por ancho de vista (sustituye zoom y ancla de `framings`). */
  arrival: readonly ArrivalFraming[];
  miniWorld: {
    /** Lado (u de mundo) del trozo de mapa, centrado en el aterrizaje, que se enrolla en la esfera. */
    span: number;
    /**
     * Distancia (u) al aterrizaje y a la salida hasta la que se cargan
     * objetos: lo que se ve al llegar y al alejarse hasta el puerto.
     */
    reach: number;
  };
  /** EXPLORAR: el alejamiento hasta el encuadre del puerto. */
  explore: { durationMs: number; easing: Easing };
}

/** Puntos del mapa que usa la entrada, en coordenadas del mundo. */
export interface IntroPoints {
  landing: Vec2Like;
  /** Salida del barco (anillo del puerto) y su rumbo inicial. */
  spawn: Vec2Like & { heading: number };
  /** El puerto; sin puerto en el mapa, la salida. */
  port: Vec2Like;
}

/**
 * Lo que necesita el alejamiento, en px de juego a zoom 1 (`worldToScreen`):
 * dónde está el barco, dónde el puerto y hasta dónde baja la cámara del juego.
 */
export interface PortReveal {
  ship: Vec2Like;
  port: Vec2Like;
  /** y más baja que enseña la cámara del juego: borde de abajo del mapa + franja de tierra. */
  floorY: number;
  durationMs: number;
  easing: Easing;
}

/** Cámara: el punto (x, y) se pinta en (ax, ay) con `zoom` px por px de mundo. */
export interface CameraLike {
  x: number;
  y: number;
  zoom: number;
  ax: number;
  ay: number;
}

/**
 * La cámara con la que empieza el juego (`createGame`): centrada en el barco,
 * a escala de juego, sin bajar más allá de la franja de tierra del borde de
 * abajo. Es el encuadre del puerto: donde termina EXPLORAR.
 */
export function portCamera(r: Pick<PortReveal, 'ship' | 'floorY'>, vp: Viewport): CameraLike {
  const y = Math.min(r.ship.y, r.floorY - vp.height / 2);
  return { x: r.ship.x, y, zoom: 1, ax: vp.width / 2, ay: vp.height / 2 };
}

/** El punto de la vista (px) donde una cámara pinta un punto del mundo. */
export function onScreen(c: CameraLike, p: Vec2Like): Vec2Like {
  return { x: c.ax + (p.x - c.x) * c.zoom, y: c.ay + (p.y - c.y) * c.zoom };
}

/**
 * El alejamiento en `e` (0..1): el centro de la vista va en línea recta y el
 * zoom en escala logarítmica (un alejamiento de ritmo constante) desde la
 * cámara de llegada hasta la del puerto. En 1 es exactamente la del puerto.
 */
export function revealCamera(
  from: CameraLike,
  to: CameraLike,
  vp: Viewport,
  e: number,
  easing: Easing,
): CameraLike {
  const u = clamp01(e);
  if (u >= 1) return { ...to };
  const a = EASING_FNS[easing](u);
  const center = (c: CameraLike) => ({
    x: c.x + (vp.width / 2 - c.ax) / c.zoom,
    y: c.y + (vp.height / 2 - c.ay) / c.zoom,
  });
  const c0 = center(from);
  const c1 = center(to);
  const zoom = from.zoom * Math.pow(to.zoom / from.zoom, a);
  return {
    x: c0.x + (c1.x - c0.x) * a,
    y: c0.y + (c1.y - c0.y) * a,
    zoom,
    ax: vp.width / 2,
    ay: vp.height / 2,
  };
}

/** Vista del barco para un rumbo (0 = este, π/2 = sur): la misma regla que el juego. */
export function shipViewFor(heading: number): ShipView {
  // S = π/2 y cada vista siguiente gira π/4 (`directionHeading` de @boia/world).
  const i = Math.round((heading - Math.PI / 2) / (Math.PI / 4));
  return SHIP_VIEWS[((i % 8) + 8) % 8]!;
}

/** El encuadre de llegada del mundo para un encuadre de la configuración. */
function arrivalFor(w: WorldIntro, f: Framing): ArrivalFraming | null {
  let chosen: ArrivalFraming | null = null;
  for (const a of w.arrival) if (f.minWidth >= a.minWidth) chosen = a;
  return chosen;
}

/**
 * La configuración de la entrada para un mundo: aterriza en su punto, con su
 * encuadre de llegada, y el barco espera en la salida (px de juego respecto
 * al aterrizaje) mirando hacia su rumbo.
 * @param screen `worldToScreen` (se pasa para que esto siga siendo puro).
 */
export function introConfigForWorld(
  config: IntroConfig,
  world: WorldIntro,
  points: IntroPoints,
  screen: (p: Vec2Like) => Vec2Like,
): IntroConfig {
  const l = screen(points.landing);
  const s = screen(points.spawn);
  return {
    ...config,
    landingPoint: { x: points.landing.x, y: points.landing.y },
    framings: config.framings.map((f) => {
      const a = arrivalFor(world, f);
      return a ? { ...f, zoom: a.zoom, anchor: a.anchor } : f;
    }),
    ship: {
      ...config.ship,
      view: shipViewFor(points.spawn.heading),
      dx: s.x - l.x,
      dy: s.y - l.y,
    },
  };
}

/** El alejamiento de un mundo, en px de juego (ver `PortReveal`). */
export function portReveal(
  world: WorldIntro,
  points: IntroPoints,
  worldBottom: number,
  screen: (p: Vec2Like) => Vec2Like,
): PortReveal {
  return {
    ship: screen(points.spawn),
    port: screen(points.port),
    floorY: screen({ x: 0, y: worldBottom }).y + GAME_BOTTOM_LAND_PX,
    durationMs: world.explore.durationMs,
    easing: world.explore.easing,
  };
}

export type WorldIntroResult = { ok: true; world: WorldIntro } | { ok: false; error: string };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isFrac = (v: unknown): v is number => isNum(v) && v >= 0 && v <= 1;

/** Valida los datos de entrada de un mundo, con mensajes que dicen qué campo falla. */
export function validateWorldIntro(input: unknown): WorldIntroResult {
  if (!isObj(input)) return { ok: false, error: 'los datos de entrada del mundo no son un objeto' };
  const errors: string[] = [];
  const need = (cond: boolean, path: string, what: string) => {
    if (!cond) errors.push(`${path}: ${what}`);
  };
  const arrival = input.arrival;
  if (Array.isArray(arrival) && arrival.length > 0) {
    arrival.forEach((a: unknown, i) => {
      need(
        isObj(a) &&
          isNum(a.minWidth) &&
          a.minWidth >= 0 &&
          isNum(a.zoom) &&
          a.zoom >= 1 &&
          a.zoom <= 4 &&
          Array.isArray(a.anchor) &&
          a.anchor.length === 2 &&
          isFrac(a.anchor[0]) &&
          isFrac(a.anchor[1]),
        `arrival[${i}]`,
        '{ minWidth ≥ 0, zoom 1–4 (el juego va a 1: EXPLORAR se aleja), anchor }',
      );
    });
    const first = arrival[0] as Obj | undefined;
    need(isObj(first) && first.minWidth === 0, 'arrival[0].minWidth', 'debe ser 0');
    const widths = arrival.map((a: unknown) => (isObj(a) ? a.minWidth : NaN));
    need(
      widths.every((w, i) => i === 0 || (w as number) > (widths[i - 1] as number)),
      'arrival',
      'ordenados por minWidth creciente',
    );
  } else errors.push('arrival: lista no vacía');
  const mini = isObj(input.miniWorld) ? input.miniWorld : {};
  need(isNum(mini.span) && mini.span >= 400 && mini.span <= 8000, 'miniWorld.span', '400–8000');
  need(isNum(mini.reach) && mini.reach >= 0 && mini.reach <= 8000, 'miniWorld.reach', '0–8000');
  const ex = isObj(input.explore) ? input.explore : {};
  need(
    isNum(ex.durationMs) && ex.durationMs >= 0 && ex.durationMs <= 4000,
    'explore.durationMs',
    '0–4000',
  );
  need(EASINGS.includes(ex.easing as Easing), 'explore.easing', EASINGS.join(' | '));
  return errors.length > 0
    ? { ok: false, error: errors.join('\n') }
    : { ok: true, world: input as unknown as WorldIntro };
}
