import type { WorldEvent } from '@boia/engine';
import type { AchievementTrigger } from '@boia/contracts';
import type { Notice } from '@boia/engine/ui';
import {
  type AchievementDefinition,
  type AchievementProgress,
  type ProgressApi,
  compensatedIds,
  isStableKey,
  isStoreError,
} from '@boia/store';
import type { WorldConfig } from '@boia/world';
import { t } from '../i18n';

/**
 * Logros del juego (T21, T36; REQ-IDE-024…027, D-22 punto 5): un solo sistema
 * de LOGROS/PROGRESO sobre `@boia/store`, igual en el 2D y en /mar. El juego
 * manda señales (una boia, una isla, un secreto, un minuto a bordo, una
 * partida ganada, una botella leída…); cada señal deja su huella en el
 * progreso (por id de lugar u objeto, así sobrevive a recargar y a cambiar de
 * mundo) y completa los logros del catálogo cuya condición ya se cumple.
 * Completar no da nada: el logro queda «listo para reclamar» y el premio
 * (puntos, monedas, insignia, barco o cosmético) llega al reclamarlo
 * (`progress.claimAchievement`). El catálogo es el del repositorio (`muestra`).
 */

/** Lo que hace falta del repositorio: sólo el progreso. */
type Repo = { readonly progress: ProgressApi };

export type AchievementSignal =
  | { trigger: 'find_buoy'; objectId: string }
  | { trigger: 'visit_island'; objectId: string }
  | { trigger: 'collect_objects'; objectId: string; category: string }
  /** s jugados desde la última señal. */
  | { trigger: 'time_played'; seconds: number }
  | { trigger: 'rescue_character'; character: string }
  | { trigger: 'deliver_character'; character: string }
  /** Vuelta válida: su tiempo y los arcos por los que pasó (la rama), si se saben. */
  | { trigger: 'complete_circuit'; circuit: string; ms?: number; via?: readonly string[] }
  | { trigger: 'buy_ticket'; eventId: string }
  /** Partida ganada y válida de un minijuego (`faro`, `canon`). */
  | { trigger: 'win_minigame'; game: string }
  /** Encuentro del mar vivo terminado (el delfín hasta el final de sus saltos). */
  | { trigger: 'complete_encounter'; encounter: string }
  /** Botella de otra persona leída. */
  | { trigger: 'read_bottle'; bottleId: string }
  /** Botella propia echada al mar. */
  | { trigger: 'throw_bottle'; bottleId: string }
  /** Hay Carnet. */
  | { trigger: 'create_carnet' }
  /** Preguntas del Carnet contestadas ahora. */
  | { trigger: 'answer_question'; questionIds: readonly string[] }
  /** Se navega en este mundo. */
  | { trigger: 'visit_world'; worldId: string };

/**
 * Nombres de los disparadores del mundo que no son los del catálogo: el
 * mapa llama `find_boia` a lo que el catálogo llama `find_buoy`.
 */
export const WORLD_TRIGGER_ALIASES: Readonly<Record<string, AchievementTrigger>> = {
  find_boia: 'find_buoy',
};

/** Contador de segundos a bordo (sólo con la pestaña a la vista). */
export const TIME_PLAYED_COUNTER = 'tiempo-jugado-s';
/** Cada cuánto se apunta el tiempo jugado. muestra */
export const TIME_PLAYED_TICK_S = 15;

/** Texto del aviso al completar un logro (D-22, catálogo punto 9). muestra */
export const ACHIEVEMENT_READY_BODY = t('achievements.notice.ready');

/** Claves de progreso de cada huella, por id estable (nunca coordenadas). */
const KEY = {
  buoy: 'boia:',
  island: 'isla:',
  object: (category: string) => `objeto:${category}:`,
  rescued: 'personaje:rescatado:',
  delivered: 'personaje:entregado:',
  circuit: 'circuito:',
  /** Mejor vuelta por circuito (récord del libro de logros). */
  lap: (circuit: string) => `logro-vuelta:${circuit}`,
  game: 'minijuego:',
  encounter: 'encuentro:',
  bottleRead: 'botella:leida:',
  bottleThrown: 'botella:echada:',
  carnet: 'carnet:creado',
  question: 'carnet:pregunta:',
  world: 'mundo:',
} as const;

/** Lo que el juego lleva contado, para las condiciones. */
export interface AchievementFacts {
  buoys: number;
  islands: number;
  /** Objetos recogidos o encontrados, por categoría (`secreto`…). */
  objects: Record<string, number>;
  seconds: number;
  /** Personajes rescatados y entregados (ids del catálogo). */
  rescued: string[];
  delivered: string[];
  /** Vueltas por circuito: arcos por los que ha pasado alguna vez y mejor tiempo. */
  circuits: Record<string, { via: string[]; bestMs: number | null }>;
  /** Minijuegos ganados (distintos). */
  games: string[];
  encounters: string[];
  bottlesRead: number;
  bottlesThrown: number;
  carnet: boolean;
  /** Preguntas del Carnet contestadas alguna vez (distintas). */
  questions: number;
  worlds: string[];
  /** Eventos distintos con sello (entradas). */
  ticketEvents: number;
}

/** La señal de logro de un evento del mundo, o null. */
export function signalFromWorldEvent(e: WorldEvent, world: WorldConfig): AchievementSignal | null {
  if (e.type !== 'achievement') return null;
  const trigger = WORLD_TRIGGER_ALIASES[e.trigger] ?? e.trigger;
  switch (trigger) {
    case 'find_buoy':
      return { trigger, objectId: e.objectId };
    case 'visit_island':
      return { trigger, objectId: e.objectId };
    case 'collect_objects': {
      const o = world.objects.find((x) => x.identity.id === e.objectId);
      return { trigger, objectId: e.objectId, category: o?.identity.category ?? 'objeto' };
    }
    default:
      return null;
  }
}

const after = (keys: readonly string[], prefix: string) =>
  keys.filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));

export async function achievementFacts(progress: ProgressApi): Promise<AchievementFacts> {
  const keys = (await progress.discoveries()).map((d) => d.key);
  const objects: Record<string, number> = {};
  for (const k of keys) {
    const m = /^objeto:([^:]+):/.exec(k);
    if (m) objects[m[1]!] = (objects[m[1]!] ?? 0) + 1;
  }
  const circuits: AchievementFacts['circuits'] = {};
  for (const rest of after(keys, KEY.circuit)) {
    const [circuit, por, gate] = rest.split(':');
    if (!circuit) continue;
    circuits[circuit] ??= { via: [], bestMs: null };
    if (por === 'por' && gate) circuits[circuit].via.push(gate);
  }
  for (const [circuit, c] of Object.entries(circuits)) {
    c.bestMs = (await progress.record(KEY.lap(circuit)))?.bestMs ?? null;
  }
  const stamps = await progress.stamps();
  return {
    buoys: after(keys, KEY.buoy).length,
    islands: after(keys, KEY.island).length,
    objects,
    seconds: await progress.counter(TIME_PLAYED_COUNTER),
    rescued: after(keys, KEY.rescued),
    delivered: after(keys, KEY.delivered),
    circuits,
    games: after(keys, KEY.game),
    encounters: after(keys, KEY.encounter),
    bottlesRead: after(keys, KEY.bottleRead).length,
    bottlesThrown: after(keys, KEY.bottleThrown).length,
    carnet: keys.includes(KEY.carnet),
    questions: after(keys, KEY.question).length,
    worlds: after(keys, KEY.world),
    ticketEvents: new Set(stamps.map((s) => s.eventId)).size,
  };
}

const param = (def: AchievementDefinition, key: string) =>
  (def.triggerParams as Record<string, unknown>)[key];
const count = (def: AchievementDefinition, fallback = 1) => {
  const v = param(def, 'count');
  return typeof v === 'number' && v > 0 ? v : fallback;
};
const text = (def: AchievementDefinition, key: string) => {
  const v = param(def, key);
  return typeof v === 'string' && v ? v : null;
};

/**
 * Cuánto lleva y cuánto pide un logro (3 de 7 islas, minutos, 0 de 1…).
 * `done` dice si ya se cumple. En `ms` (vuelta rápida) menos es mejor:
 * `have` es el mejor tiempo (0 sin vueltas) y `need` el máximo.
 */
export interface AchievementGoal {
  have: number;
  need: number;
  unit: 'veces' | 'minutos' | 'ms';
  done: boolean;
}

const tally = (have: number, need: number): AchievementGoal => ({
  have,
  need,
  unit: 'veces',
  done: have >= need,
});
/** Uno concreto (`want`) o, sin él, cuántos distintos. */
const oneOrMany = (list: readonly string[], want: string | null, need: number) =>
  want ? tally(list.includes(want) ? 1 : 0, 1) : tally(new Set(list).size, need);

export function achievementGoal(
  def: AchievementDefinition,
  facts: AchievementFacts,
): AchievementGoal {
  switch (def.trigger) {
    case 'find_buoy':
      return tally(facts.buoys, count(def));
    case 'visit_island':
      return tally(facts.islands, count(def));
    case 'collect_objects': {
      const cat = text(def, 'category');
      const have = cat
        ? (facts.objects[cat] ?? 0)
        : Object.values(facts.objects).reduce((a, b) => a + b, 0);
      return tally(have, count(def));
    }
    case 'time_played': {
      const m = param(def, 'minutes');
      const need = typeof m === 'number' && m > 0 ? m : 1;
      return {
        have: Math.floor(facts.seconds / 60),
        need,
        unit: 'minutos',
        done: facts.seconds >= need * 60,
      };
    }
    case 'rescue_character':
      return oneOrMany(facts.rescued, text(def, 'character'), count(def));
    case 'deliver_character':
      return oneOrMany(facts.delivered, text(def, 'character'), count(def));
    case 'complete_circuit': {
      const circuit = text(def, 'circuit');
      const laps = circuit
        ? [facts.circuits[circuit]].filter((c) => c !== undefined)
        : Object.values(facts.circuits);
      const times = laps.flatMap((c) => (c.bestMs === null ? [] : [c.bestMs]));
      const best = times.length > 0 ? Math.min(...times) : null;
      const maxMs = param(def, 'maxMs');
      if (typeof maxMs === 'number' && maxMs > 0) {
        return { have: best ?? 0, need: maxMs, unit: 'ms', done: best !== null && best <= maxMs };
      }
      const via = text(def, 'via');
      if (via) return tally(laps.some((c) => c.via.includes(via)) ? 1 : 0, 1);
      return tally(laps.length > 0 ? 1 : 0, 1);
    }
    case 'win_minigame':
      return oneOrMany(facts.games, text(def, 'game'), count(def));
    case 'complete_encounter':
      return oneOrMany(facts.encounters, text(def, 'encounter'), count(def));
    case 'read_bottle':
      return tally(facts.bottlesRead, count(def));
    case 'throw_bottle':
      return tally(facts.bottlesThrown, count(def));
    case 'create_carnet':
      return tally(facts.carnet ? 1 : 0, 1);
    case 'answer_question':
      return tally(facts.questions, count(def));
    case 'visit_world':
      return oneOrMany(facts.worlds, text(def, 'world'), count(def));
    case 'buy_ticket':
      return tally(facts.ticketEvents, count(def));
  }
}

/** Si el logro ya se cumple con lo contado hasta ahora. */
export function isComplete(def: AchievementDefinition, facts: AchievementFacts): boolean {
  return achievementGoal(def, facts).done;
}

const discover = async (progress: ProgressApi, key: string) => {
  // Un id raro (p. ej. de una versión vieja del mapa) no rompe la señal.
  if (isStableKey(key)) await progress.discover(key);
};

/** Deja la huella de la señal en el progreso (idempotente por id). */
async function record(progress: ProgressApi, s: AchievementSignal): Promise<void> {
  switch (s.trigger) {
    case 'find_buoy':
      return discover(progress, `${KEY.buoy}${s.objectId}`);
    case 'visit_island':
      return discover(progress, `${KEY.island}${s.objectId}`);
    case 'collect_objects':
      return discover(progress, `${KEY.object(s.category)}${s.objectId}`);
    case 'time_played':
      if (s.seconds > 0) await progress.increment(TIME_PLAYED_COUNTER, Math.round(s.seconds));
      return;
    case 'rescue_character':
      return discover(progress, `${KEY.rescued}${s.character}`);
    case 'deliver_character':
      return discover(progress, `${KEY.delivered}${s.character}`);
    case 'complete_circuit':
      await discover(progress, `${KEY.circuit}${s.circuit}`);
      for (const gate of s.via ?? []) {
        await discover(progress, `${KEY.circuit}${s.circuit}:por:${gate}`);
      }
      if (s.ms !== undefined && s.ms > 0 && isStableKey(KEY.lap(s.circuit))) {
        await progress.submitTime(KEY.lap(s.circuit), s.ms);
      }
      return;
    case 'win_minigame':
      return discover(progress, `${KEY.game}${s.game}`);
    case 'complete_encounter':
      return discover(progress, `${KEY.encounter}${s.encounter}`);
    case 'read_bottle':
      return discover(progress, `${KEY.bottleRead}${s.bottleId}`);
    case 'throw_bottle':
      return discover(progress, `${KEY.bottleThrown}${s.bottleId}`);
    case 'create_carnet':
      return discover(progress, KEY.carnet);
    case 'answer_question':
      for (const q of s.questionIds) await discover(progress, `${KEY.question}${q}`);
      return;
    case 'visit_world':
      return discover(progress, `${KEY.world}${s.worldId}`);
    case 'buy_ticket':
      // Cuentan los sellos del libro (eventos distintos), no una huella aparte.
      return;
  }
}

/** Texto del premio en puntos y monedas. muestra */
export function achievementBody(def: Pick<AchievementDefinition, 'points' | 'coins'>): string {
  const parts: string[] = [];
  if (def.points > 0) parts.push(`+${def.points} ${def.points === 1 ? 'punto' : 'puntos'}`);
  if (def.coins > 0) parts.push(`+${def.coins} ${def.coins === 1 ? 'moneda' : 'monedas'}`);
  return parts.join(' · ');
}

/** El aviso de un logro recién completado: su título y «Reclama tu premio». */
export function achievementNotice(def: AchievementDefinition): Notice {
  return {
    id: `logro:${def.id}`,
    kind: 'achievement',
    title: def.title,
    body: ACHIEVEMENT_READY_BODY,
  };
}

/**
 * Apunta la señal y completa los logros que ya tocan (listos para reclamar).
 * Devuelve los que se completaron ahora; uno ya completado o reclamado no
 * vuelve a salir.
 */
export async function completeBySignal(
  repo: Repo,
  signal: AchievementSignal,
): Promise<AchievementProgress[]> {
  await record(repo.progress, signal);
  const pending = (await repo.progress.achievements()).filter(
    (a) =>
      a.state === 'in_progress' && a.definition.active && a.definition.trigger === signal.trigger,
  );
  if (pending.length === 0) return [];
  const facts = await achievementFacts(repo.progress);
  const out: AchievementProgress[] = [];
  for (const a of pending) {
    if (!isComplete(a.definition, facts)) continue;
    try {
      const r = await repo.progress.completeAchievement(a.definition.id, {
        trigger: signal.trigger,
      });
      if (r.completed) out.push(r.achievement);
    } catch (err) {
      // Fuera de fechas o desactivado por el Admin: no se completa y no pasa nada.
      if (!isStoreError(err, 'forbidden')) throw err;
    }
  }
  return out;
}

/** Como `completeBySignal`, con los avisos «¡Logro completado!» de lo completado ahora. */
export async function recordSignal(repo: Repo, signal: AchievementSignal): Promise<Notice[]> {
  return (await completeBySignal(repo, signal)).map((a) => achievementNotice(a.definition));
}

// ---------------------------------------------------------------------------
// El premio del Carnet (decisión 2026-10-02, T72)

/**
 * Crear el Carnet BOIA da en el acto el premio de su logro (`create_carnet`:
 * 300 puntos y un barco, `muestra`), sin pasar por «Reclamar». Completa y
 * reclama los logros de esa señal (también uno completado antes y sin
 * reclamar) y devuelve el aviso de lo concedido. Repetirlo no da nada: el
 * libro guarda una fila por logro.
 */
export async function grantCarnetReward(repo: Repo): Promise<Notice[]> {
  await completeBySignal(repo, { trigger: 'create_carnet' });
  const ready = (await repo.progress.achievements()).filter(
    (a) => a.state === 'ready' && a.definition.trigger === 'create_carnet',
  );
  const notices: Notice[] = [];
  for (const a of ready) {
    const r = await repo.progress.claimAchievement(a.definition.id);
    if (!r.claimed) continue;
    const key = r.reward.kind === 'ship' ? r.reward.cosmeticKey : null;
    const ship = key
      ? ((await repo.progress.shop()).find((i) => i.cosmetic.id === key)?.cosmetic.name ?? key)
      : null;
    const reward = [
      achievementBody(a.definition),
      ...(ship ? [t('achievements.reward.ship', { ship })] : []),
    ]
      .filter(Boolean)
      .join(' · ');
    notices.push({
      id: `logro:${a.definition.id}`,
      kind: 'achievement',
      title: a.definition.title,
      body: t('achievements.notice.claimed', { reward }),
    });
  }
  return notices;
}

// ---------------------------------------------------------------------------
// Las seis boies (O12, T45)

/** Las boies de un mundo que cuentan para los logros de boies (las que dicen `find_boia`). */
export function worldBuoys(world: Pick<WorldConfig, 'objects'>): string[] {
  return world.objects
    .filter(
      (o) =>
        o.identity.active &&
        o.behaviors.some(
          (b) =>
            b.type === 'achievement' &&
            (WORLD_TRIGGER_ALIASES[b.params.trigger] ?? b.params.trigger) === 'find_buoy',
        ),
    )
    .map((o) => o.identity.id);
}

/** «Boia encontrada · {n} de 6» (textos-zonas, zona 23). muestra */
export function buoyFoundTitle(n: number, total: number): string {
  return t('juego.achievements.boiaEncontradaDe', { n, total });
}

/**
 * Una boia que habla por primera vez: apunta la señal (y los logros de boies
 * que ya tocan) y, sólo la primera vez, el aviso «Boia encontrada · n de 6».
 */
export async function recordBuoy(
  repo: Repo,
  objectId: string,
  world: Pick<WorldConfig, 'objects'>,
): Promise<Notice[]> {
  const key = `${KEY.buoy}${objectId}`;
  const known = (await repo.progress.discoveries()).some((d) => d.key === key);
  const notices = await recordSignal(repo, { trigger: 'find_buoy', objectId });
  if (known) return notices;
  const total = worldBuoys(world).length;
  const n = (await achievementFacts(repo.progress)).buoys;
  // Primero el logro (si lo hay), luego la cuenta de boies.
  return [
    ...notices,
    {
      id: `boia-encontrada:${objectId}`,
      kind: 'info',
      title: buoyFoundTitle(Math.min(n, total), total),
    },
  ];
}

// ---------------------------------------------------------------------------
// Señales sueltas (botellas, Carnet, minijuegos…) desde sitios sin cola de avisos

type NoticeListener = (notices: Notice[]) => void;
const listeners = new Set<NoticeListener>();

/** Escucha los avisos de las señales mandadas con `emitSignal`. */
export function onAchievementNotices(listener: NoticeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Manda una señal sin esperarla: lo completado queda guardado y sus avisos van
 * a quien escuche (`onAchievementNotices`). Un fallo sólo se apunta en consola.
 */
export function emitSignal(repo: Repo, signal: AchievementSignal): Promise<void> {
  return recordSignal(repo, signal).then(broadcast, (err: unknown) =>
    console.warn('[boia] no se pudo apuntar el logro', err),
  );
}

/** Como `emitSignal`, para el Carnet recién creado: su premio llega ya (`grantCarnetReward`). */
export function emitCarnetReward(repo: Repo): Promise<void> {
  return grantCarnetReward(repo).then(broadcast, (err: unknown) =>
    console.warn('[boia] no se pudo dar el premio del Carnet', err),
  );
}

function broadcast(notices: Notice[]): void {
  if (notices.length === 0) return;
  for (const l of [...listeners]) {
    try {
      l(notices);
    } catch {
      // un oyente roto no rompe a los demás
    }
  }
}

/** Restore only progress supported by persisted evidence. Never claim/re-award money.
 * Purchases prove SAMPLE ticket stamps; a castaway discount does not prove delivery;
 * an existing Carnet award proves its creation. Missing invitation history is unknowable.
 */
export async function reconcileAchievementEvidence(repo: Repo): Promise<void> {
  const [ledger, stamps] = await Promise.all([repo.progress.ledger(), repo.progress.stamps()]);
  const revoked = compensatedIds(ledger);
  if (
    ledger.some(
      (entry) =>
        entry.kind === 'achievement' && entry.achievementId === 'carnet' && !revoked.has(entry.id),
    )
  ) {
    await completeBySignal(repo, { trigger: 'create_carnet' });
  }
  for (const stamp of stamps)
    await completeBySignal(repo, { trigger: 'buy_ticket', eventId: stamp.eventId });
}
