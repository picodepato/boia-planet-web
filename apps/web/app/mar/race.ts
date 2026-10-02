import type { CircuitRace, RaceEvent } from '@boia/engine/circuit';

/**
 * Un arco de El Freu en /mar (T37): el evento CHECKPOINT del mundo llega por
 * id de objeto; la carrera recibe su orden y también el id, para recordar por
 * qué rama pasó la vuelta (el logro del atajo, `finish.route`). Un objeto que
 * no es arco del circuito no hace nada.
 */
export function raceCheckpoint(race: CircuitRace, objectId: string, now: number): RaceEvent[] {
  const order = race.orderOf(objectId);
  return order === null ? [] : race.checkpoint(order, now, objectId);
}
