import type { AdminCarnetRow, ScoreBoard, VoidedEntry } from '@boia/db/rpc';
import type { AdminCarnetView, CarnetModerationAction } from '@boia/store';
import { type MessageKey, t } from '../i18n';
import {
  type ScoreBoard as GameBoard,
  canonBoardOptions,
  castleBoardOptions,
} from '../mundo/ranking-boards';

/**
 * Moderación de Carnets, botellas y rankings (plan 017 T191, decisión 5,
 * REQ-ADM-031): qué se puede hacer con cada cosa según su estado, con
 * cuentas (las RPC de 20261007100200_moderation.sql) y en la demo local.
 */

/** Lo que admin_moderate_carnet sabe hacer. */
export const REAL_CARNET_ACTIONS = [
  'hide',
  'show',
  'hide_nickname',
  'restore_nickname',
  'hide_avatar',
  'restore_avatar',
] as const;
export type RealCarnetAction = (typeof REAL_CARNET_ACTIONS)[number];

/** El texto del botón de cada acción (con cuentas y en la demo). */
export const CARNET_ACTION_LABEL: Record<RealCarnetAction, MessageKey> = {
  hide: 'admin.moderation.carnets.hide',
  show: 'admin.moderation.carnets.show',
  hide_nickname: 'admin.moderation.carnets.hideNickname',
  restore_nickname: 'admin.moderation.carnets.restoreNickname',
  hide_avatar: 'admin.moderation.carnets.hideAvatar',
  restore_avatar: 'admin.moderation.carnets.restoreAvatar',
};

/** Retirar algo pide motivo (≥ 3 letras, como en el servidor); devolverlo, no. */
export function needsReason(action: RealCarnetAction): boolean {
  return action.startsWith('hide');
}

/**
 * Los botones de un Carnet con cuentas. Oculto, sólo «Mostrar» (devuelve
 * también su apodo y su foto); si no, ocultarlo y retirar o devolver el
 * apodo y la foto (retirar la foto, sólo si tiene).
 */
export function carnetActions(row: AdminCarnetRow): RealCarnetAction[] {
  if (row.hidden_at) return ['show'];
  const out: RealCarnetAction[] = ['hide'];
  out.push(row.nickname_moderated ? 'restore_nickname' : 'hide_nickname');
  if (row.avatar_moderated) out.push('restore_avatar');
  else if (row.has_avatar) out.push('hide_avatar');
  return out;
}

/** Lo mismo en la demo local: la acción del repositorio que corresponde a cada botón. */
const DEMO_ACTION: Record<RealCarnetAction, CarnetModerationAction> = {
  hide: { kind: 'hide_carnet' },
  show: { kind: 'show_carnet' },
  hide_nickname: { kind: 'reset_nickname' },
  restore_nickname: { kind: 'restore_nickname' },
  hide_avatar: { kind: 'hide_photo' },
  restore_avatar: { kind: 'restore_photo' },
};

export function demoCarnetActions(
  view: AdminCarnetView,
): { action: RealCarnetAction; demo: CarnetModerationAction }[] {
  const mod = view.moderation;
  const hasPhoto = !!view.carnet.avatarImage || !!view.carnet.avatarKey;
  const list: RealCarnetAction[] = mod?.hidden
    ? ['show']
    : [
        'hide',
        mod?.nickname ? 'restore_nickname' : 'hide_nickname',
        ...(mod?.photo
          ? (['restore_avatar'] as const)
          : hasPhoto
            ? (['hide_avatar'] as const)
            : []),
      ];
  return list.map((action) => ({ action, demo: DEMO_ACTION[action] }));
}

/** Qué está retirado de un Carnet, para las etiquetas de la lista. */
export function carnetBadges(state: {
  hidden: boolean;
  nickname: boolean;
  avatar: boolean;
}): MessageKey[] {
  const out: MessageKey[] = [];
  if (state.hidden) out.push('admin.moderation.carnets.hidden');
  if (state.nickname) out.push('admin.moderation.carnets.nicknameHidden');
  if (state.avatar) out.push('admin.moderation.carnets.avatarHidden');
  return out;
}

// ---------------------------------------------------------------------------
// Rankings

/** Los argumentos de admin_void_score / admin_restore_score para una tabla de juego. */
export function scoreTarget(board: GameBoard): {
  p_board: ScoreBoard;
  p_key: string;
  p_version: number;
} {
  return board.kind === 'canon'
    ? { p_board: 'canon', p_key: board.boss, p_version: board.version }
    : {
        p_board: 'castle',
        p_key: `${board.runMin}:${board.difficulty}`,
        p_version: board.version,
      };
}

/** Las tablas del Cañón y del Castillo que el Admin modera, con su nombre. */
export function gameBoardOptions(): { key: string; label: string; board: GameBoard }[] {
  return [
    ...canonBoardOptions().map((o) => ({
      ...o,
      label: t('admin.real.rankings.canon', { board: o.label }),
    })),
    ...castleBoardOptions().map((o) => ({
      ...o,
      label: t('admin.real.rankings.castle', { board: o.label }),
    })),
  ];
}

/** De qué ranking es una entrada anulada, en palabras. */
export function voidedBoardLabel(e: VoidedEntry): string {
  if (e.board === 'race') {
    return t('admin.real.rankings.race', { circuit: e.key, version: e.version });
  }
  if (e.board === 'canon') {
    const known = canonBoardOptions().find(
      (o) => o.board.kind === 'canon' && o.board.boss === e.key,
    );
    return t('admin.real.rankings.canon', { board: known?.label ?? e.key });
  }
  const known = castleBoardOptions().find(
    (o) => o.board.kind === 'castle' && `${o.board.runMin}:${o.board.difficulty}` === e.key,
  );
  return t('admin.real.rankings.castle', { board: known?.label ?? e.key });
}
