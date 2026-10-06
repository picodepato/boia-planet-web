import type { DefenseConfig, DefensePath } from '@boia/engine/defense';
import { CASTLE_OPEN_SEA_BEARING } from './compact';
import { toScene } from './compress';
import { clamp01, smooth } from './kit';

/**
 * La arena de «Defensa del Castillo» en `/mar` (plan 014 T160), sin
 * three.js: cómo cae la partida de `@boia/engine/defense` (el castillo en
 * (0, 0), el vórtice en `path.start`) sobre el mar del planeta, la cámara
 * alta, el hundimiento del resto del mundo, las barreras flotantes del camino
 * y la regla de tamaño de las islas construidas (decisiones 4, 5, 7 y 8).
 * u de motor salvo donde se diga «escena». Todo `muestra`.
 */

type Point = { x: number; y: number };

// --- El marco: de la partida al mar ---------------------------------------------

/**
 * La partida en el mar: su (0, 0) es el centro de la isla del castillo y
 * todo se gira para que el vórtice (el principio del camino) caiga hacia el
 * mar abierto (`CASTLE_OPEN_SEA_BEARING`, T157). Los puntos del mar salen
 * seguidos alrededor del castillo, sin dar la vuelta al planeta: la arena
 * (1120 u) cruza su borde y lo que la pinta hace la vuelta a la copia
 * cercana (el material del planeta, con el foco en el castillo).
 */
export interface ArenaFrame {
  /** El castillo en el mar (u de motor). */
  readonly cx: number;
  readonly cy: number;
  /** rad que se gira la partida al pasar al mar. */
  readonly rot: number;
  /** Un punto de la partida en el mar. */
  toWorld(x: number, y: number, out?: Point): Point;
  /** Un punto del mar (seguido alrededor del castillo) en la partida. */
  toSim(x: number, y: number, out?: Point): Point;
  /** Una dirección del mar (el mando) en la partida. */
  dirToSim(x: number, y: number, out?: Point): Point;
  /** Un rumbo de la partida en el mar. */
  headingToWorld(h: number): number;
}

export function arenaFrame(
  castle: Point,
  path: Pick<DefensePath, 'start'>,
  bearing: number = CASTLE_OPEN_SEA_BEARING,
): ArenaFrame {
  const rot = bearing - Math.atan2(path.start.y, path.start.x);
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const cx = castle.x;
  const cy = castle.y;
  return {
    cx,
    cy,
    rot,
    toWorld(x, y, out = { x: 0, y: 0 }) {
      out.x = cx + x * c - y * s;
      out.y = cy + x * s + y * c;
      return out;
    },
    toSim(x, y, out = { x: 0, y: 0 }) {
      const dx = x - cx;
      const dy = y - cy;
      out.x = dx * c + dy * s;
      out.y = -dx * s + dy * c;
      return out;
    },
    dirToSim(x, y, out = { x: 0, y: 0 }) {
      out.x = x * c + y * s;
      out.y = -x * s + y * c;
      return out;
    },
    headingToWorld: (h) => h + rot,
  };
}

/** El vórtice en el mar (u de motor, seguido alrededor del castillo): el principio del camino. */
export function vortexSpot(frame: ArenaFrame, path: Pick<DefensePath, 'start'>): Point {
  return frame.toWorld(path.start.x, path.start.y);
}

// --- La cámara alta -----------------------------------------------------------------

/** rad bajo la horizontal de la cámara de la arena: casi cenital (la de navegar va a 0,64). muestra */
export const ARENA_ELEVATION = 1.2;
/** Margen alrededor de la arena en la vista (1 = justa). muestra */
export const ARENA_FIT = 1.08;
/** En vertical, la parte del ancho de la arena que se ve a la vez (el resto, siguiendo al avión). muestra */
export const ARENA_PORTRAIT_WIDTH = 0.75;
/** s que tarda la cámara en subir a la arena y en volver. muestra */
export const ARENA_CAMERA_S = 1.2;

export interface ArenaCameraPose {
  /** Distancia de la cámara al foco (escena). */
  distance: number;
  /** rad bajo la horizontal. */
  elevation: number;
  /** Dónde mira, respecto al castillo (escena). */
  fx: number;
  fz: number;
}

/**
 * La cámara de la arena (decisión 4): alta, casi cenital y centrada en el
 * castillo. En apaisado cabe la arena entera; en vertical, toda su altura y
 * `ARENA_PORTRAIT_WIDTH` de su ancho, y el foco se corre hacia el avión lo
 * justo para que no se salga. `plane`: el avión respecto al castillo (escena).
 */
export function arenaCameraPose(o: {
  aspect: number;
  fovDeg: number;
  /** Radio de la arena (escena). */
  arenaRadius: number;
  plane: { x: number; z: number };
}): ArenaCameraPose {
  const t = Math.tan((o.fovDeg * Math.PI) / 360);
  const fit = o.arenaRadius * ARENA_FIT;
  const aspect = Math.max(0.1, o.aspect);
  const distance = fit / (t * Math.min(1, aspect / ARENA_PORTRAIT_WIDTH));
  // Lo que se ve a cada lado del foco; el avión se queda dentro (con margen).
  const halfW = distance * t * aspect;
  const halfH = distance * t;
  const kx = clamp01(1 - halfW / fit);
  const kz = clamp01(1 - halfH / fit);
  return { distance, elevation: ARENA_ELEVATION, fx: o.plane.x * kx, fz: o.plane.z * kz };
}

// --- El mundo se hunde ------------------------------------------------------------------

/** s que tarda el mundo en hundirse (y en volver). muestra */
export const SINK_S = 1.2;
/** Escena: lo que baja lo hundido (más que lo más alto de una isla: los rascacielos de Benidorm). muestra */
export const SINK_DEPTH = 40;

/**
 * El hundimiento del resto del mundo al entrar en la arena (decisión 4): 0
 * todo en su sitio, 1 todo bajo el agua. Corto; con movimiento reducido, de
 * golpe. Al salir vuelve a 0 igual.
 */
export class ArenaSink {
  private lv = 0;
  private goal = 0;

  /** Hundirse (true) o volver (false). */
  set(sunk: boolean): void {
    this.goal = sunk ? 1 : 0;
  }

  get target(): number {
    return this.goal;
  }

  /** 0…1. */
  get level(): number {
    return this.lv;
  }

  /** Hay algo hundido o hundiéndose. */
  get active(): boolean {
    return this.lv > 0 || this.goal > 0;
  }

  /** Todo bajo el agua (se puede dejar de pintar). */
  get under(): boolean {
    return this.lv >= 1;
  }

  /** Escena que baja ahora lo hundido (con una curva suave). */
  get depth(): number {
    return SINK_DEPTH * smooth(0, 1, this.lv);
  }

  step(dt: number, reduced: boolean): void {
    if (reduced) {
      this.lv = this.goal;
      return;
    }
    const k = Math.max(0, dt) / SINK_S;
    this.lv = this.goal > this.lv ? Math.min(this.goal, this.lv + k) : Math.max(this.goal, this.lv - k);
  }
}

/**
 * Baja cada pieza lo que toca sin perder su altura: antes de que la pieza se
 * mueva en el fotograma se deshace lo que se le bajó (`lift`), y después se
 * vuelve a bajar (`sink`). Si su animación pone la altura de nuevo, bien; si
 * no, vuelve a la suya. Con profundidad 0 queda exactamente como estaba.
 */
export class SinkOffsets {
  private readonly applied = new Map<object, number>();

  /** Deshace lo bajado (antes de la animación de la pieza). */
  lift(obj: { position: { y: number } }): void {
    const d = this.applied.get(obj);
    if (d === undefined) return;
    obj.position.y += d;
    this.applied.delete(obj);
  }

  /** La baja `depth` (después de la animación). */
  sink(obj: { position: { y: number } }, depth: number): void {
    if (!(depth > 0)) return;
    obj.position.y -= depth;
    this.applied.set(obj, depth);
  }

  /** Cuántas piezas están bajadas ahora. */
  get size(): number {
    return this.applied.size;
  }
}

// --- Las barreras flotantes del camino ------------------------------------------------

/** u entre dos puntos de la barrera (antes de rellenar las esquinas). muestra */
export const BARRIER_STEP = 24;
/** u como mucho entre dos puntos seguidos de una barrera (sin huecos). */
export const BARRIER_MAX_GAP = 30;
/** u que la barrera se queda fuera del castillo. muestra */
export const BARRIER_CASTLE_GAP = 18;

export interface BarrierLines {
  /** A la izquierda y a la derecha del sentido de avance (u de la partida). */
  left: Point[];
  right: Point[];
}

/**
 * Las dos barreras del carril (decisión 5): a medio ancho del camino a
 * cada lado, desde el vórtice hasta la muralla, sin huecos (en lo de fuera
 * de las esquinas se rellena) y sin meterse en el carril (lo de dentro de las
 * esquinas se quita) ni en el castillo.
 */
export function barrierLines(
  path: Pick<DefensePath, 'length' | 'width' | 'sampleAt' | 'distanceTo' | 'points'>,
  castleRadius: number,
  step = BARRIER_STEP,
): BarrierLines {
  const half = path.width / 2;
  const sides: [Point[], Point[]] = [[], []];
  const n = Math.max(2, Math.ceil(path.length / step));
  const stopR = castleRadius + BARRIER_CASTLE_GAP;
  for (let i = 0; i <= n; i++) {
    const s = path.sampleAt((path.length * i) / n);
    for (const k of [0, 1] as const) {
      const sign = k === 0 ? 1 : -1;
      const p = { x: s.x + s.nx * half * sign, y: s.y + s.ny * half * sign };
      // Ni dentro del carril (lo de dentro de una esquina) ni en el castillo.
      if (path.distanceTo(p.x, p.y) < half - 1) continue;
      if (Math.hypot(p.x, p.y) < stopR) continue;
      sides[k].push(p);
    }
  }
  // Lo rellenado en recto por dentro de una esquina se aparta hasta el borde del carril.
  const push = (line: Point[]) => line.map((p) => outOfLane(path.points, p, half));
  const out = (line: Point[]) => fillGaps(push(fillGaps(push(fillGaps(line)))));
  return { left: out(sides[0]), right: out(sides[1]) };
}

/** `p`, o si está a menos de `half` de la línea central, empujado hasta `half` desde lo más cercano. */
function outOfLane(points: readonly Point[], p: Point, half: number): Point {
  let best = Infinity;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
    const qx = a.x + dx * t;
    const qy = a.y + dy * t;
    const d = Math.hypot(p.x - qx, p.y - qy);
    if (d < best) {
      best = d;
      cx = qx;
      cy = qy;
    }
  }
  if (best >= half - 1 || best < 1e-6) return p;
  const k = half / best;
  return { x: cx + (p.x - cx) * k, y: cy + (p.y - cy) * k };
}

/** Rellena con puntos en línea recta donde dos seguidos quedan a más de `BARRIER_MAX_GAP`. */
function fillGaps(line: Point[]): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < line.length; i++) {
    const p = line[i]!;
    const prev = out[out.length - 1];
    if (prev) {
      const d = Math.hypot(p.x - prev.x, p.y - prev.y);
      const parts = Math.ceil(d / BARRIER_MAX_GAP);
      for (let j = 1; j < parts; j++) {
        out.push({ x: prev.x + ((p.x - prev.x) * j) / parts, y: prev.y + ((p.y - prev.y) * j) / parts });
      }
    }
    out.push(p);
  }
  return out;
}

/**
 * Las boyas de la carrera de acento (decisión 5): una por esquina viva del
 * camino, por fuera de la curva, justo detrás de la barrera.
 */
export function cornerBuoys(
  path: Pick<DefensePath, 'corners' | 'width' | 'sampleAt'>,
  gap = 14,
): Point[] {
  const off = path.width / 2 + gap;
  return path.corners.map((c) => {
    const s = path.sampleAt(c.distance);
    // Gira hacia la normal de la izquierda si `turnRad` > 0: lo de fuera es la derecha.
    const sign = c.turnRad > 0 ? -1 : 1;
    return { x: c.x + s.nx * off * sign, y: c.y + s.ny * off * sign };
  });
}

// --- El tamaño de las islas construidas (decisión 8) --------------------------------

/** Cuánto crece una isla por nivel (+10 %). */
export const ISLAND_LEVEL_GROWTH = 0.1;

/** El tamaño de un nivel respecto al 1 (1; 1,1; 1,2). */
export function islandLevelScale(level: number): number {
  const l = Math.min(3, Math.max(1, Math.round(level)));
  return 1 + ISLAND_LEVEL_GROWTH * (l - 1);
}

/**
 * El radio (escena) que cubre en el agua una isla construida de ese nivel:
 * el de la config (`islandRadius`, el de nivel 3, el de la regla de
 * construir) a su nivel. Igual para los siete tipos.
 */
export function islandFootprint(cfg: Pick<DefenseConfig, 'islandRadius'>, level: number): number {
  return (toScene(cfg.islandRadius) * islandLevelScale(level)) / islandLevelScale(3);
}

/**
 * La escala uniforme de una isla (decisión 8): construida a su tamaño de
 * siempre, mide `measured` (escena; su caja, o el `radius` del manifiesto de
 * Blender por la escala con que se pone) y se lleva a la huella común de su
 * nivel. La altura queda libre: Benidorm sigue más alta que Ibiza.
 */
export function islandScaleFor(
  measured: number,
  level: number,
  cfg: Pick<DefenseConfig, 'islandRadius'>,
): number {
  return islandFootprint(cfg, level) / Math.max(1e-6, measured);
}
