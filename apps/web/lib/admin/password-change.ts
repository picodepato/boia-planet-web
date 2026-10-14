/**
 * Cambiar la contraseña del Admin con cuentas (plan 029 T283): comprobación
 * del formulario y lectura del enlace del email de recuperación. Puro, sin
 * red; las llamadas a Supabase están en `lib/account/admin-auth.ts`.
 */

/** Mínimo de caracteres; el mismo que hay que poner en Supabase (Auth → Sign In / Providers → Email). */
export const MIN_PASSWORD_LENGTH = 8;

export type PasswordProblem = 'empty' | 'short' | 'mismatch';

/** ¿Vale la contraseña nueva escrita dos veces? null si sí. */
export function passwordProblem(password: string, again: string): PasswordProblem | null {
  if (!password) return 'empty';
  if (password.length < MIN_PASSWORD_LENGTH) return 'short';
  if (password !== again) return 'mismatch';
  return null;
}

/** Cómo acaba un intento de cambio, en categorías que la pantalla sabe explicar. */
export type PasswordChangeResult = 'ok' | PasswordProblem | 'weak' | 'same' | 'needsAal2' | 'error';

/** Las operaciones de Supabase que usa el flujo, inyectadas para probarlo sin red. */
export interface PasswordChangeDeps {
  change(password: string): Promise<void>;
  /** Cómo clasifica un error de `change`. */
  classify(error: unknown): 'weak' | 'same' | 'needsAal2' | 'error';
}

/** Valida y cambia la contraseña; nunca lanza ni devuelve la contraseña. */
export async function runPasswordChange(
  password: string,
  again: string,
  deps: PasswordChangeDeps,
): Promise<PasswordChangeResult> {
  const problem = passwordProblem(password, again);
  if (problem) return problem;
  try {
    await deps.change(password);
    return 'ok';
  } catch (e) {
    return deps.classify(e);
  }
}

/** Lo que trae la URL a la que lleva el email de recuperación. */
export type RecoveryLink =
  | { kind: 'session'; accessToken: string; refreshToken: string }
  | { kind: 'error'; code: string }
  | { kind: 'none' };

/**
 * El enlace de recuperación de Supabase vuelve a `/admin/recuperar` con la
 * sesión en el fragmento (`#access_token=…&refresh_token=…&type=recovery`) o,
 * si caducó o ya se usó, con `#error=access_denied&error_code=otp_expired`.
 */
export function parseRecoveryLink(hash: string): RecoveryLink {
  const params = new URLSearchParams(hash.replace(/^[#?]/, ''));
  const error = params.get('error_code') ?? params.get('error');
  if (error) return { kind: 'error', code: error };
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken && params.get('type') === 'recovery') {
    return { kind: 'session', accessToken, refreshToken };
  }
  return { kind: 'none' };
}
