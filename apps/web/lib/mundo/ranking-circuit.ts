import { CIRCUIT_ID, type WorldConfig } from '@boia/world';
import { SAMPLE_CREW, type SampleCrewMember } from '@boia/store';

/**
 * La pestaña «Circuito» del ranking local (T56, REQ-IDE-053, D-09): el
 * récord personal de este navegador (el mismo que guarda la carrera, por
 * versión del circuito) entre los tiempos de los miembros de muestra, del
 * más rápido al más lento. Nada se comparte ni se valida: el ranking de
 * tiempos de verdad es de L2 (REQ-AVE-034).
 */

/**
 * Mejor carrera (tres vueltas) de cada miembro de muestra (ms), en el trazado
 * de T73 (versión 3 del circuito): uno entre el oro y la plata, otro entre la
 * plata y el bronce y otro sin medalla. muestra
 */
export const SAMPLE_CIRCUIT_MS: Readonly<Record<string, number>> = {
  'muestra-pulpo-sonico': 69_400,
  'muestra-la-del-castillo': 82_200,
  'muestra-grumete-turron': 106_800,
};

export interface CircuitRow {
  userId: string;
  nickname: string | null;
  /** Mejor vuelta (ms), o null si aún no hay. */
  ms: number | null;
  /** Puesto (1 = el más rápido), o null sin vuelta. */
  position: number | null;
  isMine: boolean;
  isSample: boolean;
  hasCarnet: boolean;
}

export interface CircuitRanking {
  rows: CircuitRow[];
  mine: CircuitRow;
}

/** La tabla: los de muestra con tiempo y el visitante (sin vuelta, al final). */
export function circuitRanking(
  me: { userId?: string; nickname: string | null; hasCarnet: boolean; bestMs: number | null },
  crew: readonly SampleCrewMember[] = SAMPLE_CREW,
  times: Readonly<Record<string, number>> = SAMPLE_CIRCUIT_MS,
): CircuitRanking {
  const mine: CircuitRow = {
    userId: me.userId ?? '',
    nickname: me.nickname,
    ms: me.bestMs,
    position: null,
    isMine: true,
    isSample: false,
    hasCarnet: me.hasCarnet,
  };
  const others: CircuitRow[] = crew.flatMap((c) => {
    const ms = times[c.userId];
    return ms === undefined
      ? []
      : [
          {
            userId: c.userId,
            nickname: c.nickname,
            ms,
            position: null,
            isMine: false,
            isSample: true,
            hasCarnet: true,
          },
        ];
  });
  const timed = [...others, ...(mine.ms !== null ? [mine] : [])].sort(
    // A igualdad de tiempo, el visitante delante (lo suyo es lo que importa aquí).
    (a, b) => a.ms! - b.ms! || Number(b.isMine) - Number(a.isMine),
  );
  timed.forEach((r, i) => (r.position = i + 1));
  return { rows: mine.ms === null ? [...timed, mine] : timed, mine };
}

/** El nombre del circuito en un mundo (el lugar de su arco de salida): «El Freu», «El Penyal». */
export function circuitName(world: WorldConfig, circuitId: string = CIRCUIT_ID): string | null {
  const start = world.objects.find((o) =>
    o.behaviors.some(
      (b) => b.type === 'checkpoint' && b.params.circuitId === circuitId && b.params.order === 0,
    ),
  );
  return start?.identity.name ?? null;
}

/**
 * El puesto de una carrera de `ms` contra la tripulación de muestra (T73):
 * 1 más los que fueron más rápidos, de cuántos (ellos y esta carrera).
 */
export function crewPlace(
  ms: number,
  crew: readonly SampleCrewMember[] = SAMPLE_CREW,
  times: Readonly<Record<string, number>> = SAMPLE_CIRCUIT_MS,
): { position: number; of: number } {
  const others = crew.flatMap((c) => (times[c.userId] === undefined ? [] : [times[c.userId]!]));
  return { position: 1 + others.filter((t) => t < ms).length, of: others.length + 1 };
}

/** El más rápido de la tripulación de muestra (nombre y tiempo), o null. */
export function crewLeader(
  crew: readonly SampleCrewMember[] = SAMPLE_CREW,
  times: Readonly<Record<string, number>> = SAMPLE_CIRCUIT_MS,
): { name: string; ms: number } | null {
  let best: { name: string; ms: number } | null = null;
  for (const c of crew) {
    const ms = times[c.userId];
    if (ms !== undefined && (!best || ms < best.ms)) best = { name: c.nickname, ms };
  }
  return best;
}
