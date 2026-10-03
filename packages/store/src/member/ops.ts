/**
 * Las acciones de valor de un miembro que esperan su turno para ir al
 * servidor (plan 008, T90): la cola que sobrevive a cerrar la pestaña y a
 * quedarse sin red. Cada una es una llamada a una RPC de T86 (o, las
 * respuestas del Carnet, a su tabla).
 */
import { StoreError, type StoreErrorCode } from '../errors';
import type { JsonValue } from '../schema';
import type { MemberServer } from './server';

export type MemberOpInput =
  | {
      kind: 'award';
      /** Acción de `point_actions`: world, encounter, mission, minigame, achievement. */
      action: string;
      ref: string;
      points: number;
      coins: number;
      policy: 'once' | 'daily' | 'season';
      metadata: Record<string, JsonValue>;
    }
  | { kind: 'buy'; cosmetic: string }
  | { kind: 'equip'; slot: string; cosmetic: string | null }
  | { kind: 'time'; circuit: string; version: number; ms: number }
  | { kind: 'find_discount'; discount: string }
  | { kind: 'use_discount'; discount: string; event: string | null }
  | { kind: 'profile'; nickname: string; avatarKey: string | null; avatarImage: string | null }
  | { kind: 'answer'; questionId: string; questionVersion: number; answer: string | null };

export type MemberOp = MemberOpInput & {
  id: string;
  /** Cuándo se hizo en el navegador. */
  at: string;
};

export type MemberOpKind = MemberOp['kind'];

/**
 * La acción del servidor de un premio del mundo por la forma de su origen
 * (`point_actions.ref_pattern`); null si el servidor no la conoce.
 */
export function pointActionFor(sourceRef: string): string | null {
  if (/^minigame:[a-z0-9_-]+$/.test(sourceRef)) return 'minigame';
  if (/^mision:[a-z0-9_-]+:entrega$/.test(sourceRef)) return 'mission';
  if (/^lugar:[a-z0-9_.-]+:(seguir|[0-9]+s)$/.test(sourceRef)) return 'encounter';
  if (/^lugar:[a-z0-9_.-]+:(points|coins)(:visita:[a-z0-9-]+)?$/.test(sourceRef)) return 'world';
  return null;
}

/** Rechazos que dicen que lo pedido ya está hecho: cuentan como bien. */
const ALREADY_DONE: Partial<Record<MemberOpKind, readonly string[]>> = {
  use_discount: ['discount_used'],
};

export function isAlreadyDone(kind: MemberOpKind, reason: string): boolean {
  return ALREADY_DONE[kind]?.includes(reason) ?? false;
}

/** Manda una acción al servidor; lanza `ServerCallError` si falla. */
export async function sendOp(server: MemberServer, op: MemberOp): Promise<void> {
  switch (op.kind) {
    case 'award':
      await server.rpc('award_points', {
        p_action: op.action,
        p_ref: op.ref,
        p_points: op.points,
        p_coins: op.coins,
        p_policy: op.policy,
        p_metadata: op.metadata,
      });
      return;
    case 'buy':
      await server.rpc('buy_cosmetic', { p_cosmetic: op.cosmetic });
      return;
    case 'equip':
      await server.rpc('equip_cosmetic', { p_slot: op.slot, p_cosmetic: op.cosmetic });
      return;
    case 'time':
      await server.rpc('submit_race_time', {
        p_circuit: op.circuit,
        p_version: op.version,
        p_ms: op.ms,
      });
      return;
    case 'find_discount':
      await server.rpc('find_discount', { p_discount: op.discount });
      return;
    case 'use_discount':
      await server.rpc('use_discount', { p_discount: op.discount, p_event: op.event });
      return;
    case 'profile':
      await server.rpc('save_profile', {
        p_nickname: op.nickname,
        p_avatar_key: op.avatarKey,
        p_avatar_image: op.avatarImage,
      });
      return;
    case 'answer':
      await server.saveAnswer(op.questionId, op.questionVersion, op.answer);
      return;
  }
}

/**
 * El servidor rechazó una acción (decisión 7): `reason` es la clave estable
 * de la RPC (`insufficient_coins`, `nickname_taken`, `limit_daily`…). Su
 * `code` es el de `StoreError` que la interfaz ya sabe explicar.
 */
export class SyncRejectedError extends StoreError {
  readonly reason: string;
  constructor(reason: string) {
    super(
      storeCodeFor(reason),
      `${reason === 'nickname_taken' ? 'apodo en uso' : 'rechazado'} (servidor: ${reason})`,
    );
    this.name = 'SyncRejectedError';
    this.reason = reason;
  }
}

export function storeCodeFor(reason: string): StoreErrorCode {
  if (reason === 'insufficient_coins') return 'insufficient_coins';
  if (reason === 'nickname_taken') return 'conflict';
  if (reason === 'carnet_required') return 'no_carnet';
  if (reason.startsWith('unknown_') || reason.endsWith('_not_found')) return 'not_found';
  if (
    reason.startsWith('invalid_') ||
    reason.startsWith('text_') ||
    reason === 'nickname_invalid' ||
    reason === 'avatar_invalid'
  )
    return 'invalid';
  return 'forbidden';
}
