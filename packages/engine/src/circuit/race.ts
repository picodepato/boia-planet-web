import type { WorldConfig } from '@boia/world';

/**
 * El circuito de velocidad (REQ-AVE-026…033, T61), sin three.js ni DOM: una
 * carrera de varias vueltas que se alimenta de los eventos CHECKPOINT del
 * mundo y de un reloj. La aplicación enseña la cuenta atrás, el cronómetro
 * pequeño y el resultado, y guarda el récord local con `submitRecord` (D-09:
 * nada de servidor en L1).
 *
 * - La salida (orden 0) es también la meta. Pasarla sin carrera arranca la
 *   cuenta atrás; el tiempo cuenta desde «¡Ya!».
 * - Las boias (orden 1…n) se pasan en orden; una fuera de orden no cuenta.
 *   Varias boias con el mismo orden son alternativas (una rama).
 * - Volver a la salida después de la última boia cierra la vuelta; volver
 *   antes no la cuenta (`missed`: la boia que falta). Tras `laps` vueltas,
 *   meta (`finish`) con el tiempo total y el de cada vuelta.
 * - Se invalida al abrir un panel, ocultar la pestaña, recargar o
 *   teletransportarse (REQ-AVE-032: `invalidate`), o si pasa `maxDuration`.
 * - El récord es el tiempo total y va con la versión del circuito (REQ-AVE-033).
 */

/** Tiempo total máximo (ms) para cada medalla. */
export interface Medals {
  gold: number;
  silver: number;
  bronze: number;
}

export type Medal = keyof Medals;

export interface CircuitSpec {
  id: string;
  version: number;
  /** Objetos con CHECKPOINT de este circuito y su orden (0: salida y meta). */
  gates: { objectId: string; order: number }[];
  /** Boias por vuelta: el orden mayor. */
  buoys: number;
  /** Vueltas de una carrera. */
  laps: number;
  medals: Medals;
  /** s de cuenta atrás. muestra */
  countdown: number;
  /** s máximos de una carrera antes de darla por perdida. muestra */
  maxDuration: number;
}

export const CIRCUIT_COUNTDOWN_S = 3;
export const CIRCUIT_MAX_DURATION_S = 300;
/** Sin `params.laps` en la salida. muestra */
export const DEFAULT_CIRCUIT_LAPS = 3;
/** Sin `params.medals` en la salida. muestra */
export const DEFAULT_CIRCUIT_MEDALS: Medals = { gold: 45_000, silver: 55_000, bronze: 70_000 };

/** Las medallas de mejor a peor. */
export const MEDALS: readonly Medal[] = ['gold', 'silver', 'bronze'];

/**
 * Clave del récord local: circuito y versión (una versión nueva empieza de
 * cero). Es una clave estable del repositorio (minúsculas, cifras y `-_:./`):
 * `circuito:el-freu:v2`. La pestaña «Circuito» del ranking la lee igual.
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

const positiveInt = (v: unknown, max: number): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= max ? v : null;

/** Las medallas de `params.medals` si son tres tiempos crecientes; si no, null. */
function medalsOf(v: unknown): Medals | null {
  if (!v || typeof v !== 'object') return null;
  const m = v as Record<string, unknown>;
  const [g, s, b] = MEDALS.map((k) => m[k]);
  if (![g, s, b].every((x) => typeof x === 'number' && Number.isFinite(x) && x > 0)) return null;
  const [gold, silver, bronze] = [g, s, b] as number[];
  return gold! < silver! && silver! < bronze!
    ? { gold: gold!, silver: silver!, bronze: bronze! }
    : null;
}

/**
 * El circuito `circuitId` tal como está en el mundo: sus boias por orden y,
 * de la salida (`params`), la versión, las vueltas y las medallas. null si no
 * hay salida o boias.
 */
export function circuitFromWorld(world: WorldConfig, circuitId: string): CircuitSpec | null {
  const gates: CircuitSpec['gates'] = [];
  let version = 1;
  let laps = DEFAULT_CIRCUIT_LAPS;
  let medals = DEFAULT_CIRCUIT_MEDALS;
  for (const o of world.objects) {
    if (!o.identity.active) continue;
    for (const b of o.behaviors) {
      if (b.type !== 'checkpoint' || b.params.circuitId !== circuitId) continue;
      gates.push({ objectId: o.identity.id, order: b.params.order });
      if (b.params.order !== 0) continue;
      version = positiveInt(o.params?.version, 1_000_000) ?? version;
      laps = positiveInt(o.params?.laps, 9) ?? laps;
      medals = medalsOf(o.params?.medals) ?? medals;
    }
  }
  if (!gates.some((g) => g.order === 0) || gates.length < 2) return null;
  return {
    id: circuitId,
    version,
    gates,
    buoys: Math.max(...gates.map((g) => g.order)),
    laps,
    medals,
    countdown: CIRCUIT_COUNTDOWN_S,
    maxDuration: CIRCUIT_MAX_DURATION_S,
  };
}

/** La medalla de un tiempo total, o null si no llega al bronce. */
export function medalFor(ms: number, medals: Medals): Medal | null {
  return MEDALS.find((m) => ms <= medals[m]) ?? null;
}

/** La siguiente medalla que se puede ganar con este tiempo (null: ya es oro). */
export function nextMedal(ms: number, medals: Medals): Medal | null {
  const now = medalFor(ms, medals);
  const i = now ? MEDALS.indexOf(now) : MEDALS.length;
  return i > 0 ? MEDALS[i - 1]! : null;
}

export type RacePhase = 'idle' | 'countdown' | 'racing';

export type InvalidReason = 'panel' | 'hidden' | 'teleport' | 'timeout';

export type RaceEvent =
  | { type: 'countdown'; goAt: number }
  | { type: 'go' }
  /** Boia pasada en orden; `lap` es la vuelta en curso (1…). */
  | { type: 'checkpoint'; order: number; lap: number }
  /** Paso por la salida con boias sin pasar: la vuelta no cuenta. `order`: la que falta. */
  | { type: 'missed'; order: number; lap: number }
  /** Vuelta cerrada (no la última): `lap` vueltas hechas, `lapMs` lo que duró esta. */
  | { type: 'lap'; lap: number; lapMs: number; ms: number }
  /**
   * Meta: `ms` total, `laps` el tiempo de cada vuelta y `route` las boias que
   * contaron, por id de objeto y sin repetir (la rama, si la hay).
   */
  | { type: 'finish'; ms: number; laps: number[]; route: string[] }
  | { type: 'invalid'; reason: InvalidReason };

/** Lo que el cronómetro enseña ahora. */
export interface RaceView {
  phase: RacePhase;
  /** s que faltan de cuenta atrás (redondeado hacia arriba al pintar). */
  countdown: number | null;
  /** ms de carrera. */
  elapsedMs: number | null;
  /** Siguiente boia que cuenta (buoys + 1: toca la salida). */
  next: number;
  /** Vuelta en curso (1…laps). */
  lap: number;
  laps: number;
  buoys: number;
}

export class CircuitRace {
  private phase: RacePhase = 'idle';
  private goAt = 0;
  private next = 1;
  private lap = 1;
  private lapStart = 0;
  private lapTimes: number[] = [];
  private route: string[] = [];

  constructor(readonly spec: CircuitSpec) {}

  /** El orden de un objeto del circuito, o null si no es una boia suya. */
  orderOf(objectId: string): number | null {
    return this.spec.gates.find((g) => g.objectId === objectId)?.order ?? null;
  }

  get active(): boolean {
    return this.phase !== 'idle';
  }

  get racing(): boolean {
    return this.phase === 'racing';
  }

  /** ms de carrera en `now` (0 antes de «¡Ya!»). */
  elapsedMs(now: number): number {
    return this.phase === 'racing' ? Math.max(0, Math.round((now - this.goAt) * 1000)) : 0;
  }

  view(now: number): RaceView {
    return {
      phase: this.phase,
      countdown: this.phase === 'countdown' ? Math.max(0, this.goAt - now) : null,
      elapsedMs: this.phase === 'racing' ? this.elapsedMs(now) : null,
      next: this.next,
      lap: this.lap,
      laps: this.spec.laps,
      buoys: this.spec.buoys,
    };
  }

  /** Avanza el reloj (s): fin de la cuenta atrás o carrera caducada. */
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

  /** Empieza la cuenta atrás (como pasar por la salida sin carrera). */
  start(now: number): RaceEvent[] {
    if (this.phase !== 'idle') return [];
    this.phase = 'countdown';
    this.goAt = now + this.spec.countdown;
    this.next = 1;
    this.lap = 1;
    this.lapStart = this.goAt;
    this.lapTimes = [];
    this.route = [];
    return [{ type: 'countdown', goAt: this.goAt }];
  }

  /**
   * El barco pasó por una boia o por la salida (evento CHECKPOINT) en el
   * instante `now` (s). Con `objectId`, la carrera recuerda por qué boias pasó.
   */
  checkpoint(order: number, now: number, objectId?: string): RaceEvent[] {
    const out = this.tick(now);
    if (order === 0) {
      if (this.phase === 'idle') return [...out, ...this.start(now)];
      if (this.phase !== 'racing') return out;
      if (this.next <= this.spec.buoys) {
        // Antes de la primera boia es la misma salida (rozarla al arrancar): nada.
        if (this.next > 1) out.push({ type: 'missed', order: this.next, lap: this.lap });
        return out;
      }
      return [...out, this.closeLap(now)];
    }
    if (this.phase !== 'racing' || order !== this.next) return out;
    if (objectId && !this.route.includes(objectId)) this.route.push(objectId);
    this.next++;
    out.push({ type: 'checkpoint', order, lap: this.lap });
    return out;
  }

  private closeLap(now: number): RaceEvent {
    const ms = this.elapsedMs(now);
    const lapMs = Math.round((now - this.lapStart) * 1000);
    this.lapTimes.push(lapMs);
    this.lapStart = now;
    this.next = 1;
    if (this.lap >= this.spec.laps) {
      this.phase = 'idle';
      return { type: 'finish', ms, laps: [...this.lapTimes], route: [...this.route] };
    }
    this.lap++;
    return { type: 'lap', lap: this.lap - 1, lapMs, ms };
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
 * Guarda una carrera válida (su tiempo total): devuelve si es récord y el
 * mejor tiempo (contando también un récord viejo con `legacyCircuitRecordId`).
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
