'use client';

import { isRpcRejection } from '@boia/db/rpc';
import { type ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { type StaffRole, adminClient, canManage } from '../../../lib/account/admin-auth';
import { type MessageKey, t } from '../../../lib/i18n';
import type { BoiaSupabase } from '../../../lib/supabase/browser';

/** Quién está dentro del Admin con cuentas (T94). */
export interface RealAdmin {
  email: string | null;
  role: StaffRole;
  userId: string;
  signOut: () => Promise<void>;
}

const RealAdminContext = createContext<RealAdmin | null>(null);
export const RealAdminProvider = RealAdminContext.Provider;

export function useRealAdmin(): RealAdmin {
  const v = useContext(RealAdminContext);
  if (!v) throw new Error('useRealAdmin fuera del Admin con cuentas');
  return v;
}

/** Quién está dentro con cuentas, o null en el Admin de la demo (T189: fotos de las islas). */
export function useMaybeRealAdmin(): RealAdmin | null {
  return useContext(RealAdminContext);
}

/** El cliente con la sesión del Admin (aal2); null hasta que carga. */
export function useAdminSupabase(): BoiaSupabase | null {
  const [sb, setSb] = useState<BoiaSupabase | null>(null);
  useEffect(() => {
    let alive = true;
    void adminClient().then((c) => alive && setSb(c));
    return () => {
      alive = false;
    };
  }, []);
  return sb;
}

const REJECTION_TEXT: Partial<Record<string, MessageKey>> = {
  forbidden: 'admin.real.error.forbidden',
  reason_required: 'admin.real.error.reasonRequired',
  unknown_member: 'admin.real.error.unknownMember',
  unknown_event: 'admin.real.error.unknownEvent',
  invalid_window: 'admin.real.error.invalidWindow',
  invalid_image: 'admin.real.error.invalidImage',
  unknown_bottle: 'admin.real.error.notFound',
  unknown_report: 'admin.real.error.notFound',
  unknown_time: 'admin.real.error.notFound',
  unknown_entry: 'admin.real.error.notFound',
  invalid_entry: 'admin.real.error.invalidEntry',
  insufficient_coins: 'admin.real.error.coinsSpent',
  number_taken: 'admin.real.error.numberTaken',
  invalid_number: 'admin.real.error.invalidNumber',
};

/** Lo que se le dice al equipo de un error de Supabase (una RPC, la RLS, la red). */
export function realErrorText(e: unknown): string {
  const err = (e && typeof e === 'object' ? e : {}) as { message?: string; code?: string };
  const msg = err.message ?? String(e);
  if (isRpcRejection(msg) || msg in REJECTION_TEXT) {
    const key = REJECTION_TEXT[msg];
    return key ? t(key) : msg;
  }
  if (err.code === '42501') return t('admin.real.error.forbidden');
  if (/fetch|network/i.test(msg)) return t('admin.real.error.network');
  return msg;
}

/** Espera una llamada de Supabase y lanza un Error con el texto para el equipo. */
export async function must<T>(call: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await call;
  if (error) throw new Error(realErrorText(error));
  return data;
}

/** El aviso para un editor: las secciones con datos reales piden el rol admin. */
export function NeedsAdmin({ children }: { children: ReactNode }) {
  const admin = useRealAdmin();
  if (canManage(admin.role)) return <>{children}</>;
  return (
    <p className="admin-lead" data-testid="admin-real-editor">
      {t('admin.real.editorOnly')}
    </p>
  );
}

/** Fecha y hora para el equipo (Europe/Madrid). */
export function when(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Guarda un archivo en el ordenador de quien lo pide. */
export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
