/**
 * Constantes de la cuenta con email (plan 008, T89, decisiones 1–5).
 *
 * `OTP_LENGTH` y `OTP_EXPIRY_MS` tienen que coincidir con el panel de
 * Supabase (Authentication → Sign In / Providers → Email: «Email OTP Length»
 * 6 y «Email OTP Expiration» 600 s); los pasos están en ESTADO.md (T89).
 */

/**
 * Versión de la política de privacidad que se acepta al crear la cuenta; se
 * guarda con la fecha en `consents` (decisión 3). Sube cuando cambie el texto
 * de /legal/privacidad. `muestra` hasta P21.
 */
export const PRIVACY_POLICY_VERSION = 'muestra-2026-10-03';

/** Cifras del código que llega por email (decisión 2, REQ-IDE-002). */
export const OTP_LENGTH = 6;

/** Cuánto vale un código: pasado esto, un código rechazado es «caducado». */
export const OTP_EXPIRY_MS = 10 * 60_000;

/** Espera entre dos envíos del código (la de Supabase es de 60 s). */
export const RESEND_COOLDOWN_S = 60;

/** El apodo se comprueba al dejar de escribir (T87, «Sign-in sheet»). */
export const NICKNAME_CHECK_DELAY_MS = 400;

/** Lo que dura un aviso de la cuenta (entrar, salir, borrar). */
export const ACCOUNT_NOTICE_MS = 6000;
