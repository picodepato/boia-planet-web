import type { InvalidReason, MinigameResult, Validation } from './session';
import type { KeyValueStore } from '../ui/storage';
import type { MinigameId, RewardRule } from './types';

/**
 * Premio de una partida (REQ-AVE-038): sólo si la sesión es válida y se
 * ganó, con la política de la regla (única, diaria, por temporada o sólo
 * marca personal) y sus límites. La idempotencia es del libro: el origen
 * `minigame:<id>` y la política dan el id estable de la transacción
 * (`world_reward:minigame:faro@2026-09-29`…), así que repetir no duplica.
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
  | { granted: true; points: number; coins: number }
  | {
      granted: false;
      reason: InvalidReason | 'not_won' | 'duplicate' | 'record_only' | 'no_sink' | 'error';
    };

export const minigameSourceRef = (id: MinigameId) => `minigame:${id}`;

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
  const points = Math.max(0, Math.min(rule.points, rule.maxPoints));
  const coins = Math.max(0, Math.min(rule.coins, rule.maxCoins));
  try {
    const r = await sink.grantWorldReward({
      sourceRef: minigameSourceRef(result.gameId),
      points,
      coins,
      policy: rule.policy,
      metadata: {
        sessionId: result.sessionId,
        seed: result.seed,
        version: result.version,
        configHash: result.configHash,
        score: result.score,
        elapsedMs: Math.round(result.elapsedMs),
        // Una partida del atajo de desarrollo `&t=` lo deja dicho en el libro.
        ...(result.skippedMs ? { skippedMs: Math.round(result.skippedMs) } : {}),
      },
    });
    return r.granted ? { granted: true, points, coins } : { granted: false, reason: 'duplicate' };
  } catch {
    return { granted: false, reason: 'error' };
  }
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
