/**
 * Qué le ha pasado a una llamada de la cuenta, en categorías que la hoja de
 * acceso sabe explicar (T87, «Sign-in sheet»). Supabase Auth da el mismo
 * error (`otp_expired`, «Token has expired or is invalid») a un código mal
 * escrito y a uno caducado: los separa el tiempo desde el envío.
 */
import { OTP_EXPIRY_MS } from './config';

export type AuthProblem = 'wrong' | 'expired' | 'tooMany' | 'invalidEmail' | 'network' | 'unknown';

interface ErrorLike {
  status?: number;
  code?: string;
  message?: string;
  name?: string;
}

function asError(e: unknown): ErrorLike {
  return e && typeof e === 'object' ? (e as ErrorLike) : {};
}

/**
 * Categoría de un error de `signInWithOtp` o `verifyOtp`. `sentAt` es cuándo
 * se pidió el código que se está comprobando (ms), para distinguir caducado.
 */
export function authProblem(
  e: unknown,
  sentAt: number | null = null,
  now = Date.now(),
): AuthProblem {
  const err = asError(e);
  const code = err.code ?? '';
  const message = err.message ?? '';
  if (err.status === 429 || /rate_limit|too_many/.test(code)) return 'tooMany';
  if (code === 'email_address_invalid' || code === 'validation_failed') return 'invalidEmail';
  if (code === 'otp_expired' || /expired or is invalid/i.test(message) || err.status === 403) {
    return sentAt !== null && now - sentAt > OTP_EXPIRY_MS ? 'expired' : 'wrong';
  }
  if (
    err.name === 'AuthRetryableFetchError' ||
    err.status === 0 ||
    /fetch|network/i.test(message)
  ) {
    return 'network';
  }
  return 'unknown';
}

/** El apodo: libre, ocupado, no permitido (filtro) o inválido (longitud). */
export type NicknameVerdict = 'free' | 'taken' | 'blocked' | 'invalid';

/**
 * Lo que dice `nickname_status` (o el motivo de rechazo de `save_profile`)
 * para la hoja. El filtro nunca dice qué palabra falla (T87).
 */
export function nicknameVerdict(status: string | null | undefined): NicknameVerdict | null {
  if (status === 'ok') return 'free';
  if (status === 'nickname_taken') return 'taken';
  if (status === 'nickname_invalid') return 'invalid';
  if (status && status.startsWith('text_')) return 'blocked';
  return null;
}

/** El mensaje (clave estable) de un rechazo de una RPC, o null. */
export function rpcReason(e: unknown): string | null {
  const m = asError(e).message;
  return typeof m === 'string' && /^[a-z_]+$/.test(m) ? m : null;
}

/** Forma razonable de un email; se valida al enviar, no al escribir (T87). */
export function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/.test(email.trim());
}
