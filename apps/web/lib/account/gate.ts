/**
 * La puerta de la cuenta (decisión 1): navegar, jugar y leer no la piden;
 * guardar sí. Cada sitio que guarda llama a `requireAccount(motivo)` antes de
 * hacerlo y sigue sólo si devuelve true:
 *
 *   if (!(await requireAccount('skin'))) return;   // canceló
 *   … comprar …
 *
 * Motivos: `carnet` (crear o guardar el Carnet, T89), `skin` (comprar en la
 * tienda, T90), `stamp` (el sello de una fiesta, T91, con `event`) y
 * `ranking` (entrar en el ranking, T92). Cada uno tiene su título y su línea
 * de «por qué te lo pedimos» en la hoja de acceso.
 *
 * - Modo local (sin Supabase): true al momento, todo como hoy.
 * - Con cuenta y Carnet: true al momento.
 * - Si no: abre la hoja de acceso (`<AccountGate />`, montado en /mar y
 *   /carnet) y espera. true cuando termina (cuenta nueva con su Carnet o
 *   cuenta existente); false si se cierra o se vuelve atrás.
 */
import { isSupabaseConfigured } from '../supabase/config';
import { accountReady } from './session';

export const ACCOUNT_REASONS = ['carnet', 'skin', 'stamp', 'ranking'] as const;
export type AccountReason = (typeof ACCOUNT_REASONS)[number];

export interface AccountPrefill {
  /** Apodo para el paso de la cuenta nueva (si no, el del Carnet de este navegador). */
  nickname?: string | null | undefined;
  avatarKey?: string | null | undefined;
  avatarImage?: string | null | undefined;
}

export interface AccountGateOptions {
  /** Nombre de la fiesta del sello (motivo `stamp`). */
  event?: string | undefined;
  prefill?: AccountPrefill | undefined;
  /** A new registration may continue into its optional Carnet questionnaire. */
  onRegistered?: (() => void) | undefined;
}

export interface GateRequest extends AccountGateOptions {
  id: number;
  reason: AccountReason;
}

let pending: (GateRequest & { resolve: (ok: boolean) => void }) | null = null;
let nextId = 1;
let hosts = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function gateSnapshot(): GateRequest | null {
  return pending;
}

export function subscribeGate(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** `<AccountGate />` se apunta al montarse; sin ninguno, la puerta no se abre. */
export function registerGateHost(): () => void {
  hosts += 1;
  return () => {
    hosts -= 1;
  };
}

export async function requireAccount(
  reason: AccountReason,
  opts: AccountGateOptions = {},
): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;
  const account = await accountReady();
  if (account.status === 'member' || account.status === 'local') return true;
  if (hosts === 0) {
    console.warn('[boia] requireAccount sin <AccountGate /> montado');
    return false;
  }
  pending?.resolve(false);
  return new Promise<boolean>((resolve) => {
    pending = { id: nextId++, reason, ...opts, resolve };
    emit();
  });
}

/** La hoja termina: true si ya hay cuenta con Carnet, false si se canceló. */
export function settleGate(ok: boolean): void {
  const p = pending;
  pending = null;
  emit();
  p?.resolve(ok);
}

/** Sólo pruebas. */
export function resetGateForTests(): void {
  pending = null;
  hosts = 0;
  emit();
}
