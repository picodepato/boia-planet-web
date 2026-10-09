import {
  type CircuitRace,
  type CircuitSpec,
  type GhostPose,
  type GhostRun,
  type InvalidReason,
  type RaceEvent,
  circuitRecordId,
  decodeGhost,
  encodeGhost,
} from '@boia/engine/circuit';
import type { WorldConfig } from '@boia/world';

/**
 * El Freu en /mar (T37, T61): el evento CHECKPOINT del mundo llega por id de
 * objeto; la carrera recibe su orden y también el id, para recordar por qué
 * boias pasó (`finish.route`). Un objeto que no es del circuito no hace
 * nada. Aquí también: dónde espera el barco la salida, el orden de paso de
 * una vuelta y el fantasma de la mejor carrera guardado en este navegador.
 */
export function raceCheckpoint(race: CircuitRace, objectId: string, now: number): RaceEvent[] {
  const order = race.orderOf(objectId);
  return order === null ? [] : race.checkpoint(order, now, objectId);
}

/**
 * Por qué se anula el intento en este paso (REQ-AVE-032), o null. El barco
 * se teletransporta si el motor lo puso en otro sitio de un salto
 * (`Mar3D.jumpCount` cambió: «Saltar» un viaje, `startNear`, despegar en
 * nave) o si navega solo (un viaje o un vuelo en curso). Los paneles anulan
 * al abrirse ('panel') y una recarga no deja nada que anular: el intento
 * vive sólo en memoria.
 */
export function raceStepInvalid(s: {
  jumpsBefore: number;
  jumpsNow: number;
  autopilot: boolean;
}): InvalidReason | null {
  return s.jumpsNow !== s.jumpsBefore || s.autopilot ? 'teleport' : null;
}

/** Ocultar la pestaña anula el intento (REQ-AVE-032); volver a ella, no. */
export function raceVisibilityInvalid(state: DocumentVisibilityState): InvalidReason | null {
  return state === 'hidden' ? 'hidden' : null;
}

type Point = { x: number; y: number };

const posOf = (world: WorldConfig, id: string): Point | null => {
  const o = world.objects.find((x) => x.identity.id === id);
  return o ? { x: o.position.x, y: o.position.y } : null;
};

/**
 * Por dónde pasa una vuelta: una boia de cada orden (la primera, si hay
 * ramas) y al final la salida, que es la meta. u de motor del mundo.
 */
export function lapTargets(world: WorldConfig, spec: CircuitSpec): (Point & { id: string })[] {
  const out: (Point & { id: string })[] = [];
  for (let order = 1; order <= spec.buoys + 1; order++) {
    const want = order > spec.buoys ? 0 : order;
    const g = spec.gates.find((x) => x.order === want);
    const p = g ? posOf(world, g.objectId) : null;
    if (g && p) out.push({ id: g.objectId, ...p });
  }
  return out;
}

/**
 * La carretera de una vuelta (T76): la salida, cada boia por orden y otra
 * vez la salida. Las boyitas de los lados y el «te saliste» salen de ella.
 */
export function roadPath(world: WorldConfig, spec: CircuitSpec): Point[] {
  const start = startPose(world, spec);
  if (!start) return [];
  return [{ x: start.x, y: start.y }, ...lapTargets(world, spec).map(({ x, y }) => ({ x, y }))];
}

/**
 * Dónde espera el barco la cuenta atrás: en la salida, mirando a la primera
 * boia (el semáforo manda; el barco no se mueve hasta «¡Ya!»).
 */
export function startPose(world: WorldConfig, spec: CircuitSpec): GhostPose | null {
  const start = spec.gates.find((g) => g.order === 0);
  const p = start ? posOf(world, start.objectId) : null;
  if (!p) return null;
  const first = lapTargets(world, spec)[0];
  const heading = first ? Math.atan2(first.y - p.y, first.x - p.x) : -Math.PI / 2;
  return { x: p.x, y: p.y, heading };
}

/** Clave del fantasma en el almacenamiento del navegador: la del récord (circuito y versión). */
export function ghostKey(spec: Pick<CircuitSpec, 'id' | 'version'>): string {
  return `boia:fantasma:${circuitRecordId(spec)}`;
}

type GhostStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** El fantasma guardado (la mejor carrera de este navegador), o null. */
export function loadGhost(
  storage: Pick<Storage, 'getItem'> | null,
  spec: Pick<CircuitSpec, 'id' | 'version'>,
): GhostRun | null {
  try {
    return decodeGhost(storage?.getItem(ghostKey(spec)));
  } catch {
    return null;
  }
}

/**
 * Guarda la grabación si es la mejor (o la primera). Devuelve si se guardó.
 * Sin almacenamiento, o lleno, no pasa nada: el récord va aparte.
 */
export function saveGhost(
  storage: GhostStorage | null,
  spec: Pick<CircuitSpec, 'id' | 'version'>,
  run: GhostRun,
): boolean {
  const old = loadGhost(storage, spec);
  if (!storage || (old && old.ms <= run.ms)) return false;
  try {
    storage.setItem(ghostKey(spec), encodeGhost(run));
    return true;
  } catch {
    return false;
  }
}

/** El almacenamiento del navegador, o null (modo privado, sin permiso…). */
export function browserGhostStorage(): GhostStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
