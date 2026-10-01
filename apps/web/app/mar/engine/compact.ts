import type { Rect, WorldConfig, WorldObject } from '@boia/world';
import { compressWorld, fromScene, toScene } from './compress';
import { type Circle, type Period, periodOf, planetRect, shortest, wrapIn } from './wrap';

/**
 * El mundo compacto de `/mar` (T50), sin three.js: el mapa compartido a la
 * escala del mar 3D (`compressWorld`, con las zonas a la mitad de distancia
 * que en T33), el decorado propio (castillo, Explanada, islote de la cueva),
 * los límites del planeta ajustados a lo que hay y la ruta de boyas que une
 * las islas en el orden de la historia. Las posiciones del mapa compartido
 * no cambian (el 2D sigue igual): todo se deriva al cargar `/mar`, y el
 * runtime, los rótulos, el piloto, el viaje de «Entradas» y los premios
 * (por id de lugar) van sobre este mismo mundo. u de motor salvo donde se
 * diga. Todo `muestra`.
 */

type Point = { x: number; y: number };

// --- Decorado propio -----------------------------------------------------------

export type DecorKind = 'castillo' | 'explanada' | 'cueva';

export interface DecorSpot {
  kind: DecorKind;
  /** Centro (unidades de escena). */
  x: number;
  z: number;
}

/** Medidas del decorado (escena): `decor.ts` lo dibuja con ellas. */
export const DECOR_SIZE = {
  /** Radio de la isla del castillo. */
  castillo: 13,
  /** Semilargo y semiancho de la Explanada. */
  explanadaL: 17,
  explanadaW: 6.5,
  /** Radio del islote de la cueva. */
  cueva: 3.6,
} as const;

/** Círculos sólidos de cada pieza, respecto a su centro (escena). */
export const DECOR_SOLIDS: Record<DecorKind, readonly { dx: number; dz: number; r: number }[]> = {
  castillo: [{ dx: 0, dz: 0, r: DECOR_SIZE.castillo }],
  explanada: [-2, -1, 0, 1, 2].map((i) => ({
    dx: i * (DECOR_SIZE.explanadaL / 3),
    dz: 0,
    r: DECOR_SIZE.explanadaW * 0.95,
  })),
  cueva: [{ dx: 0, dz: 0, r: DECOR_SIZE.cueva * 0.9 }],
};

/**
 * Dónde va cada pieza (escena): el castillo al oeste y la Explanada al este
 * del puerto, un poco al norte (se ven al zarpar y flanquean la bocana sin
 * taparla ni pisar la ruta hacia la Cala), y el islote al oeste del punto de
 * la cueva, con la boca hacia él. Se mueven con el puerto y con la cueva.
 */
export const DECOR_OFFSET = {
  castillo: { x: -28, z: -10 },
  explanada: { x: 34, z: -12 },
  cueva: { x: -4.2, z: 0 },
} as const;

export function decorSpots(world: WorldConfig): DecorSpot[] {
  const sp = world.spawn ?? { x: 0, y: 0 };
  const cave = world.objects.find((o) => o.identity.id === 'secreto-cueva');
  const sx = toScene(sp.x);
  const sz = toScene(sp.y);
  const out: DecorSpot[] = [
    { kind: 'castillo', x: sx + DECOR_OFFSET.castillo.x, z: sz + DECOR_OFFSET.castillo.z },
    { kind: 'explanada', x: sx + DECOR_OFFSET.explanada.x, z: sz + DECOR_OFFSET.explanada.z },
  ];
  if (cave) {
    out.push({
      kind: 'cueva',
      x: toScene(cave.position.x) + DECOR_OFFSET.cueva.x,
      z: toScene(cave.position.y) + DECOR_OFFSET.cueva.z,
    });
  }
  return out;
}

/** Los círculos sólidos del decorado (u de motor). */
export function decorCircles(spots: readonly DecorSpot[]): (Circle & { kind: DecorKind })[] {
  return spots.flatMap((s) =>
    DECOR_SOLIDS[s.kind].map((c) => ({
      kind: s.kind,
      x: fromScene(s.x + c.dx),
      y: fromScene(s.z + c.dz),
      radius: fromScene(c.r),
    })),
  );
}

// --- Huellas y límites -----------------------------------------------------------

/** Hasta dónde llega lo sólido de un lugar desde su centro (u). */
export function footprintOf(o: WorldObject): number {
  const g = o.geometry;
  let r = Math.max(g.collision?.radius ?? 0, g.activation?.radius ?? 0);
  if (g.collision) {
    for (const p of g.collisionParts ?? []) r = Math.max(r, Math.hypot(p.dx, p.dy) + p.radius);
  }
  return r;
}

/** Los círculos sólidos de un lugar (su colisión y sus partes). */
function solidCircles(o: WorldObject): Circle[] {
  const g = o.geometry;
  if (!g.collision) return [];
  const out: Circle[] = [{ x: o.position.x, y: o.position.y, radius: g.collision.radius }];
  for (const p of g.collisionParts ?? []) {
    out.push({ x: o.position.x + p.dx, y: o.position.y + p.dy, radius: p.radius });
  }
  return out;
}

const isIsland = (o: WorldObject) => o.identity.category === 'isla';
const hasCollision = (o: WorldObject) => o.behaviors.some((b) => b.type === 'collision');

/**
 * Lo que ocupa el mar: todos los lugares (con su huella; el remolino, con su
 * giro), el anillo de salida y el decorado. El puerto en sí es el paseo del
 * 2D y aquí no se pinta: no cuenta.
 */
export function contentBounds(world: WorldConfig, decor: readonly Circle[]): Rect {
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  const add = (x: number, y: number, r: number) => {
    left = Math.min(left, x - r);
    right = Math.max(right, x + r);
    top = Math.min(top, y - r);
    bottom = Math.max(bottom, y + r);
  };
  for (const o of world.objects) {
    if (!o.identity.active || o.identity.category === 'puerto') continue;
    const r = Math.max(
      footprintOf(o),
      o.identity.category === 'remolino' ? (o.geometry.proximityRadius ?? 0) : 0,
    );
    add(o.position.x, o.position.y, r);
  }
  if (world.spawn) add(world.spawn.x, world.spawn.y, 60);
  for (const c of decor) add(c.x, c.y, c.radius);
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return { left: r2(left), right: r2(right), top: r2(top), bottom: r2(bottom) };
}

// --- La ruta de boyas ---------------------------------------------------------------

/**
 * El orden de la historia: del puerto (El Varadero) a la Cala del Alfar, el
 * remanso de la Boia Fiestera (la rescatas ahí), la isla del evento, el
 * Puerto de Fotos, la isla tienda, el Cañón y el Faro, y la Isla del
 * Amanecer (la última, donde la Fiestera baja: su misión la lleva hasta el
 * final de la ruta). Luego vuelve al puerto.
 */
export const ROUTE_STOPS = [
  'puerto',
  'cala',
  'fiestera',
  'allday',
  'fotos',
  'tienda',
  'canon',
  'faro',
  'ultima',
] as const;

/** Medidas de la ruta (u). muestra */
export const ROUTE = {
  /** Entre boya y boya. */
  spacing: 125,
  /** Entre trazo y trazo de la línea del mapa. */
  dash: 72,
  /** Agua libre entre las boyas y lo sólido. */
  clear: 50,
  /** Agua de más alrededor de cada parada antes de la primera boya. */
  stopClear: 70,
  /** La ruta se aparta de las islas que no son parada y del decorado. */
  detourPad: 70,
  /** La ruta sale del puerto recta por la bocana (hacia donde mira el barco) esto antes de girar. */
  exit: 320,
  /** Lo que no está en la ruta (el mar vivo) queda como mucho a esta distancia. */
  near: 240,
  /** Y separado de lo demás del mar vivo al menos esto. */
  spread: 110,
} as const;

/** El mar vivo que sale al paso: se acerca a la ruta (categorías, lo grande primero). */
export const ROUTE_NEIGHBOURS = ['naufrago', 'remolino', 'delfin', 'cofre', 'restos'] as const;

export interface SeaRoute {
  /** Ids de las paradas, en orden (las que hay en este mundo). */
  stops: string[];
  /** La línea, seguida (sin cortes en el borde: cada tramo por el camino corto). */
  path: Point[];
  /** Índice en `path` de cada parada; la última entrada es la vuelta al puerto. */
  stopAt: number[];
  /** Boyas, dentro del planeta. */
  buoys: Point[];
  /** Trazos de la línea del mapa: centro (dentro del planeta) y rumbo. */
  dashes: (Point & { angle: number })[];
}

const byId = (world: WorldConfig, id: string) =>
  world.objects.find((o) => o.identity.id === id && o.identity.active);

/** Dónde para la ruta en un lugar: el anillo de salida en el puerto, si no su centro. */
function stopPoint(world: WorldConfig, id: string): Point | null {
  if (id === 'puerto' && world.spawn) return { x: world.spawn.x, y: world.spawn.y };
  const o = byId(world, id);
  return o ? { x: o.position.x, y: o.position.y } : null;
}

/**
 * Cuánto se aparta la ruta de una parada antes de poner boyas: su huella y,
 * en el puerto y el remanso, lo sólido de su composición.
 */
function stopClearance(world: WorldConfig, id: string, at: Point): number {
  const o = byId(world, id);
  let r = o ? footprintOf(o) : 0;
  if (!o || !isIsland(o)) {
    for (const x of world.objects) {
      if (x.position.zone !== id || !hasCollision(x)) continue;
      const d = Math.hypot(x.position.x - at.x, x.position.y - at.y);
      if (d < 320) r = Math.max(r, d + footprintOf(x));
    }
  }
  return r + ROUTE.stopClear;
}

/** Lo más cercano de un tramo a `p` (en la copia de `p` más cercana al tramo). */
function nearestOnSegment(
  a: Point,
  b: Point,
  p: Point,
  period: Period,
): { d: number; t: number; q: Point; pc: Point; dir: Point } {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const s = shortest(mid, p, period);
  const pc = { x: mid.x + s.dx, y: mid.y + s.dy };
  const ax = b.x - a.x;
  const ay = b.y - a.y;
  const len2 = ax * ax + ay * ay;
  const t =
    len2 > 1e-9 ? Math.max(0, Math.min(1, ((pc.x - a.x) * ax + (pc.y - a.y) * ay) / len2)) : 0;
  const q = { x: a.x + ax * t, y: a.y + ay * t };
  const l = Math.sqrt(len2) || 1;
  return { d: Math.hypot(pc.x - q.x, pc.y - q.y), t, q, pc, dir: { x: ax / l, y: ay / l } };
}

/** Un tramo que pasa por encima de algo sólido da un rodeo por su lado. */
function detour(
  a: Point,
  b: Point,
  circles: readonly Circle[],
  period: Period,
  depth = 0,
): Point[] {
  if (depth > 5) return [b];
  let worst: { need: number; d: number; q: Point; pc: Point } | null = null;
  for (const c of circles) {
    const n = nearestOnSegment(a, b, c, period);
    if (n.t <= 0 || n.t >= 1) continue;
    const need = c.radius + ROUTE.detourPad;
    if (n.d >= need) continue;
    if (!worst || need - n.d > worst.need - worst.d) worst = { need, d: n.d, q: n.q, pc: n.pc };
  }
  if (!worst) return [b];
  const { q, pc, need } = worst;
  let nx = q.x - pc.x;
  let ny = q.y - pc.y;
  const nl = Math.hypot(nx, ny);
  if (nl < 1e-6) {
    // Justo por el centro: rodea por la izquierda del tramo.
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    nx = (b.y - a.y) / l;
    ny = -(b.x - a.x) / l;
  } else {
    nx /= nl;
    ny /= nl;
  }
  const w = { x: pc.x + nx * (need + 10), y: pc.y + ny * (need + 10) };
  return [...detour(a, w, circles, period, depth + 1), ...detour(w, b, circles, period, depth + 1)];
}

/** El periodo del planeta de un mundo ya a escala. */
export const periodOfWorld = (world: WorldConfig): Period => periodOf(planetRect(world.bounds));

/**
 * La ruta de boyas: sale recta por la bocana del puerto y une las paradas en
 * orden, cada tramo por el camino más corto del planeta (dando la vuelta si
 * lo es), rodeando las islas que no son parada y el decorado, y vuelve al
 * puerto. Sólo decorado: sin choques ni premios.
 */
export function seaRoute(world: WorldConfig): SeaRoute {
  const rect = planetRect(world.bounds);
  const period = periodOf(rect);
  const decor = decorCircles(decorSpots(world));
  const stops = ROUTE_STOPS.filter((id) => stopPoint(world, id));
  const at = stops.map((id) => stopPoint(world, id)!);

  // Islas (por id) y decorado: lo que la línea rodea.
  const islandCircles = new Map<string, Circle[]>();
  for (const o of world.objects) {
    if (o.identity.active && isIsland(o)) islandCircles.set(o.identity.id, solidCircles(o));
  }
  const avoid = (skip: readonly string[]) => [
    ...[...islandCircles].filter(([id]) => !skip.includes(id)).flatMap(([, c]) => c),
    ...decor,
  ];

  const path: Point[] = [];
  const stopAt: number[] = [];
  if (at.length) {
    path.push(at[0]!);
    stopAt.push(0);
    // Del anillo sale recta por la bocana: las primeras boyas quedan delante del barco.
    if (stops[0] === 'puerto' && world.spawn && at.length > 1) {
      const h = world.spawn.heading;
      path.push({ x: at[0]!.x + Math.cos(h) * ROUTE.exit, y: at[0]!.y + Math.sin(h) * ROUTE.exit });
    }
  }
  for (let i = 1; i <= at.length && at.length > 1; i++) {
    const k = i % at.length;
    const a = path[path.length - 1]!;
    const s = shortest(a, at[k]!, period);
    const b = { x: a.x + s.dx, y: a.y + s.dy };
    path.push(...detour(a, b, avoid([stops[i - 1]!, stops[k]!]), period));
    stopAt.push(path.length - 1);
  }

  // Lo que las boyas no pisan: todo lo sólido y el agua de cada parada.
  const solids: Circle[] = [...decor];
  for (const o of world.objects) {
    if (o.identity.active && hasCollision(o)) solids.push(...solidCircles(o));
  }
  const clears = stops.map((id, i) => ({ ...at[i]!, radius: stopClearance(world, id, at[i]!) }));
  const free = (p: Point, pad: number, withStops: boolean) =>
    solids.every((c) => {
      const s = shortest(c, p, period);
      return Math.hypot(s.dx, s.dy) >= c.radius + pad;
    }) &&
    (!withStops ||
      clears.every((c) => {
        const s = shortest(c, p, period);
        return Math.hypot(s.dx, s.dy) >= c.radius;
      }));
  const inside = (p: Point) => ({
    x: wrapIn(p.x, rect.left, rect.right),
    y: wrapIn(p.y, rect.top, rect.bottom),
  });

  const buoys: Point[] = [];
  const dashes: (Point & { angle: number })[] = [];
  const walk = (step: number, visit: (p: Point, angle: number) => void) => {
    let carry = step / 2;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]!;
      const b = path[i]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      let s = carry;
      for (; s < len; s += step) {
        visit({ x: a.x + ((b.x - a.x) * s) / len, y: a.y + ((b.y - a.y) * s) / len }, angle);
      }
      carry = s - len;
    }
  };
  walk(ROUTE.spacing, (p) => {
    if (free(p, ROUTE.clear, true)) buoys.push(inside(p));
  });
  walk(ROUTE.dash, (p, angle) => {
    if (free(p, 20, false)) dashes.push({ ...inside(p), angle });
  });
  return { stops, path, stopAt, buoys, dashes };
}

/**
 * Distancia de un punto a la ruta (por el camino corto), el punto de la ruta
 * más cercano (`q`, junto a la copia `pc` del punto), el rumbo de la ruta
 * allí y cuánto se lleva recorrido de ruta hasta él (`arc`).
 */
export function nearestOnRoute(
  route: SeaRoute,
  p: Point,
  period: Period,
): { d: number; q: Point; pc: Point; dir: Point; arc: number } {
  let best = { d: Infinity, q: p, pc: p, dir: { x: 1, y: 0 }, arc: 0 };
  let arc = 0;
  for (let i = 1; i < route.path.length; i++) {
    const a = route.path[i - 1]!;
    const b = route.path[i]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = nearestOnSegment(a, b, p, period);
    if (n.d < best.d) best = { ...n, arc: arc + n.t * len };
    arc += len;
  }
  return best;
}

/** El punto de la ruta a `arc` u del puerto (dando la vuelta a la ruta) y su rumbo. */
export function routeAt(route: SeaRoute, arc: number): { p: Point; dir: Point } {
  const path = route.path;
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y);
  }
  let s = total > 0 ? ((arc % total) + total) % total : 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (s <= len || i === path.length - 1) {
      const t = len > 0 ? Math.min(1, s / len) : 0;
      const l = len || 1;
      return {
        p: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
        dir: { x: (b.x - a.x) / l, y: (b.y - a.y) / l },
      };
    }
    s -= len;
  }
  return { p: path[0] ?? { x: 0, y: 0 }, dir: { x: 1, y: 0 } };
}

/** Mueve todos los puntos ({x, y}) de unos parámetros. */
function shiftParams(v: unknown, dx: number, dy: number, rect: Rect): unknown {
  if (Array.isArray(v)) return v.map((x) => shiftParams(x, dx, dy, rect));
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(o)) out[k] = shiftParams(x, dx, dy, rect);
    if (typeof o.x === 'number' && typeof o.y === 'number') {
      out.x = wrapIn(o.x + dx, rect.left, rect.right);
      out.y = wrapIn(o.y + dy, rect.top, rect.bottom);
    }
    return out;
  }
  return v;
}

/**
 * El mar vivo (náufrago, restos, cofres, delfín, remolino) sale al paso: lo
 * que queda lejos de la ruta se acerca hasta `ROUTE.near`, y lo que choca o
 * gira se aparta de la línea lo justo para no pisar las boyas. Sin
 * amontonarse (si dos caen juntos, el segundo se corre a lo largo de la
 * ruta), fuera de las islas, del decorado y de lo sólido. Se mueve con sus
 * parámetros (reapariciones, rastro del delfín).
 */
export function pullToRoute(world: WorldConfig, route: SeaRoute): WorldConfig {
  const rect = planetRect(world.bounds);
  const period = periodOf(rect);
  const cats: readonly string[] = ROUTE_NEIGHBOURS;
  const keepOut: Circle[] = [...decorCircles(decorSpots(world))];
  for (const o of world.objects) {
    if (o.identity.active && !cats.includes(o.identity.category) && hasCollision(o)) {
      keepOut.push(...solidCircles(o));
    }
  }
  const placed: Circle[] = [];
  /** Agua libre que queda hasta lo ya colocado (negativa: se pisan). */
  const room = (x: number, y: number, size: number) =>
    placed.reduce((m, c) => {
      const s = shortest(c, { x, y }, period);
      return Math.min(m, Math.hypot(s.dx, s.dy) - c.radius - size - ROUTE.spread);
    }, Infinity);
  // Lo grande primero (el orden de `ROUTE_NEIGHBOURS`), lo pequeño busca sitio después.
  const rank = (o: WorldObject) => cats.indexOf(o.identity.category);
  const todo = world.objects.filter((o) => rank(o) >= 0).sort((a, b) => rank(a) - rank(b));
  const moved = new Map<string, WorldObject>();
  for (const o of todo) {
    const size = Math.max(
      footprintOf(o),
      o.identity.category === 'remolino' ? (o.geometry.proximityRadius ?? 0) : 0,
    );
    // Lo que choca o gira, fuera de la línea; lo que se recoge, casi encima.
    const min =
      hasCollision(o) || o.identity.category === 'remolino' ? size + ROUTE.clear + 20 : 40;
    const p = { x: o.position.x, y: o.position.y };
    const n = nearestOnRoute(route, p, period);
    // A qué distancia de la línea y hacia qué lado (izquierda o derecha del rumbo).
    const off = Math.max(min, Math.min(ROUTE.near, n.d));
    const cross = n.dir.x * (n.pc.y - n.q.y) - n.dir.y * (n.pc.x - n.q.x);
    const side = cross < 0 ? -1 : 1;
    const beside = (r: { p: Point; dir: Point }) => ({
      x: r.p.x - r.dir.y * side * off,
      y: r.p.y + r.dir.x * side * off,
    });
    let x = n.pc.x;
    let y = n.pc.y;
    if (n.d > ROUTE.near || n.d < min) ({ x, y } = beside(routeAt(route, n.arc)));
    // Sin amontonarse: se corre a lo largo de la ruta hasta tener sitio (o el más holgado).
    let best = room(x, y, size);
    for (let k = 1; k <= 16 && best < 0; k++) {
      const along = Math.ceil(k / 2) * ROUTE.spread * (k % 2 ? 1 : -1);
      const c = beside(routeAt(route, n.arc + along));
      const r = room(c.x, c.y, size);
      if (r > best) {
        best = r;
        ({ x, y } = c);
      }
    }
    // Nunca dentro de una isla, del decorado ni de lo sólido.
    for (let iter = 0; iter < 4; iter++) {
      let moved = false;
      for (const c of keepOut) {
        const s = shortest(c, { x, y }, period);
        const d = Math.hypot(s.dx, s.dy);
        const need = c.radius + size + 40;
        if (d >= need) continue;
        const vx = d > 1e-6 ? s.dx / d : 1;
        const vy = d > 1e-6 ? s.dy / d : 0;
        x += vx * (need - d);
        y += vy * (need - d);
        moved = true;
      }
      if (!moved) break;
    }
    placed.push({ x, y, radius: size });
    const dx = x - p.x;
    const dy = y - p.y;
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) continue;
    const r2 = (v: number) => Math.round(v * 100) / 100;
    const out: WorldObject = {
      ...o,
      position: {
        ...o.position,
        x: r2(wrapIn(x, rect.left, rect.right)),
        y: r2(wrapIn(y, rect.top, rect.bottom)),
      },
    };
    if (o.params) out.params = shiftParams(o.params, dx, dy, rect) as Record<string, unknown>;
    out.behaviors = o.behaviors.map((b) =>
      b.type === 'spawn' && b.params.positions
        ? {
            ...b,
            params: {
              ...b.params,
              positions: shiftParams(b.params.positions, dx, dy, rect) as Point[],
            },
          }
        : b,
    );
    moved.set(o.identity.id, out);
  }
  const objects = world.objects.map((o) => moved.get(o.identity.id) ?? o);
  return { ...world, objects };
}

/**
 * El mundo de `/mar`: el mapa compartido a escala (compacto), con los
 * límites del planeta ajustados a lo que hay (sin mar vacío de más: el
 * margen es `PLANET_MARGIN`) y el mar vivo junto a la ruta de boyas.
 * `compact` 1 da las posiciones del mar de T33 (para comparar).
 */
export function marWorld(shared: WorldConfig, opts: { compact?: number } = {}): WorldConfig {
  const w = compressWorld(shared, opts);
  const sized: WorldConfig = { ...w, bounds: contentBounds(w, decorCircles(decorSpots(w))) };
  return pullToRoute(sized, seaRoute(sized));
}
