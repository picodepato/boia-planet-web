import type { WorldConfig } from '@boia/world';

/**
 * El circuito de velocidad (REQ-AVE-026…033), sin Pixi ni DOM: una carrera
 * que se alimenta de los eventos CHECKPOINT del mundo y de un reloj. La
 * aplicación enseña la cuenta atrás y el cronómetro pequeño, y guarda el
 * récord local con `submitRecord` (D-09: nada de servidor en L1).
 *
 * - Pasar por el arco de salida (orden 0) arranca una cuenta atrás; el
 *   tiempo cuenta desde «¡Ya!».
 * - Los arcos se pasan en orden (CP1 → CP-S o CP-A → CP2 → meta); uno fuera
 *   de orden no cuenta. Las dos ramas llevan el mismo orden.
 * - Se invalida al abrir un panel, ocultar la pestaña, recargar o
 *   teletransportarse (REQ-AVE-032: `invalidate`), o si pasa `maxDuration`.
 * - El récord va con la versión del circuito (REQ-AVE-033).
 */

export interface CircuitSpec {
  id: string;
  version: number;
  /** Objetos con CHECKPOINT de este circuito y su orden. */
  gates: { objectId: string; order: number }[];
  /** Orden de la meta (el mayor). */
  finishOrder: number;
  /** s de cuenta atrás. muestra */
  countdown: number;
  /** s máximos de una vuelta antes de darla por perdida. muestra */
  maxDuration: number;
}

export const CIRCUIT_COUNTDOWN_S = 3;
export const CIRCUIT_MAX_DURATION_S = 300;

/**
 * Clave del récord local: circuito y versión (una versión nueva empieza de
 * cero). Es una clave estable del repositorio (minúsculas, cifras y `-_:./`):
 * `circuito:el-freu:v1`.
 */
export function circuitRecordId(spec: Pick<CircuitSpec, 'id' | 'version'>): string {
  return `circuito:${spec.id}:v${spec.version}`;
}

/**
 * La clave de antes de T37 (`circuito:el-freu@v1`). El repositorio la
 * rechazaba al guardar, pero se sigue leyendo por si algún navegador guardó
 * un récord con ella.
 */
export function legacyCircuitRecordId(spec: Pick<CircuitSpec, 'id' | 'version'>): string {
  return `circuito:${spec.id}@v${spec.version}`;
}

/**
 * El circuito `circuitId` tal como está en el mundo: sus arcos por orden y la
 * versión del lugar de salida (`params.version`). null si no hay arcos.
 */
export function circuitFromWorld(world: WorldConfig, circuitId: string): CircuitSpec | null {
  const gates: CircuitSpec['gates'] = [];
  let version = 1;
  for (const o of world.objects) {
    if (!o.identity.active) continue;
    for (const b of o.behaviors) {
      if (b.type !== 'checkpoint' || b.params.circuitId !== circuitId) continue;
      gates.push({ objectId: o.identity.id, order: b.params.order });
      const v = o.params?.version;
      if (b.params.order === 0 && typeof v === 'number' && Number.isInteger(v) && v > 0) {
        version = v;
      }
    }
  }
  if (!gates.some((g) => g.order === 0) || gates.length < 2) return null;
  return {
    id: circuitId,
    version,
    gates,
    finishOrder: Math.max(...gates.map((g) => g.order)),
    countdown: CIRCUIT_COUNTDOWN_S,
    maxDuration: CIRCUIT_MAX_DURATION_S,
  };
}

export type RacePhase = 'idle' | 'countdown' | 'racing';

export type InvalidReason = 'panel' | 'hidden' | 'teleport' | 'timeout';

export type RaceEvent =
  | { type: 'countdown'; goAt: number }
  | { type: 'go' }
  | { type: 'checkpoint'; order: number }
  /** `route`: arcos que contaron en la vuelta, por id de objeto (la rama), si se dieron. */
  | { type: 'finish'; ms: number; route: string[] }
  | { type: 'invalid'; reason: InvalidReason };

/** Lo que el cronómetro enseña ahora. */
export interface RaceView {
  phase: RacePhase;
  /** s que faltan de cuenta atrás (redondeado hacia arriba al pintar). */
  countdown: number | null;
  /** ms de carrera. */
  elapsedMs: number | null;
  /** Siguiente orden que cuenta. */
  next: number;
}

export class CircuitRace {
  private phase: RacePhase = 'idle';
  private goAt = 0;
  private next = 1;
  private route: string[] = [];

  constructor(readonly spec: CircuitSpec) {}

  /** El orden de un objeto del circuito, o null si no es un arco suyo. */
  orderOf(objectId: string): number | null {
    return this.spec.gates.find((g) => g.objectId === objectId)?.order ?? null;
  }

  get active(): boolean {
    return this.phase !== 'idle';
  }

  view(now: number): RaceView {
    return {
      phase: this.phase,
      countdown: this.phase === 'countdown' ? Math.max(0, this.goAt - now) : null,
      elapsedMs: this.phase === 'racing' ? Math.round((now - this.goAt) * 1000) : null,
      next: this.next,
    };
  }

  /** Avanza el reloj (s): fin de la cuenta atrás o vuelta caducada. */
  tick(now: number): RaceEvent[] {
    if (this.phase === 'countdown' && now >= this.goAt) {
      this.phase = 'racing';
      return [{ type: 'go' }];
    }
    if (this.phase === 'racing' && now - this.goAt > this.spec.maxDuration) {
      return [this.invalidate('timeout')!];
    }
    return [];
  }

  /**
   * El barco pasó por un arco (evento CHECKPOINT) en el instante `now` (s).
   * Con `objectId`, la vuelta recuerda por qué arcos pasó (la rama del atajo).
   */
  checkpoint(order: number, now: number, objectId?: string): RaceEvent[] {
    const out = this.tick(now);
    if (order === 0) {
      if (this.phase !== 'idle') return out;
      this.phase = 'countdown';
      this.goAt = now + this.spec.countdown;
      this.next = 1;
      this.route = [];
      out.push({ type: 'countdown', goAt: this.goAt });
      return out;
    }
    if (this.phase !== 'racing' || order !== this.next) return out;
    if (objectId) this.route.push(objectId);
    if (order === this.spec.finishOrder) {
      const ms = Math.round((now - this.goAt) * 1000);
      this.phase = 'idle';
      out.push({ type: 'finish', ms, route: [...this.route] });
      return out;
    }
    this.next++;
    out.push({ type: 'checkpoint', order });
    return out;
  }

  /** Anula el intento en curso (REQ-AVE-032). null si no había ninguno. */
  invalidate(reason: InvalidReason): RaceEvent | null {
    if (this.phase === 'idle') return null;
    this.phase = 'idle';
    return { type: 'invalid', reason };
  }
}

/** Lo que hace falta del repositorio (`repo.progress` de `@boia/store`). */
export interface RecordSink {
  record(id: string): Promise<{ bestMs: number } | null>;
  submitTime(id: string, ms: number): Promise<{ best: boolean; record: { bestMs: number } }>;
}

const readLegacy = (sink: Pick<RecordSink, 'record'>, spec: Pick<CircuitSpec, 'id' | 'version'>) =>
  sink.record(legacyCircuitRecordId(spec)).catch(() => null);

/** El récord del circuito (el mejor de la clave de ahora y la de antes), o null. */
export async function readRecord(
  sink: Pick<RecordSink, 'record'>,
  spec: Pick<CircuitSpec, 'id' | 'version'>,
): Promise<{ bestMs: number } | null> {
  const [now, old] = await Promise.all([
    sink.record(circuitRecordId(spec)),
    readLegacy(sink, spec),
  ]);
  if (!now || !old) return now ?? old;
  return now.bestMs <= old.bestMs ? now : old;
}

/**
 * Guarda una vuelta válida: devuelve si es récord y el mejor tiempo (contando
 * también un récord viejo guardado con `legacyCircuitRecordId`).
 */
export async function submitRecord(
  sink: RecordSink,
  spec: Pick<CircuitSpec, 'id' | 'version'>,
  ms: number,
): Promise<{ best: boolean; bestMs: number }> {
  const r = await sink.submitTime(circuitRecordId(spec), ms);
  const old = await readLegacy(sink, spec);
  if (old && old.bestMs <= r.record.bestMs) return { best: false, bestMs: old.bestMs };
  return { best: r.best, bestMs: r.record.bestMs };
}

/** «1:02,3» o «58,2 s». */
export function formatRaceTime(ms: number): string {
  const tenths = Math.floor(ms / 100);
  const s = Math.floor(tenths / 10);
  const d = tenths % 10;
  if (s < 60) return `${s},${d} s`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')},${d}`;
}
