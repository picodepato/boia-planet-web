'use client';

import { useSyncExternalStore } from 'react';
import { type MessageKey } from '../i18n';
import {
  type AccountState,
  accountServerSnapshot,
  accountSnapshot,
  subscribeAccount,
} from './session';

/**
 * La cuenta en React: invitado o miembro, al día con cada cambio de sesión
 * (entrar, salir, otra pestaña). En modo local, siempre `status: 'local'`.
 */
export function useAccount(): AccountState {
  return useSyncExternalStore(subscribeAccount, accountSnapshot, accountServerSnapshot);
}

// ---------------------------------------------------------------------------
// Avisos de la cuenta («Has entrado como…», «Has cerrado sesión…»)

export interface AccountNotice {
  id: number;
  key: MessageKey;
  vars?: Record<string, string | number> | undefined;
}

let notice: AccountNotice | null = null;
let nextNotice = 1;
const noticeListeners = new Set<() => void>();

export function showAccountNotice(key: MessageKey, vars?: Record<string, string | number>): void {
  notice = { id: nextNotice++, key, vars };
  for (const l of noticeListeners) l();
}

export function clearAccountNotice(id: number): void {
  if (notice?.id !== id) return;
  notice = null;
  for (const l of noticeListeners) l();
}

function subscribeNotice(l: () => void): () => void {
  noticeListeners.add(l);
  return () => {
    noticeListeners.delete(l);
  };
}

export function useAccountNotice(): AccountNotice | null {
  return useSyncExternalStore(
    subscribeNotice,
    () => notice,
    () => null,
  );
}
