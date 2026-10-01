import type { WorldObject } from '@boia/world';

/**
 * Encuentros del mar vivo que el catálogo no guioniza solo (T20, T45): el
 * delfín que aparece junto al barco y guía (REQ-AVE-018, O15) y el reto del
 * remolino (REQ-AVE-019). Sin React ni motor: la web los alimenta con el
 * tiempo, el barco y los eventos de proximidad y aplica lo que devuelven
 * (mover el delfín, conceder el premio). Números `muestra`.
 */

type Point = { x: number; y: number };

function pointList(v: unknown): Point[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((p) => {
    const x = (p as Point | null)?.x;
    const y = (p as Point | null)?.y;
    return typeof x === 'number' && typeof y === 'number' ? [{ x, y }] : [];
  });
}

/**
 * El delfín de rastro fijo (T20), el que sigue usando /mar: cada vez que el
 * barco lo alcanza salta al siguiente punto de su rastro (`params.trail`);
 * tras el último salto, alcanzarlo da el premio y vuelve a su sitio. /juego
 * usa el delfín guía (`DolphinGuide`, T45); pasar /mar a él queda para
 * después del plan 003.
 */
export class DolphinTrail {
  readonly objectId: string;
  readonly home: Point;
  readonly trail: Point[];
  readonly coins: number;
  private step = 0;

  constructor(o: WorldObject) {
    this.objectId = o.identity.id;
    this.home = { x: o.position.x, y: o.position.y };
    this.trail = pointList(o.params?.trail);
    const c = o.params?.rewardCoins;
    this.coins = typeof c === 'number' && c > 0 ? Math.round(c) : 10;
  }

  /** El barco llegó hasta el delfín: adónde salta y si toca premio. */
  reached(): { moveTo: Point; reward: boolean } {
    if (this.step < this.trail.length) {
      return { moveTo: this.trail[this.step++]!, reward: false };
    }
    this.step = 0;
    return { moveTo: this.home, reward: true };
  }

  get jumps(): number {
    return this.step;
  }
}

/** El delfín de rastro fijo del mapa (/mar). */
export function findDolphin(objects: readonly WorldObject[]): DolphinTrail | null {
  const o = objects.find((x) => x.identity.category === 'delfin' && x.identity.active);
  return o ? new DolphinTrail(o) : null;
}

/** Algo sin descubrir hacia donde puede guiar el delfín. */
export interface GuideTarget {
  id: string;
  x: number;
  y: number;
}

/** `?delfin=<s>`: el delfín sale tras esos segundos de mar abierto (pruebas y demos). */
export const DOLPHIN_PARAM = 'delfin';

/** Números del delfín (O15, REQ-AVE-018). muestra */
export const DOLPHIN_TUNING = {
  /** Segundos de mar abierto entre apariciones: entre 2 y 4 minutos. */
  minInterval: 120,
  maxInterval: 240,
  /** Bajo el agua junto al barco antes de asomar (da tiempo a su arte). */
  surfaceDelay: 0.8,
  /** Saltos hacia el objetivo, cuánto dura cada uno y cuánto se sumerge entre saltos. */
  hops: 3,
  hopSeconds: 2.2,
  diveSeconds: 0.7,
  /** u que avanza en cada salto (sin pasarse del objetivo). */
  hopDistance: 170,
  /** Dónde asoma respecto al barco: al costado y un poco por delante (u). */
  side: 90,
  ahead: 70,
  /** Seguirlo: el barco a menos de esto (u) cuando reaparece. */
  followRadius: 260,
  /** Sólo guía hacia algo a menos de esto (u). */
  maxTargetDistance: 4000,
} as const;

export type DolphinTuning = { -readonly [K in keyof typeof DOLPHIN_TUNING]: number };

/** Lo que la web hace con el delfín en el motor. */
export type DolphinAction =
  /** Colocarlo (sumergido) en un punto. */
  | { type: 'place'; x: number; y: number }
  /** Asoma: se ve donde está. */
  | { type: 'surface' }
  /** Se sumerge (no se ve ni interactúa). */
  | { type: 'dive' }
  /** Terminó y se fue: `followed` si el barco lo siguió hasta el final. */
  | { type: 'gone'; followed: boolean; targetId: string };

type Phase = 'away' | 'surfacing' | 'hop' | 'dive';

/**
 * El delfín guía (O15, REQ-AVE-018): tras 2–4 minutos de mar abierto aparece
 * junto al barco, avanza unos saltos hacia algo que el visitante todavía no
 * ha descubierto (sumergiéndose entre salto y salto) y se va. Seguirlo es
 * opcional: si el barco lo acompaña hasta el final, hay premio (lo da la web).
 * Sin React ni motor: la web le da el tiempo, el barco y si está en mar
 * abierto, y aplica lo que devuelve. `random` para las pruebas.
 */
export class DolphinGuide {
  readonly objectId: string;
  readonly home: Point;
  readonly coins: number;
  private readonly tuning: DolphinTuning;
  private readonly random: () => number;
  private phase: Phase = 'away';
  private wait: number;
  private timer = 0;
  private hop = 0;
  private followedHops = 0;
  private pos: Point;
  private target: GuideTarget | null = null;

  constructor(
    o: Pick<WorldObject, 'identity' | 'position' | 'params'>,
    opts: { tuning?: Partial<DolphinTuning>; random?: () => number } = {},
  ) {
    this.objectId = o.identity.id;
    this.home = { x: o.position.x, y: o.position.y };
    this.pos = { ...this.home };
    const c = o.params?.rewardCoins;
    this.coins = typeof c === 'number' && c > 0 ? Math.round(c) : 10;
    this.tuning = { ...DOLPHIN_TUNING, ...opts.tuning };
    this.random = opts.random ?? Math.random;
    this.wait = this.nextWait();
  }

  private nextWait(): number {
    const { minInterval, maxInterval } = this.tuning;
    return minInterval + (maxInterval - minInterval) * this.random();
  }

  /** Está fuera, junto al barco. */
  get active(): boolean {
    return this.phase !== 'away';
  }

  /** Segundos de mar abierto que faltan para que aparezca. */
  get untilNext(): number {
    return this.phase === 'away' ? this.wait : 0;
  }

  get position(): Point {
    return { ...this.pos };
  }

  get guiding(): GuideTarget | null {
    return this.target;
  }

  /**
   * Un paso: `ship` con su rumbo (rad, 0 = +x), `openSea` si el barco está
   * lejos de islas y sin carrera ni panel, y el objetivo sin descubrir más
   * cercano (o null: sin nada que enseñar, no sale).
   */
  step(
    dt: number,
    ship: { x: number; y: number; heading: number },
    ctx: { openSea: boolean; target: GuideTarget | null },
  ): DolphinAction[] {
    const t = this.tuning;
    switch (this.phase) {
      case 'away': {
        if (!ctx.openSea || !ctx.target) return [];
        if (Math.hypot(ctx.target.x - ship.x, ctx.target.y - ship.y) > t.maxTargetDistance) {
          return [];
        }
        this.wait -= dt;
        if (this.wait > 0) return [];
        this.target = ctx.target;
        const fx = Math.cos(ship.heading);
        const fy = Math.sin(ship.heading);
        // A estribor si el objetivo queda a ese lado; si no, a babor.
        const cross = fx * (ctx.target.y - ship.y) - fy * (ctx.target.x - ship.x);
        const side = cross >= 0 ? 1 : -1;
        this.pos = {
          x: ship.x + fx * t.ahead - fy * t.side * side,
          y: ship.y + fy * t.ahead + fx * t.side * side,
        };
        this.phase = 'surfacing';
        this.timer = t.surfaceDelay;
        this.hop = 0;
        this.followedHops = 0;
        return [{ type: 'place', ...this.pos }];
      }
      case 'surfacing':
        this.timer -= dt;
        if (this.timer > 0) return [];
        this.phase = 'hop';
        this.timer = t.hopSeconds;
        return [{ type: 'surface' }];
      case 'hop': {
        this.timer -= dt;
        if (this.timer > 0) return [];
        if (Math.hypot(ship.x - this.pos.x, ship.y - this.pos.y) <= t.followRadius) {
          this.followedHops++;
        }
        this.hop++;
        if (this.hop >= t.hops) return this.leave();
        this.phase = 'dive';
        this.timer = t.diveSeconds;
        return [{ type: 'dive' }];
      }
      case 'dive': {
        this.timer -= dt;
        if (this.timer > 0) return [];
        const target = this.target!;
        const dx = target.x - this.pos.x;
        const dy = target.y - this.pos.y;
        const d = Math.hypot(dx, dy);
        const step = Math.min(t.hopDistance, Math.max(0, d - t.hopDistance * 0.5));
        if (d > 0) this.pos = { x: this.pos.x + (dx / d) * step, y: this.pos.y + (dy / d) * step };
        this.phase = 'hop';
        this.timer = t.hopSeconds;
        return [{ type: 'place', ...this.pos }, { type: 'surface' }];
      }
    }
  }

  /** Se va: se sumerge, vuelve a su sitio de descanso y espera otra vez. */
  private leave(): DolphinAction[] {
    const targetId = this.target?.id ?? '';
    const followed = this.followedHops >= this.tuning.hops;
    this.phase = 'away';
    this.wait = this.nextWait();
    this.target = null;
    this.pos = { ...this.home };
    return [
      { type: 'dive' },
      { type: 'place', ...this.home },
      { type: 'gone', followed, targetId },
    ];
  }

  /** Otro mundo (otro motor): si estaba fuera, se va sin premio y vuelve a esperar. */
  reset(): void {
    this.phase = 'away';
    this.target = null;
    this.pos = { ...this.home };
    this.wait = Math.max(this.wait, this.tuning.minInterval / 2);
  }
}

/** El delfín guía del mapa (/juego). */
export function findDolphinGuide(
  objects: readonly WorldObject[],
  opts?: { tuning?: Partial<DolphinTuning>; random?: () => number },
): DolphinGuide | null {
  const o = objects.find((x) => x.identity.category === 'delfin' && x.identity.active);
  return o ? new DolphinGuide(o, opts) : null;
}

/** Lo que el delfín puede enseñar: lo que da algo y todavía no se ha encontrado. */
const GUIDE_CATEGORIES = new Set(['secreto', 'cofre', 'isla', 'naufrago', 'boia']);

/**
 * El objetivo sin descubrir más cercano al barco (ni ya encontrado, ni ya al
 * alcance del barco), o null.
 */
export function undiscoveredTarget(
  objects: readonly WorldObject[],
  found: { has(id: string): boolean },
  ship: Point,
  minDistance = 400,
): GuideTarget | null {
  let best: GuideTarget | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const o of objects) {
    if (!o.identity.active || found.has(o.identity.id)) continue;
    if (!GUIDE_CATEGORIES.has(o.identity.category)) continue;
    const d = Math.hypot(o.position.x - ship.x, o.position.y - ship.y);
    if (d < minDistance || d >= bestD) continue;
    best = { id: o.identity.id, x: o.position.x, y: o.position.y };
    bestD = d;
  }
  return best;
}

/**
 * Mar abierto: el barco no está en el radio (ampliado) de ninguna isla ni
 * de nada con lo que hablar, así el delfín no tapa un panel ni un bocadillo.
 */
export function inOpenSea(objects: readonly WorldObject[], ship: Point, margin = 1.5): boolean {
  for (const o of objects) {
    if (!o.identity.active) continue;
    const r = o.geometry.proximityRadius;
    if (r === undefined || o.identity.category === 'delfin') continue;
    if (Math.hypot(o.position.x - ship.x, o.position.y - ship.y) < r * margin) return false;
  }
  return true;
}

/** Tramos del remolino: segundos dentro → monedas, cada tramo una vez al día. muestra */
export const WHIRLPOOL_TIERS: readonly { seconds: number; coins: number }[] = [
  { seconds: 3, coins: 2 },
  { seconds: 6, coins: 4 },
  { seconds: 10, coins: 6 },
];

/**
 * El reto del remolino: cuánto aguanta el barco dentro (más tiempo, más
 * premio). Devuelve los tramos alcanzados al salir.
 */
export class WhirlpoolTimer {
  private enteredAt: number | null = null;

  enter(now: number): void {
    this.enteredAt ??= now;
  }

  /** Salida: los tramos conseguidos (de menor a mayor). */
  exit(now: number): { seconds: number; tiers: typeof WHIRLPOOL_TIERS } {
    const t = this.enteredAt === null ? 0 : (now - this.enteredAt) / 1000;
    this.enteredAt = null;
    return { seconds: t, tiers: WHIRLPOOL_TIERS.filter((x) => t >= x.seconds) };
  }

  get inside(): boolean {
    return this.enteredAt !== null;
  }
}
