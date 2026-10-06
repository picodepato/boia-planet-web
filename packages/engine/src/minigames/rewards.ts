import type { InvalidReason, MinigameResult, Validation } from './session';
import type { KeyValueStore } from '../ui/storage';
import type { MinigameId, RewardRule, RewardTier } from './types';

/**
 * Premio de una partida (REQ-AVE-038): sólo si la sesión es válida y se
 * ganó, con la política de la regla (única, diaria, por temporada o sólo
 * marca personal) y sus límites. La idempotencia es del libro: el origen
 * `minigame:<id>` y la política dan el id estable de la transacción
 * (`world_reward:minigame:canon:oro@2026-10-05`…), así que repetir no duplica.
 *
 * `MinigameRewardSink` es la parte de `@boia/store` que hace falta
 * (`repo.progress` la cumple); el motor no depende del repositorio.
 */

export interface MinigameRewardSink {
  grantWorldReward(input: {
    sourceRef: string;
    points?: number;
    coins?: number;
    policy?: 'once' | 'daily' | 'season';
    metadata?: Record<string, string | number | boolean | null>;
  }): Promise<{ granted: boolean; reason?: string }>;
}

export type RewardOutcome =
  | {
      granted: true;
      points: number;
      coins: number;
      /** Con escalones (T153): los que se cobraron ahora, de menos a más. */
      tiers?: string[];
    }
  | {
      granted: false;
      /**
       * `test_start`: una partida de prueba (empezada con un atajo de
       * desarrollo que cambia el juego) en un build de producción (T121).
       */
      reason:
        | InvalidReason
        | 'not_won'
        | 'duplicate'
        | 'record_only'
        | 'no_sink'
        | 'error'
        | 'test_start';
    };

export const minigameSourceRef = (id: MinigameId) => `minigame:${id}`;

/** El origen de un escalón del premio (T153): `minigame:canon:oro`. */
export const minigameTierRef = (id: MinigameId, tier: string) => `minigame:${id}:${tier}`;

/** Margen de redondeo del paso fijo frente al mínimo de un escalón (ms). */
const TIER_SLACK_MS = 100;

export async function grantMinigameReward(
  sink: MinigameRewardSink | null | undefined,
  rule: RewardRule,
  result: MinigameResult,
  validation: Validation,
): Promise<RewardOutcome> {
  if (!validation.valid) return { granted: false, reason: validation.reason };
  if (result.outcome !== 'won') return { granted: false, reason: 'not_won' };
  if (rule.policy === 'record_only') return { granted: false, reason: 'record_only' };
  if (!sink) return { granted: false, reason: 'no_sink' };
  if (rule.tiers) return grantTiers(sink, rule, rule.tiers, result);
  const points = Math.max(0, Math.min(rule.points, rule.maxPoints));
  const coins = Math.max(0, Math.min(rule.coins, rule.maxCoins));
  try {
    const r = await sink.grantWorldReward({
      sourceRef: minigameSourceRef(result.gameId),
      points,
      coins,
      policy: rule.policy,
      // Una partida del atajo de desarrollo `&t=` lo deja dicho en el libro (`skippedMs`).
      metadata: resultMetadata(result),
    });
    return r.granted ? { granted: true, points, coins } : { granted: false, reason: 'duplicate' };
  } catch {
    return { granted: false, reason: 'error' };
  }
}

function resultMetadata(result: MinigameResult): Record<string, string | number> {
  return {
    sessionId: result.sessionId,
    seed: result.seed,
    version: result.version,
    configHash: result.configHash,
    score: result.score,
    elapsedMs: Math.round(result.elapsedMs),
    ...(result.skippedMs ? { skippedMs: Math.round(result.skippedMs) } : {}),
    ...(result.tier ? { tier: result.tier } : {}),
  };
}

/**
 * Premio por escalones (T153): el escalón conseguido y los de debajo, cada
 * uno una vez por periodo de la política (el libro decide: `minigame:canon:
 * bronce@<día>`…). Un escalón que no existe, que no casa con cómo acabó la
 * partida o que llega antes de lo posible (un oro antes de que entre el
 * boss final) no cobra nada.
 */
async function grantTiers(
  sink: MinigameRewardSink,
  rule: RewardRule,
  tiers: readonly RewardTier[],
  result: MinigameResult,
): Promise<RewardOutcome> {
  const top = tiers.findIndex((t) => t.id === result.tier);
  const tier = tiers[top];
  if (!tier || !tier.reasons.includes(result.reason)) {
    return { granted: false, reason: 'implausible_score' };
  }
  if (!Number.isFinite(result.elapsedMs) || result.elapsedMs + TIER_SLACK_MS < tier.minMs) {
    return { granted: false, reason: 'implausible_duration' };
  }
  const metadata = resultMetadata(result);
  let points = 0;
  let coins = 0;
  const paid: string[] = [];
  let failed = false;
  for (const t of tiers.slice(0, top + 1)) {
    const p = Math.max(0, Math.min(t.points, rule.maxPoints));
    const c = Math.max(0, Math.min(t.coins, rule.maxCoins));
    if (p + c <= 0) continue;
    try {
      const r = await sink.grantWorldReward({
        sourceRef: minigameTierRef(result.gameId, t.id),
        points: p,
        coins: c,
        policy: rule.policy === 'record_only' ? 'once' : rule.policy,
        metadata,
      });
      if (!r.granted) continue;
      points += p;
      coins += c;
      paid.push(t.id);
    } catch {
      failed = true;
    }
  }
  if (paid.length > 0) return { granted: true, points, coins, tiers: paid };
  return { granted: false, reason: failed ? 'error' : 'duplicate' };
}

/** Marca personal por juego, en este dispositivo. Sólo cuentan partidas válidas. */
export const RECORDS_KEY = 'boia.minijuegos.marcas';

export function readBest(store: KeyValueStore | null | undefined, id: MinigameId): number | null {
  try {
    const raw = JSON.parse(store?.getItem(RECORDS_KEY) ?? '{}') as Record<string, unknown>;
    const v = raw[id];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

export function saveBest(
  store: KeyValueStore | null | undefined,
  id: MinigameId,
  score: number,
): boolean {
  if (!store) return false;
  const best = readBest(store, id);
  if (best !== null && best >= score) return false;
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(store.getItem(RECORDS_KEY) ?? '{}') as Record<string, unknown>;
  } catch {
    raw = {};
  }
  store.setItem(RECORDS_KEY, JSON.stringify({ ...raw, [id]: score }));
  return true;
}

/** Texto (muestra) de lo que dio la partida. */
export function rewardText(r: RewardOutcome, rule: RewardRule): string {
  if (r.granted) return `+${r.points} puntos y +${r.coins} monedas.`;
  switch (r.reason) {
    case 'duplicate':
      return rule.policy === 'daily'
        ? 'Hoy ya cobraste este premio: vuelve mañana.'
        : rule.policy === 'season'
          ? 'Ya cobraste este premio esta temporada.'
          : 'Este premio ya lo cobraste.';
    case 'not_won':
      return '';
    case 'record_only':
      return 'Este juego sólo guarda tu mejor marca.';
    case 'no_sink':
    case 'error':
      return 'No se pudo guardar el premio en este navegador.';
    default:
      return 'Esta partida no da premio.';
  }
}

/** Política en palabras, para las instrucciones; con `goal`, la marca que hace falta. */
export function policyText(rule: RewardRule, goal?: number): string {
  const what = `${rule.points} puntos y ${rule.coins} monedas`;
  const when = goal ? `, si haces ${goal} o más` : '';
  switch (rule.policy) {
    case 'daily':
      return `Premio (muestra)${when}: ${what}, una vez al día.`;
    case 'season':
      return `Premio (muestra)${when}: ${what}, una vez por temporada.`;
    case 'once':
      return `Premio (muestra)${when}: ${what}, una sola vez.`;
    default:
      return 'Sin premio: sólo cuenta tu mejor marca.';
  }
}
