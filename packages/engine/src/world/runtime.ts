import {
  type Behavior,
  type BehaviorParams,
  type BehaviorTrigger,
  COLLISION_DEFAULTS,
  type CollisionMode,
  type Rect,
  type WorldConfig,
  type WorldObject,
} from '@boia/world';
import type { ShipConfig } from '../ship/config';
import {
  type CircleObstacle,
  type ShipState,
  collideShip,
  wrapDelta,
  wrapInto,
} from '../ship/controller';
import { READABLE_MAX_MS, readableDurationMs } from '../ui/notifications';
import type { WorldEvent } from './events';
import { MemoryRewardStore, type RewardStore, rewardKey } from './rewards';

/**
 * Motor de comportamientos del mundo (v14 §48): ejecuta el catálogo de
 * `@boia/world` sobre los objetos de un `WorldConfig`, sin Pixi ni DOM. No
 * conoce el asset de ningún objeto: dos objetos con la misma geometría y los
 * mismos comportamientos se comportan igual lleven la imagen que lleven.
 *
 * Cada paso fijo: `shipConfig()` da la física del barco con los efectos
 * activos (ralentizar, boost); después de mover el barco, `step()` resuelve
 * colisiones, contacto, recogida y proximidad, avanza temporizadores y
 * encola `WorldEvent`s, que la aplicación lee con `drainEvents()`.
 */

/**
 * Registro de minijuegos para INICIAR_MINIJUEGO. Vacío en L1 (D-08, REQ-MUN-026):
 * el comportamiento existe y emite `minigame` con `available: false`.
 */
export const MINIGAMES: ReadonlyMap<string, unknown> = new Map();

export interface RuntimeOptions {
  /** Temporada activa, para las recompensas «una por temporada». */
  seasonId?: string;
  /** Sesión de juego, para las recompensas «una por sesión». */
  sessionId?: string;
  rewards?: RewardStore;
  /** Semilla de SPAWN; la misma semilla da las mismas apariciones. */
  seed?: number;
  /** Si el evento está a la venta (TICKET desaparece en histórico). */
  ticketAvailable?: (eventId: string) => boolean;
  minigames?: ReadonlyMap<string, unknown>;
  /**
   * Bocadillos con tiempo de lectura (D-22, REQ-AVE-002): cada línea (y la
   * reacción) dura lo que pide su texto (`readableDurationMs`: al menos 3 s,
   * más si es larga, tope 8 s) o el intervalo del DIÁLOGO si es mayor. Sin
   * ella, el intervalo del DIÁLOGO (1,5 s de D-07). `/mar` y `/juego` la
   * encienden.
   */
  readableDialogue?: boolean;
  /**
   * Mundo que da la vuelta (el planeta de agua de `/mar`, D-22): `bounds` es
   * el periodo; el barco sale por un lado y vuelve por el opuesto, y
   * contacto, proximidad, recogida, remolinos y diálogos se miden por el
   * camino más corto. Sin ella (por defecto, `/juego`), costas y límites.
   */
  wrap?: boolean;
}

/** u extra para dar por terminado un contacto (evita parpadeo en el borde). */
const CONTACT_SLOP = 1;
const CONTACT_RELEASE = 6;
/** Radio de alejamiento de un diálogo sin proximidad: radio de contacto + esto. */
const DIALOGUE_LEAVE_MARGIN = 120;

const ACTION_TYPES = new Set<Behavior['type']>([
  'dialogue',
  'reward',
  'content',
  'ticket',
  'checkpoint',
  'teleport',
  'achievement',
  'start_minigame',
]);

interface Action {
  index: number;
  behavior: Behavior;
  on: BehaviorTrigger;
}

interface CollisionRule {
  mode: CollisionMode;
  intensity: number;
  duration: number;
  solid: boolean;
  radius: number;
  /** Círculos extra (islas alargadas), relativos al objeto. */
  parts: { dx: number; dy: number; radius: number }[];
}

/**
 * Vaivén de un objeto entre puntos (`params.patrol`), p. ej. el cocodrilo del
 * circuito (REQ-AVE-030). Ida y vuelta en `period` s. muestra
 */
interface Patrol {
  points: { x: number; y: number }[];
  period: number;
}

/**
 * Fuerza de un remolino (`params.swirl`) dentro de su radio de proximidad
 * (REQ-AVE-019): empuja el barco de lado (u/s² de giro) y un poco hacia el
 * centro. El catálogo no tiene este efecto; va como parámetro del objeto.
 */
interface Swirl {
  strength: number;
  pull: number;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function pointsOf(v: unknown): { x: number; y: number }[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((p) => {
    const x = num((p as { x?: unknown })?.x);
    const y = num((p as { y?: unknown })?.y);
    return x !== null && y !== null ? [{ x, y }] : [];
  });
}

function patrolOf(o: WorldObject): Patrol | null {
  const p = o.params?.patrol as { points?: unknown; period?: unknown } | undefined;
  const points = pointsOf(p?.points);
  const period = num(p?.period);
  return points.length >= 2 && period && period > 0 ? { points, period } : null;
}

function swirlOf(o: WorldObject): Swirl | null {
  const s = o.params?.swirl as { strength?: unknown; pull?: unknown } | undefined;
  const strength = num(s?.strength);
  return strength ? { strength, pull: num(s?.pull) ?? 0 } : null;
}

interface Obj {
  id: string;
  object: WorldObject;
  x: number;
  y: number;
  /** Altura sobre el agua (u) de un movimiento guionizado (la Fiestera que sube a bordo). */
  z: number;
  present: boolean;
  /**
   * Sin interacción: se dibuja, pero no choca, no tiene proximidad ni
   * contacto y no dispara nada (la Fiestera mientras sube a bordo y ya
   * entregada en su isla, T21).
   */
  inert: boolean;
  collision: CollisionRule | null;
  /** Radio de contacto (activación o colisión). */
  touchRadius: number | null;
  inContact: boolean;
  proximityRadius: number | null;
  hysteresis: number;
  inProximity: boolean;
  collect: { radius: number; respawn: number | null } | null;
  respawnIn: number | null;
  spawn: BehaviorParams<'spawn'> | null;
  spawnPhase: 'alive' | 'waiting' | null;
  spawnTimer: number;
  actions: Action[];
  dialogueDone: boolean;
  openContent: Map<number, { target: string; ref?: string }>;
  patrol: Patrol | null;
  swirl: Swirl | null;
}

interface Effect {
  source: string;
  factor: number;
  remaining: number;
}

interface ActiveDialogue {
  obj: Obj;
  params: BehaviorParams<'dialogue'>;
  index: number;
  timer: number;
  reaction: string | null;
}

export interface DialogueView {
  objectId: string;
  text: string;
  index: number;
  count: number;
  /** Mostrando la reacción por alejarse. */
  reaction: boolean;
}

export interface ObjectRuntimeState {
  id: string;
  x: number;
  y: number;
  /** Altura sobre el agua (u); 0 salvo en movimientos guionizados. */
  z?: number;
  present: boolean;
  inProximity: boolean;
}

function defaultTrigger(o: WorldObject): BehaviorTrigger {
  if (o.behaviors.some((b) => b.type === 'collectible')) return 'collect';
  if (proximityRadiusOf(o) !== null) return 'proximity_enter';
  return 'contact';
}

function proximityRadiusOf(o: WorldObject): number | null {
  const p = o.behaviors.find((b) => b.type === 'proximity');
  return (
    (p?.type === 'proximity' ? p.params.radius : undefined) ?? o.geometry.proximityRadius ?? null
  );
}

function collisionRuleOf(o: WorldObject): CollisionRule | null {
  const radius = o.geometry.collision?.radius ?? o.geometry.activation?.radius;
  if (radius === undefined) return null;
  // Una sola regla por objeto: la primera COLISIÓN del catálogo.
  const b = o.behaviors.find((x) => x.type === 'collision');
  if (b?.type !== 'collision') return null;
  const d = COLLISION_DEFAULTS[b.params.mode];
  return {
    mode: b.params.mode,
    intensity: b.params.intensity ?? d.intensity,
    duration: b.params.duration,
    solid: b.params.solid ?? d.solid,
    radius,
    parts: o.geometry.collision ? (o.geometry.collisionParts ?? []) : [],
  };
}

/** Obstáculos sólidos iniciales de un mundo (objetos activos con COLISIÓN sólida). */
export function solidObstaclesOf(world: WorldConfig): CircleObstacle[] {
  return new WorldRuntime(world).solidObstacles();
}

/** Punto del vaivén en el instante `t` (ida y vuelta por los puntos). */
export function patrolPoint(p: Patrol, t: number): { x: number; y: number } {
  const legs = p.points.length - 1;
  const phase = (t / p.period) % 1;
  // 0 → 1 ida, 1 → 0 vuelta.
  const u = (phase < 0.5 ? phase * 2 : 2 - phase * 2) * legs;
  const i = Math.min(legs - 1, Math.floor(u));
  const f = u - i;
  const a = p.points[i]!;
  const b = p.points[i + 1]!;
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

export class WorldRuntime {
  readonly bounds: Rect;
  private readonly objs: Obj[] = [];
  private readonly byId = new Map<string, Obj>();
  private readonly queue: WorldEvent[] = [];
  private readonly effects: Effect[] = [];
  private active: ActiveDialogue | null = null;
  private readonly rewards: RewardStore;
  private readonly scope: { seasonId: string; sessionId: string };
  private readonly ticketAvailable: (eventId: string) => boolean;
  private readonly minigames: ReadonlyMap<string, unknown>;
  private readonly readableDialogue: boolean;
  /** Mundo que da la vuelta (`RuntimeOptions.wrap`). */
  readonly wrap: boolean;
  private seed: number;
  private shipRadius = 0;
  /** s simulados. */
  time = 0;

  constructor(world: WorldConfig, opts: RuntimeOptions = {}) {
    this.bounds = world.bounds;
    this.rewards = opts.rewards ?? new MemoryRewardStore();
    this.scope = { seasonId: opts.seasonId ?? 'default', sessionId: opts.sessionId ?? 'session' };
    this.ticketAvailable = opts.ticketAvailable ?? (() => true);
    this.minigames = opts.minigames ?? MINIGAMES;
    this.readableDialogue = opts.readableDialogue ?? false;
    this.wrap = opts.wrap ?? false;
    this.seed = (opts.seed ?? 1) >>> 0 || 1;

    for (const o of world.objects) {
      if (!o.identity.active) continue;
      const on = defaultTrigger(o);
      const prox = o.behaviors.find((b) => b.type === 'proximity');
      const collectible = o.behaviors.find((b) => b.type === 'collectible');
      const spawn = o.behaviors.find((b) => b.type === 'spawn');
      const touch = o.geometry.activation?.radius ?? o.geometry.collision?.radius ?? null;
      const obj: Obj = {
        id: o.identity.id,
        object: o,
        x: o.position.x,
        y: o.position.y,
        z: 0,
        present: o.state?.visible ?? true,
        inert: false,
        collision: collisionRuleOf(o),
        touchRadius: touch,
        inContact: false,
        proximityRadius: proximityRadiusOf(o),
        hysteresis: prox?.type === 'proximity' ? prox.params.hysteresis : 12,
        inProximity: false,
        collect:
          collectible?.type === 'collectible'
            ? {
                radius: collectible.params.radius ?? touch ?? 16,
                respawn: collectible.params.respawn ?? null,
              }
            : null,
        respawnIn: null,
        spawn: spawn?.type === 'spawn' ? spawn.params : null,
        spawnPhase: null,
        spawnTimer: 0,
        actions: o.behaviors.flatMap((behavior, index) =>
          ACTION_TYPES.has(behavior.type)
            ? [{ index, behavior, on: ('on' in behavior.params && behavior.params.on) || on }]
            : [],
        ),
        dialogueDone: false,
        openContent: new Map(),
        patrol: patrolOf(o),
        swirl: swirlOf(o),
      };
      if (obj.spawn) this.rollSpawn(obj, false);
      this.objs.push(obj);
      this.byId.set(obj.id, obj);
    }
  }

  // --- Lectura -------------------------------------------------------------

  drainEvents(): WorldEvent[] {
    return this.queue.splice(0, this.queue.length);
  }

  objectState(id: string): ObjectRuntimeState | undefined {
    const o = this.byId.get(id);
    return (
      o && {
        id,
        x: o.x,
        y: o.y,
        ...(o.z ? { z: o.z } : {}),
        present: o.present,
        inProximity: o.inProximity,
      }
    );
  }

  objectStates(): ObjectRuntimeState[] {
    return this.objs.map((o) => this.objectState(o.id)!);
  }

  dialogue(): DialogueView | null {
    const a = this.active;
    if (!a) return null;
    return {
      objectId: a.obj.id,
      text: a.reaction ?? a.params.lines[a.index]!.text,
      index: a.index,
      count: a.params.lines.length,
      reaction: a.reaction !== null,
    };
  }

  /** Multiplicador actual de la velocidad máxima por efectos activos. */
  speedFactor(): number {
    return this.effects.reduce((k, e) => k * e.factor, 1);
  }

  /** Física del barco para el próximo paso, con ralentizar y boost aplicados. */
  shipConfig(base: ShipConfig): ShipConfig {
    const k = this.speedFactor();
    if (k === 1) return base;
    return {
      ...base,
      maxSpeed: base.maxSpeed * k,
      acceleration: base.acceleration * Math.max(1, k),
    };
  }

  solidObstacles(): CircleObstacle[] {
    const out: CircleObstacle[] = [];
    for (const o of this.objs) {
      const c = o.collision;
      if (!o.present || o.inert || !c?.solid) continue;
      const restitution = c.mode === 'bounce' ? c.intensity : 0;
      out.push({ x: o.x, y: o.y, radius: c.radius, restitution });
      for (const p of c.parts) {
        out.push({ x: o.x + p.dx, y: o.y + p.dy, radius: p.radius, restitution });
      }
    }
    return out;
  }

  // --- Encuentros guionizados desde la aplicación --------------------------

  /**
   * Mueve un objeto (el delfín que salta, T20; la Fiestera que sube a bordo,
   * T21). `z` lo levanta sobre el agua (u; sólo se ve, no cambia la
   * simulación). Su proximidad y su contacto se recalculan en el siguiente paso.
   */
  moveObject(id: string, x: number, y: number, z = 0): boolean {
    const o = this.byId.get(id);
    if (!o) return false;
    o.x = x;
    o.y = y;
    o.z = z;
    return true;
  }

  /**
   * Quita o devuelve la interacción de un objeto: sin ella se dibuja pero no
   * choca ni dispara nada, y sale de su proximidad y de su diálogo.
   */
  setObjectInteractive(id: string, interactive: boolean): boolean {
    const o = this.byId.get(id);
    if (!o) return false;
    if (o.inert === !interactive) return true;
    o.inert = !interactive;
    if (o.inert) {
      o.inContact = false;
      if (o.inProximity) this.leaveProximity(o, null, null);
      if (this.active?.obj === o) this.endDialogue('interrupted');
    }
    return true;
  }

  /** Muestra u oculta un objeto (un cocodrilo que se sumerge). */
  setObjectPresent(id: string, present: boolean): boolean {
    const o = this.byId.get(id);
    if (!o) return false;
    this.setPresent(o, present);
    return true;
  }

  // --- Acciones del jugador sobre el diálogo --------------------------------

  /** Toque sobre el bocadillo: siguiente línea, o cierra si era la última. */
  advanceDialogue(): boolean {
    const a = this.active;
    if (!a) return false;
    if (a.reaction !== null) this.endDialogue('interrupted');
    else if (a.index < a.params.lines.length - 1) this.showLine(a, a.index + 1);
    else this.endDialogue('completed');
    return true;
  }

  /** Saltar: cierra el diálogo entero. */
  skipDialogue(): boolean {
    const a = this.active;
    if (!a) return false;
    this.endDialogue(a.reaction !== null ? 'interrupted' : 'skipped');
    return true;
  }

  // --- Paso de simulación ---------------------------------------------------

  /**
   * Un paso fijo, después de `stepShip`. Resuelve costas y obstáculos sólidos
   * (con la restitución de cada uno), contacto, recogida y proximidad, y
   * avanza efectos, apariciones y diálogo. Muta `ship`.
   */
  step(ship: ShipState, cfg: ShipConfig, dt: number): void {
    this.time += dt;
    this.shipRadius = cfg.radius;
    this.tickEffects(dt);
    this.tickObjects(dt);
    this.tickDialogue(ship, dt);

    this.applySwirls(ship, dt);
    collideShip(
      ship,
      { bounds: this.bounds, obstacles: this.solidObstacles(), wrap: this.wrap },
      cfg,
      dt,
    );

    const r = cfg.radius;
    for (const o of this.objs) {
      if (!o.present || o.inert) continue;
      const d = this.distance(ship.x, ship.y, o.x, o.y);

      if (o.touchRadius !== null) {
        const reach = o.touchRadius + r + CONTACT_SLOP;
        if (!o.inContact && d <= reach) {
          o.inContact = true;
          this.emit({
            type: 'contact',
            objectId: o.id,
            ...(o.collision ? { mode: o.collision.mode } : {}),
          });
          this.applyCollision(o, ship, cfg);
          this.fire(o, 'contact', ship, cfg);
        } else if (o.inContact && d > reach + CONTACT_RELEASE) {
          o.inContact = false;
        }
      }

      if (o.collect && d <= o.collect.radius + r) {
        this.collect(o);
        this.fire(o, 'collect', ship, cfg);
        continue;
      }

      if (o.proximityRadius !== null) {
        if (!o.inProximity && d <= o.proximityRadius) {
          o.inProximity = true;
          this.emit({ type: 'proximity_enter', objectId: o.id });
          this.fire(o, 'proximity_enter', ship, cfg);
        } else if (o.inProximity && d > o.proximityRadius + o.hysteresis) {
          this.leaveProximity(o, ship, cfg);
        }
      }
    }
  }

  // --- Internos ---------------------------------------------------------------

  private emit(e: WorldEvent): void {
    this.queue.push(e);
  }

  /**
   * De (ax, ay) a (bx, by): la diferencia b − a, por el camino más corto si
   * el mundo da la vuelta.
   */
  delta(ax: number, ay: number, bx: number, by: number): { dx: number; dy: number } {
    const dx = bx - ax;
    const dy = by - ay;
    if (!this.wrap) return { dx, dy };
    const b = this.bounds;
    return { dx: wrapDelta(dx, b.right - b.left), dy: wrapDelta(dy, b.bottom - b.top) };
  }

  /** Distancia entre dos puntos (por el camino más corto si el mundo da la vuelta). */
  distance(ax: number, ay: number, bx: number, by: number): number {
    if (!this.wrap) return Math.hypot(bx - ax, by - ay);
    const { dx, dy } = this.delta(ax, ay, bx, by);
    return Math.hypot(dx, dy);
  }

  /** Remolinos: giro alrededor del centro, más fuerte cuanto más dentro. */
  private applySwirls(ship: ShipState, dt: number): void {
    for (const o of this.objs) {
      if (!o.swirl || !o.present || o.inert || o.proximityRadius === null) continue;
      const { dx, dy } = this.delta(o.x, o.y, ship.x, ship.y);
      const d = Math.hypot(dx, dy);
      if (d >= o.proximityRadius || d < 1e-6) continue;
      const k = 1 - d / o.proximityRadius;
      const nx = dx / d;
      const ny = dy / d;
      // Tangente en sentido horario en pantalla (+x hacia +y) y tirón al centro.
      ship.vx += (-ny * o.swirl.strength * k - nx * o.swirl.pull * k) * dt;
      ship.vy += (nx * o.swirl.strength * k - ny * o.swirl.pull * k) * dt;
    }
  }

  private rand(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  private leaveProximity(o: Obj, ship: ShipState | null, cfg: ShipConfig | null): void {
    o.inProximity = false;
    this.emit({ type: 'proximity_exit', objectId: o.id });
    for (const [index, c] of o.openContent) {
      this.emit({
        type: 'content_close',
        objectId: o.id,
        target: c.target,
        ...(c.ref ? { ref: c.ref } : {}),
      });
      o.openContent.delete(index);
    }
    if (ship && cfg) this.fire(o, 'proximity_exit', ship, cfg);
  }

  private setPresent(o: Obj, present: boolean): void {
    if (o.present === present) return;
    o.present = present;
    o.inContact = false;
    if (present) {
      this.emit({ type: 'appeared', objectId: o.id, x: o.x, y: o.y });
    } else {
      if (o.inProximity) this.leaveProximity(o, null, null);
      if (this.active?.obj === o) this.endDialogue('interrupted');
      this.emit({ type: 'disappeared', objectId: o.id });
    }
  }

  private rollSpawn(o: Obj, emit: boolean): void {
    const s = o.spawn!;
    const appear = this.rand() < s.probability;
    if (appear && s.positions.length > 0) {
      const p =
        s.positions[
          Math.min(s.positions.length - 1, Math.floor(this.rand() * s.positions.length))
        ]!;
      o.x = p.x;
      o.y = p.y;
    }
    if (emit) this.setPresent(o, appear);
    else o.present = appear;
    if (appear && s.lifetime !== undefined) {
      o.spawnPhase = 'alive';
      o.spawnTimer = s.lifetime;
    } else if (!appear && s.every !== undefined) {
      o.spawnPhase = 'waiting';
      o.spawnTimer = s.every;
    } else {
      o.spawnPhase = null;
    }
  }

  private tickObjects(dt: number): void {
    for (const o of this.objs) {
      if (o.patrol) {
        const { x, y } = patrolPoint(o.patrol, this.time);
        o.x = x;
        o.y = y;
      }
      if (o.respawnIn !== null) {
        o.respawnIn -= dt;
        if (o.respawnIn <= 1e-9) {
          o.respawnIn = null;
          this.setPresent(o, true);
        }
      }
      if (o.spawnPhase === null) continue;
      o.spawnTimer -= dt;
      if (o.spawnTimer > 1e-9) continue;
      if (o.spawnPhase === 'alive') {
        this.setPresent(o, false);
        if (o.spawn!.every !== undefined) {
          o.spawnPhase = 'waiting';
          o.spawnTimer = o.spawn!.every;
        } else {
          o.spawnPhase = null;
        }
      } else {
        this.rollSpawn(o, true);
      }
    }
  }

  private collect(o: Obj): void {
    this.emit({ type: 'collected', objectId: o.id });
    this.setPresent(o, false);
    if (o.spawn?.every !== undefined) {
      o.spawnPhase = 'waiting';
      o.spawnTimer = o.spawn.every;
    } else if (o.collect!.respawn !== null) {
      o.spawnPhase = null;
      o.respawnIn = o.collect!.respawn;
    } else {
      o.spawnPhase = null;
    }
  }

  private tickEffects(dt: number): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i]!;
      e.remaining -= dt;
      if (e.remaining <= 1e-9) this.effects.splice(i, 1);
    }
  }

  private addEffect(source: string, factor: number, duration: number): void {
    const existing = this.effects.find((e) => e.source === source);
    if (existing) {
      existing.factor = factor;
      existing.remaining = duration;
    } else if (duration > 0) {
      this.effects.push({ source, factor, remaining: duration });
    }
  }

  private boost(
    source: string,
    ship: ShipState,
    cfg: ShipConfig,
    fraction: number,
    duration: number,
  ) {
    const factor = 1 + fraction;
    this.addEffect(source, factor, duration);
    // Impulso inmediato hacia la proa hasta la nueva velocidad máxima.
    const fx = Math.cos(ship.heading);
    const fy = Math.sin(ship.heading);
    const vF = ship.vx * fx + ship.vy * fy;
    const target = cfg.maxSpeed * factor;
    if (vF < target) {
      ship.vx += fx * (target - vF);
      ship.vy += fy * (target - vF);
    }
    this.emit({ type: 'effect', objectId: source, effect: 'boost', factor, duration });
  }

  private applyCollision(o: Obj, ship: ShipState, cfg: ShipConfig): void {
    const c = o.collision;
    if (!c) return;
    switch (c.mode) {
      case 'slow': {
        const factor = 1 - c.intensity;
        this.addEffect(o.id, factor, c.duration);
        this.emit({ type: 'effect', objectId: o.id, effect: 'slow', factor, duration: c.duration });
        break;
      }
      case 'boost':
        this.boost(o.id, ship, cfg, c.intensity, c.duration);
        break;
      case 'brake': {
        const factor = 1 - c.intensity;
        ship.vx *= factor;
        ship.vy *= factor;
        this.emit({ type: 'effect', objectId: o.id, effect: 'brake', factor, duration: 0 });
        break;
      }
      case 'block':
      case 'bounce':
        break;
    }
  }

  private fire(o: Obj, trigger: BehaviorTrigger, ship: ShipState, cfg: ShipConfig): void {
    for (const a of o.actions) {
      if (a.on === trigger) this.run(o, a, ship, cfg);
    }
  }

  private run(o: Obj, a: Action, ship: ShipState, cfg: ShipConfig): void {
    const b = a.behavior;
    switch (b.type) {
      case 'dialogue':
        this.startDialogue(o, b.params);
        break;
      case 'reward': {
        const key = rewardKey(b.params.frequency, o.id, a.index, this.scope);
        if (key !== null) {
          if (this.rewards.has(key)) break;
          this.rewards.add(key);
        }
        this.emit({
          type: 'reward',
          objectId: o.id,
          kind: b.params.kind,
          amount: b.params.amount,
          ...(b.params.ref ? { ref: b.params.ref } : {}),
          frequency: b.params.frequency,
          key,
        });
        break;
      }
      case 'content': {
        const ref = b.params.ref ? { ref: b.params.ref } : {};
        if (b.params.closeOnExit) o.openContent.set(a.index, { target: b.params.target, ...ref });
        this.emit({ type: 'content_open', objectId: o.id, target: b.params.target, ...ref });
        break;
      }
      case 'ticket':
        if (this.ticketAvailable(b.params.eventId)) {
          this.emit({ type: 'ticket', objectId: o.id, eventId: b.params.eventId });
        }
        break;
      case 'checkpoint':
        this.emit({
          type: 'checkpoint',
          objectId: o.id,
          ...(b.params.circuitId ? { circuitId: b.params.circuitId } : {}),
          order: b.params.order,
        });
        if (b.params.boost > 0) this.boost(o.id, ship, cfg, b.params.boost, b.params.duration);
        break;
      case 'teleport': {
        const p = this.safePoint(b.params.x, b.params.y);
        ship.x = p.x;
        ship.y = p.y;
        ship.vx = 0;
        ship.vy = 0;
        if (b.params.heading !== undefined) ship.heading = b.params.heading;
        this.emit({ type: 'teleport', objectId: o.id, x: p.x, y: p.y });
        break;
      }
      case 'achievement':
        this.emit({
          type: 'achievement',
          objectId: o.id,
          trigger: b.params.trigger,
          amount: b.params.amount,
        });
        break;
      case 'start_minigame': {
        const gameId = b.params.gameId;
        this.emit({
          type: 'minigame',
          objectId: o.id,
          ...(gameId ? { gameId } : {}),
          available: gameId !== undefined && this.minigames.has(gameId),
        });
        break;
      }
      default:
        break;
    }
  }

  /**
   * Punto de agua navegable más cercano a (x, y): dentro de los límites y
   * fuera de todo obstáculo sólido. Un teletransporte nunca deja el barco en
   * tierra (§48.3).
   */
  safePoint(x: number, y: number, shipRadius = this.shipRadius): { x: number; y: number } {
    const r = shipRadius;
    const b = this.bounds;
    const obstacles = this.solidObstacles();
    // Con el mundo que da la vuelta no hay costa: el punto se lleva dentro del periodo.
    const clampX = this.wrap
      ? (v: number) => wrapInto(v, b.left, b.right)
      : (v: number) => Math.min(Math.max(v, b.left + r), b.right - r);
    const clampY = this.wrap
      ? (v: number) => wrapInto(v, b.top, b.bottom)
      : (v: number) => Math.min(Math.max(v, b.top + r), b.bottom - r);
    const free = (px: number, py: number) =>
      px === clampX(px) &&
      py === clampY(py) &&
      obstacles.every((o) => this.distance(px, py, o.x, o.y) >= o.radius + r);
    let px = clampX(x);
    let py = clampY(y);
    for (let pass = 0; pass < 8 && !free(px, py); pass++) {
      for (const o of obstacles) {
        const { dx, dy } = this.delta(o.x, o.y, px, py);
        const d = Math.hypot(dx, dy);
        const min = o.radius + r + CONTACT_SLOP;
        if (d >= min) continue;
        const nx = d > 1e-6 ? dx / d : 0;
        const ny = d > 1e-6 ? dy / d : 1;
        px += nx * min - dx;
        py += ny * min - dy;
      }
      px = clampX(px);
      py = clampY(py);
    }
    if (free(px, py)) return { x: px, y: py };
    // Encajonado entre obstáculos y costa: el agua libre más cercana, en espiral.
    const ox = px;
    const oy = py;
    for (let d = 8; d < 4000; d += 8) {
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        const qx = ox + Math.cos(a) * d;
        const qy = oy + Math.sin(a) * d;
        if (free(qx, qy)) return { x: qx, y: qy };
      }
    }
    return { x: px, y: py };
  }

  private startDialogue(o: Obj, params: BehaviorParams<'dialogue'>): void {
    if (params.lines.length === 0) return;
    if (params.once && o.dialogueDone) return;
    if (this.active?.obj === o && this.active.reaction === null) return;
    if (this.active) this.endDialogue('interrupted');
    this.active = { obj: o, params, index: 0, timer: 0, reaction: null };
    this.showLine(this.active, 0);
  }

  private showLine(a: ActiveDialogue, index: number): void {
    a.index = index;
    a.timer = 0;
    const line = a.params.lines[index]!;
    this.emit({
      type: 'dialogue_line',
      objectId: a.obj.id,
      index,
      count: a.params.lines.length,
      text: line.text,
      ...(line.cue ? { cue: line.cue } : {}),
    });
  }

  private endDialogue(reason: 'completed' | 'skipped' | 'interrupted'): void {
    const a = this.active;
    if (!a) return;
    if (reason !== 'interrupted') a.obj.dialogueDone = true;
    this.active = null;
    this.emit({ type: 'dialogue_end', objectId: a.obj.id, reason });
  }

  /** s que se queda en pantalla la línea (o la reacción) visible. */
  private lineSeconds(a: ActiveDialogue): number {
    const interval = a.params.interval;
    if (!this.readableDialogue) return interval;
    const text = a.reaction ?? a.params.lines[a.index]!.text;
    return Math.min(READABLE_MAX_MS / 1000, Math.max(interval, readableDurationMs(text) / 1000));
  }

  private tickDialogue(ship: ShipState, dt: number): void {
    const a = this.active;
    if (!a) return;
    // El barco se aleja con el diálogo a medias: reacción juguetona (§7).
    if (a.reaction === null) {
      const o = a.obj;
      const leave =
        o.proximityRadius !== null
          ? o.proximityRadius + o.hysteresis
          : (o.touchRadius ?? 0) + this.shipRadius + DIALOGUE_LEAVE_MARGIN;
      if (this.distance(ship.x, ship.y, o.x, o.y) > leave) {
        a.reaction = a.params.leaveReaction;
        a.timer = 0;
        this.emit({ type: 'dialogue_reaction', objectId: o.id, text: a.reaction });
        return;
      }
    }
    a.timer += dt;
    if (a.timer < this.lineSeconds(a) - 1e-9) return;
    if (a.reaction !== null) this.endDialogue('interrupted');
    else if (a.index < a.params.lines.length - 1) this.showLine(a, a.index + 1);
    else this.endDialogue('completed');
  }
}
