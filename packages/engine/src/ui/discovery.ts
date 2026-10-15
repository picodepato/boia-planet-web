import { type Vec2, type WorldConfig, type WorldObject, worldToScreen } from '@boia/world';

/**
 * Qué hay que descubrir en el mundo, qué se ha descubierto ya y hacia dónde
 * apunta la brújula (§10, REQ-MUN-020, REQ-MUN-022). Todo sale de los datos
 * del mundo: una isla nueva en el editor aparece aquí sin tocar código.
 */

/** Para qué sirve un punto, según sus comportamientos (lo que dice el mapa ampliado). */
export type TargetFunction =
  'event' | 'tickets' | 'guide' | 'reward' | 'teleport' | 'minigame' | 'circuit';

/**
 * Etiquetas de objeto que el mapa respeta: `oculto` no sale en el minimapa ni
 * en la brújula (secretos, REQ-AVE-015); `sin-brujula` sale en el minimapa
 * pero la brújula no lo persigue (restos, cofres, boies de carril).
 */
export const HIDDEN_TAG = 'oculto';
export const NO_COMPASS_TAG = 'sin-brujula';

export type MarkerKind = 'island' | 'boia' | 'obstacle' | 'point';

export interface DiscoveryTarget {
  id: string;
  name: string;
  kind: MarkerKind;
  x: number;
  y: number;
  /** Radio de colisión (para dibujarlo a escala en el mapa). */
  size: number;
  /** Radio en el que el barco lo descubre. */
  discoverRadius: number;
  functions: TargetFunction[];
  /** Evento que abre (para señalar su isla al entrar desde ese evento). */
  eventRef?: string;
}

export interface MapMarker {
  id: string;
  kind: MarkerKind;
  x: number;
  y: number;
  size: number;
}

/** Margen de descubrimiento para lo que no tiene radio de proximidad. muestra */
export const DISCOVERY_MARGIN = 160;

function kindOf(o: WorldObject): MarkerKind {
  const c = o.identity.category.toLowerCase();
  if (c === 'isla' || c === 'island') return 'island';
  if (c === 'boia') return 'boia';
  if (c === 'obstaculo' || c === 'obstacle') return 'obstacle';
  if (o.behaviors.some((b) => b.type === 'collision') && o.behaviors.length === 1)
    return 'obstacle';
  return 'point';
}

function functionsOf(o: WorldObject): TargetFunction[] {
  const out = new Set<TargetFunction>();
  for (const b of o.behaviors) {
    if (b.type === 'content' && b.params.target === 'event') out.add('event');
    if (b.type === 'ticket') out.add('tickets');
    if (b.type === 'dialogue') out.add('guide');
    if (b.type === 'reward' || b.type === 'collectible') out.add('reward');
    if (b.type === 'teleport') out.add('teleport');
    if (b.type === 'start_minigame') out.add('minigame');
    if (b.type === 'checkpoint') out.add('circuit');
  }
  return [...out];
}

function proximityOf(o: WorldObject): number | null {
  for (const b of o.behaviors) {
    if (b.type === 'proximity' && b.params.radius) return b.params.radius;
  }
  return o.geometry.proximityRadius ?? null;
}

const sizeOf = (o: WorldObject) =>
  o.geometry.collision?.radius ?? o.geometry.activation?.radius ?? 0;

/** Todo lo activo, para dibujar el minimapa. */
export function mapMarkers(world: WorldConfig): MapMarker[] {
  return world.objects
    .filter((o) => o.identity.active && !o.identity.tags.includes(HIDDEN_TAG))
    .map((o) => ({
      id: o.identity.id,
      kind: kindOf(o),
      x: o.position.x,
      y: o.position.y,
      size: sizeOf(o),
    }));
}

/**
 * Lo que cuenta como objetivo: islas, boies y cualquier punto con una
 * función (evento, entradas, diálogo, premio…). Rocas y decorado, no.
 */
export function discoveryTargets(world: WorldConfig): DiscoveryTarget[] {
  const out: DiscoveryTarget[] = [];
  for (const o of world.objects) {
    if (!o.identity.active) continue;
    if (o.identity.tags.includes(HIDDEN_TAG) || o.identity.tags.includes(NO_COMPASS_TAG)) continue;
    const kind = kindOf(o);
    const functions = functionsOf(o);
    if (kind === 'obstacle' || (kind === 'point' && functions.length === 0)) continue;
    const size = sizeOf(o);
    const eventRef = o.behaviors.find((b) => b.type === 'content' && b.params.target === 'event');
    const ref = eventRef?.type === 'content' ? eventRef.params.ref : undefined;
    out.push({
      id: o.identity.id,
      name: o.identity.name,
      kind,
      x: o.position.x,
      y: o.position.y,
      size,
      discoverRadius: proximityOf(o) ?? size + DISCOVERY_MARGIN,
      functions,
      ...(ref ? { eventRef: ref } : {}),
    });
  }
  return out;
}

/**
 * Ángulo de pantalla (rad; 0 = derecha, positivo = horario) de `from` a
 * `to`, con la proyección del motor: es el que dibuja la aguja.
 */
export function compassAngle(from: Vec2, to: Vec2): number {
  const a = worldToScreen(from);
  const b = worldToScreen(to);
  return Math.atan2(b.y - a.y, b.x - a.x);
}

export class DiscoveryTracker {
  private readonly found = new Set<string>();
  private selectedId: string | null = null;
  readonly targets: readonly DiscoveryTarget[];

  constructor(targets: readonly DiscoveryTarget[], discovered: Iterable<string> = []) {
    this.targets = targets;
    for (const id of discovered) if (targets.some((t) => t.id === id)) this.found.add(id);
  }

  isDiscovered(id: string): boolean {
    return this.found.has(id);
  }

  discovered(): string[] {
    return this.targets.filter((t) => this.found.has(t.id)).map((t) => t.id);
  }

  get selected(): DiscoveryTarget | null {
    return this.targets.find((t) => t.id === this.selectedId) ?? null;
  }

  /** Elige el objetivo de la brújula (null = automático). */
  select(id: string | null): void {
    this.selectedId = id !== null && this.targets.some((t) => t.id === id) ? id : null;
  }

  /** Elige la isla del evento `eventId`, si la hay (entrada desde un evento). */
  selectEvent(eventId: string): boolean {
    const t = this.targets.find((x) => x.eventRef === eventId);
    this.select(t?.id ?? null);
    return !!t;
  }

  /**
   * Marca lo que el barco tiene dentro de su radio y devuelve lo recién
   * descubierto. Llegar al objetivo elegido lo suelta: la brújula vuelve a
   * lo siguiente sin explorar.
   */
  update(ship: Vec2): DiscoveryTarget[] {
    const fresh: DiscoveryTarget[] = [];
    for (const t of this.targets) {
      const inRange = Math.hypot(ship.x - t.x, ship.y - t.y) <= t.discoverRadius;
      if (!inRange) continue;
      if (t.id === this.selectedId) this.selectedId = null;
      if (this.found.has(t.id)) continue;
      this.found.add(t.id);
      fresh.push(t);
    }
    return fresh;
  }

  /** Hacia dónde apunta la brújula: lo elegido o, si no, lo más cercano sin descubrir. */
  nextTarget(ship: Vec2): DiscoveryTarget | null {
    const sel = this.selected;
    if (sel) return sel;
    let best: DiscoveryTarget | null = null;
    let bestD = Infinity;
    for (const t of this.targets) {
      if (this.found.has(t.id)) continue;
      const d = Math.hypot(ship.x - t.x, ship.y - t.y);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }
}
