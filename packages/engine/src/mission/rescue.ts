import { type WorldConfig, type WorldObject, parseAssetRef } from '@boia/world';

/**
 * Misión de rescate y entrega (la Boia Fiestera, REQ-AVE-005…010), sin Pixi
 * ni DOM. Es genérica por mundo: todo sale de los datos del mapa compartido,
 * así cada mundo (Arcilla, Acuarela…) juega la misma misión con su piel.
 *
 * - El personaje es el objeto con `params.mission` (y `params.character`,
 *   el id del personaje en el catálogo de logros). Sube a bordo al entrar el
 *   barco en su radio de proximidad (`geometry.proximityRadius`) con todos
 *   los cocodrilos sumergidos.
 * - Los cocodrilos son los objetos de categoría `cocodrilo` de su zona. Con
 *   el barco a menos de `params.crocRadius` se sumergen uno a uno (el más
 *   cercano primero, uno cada `CROC_INTERVAL`) y al alejarse vuelven.
 * - El destino es el lugar con `params.missionDestination` igual al id de la
 *   misión. Se guarda al rescatar, por id de lugar (nunca coordenadas): una
 *   partida empezada sigue yendo a ese lugar aunque cambie el mundo o el
 *   Admin elija otro destino para las nuevas (REQ-AVE-010, REQ-AVE-011).
 *   La entrega salta al entrar en el radio de proximidad del destino, desde
 *   cualquier lado; ahí baja a `params.missionDrop` y se queda.
 *
 * Todos los tiempos y alturas son `muestra`.
 */

/** s entre dos cocodrilos que se sumergen o emergen. */
export const CROC_INTERVAL = 0.4;
/** u extra para que vuelvan a salir (evita que parpadeen en el borde). */
export const CROC_HYSTERESIS = 30;
/** s que tarda en subir a bordo y en bajar a su isla. */
export const BOARD_SECONDS = 1;
export const LAND_SECONDS = 1.2;
/** Altura del salto al subir y al bajar (u). */
export const HOP_HEIGHT = 60;

export interface Point {
  x: number;
  y: number;
}

export interface RescueMissionSpec {
  missionId: string;
  /** Id del personaje en el catálogo de logros (`triggerParams.character`). */
  character: string;
  /** Objeto del mundo que es el personaje antes del rescate. */
  characterId: string;
  home: Point;
  rescueRadius: number;
  crocRadius: number;
  crocIds: string[];
  /** Destino para partidas nuevas (id de lugar). */
  destination: string;
  /** Arte de la tripulante a bordo: la pieza `tripulante` del arte del personaje. */
  crewAsset: string | null;
}

export interface MissionDestination {
  placeId: string;
  center: Point;
  radius: number;
  /** Dónde se queda: posición en el agua y altura (u) hasta el nicho. */
  drop: Point & { z: number };
  reward: MissionReward;
}

/**
 * El premio grande de la entrega (REQ-AVE-008): puntos, monedas y, si el
 * destino lo dice (`missionReward.discount`, T59), el id de un código de
 * entradas que se da al entregarla.
 */
export interface MissionReward {
  points: number;
  coins: number;
  discount?: string;
}

export type RescueStep = 'rescued' | 'delivered';

/** Lo que se guarda de la misión: paso y destino por id de lugar. */
export interface SavedRescue {
  step: RescueStep;
  destination: string;
}

export type RescuePhase = 'loading' | 'waiting' | 'boarding' | 'aboard' | 'landing' | 'delivered';

export type MissionEvent =
  | { type: 'croc_dive'; objectId: string }
  | { type: 'croc_emerge'; objectId: string }
  /** Rescatada: empieza a subir a bordo. Guardar el paso aquí. */
  | { type: 'rescued'; missionId: string; character: string; destination: string }
  /** Ya a bordo, en el slot TRIPULANTE: el aviso. */
  | { type: 'boarded'; missionId: string; character: string; destination: string }
  /** Entregada: baja a su isla. Guardar, logro y premio aquí. */
  | {
      type: 'delivered';
      missionId: string;
      character: string;
      destination: string;
      reward: MissionReward;
    }
  /** Ya en su sitio de la isla. */
  | { type: 'landed'; missionId: string; destination: string };

/** Lo que la misión mueve: el runtime del mundo y el slot del barco. */
export interface MissionHost {
  moveObject(id: string, x: number, y: number, z?: number): boolean;
  setObjectPresent(id: string, present: boolean): boolean;
  setObjectInteractive(id: string, interactive: boolean): boolean;
  setPassenger(on: boolean): void;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

function proximityOf(o: WorldObject): number | null {
  return o.geometry.proximityRadius ?? null;
}

/** El lugar que es destino de una misión en este mundo (el de las partidas nuevas). */
export function missionDestinationId(world: WorldConfig, missionId: string): string | null {
  const o = world.objects.find(
    (x) => x.identity.active && x.params?.missionDestination === missionId,
  );
  return o?.identity.id ?? null;
}

/** El destino guardado (id de lugar) en este mundo, o null si aquí no está. */
export function missionDestination(world: WorldConfig, placeId: string): MissionDestination | null {
  const o = world.objects.find((x) => x.identity.id === placeId && x.identity.active);
  if (!o) return null;
  const prox = o.behaviors.find((b) => b.type === 'proximity');
  const radius =
    (prox?.type === 'proximity' ? prox.params.radius : undefined) ?? proximityOf(o) ?? null;
  if (radius === null) return null;
  const d = o.params?.missionDrop as { x?: unknown; y?: unknown; z?: unknown } | undefined;
  const r = o.params?.missionReward as
    | { points?: unknown; coins?: unknown; discount?: unknown }
    | undefined;
  const discount = str(r?.discount);
  const center = { x: o.position.x, y: o.position.y };
  const dx = num(d?.x);
  const dy = num(d?.y);
  return {
    placeId,
    center,
    radius,
    drop: dx !== null && dy !== null ? { x: dx, y: dy, z: num(d?.z) ?? 0 } : { ...center, z: 0 },
    reward: {
      points: Math.max(0, num(r?.points) ?? 0),
      coins: Math.max(0, num(r?.coins) ?? 0),
      ...(discount ? { discount } : {}),
    },
  };
}

/**
 * La misión de este mundo (la primera con `params.mission`, o la pedida), o
 * null si falta el personaje, sus radios o su destino: nunca hay una misión
 * con destino inexistente (REQ-AVE-010).
 */
export function rescueMissionOf(world: WorldConfig, missionId?: string): RescueMissionSpec | null {
  const o = world.objects.find(
    (x) =>
      x.identity.active &&
      str(x.params?.mission) !== null &&
      (missionId === undefined || x.params?.mission === missionId),
  );
  if (!o) return null;
  const id = str(o.params?.mission)!;
  const rescueRadius = proximityOf(o);
  const crocRadius = num(o.params?.crocRadius) ?? rescueRadius;
  const destination = missionDestinationId(world, id);
  if (rescueRadius === null || crocRadius === null || destination === null) return null;
  const home = { x: o.position.x, y: o.position.y };
  const zone = o.position.zone;
  const crocIds = world.objects
    .filter(
      (x) =>
        x.identity.active &&
        x.identity.category === 'cocodrilo' &&
        zone !== undefined &&
        x.position.zone === zone,
    )
    .map((x) => x.identity.id);
  const ref = parseAssetRef(o.appearance.asset);
  const crewAsset =
    o.appearance.asset.startsWith('placeholder:') || !ref.part ? null : `${ref.base}#tripulante`;
  return {
    missionId: id,
    character: str(o.params?.character) ?? id,
    characterId: o.identity.id,
    home,
    rescueRadius,
    crocRadius,
    crocIds,
    destination,
    crewAsset,
  };
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const ease = (k: number) => k * k * (3 - 2 * k);

/**
 * La misión en marcha. Se crea con el mundo que se juega, `restore` le da lo
 * guardado (hasta entonces está `loading` y no hace nada) y `step` avanza en
 * cada paso fijo del motor. `setWorld` la pasa a otro mundo sin perder el
 * paso ni el destino; el siguiente `step` vuelve a poner personaje,
 * cocodrilos y tripulante en el runtime nuevo.
 */
export class RescueMission {
  private spec: RescueMissionSpec;
  private world: WorldConfig;
  private phaseValue: RescuePhase = 'loading';
  private destinationId: string | null = null;
  private readonly dived = new Set<string>();
  private crocTimer = CROC_INTERVAL;
  private anim: { t: number; from: Point & { z: number } } | null = null;
  private applied: MissionHost | null = null;

  constructor(world: WorldConfig, spec: RescueMissionSpec) {
    this.world = world;
    this.spec = spec;
  }

  get phase(): RescuePhase {
    return this.phaseValue;
  }

  get missionId(): string {
    return this.spec.missionId;
  }

  get character(): string {
    return this.spec.character;
  }

  get crewAsset(): string | null {
    return this.spec.crewAsset;
  }

  /** Destino guardado (desde el rescate) o, antes, el de las partidas nuevas. */
  get destination(): string {
    return this.destinationId ?? this.spec.destination;
  }

  /** Cocodrilos sumergidos ahora. */
  get divedCrocs(): readonly string[] {
    return [...this.dived];
  }

  /** Con la Fiestera en el slot TRIPULANTE. */
  get aboard(): boolean {
    return this.phaseValue === 'aboard';
  }

  /** Lo guardado de otras visitas; null si aún no la ha rescatado. */
  restore(saved: SavedRescue | null): void {
    if (this.phaseValue !== 'loading') return;
    if (!saved) {
      this.phaseValue = 'waiting';
    } else {
      this.destinationId = saved.destination;
      this.phaseValue = saved.step === 'delivered' ? 'delivered' : 'aboard';
    }
    this.applied = null;
  }

  /** Otro mundo sobre el mismo mapa: mismo paso y mismo destino guardado. */
  setWorld(world: WorldConfig): boolean {
    const spec = rescueMissionOf(world, this.spec.missionId);
    if (!spec) return false;
    this.world = world;
    this.spec = spec;
    this.applied = null;
    // A medio subir o bajar, el cambio lo termina.
    if (this.phaseValue === 'boarding') this.phaseValue = 'aboard';
    if (this.phaseValue === 'landing') this.phaseValue = 'delivered';
    this.anim = null;
    return true;
  }

  step(host: MissionHost, ship: Point, dt: number): MissionEvent[] {
    if (this.phaseValue === 'loading') return [];
    const out: MissionEvent[] = [];
    if (this.applied !== host) this.apply(host);
    this.stepCrocs(host, ship, dt, out);
    switch (this.phaseValue) {
      case 'waiting':
        this.tryRescue(host, ship, out);
        break;
      case 'boarding':
        this.stepBoarding(host, ship, dt, out);
        break;
      case 'aboard':
        this.tryDeliver(host, ship, out);
        break;
      case 'landing':
        this.stepLanding(host, dt, out);
        break;
      default:
        break;
    }
    return out;
  }

  // --- Internos ---------------------------------------------------------------

  /** Pone en el runtime lo que corresponde al paso (runtime nuevo, recarga). */
  private apply(host: MissionHost): void {
    this.applied = host;
    const c = this.spec.characterId;
    for (const id of this.spec.crocIds) host.setObjectPresent(id, !this.dived.has(id));
    const p = this.phaseValue;
    if (p === 'waiting') {
      host.moveObject(c, this.spec.home.x, this.spec.home.y);
      host.setObjectInteractive(c, true);
      host.setObjectPresent(c, true);
      host.setPassenger(false);
    } else if (p === 'boarding' || p === 'aboard') {
      host.setObjectInteractive(c, false);
      host.setObjectPresent(c, p === 'boarding');
      host.setPassenger(p === 'aboard');
    } else if (p === 'landing' || p === 'delivered') {
      host.setPassenger(false);
      const d = missionDestination(this.world, this.destination);
      host.setObjectInteractive(c, false);
      if (d && p === 'delivered') host.moveObject(c, d.drop.x, d.drop.y, d.drop.z);
      host.setObjectPresent(c, d !== null);
    }
  }

  private stepCrocs(host: MissionHost, ship: Point, dt: number, out: MissionEvent[]): void {
    const ids = this.spec.crocIds;
    if (ids.length === 0) return;
    const d = dist(ship, this.spec.home);
    const near = d <= this.spec.crocRadius;
    const far = d > this.spec.crocRadius + CROC_HYSTERESIS;
    const up = ids.filter((id) => !this.dived.has(id));
    const wants = (near && up.length > 0) || (far && this.dived.size > 0);
    if (!wants) {
      this.crocTimer = CROC_INTERVAL;
      return;
    }
    this.crocTimer += dt;
    if (this.crocTimer < CROC_INTERVAL - 1e-9) return;
    this.crocTimer = 0;
    const byDistance = (list: string[]) =>
      list
        .map((id) => ({ id, d: this.crocDistance(id, ship) }))
        .sort((a, b) => a.d - b.d)
        .map((x) => x.id);
    if (near) {
      const id = byDistance(up)[0]!;
      this.dived.add(id);
      host.setObjectPresent(id, false);
      out.push({ type: 'croc_dive', objectId: id });
    } else {
      const id = byDistance([...this.dived]).at(-1)!;
      this.dived.delete(id);
      host.setObjectPresent(id, true);
      out.push({ type: 'croc_emerge', objectId: id });
    }
  }

  private crocDistance(id: string, ship: Point): number {
    const o = this.world.objects.find((x) => x.identity.id === id);
    return o ? dist(ship, o.position) : Infinity;
  }

  private tryRescue(host: MissionHost, ship: Point, out: MissionEvent[]): void {
    const s = this.spec;
    if (dist(ship, s.home) > s.rescueRadius) return;
    if (s.crocIds.some((id) => !this.dived.has(id))) return;
    this.destinationId = s.destination;
    this.phaseValue = 'boarding';
    this.anim = { t: 0, from: { ...s.home, z: 0 } };
    host.setObjectInteractive(s.characterId, false);
    out.push({
      type: 'rescued',
      missionId: s.missionId,
      character: s.character,
      destination: this.destination,
    });
  }

  private stepBoarding(host: MissionHost, ship: Point, dt: number, out: MissionEvent[]): void {
    const a = this.anim!;
    a.t += dt;
    const k = Math.min(1, a.t / BOARD_SECONDS);
    const e = ease(k);
    // Sale del agua y sube al barco con un saltito.
    host.moveObject(
      this.spec.characterId,
      a.from.x + (ship.x - a.from.x) * e,
      a.from.y + (ship.y - a.from.y) * e,
      Math.sin(Math.PI * k) * HOP_HEIGHT + k * 12,
    );
    if (k < 1) return;
    this.anim = null;
    this.phaseValue = 'aboard';
    host.setObjectPresent(this.spec.characterId, false);
    host.setPassenger(true);
    out.push({
      type: 'boarded',
      missionId: this.spec.missionId,
      character: this.spec.character,
      destination: this.destination,
    });
  }

  private tryDeliver(host: MissionHost, ship: Point, out: MissionEvent[]): void {
    const d = missionDestination(this.world, this.destination);
    if (!d || dist(ship, d.center) > d.radius) return;
    const c = this.spec.characterId;
    this.phaseValue = 'landing';
    this.anim = { t: 0, from: { x: ship.x, y: ship.y, z: 12 } };
    host.setPassenger(false);
    host.setObjectInteractive(c, false);
    host.moveObject(c, ship.x, ship.y, 12);
    host.setObjectPresent(c, true);
    out.push({
      type: 'delivered',
      missionId: this.spec.missionId,
      character: this.spec.character,
      destination: d.placeId,
      reward: d.reward,
    });
  }

  private stepLanding(host: MissionHost, dt: number, out: MissionEvent[]): void {
    const d = missionDestination(this.world, this.destination);
    const a = this.anim!;
    if (!d) {
      this.phaseValue = 'delivered';
      this.anim = null;
      return;
    }
    a.t += dt;
    const k = Math.min(1, a.t / LAND_SECONDS);
    const e = ease(k);
    host.moveObject(
      this.spec.characterId,
      a.from.x + (d.drop.x - a.from.x) * e,
      a.from.y + (d.drop.y - a.from.y) * e,
      a.from.z + (d.drop.z - a.from.z) * e + Math.sin(Math.PI * k) * HOP_HEIGHT,
    );
    if (k < 1) return;
    host.moveObject(this.spec.characterId, d.drop.x, d.drop.y, d.drop.z);
    this.anim = null;
    this.phaseValue = 'delivered';
    out.push({ type: 'landed', missionId: this.spec.missionId, destination: d.placeId });
  }
}
