/**
 * Entrar al Admin con cuentas (plan 008, T94, decisión 11): el código de 6
 * cifras del email y después el TOTP (Supabase MFA, `aal2`, D-10). La
 * primera vez se da de alta el TOTP con el QR de la app de autenticación.
 * Sin rol del equipo no se pide TOTP: «sin acceso».
 *
 * Plan 017 T193 (decisión 9): el Admin entra con la contraseña de su cuenta
 * (la del Carnet 000; desde T278 escribiendo su email) y después el TOTP;
 * si pierde el móvil, un código de respaldo de un solo uso quita el TOTP y
 * da de alta otro. El código del email sigue para el resto del equipo.
 *
 * Usa el mismo cliente del navegador que la cuenta (`accountClient`): la
 * sesión del Admin es la de la cuenta con email.
 */
import type { BackupCodeUse, BackupCodesResult } from '@boia/db/rpc';
import { normalizeBackupCode } from '../admin/backup-codes';
import type { BoiaSupabase } from '../supabase/browser';
import { accountClient } from './session';

export type StaffRole = 'editor' | 'admin' | 'owner';

/** Dónde está quien abre /admin. */
export type AdminStep =
  | { step: 'email' }
  | { step: 'noAccess'; email: string | null }
  | { step: 'mfa'; email: string | null; role: StaffRole }
  | { step: 'ready'; email: string | null; role: StaffRole; userId: string };

export function isStaffRole(v: unknown): v is StaffRole {
  return v === 'editor' || v === 'admin' || v === 'owner';
}

/** Los roles que llevan las cuatro secciones de datos reales (las RPC piden `admin`). */
export function canManage(role: StaffRole): boolean {
  return role === 'admin' || role === 'owner';
}

async function client(): Promise<BoiaSupabase> {
  const sb = await accountClient();
  if (!sb) throw new Error('sin Supabase');
  return sb;
}

/**
 * Dónde está la sesión de este navegador: sin sesión → email; con sesión y
 * sin fila en `staff_roles` → sin acceso; con rol y aal1 → TOTP; con rol y
 * aal2 → dentro. La fila propia se puede leer con aal1 (RLS
 * `staff_roles_select_own`); los permisos, sólo con aal2.
 */
export async function adminStep(): Promise<AdminStep> {
  const sb = await client();
  const { data } = await sb.auth.getSession();
  const user = data.session?.user;
  if (!user) return { step: 'email' };
  const email = user.email ?? null;
  const { data: rows, error } = await sb.from('staff_roles').select('role').eq('user_id', user.id);
  if (error) throw error;
  const role = rows?.[0]?.role;
  if (!isStaffRole(role)) return { step: 'noAccess', email };
  const aal = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal.error) throw aal.error;
  if (aal.data.currentLevel !== 'aal2') return { step: 'mfa', email, role };
  return { step: 'ready', email, role, userId: user.id };
}

/**
 * Pide el código. No crea cuentas: un email sin cuenta no recibe nada, pero
 * la pantalla dice lo mismo (no se revela quién tiene cuenta).
 */
export async function sendAdminCode(email: string): Promise<void> {
  const sb = await client();
  const { error } = await sb.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: false },
  });
  if (!error) return;
  const code = (error as { code?: string }).code ?? '';
  if (
    code === 'otp_disabled' ||
    code === 'user_not_found' ||
    /signups not allowed/i.test(error.message)
  ) {
    return;
  }
  throw error;
}

/** El email o la contraseña no valen (no se dice cuál). */
export class WrongPasswordLogin extends Error {
  constructor() {
    super('wrong_password_login');
  }
}

/**
 * Entrar con el email y la contraseña de la cuenta del Admin (la del Carnet
 * 000; plan 017 T193, decisión 9) y después el TOTP. Plan 029 T278: el
 * Admin escribe el email; antes «000» lo pedía a la base
 * (`admin_sign_in_email`), y así cualquiera podía averiguarlo.
 */
export async function signInWithAdminPassword(email: string, password: string): Promise<void> {
  const address = email.trim();
  if (!address || !password) throw new WrongPasswordLogin();
  const sb = await client();
  const res = await sb.auth.signInWithPassword({ email: address, password });
  if (res.error) {
    const code = (res.error as { code?: string }).code ?? '';
    if (code === 'invalid_credentials' || /invalid login credentials/i.test(res.error.message)) {
      throw new WrongPasswordLogin();
    }
    throw res.error;
  }
}

/**
 * Usa un código de respaldo (con la contraseña ya puesta, aal1): el TOTP
 * perdido se quita y el paso siguiente da de alta uno nuevo. Devuelve los
 * que quedan; un código que no vale o ya se usó lanza.
 */
export async function redeemBackupCode(code: string): Promise<number> {
  const sb = await client();
  const { data, error } = await sb.rpc('admin_use_backup_code', {
    p_code: normalizeBackupCode(code),
  });
  if (error) throw error;
  return (data as unknown as BackupCodeUse).left;
}

/** 10 códigos nuevos (los anteriores dejan de valer). Se enseñan una vez. */
export async function generateBackupCodes(): Promise<string[]> {
  const sb = await client();
  const { data, error } = await sb.rpc('admin_generate_backup_codes');
  if (error) throw error;
  return (data as unknown as BackupCodesResult).codes;
}

/** Los códigos de respaldo que quedan sin usar. */
export async function backupCodesLeft(): Promise<number> {
  const sb = await client();
  const { data, error } = await sb.rpc('admin_backup_codes_left');
  if (error) throw error;
  return data ?? 0;
}

export async function verifyAdminCode(email: string, token: string): Promise<void> {
  const sb = await client();
  const { error } = await sb.auth.verifyOtp({ email: email.trim(), token, type: 'email' });
  if (error) throw error;
}

/** El TOTP ya dado de alta y verificado, si lo hay. */
export async function verifiedTotp(): Promise<string | null> {
  const sb = await client();
  const { data, error } = await sb.auth.mfa.listFactors();
  if (error) throw error;
  return data.totp.find((f) => f.status === 'verified')?.id ?? null;
}

export interface TotpEnrollment {
  factorId: string;
  /** El QR de la app de autenticación (SVG en `data:`). */
  qrCode: string;
  /** El secreto en base32, para escribirlo a mano. */
  secret: string;
  uri: string;
}

/** Alta del TOTP: borra un alta a medias anterior y crea una nueva. */
export async function enrollTotp(): Promise<TotpEnrollment> {
  const sb = await client();
  const { data: list, error: listError } = await sb.auth.mfa.listFactors();
  if (listError) throw listError;
  for (const f of list.all) {
    if (f.factor_type === 'totp' && f.status !== 'verified') {
      await sb.auth.mfa.unenroll({ factorId: f.id });
    }
  }
  const { data, error } = await sb.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `BOIA Admin ${new Date().toISOString().slice(0, 10)}`,
    issuer: 'BOIA.PLANET',
  });
  if (error) throw error;
  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
  };
}

/** Comprueba un código de la app: la sesión sube a aal2. */
export async function verifyTotp(factorId: string, code: string): Promise<void> {
  const sb = await client();
  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
  if (error) throw error;
}

/** Para cambiar la contraseña hace falta haber entrado con el TOTP (aal2). */
export class AdminPasswordNeedsAal2 extends Error {
  constructor() {
    super('admin_password_needs_aal2');
  }
}

/** Supabase no acepta la contraseña nueva. */
export class AdminPasswordRejected extends Error {
  constructor(readonly reason: 'weak' | 'same' | 'other') {
    super(`admin_password_rejected_${reason}`);
  }
}

/** Qué le ha pasado a un cambio de contraseña, para la pantalla. */
export function passwordChangeFailure(e: unknown): 'weak' | 'same' | 'needsAal2' | 'error' {
  if (e instanceof AdminPasswordNeedsAal2) return 'needsAal2';
  if (e instanceof AdminPasswordRejected) return e.reason === 'other' ? 'error' : e.reason;
  return 'error';
}

/**
 * Cambia la contraseña de la cuenta del Admin (plan 029 T283). Sólo con la
 * sesión completa (aal2: contraseña y TOTP); si no, lanza
 * `AdminPasswordNeedsAal2` sin llamar a Supabase.
 */
export async function changeAdminPassword(password: string): Promise<void> {
  await updatePassword(password, false);
}

/**
 * Pone la contraseña nueva tras el enlace del email (sesión aal1). Si la
 * cuenta tiene TOTP, primero hay que verificarlo (Supabase lo exige para
 * cambiar la contraseña); si no tiene, basta el enlace.
 */
export async function setPasswordAfterRecovery(password: string): Promise<void> {
  await updatePassword(password, true);
}

async function updatePassword(password: string, recovery: boolean): Promise<void> {
  const sb = await client();
  const aal = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal.error) throw aal.error;
  const { currentLevel, nextLevel } = aal.data;
  const enough = recovery
    ? currentLevel === 'aal2' || nextLevel !== 'aal2'
    : currentLevel === 'aal2';
  if (!enough) throw new AdminPasswordNeedsAal2();
  const { error } = await sb.auth.updateUser({ password });
  if (!error) return;
  const code = (error as { code?: string }).code ?? '';
  if (code === 'weak_password') throw new AdminPasswordRejected('weak');
  if (code === 'same_password') throw new AdminPasswordRejected('same');
  if (code === 'insufficient_aal') throw new AdminPasswordNeedsAal2();
  throw error;
}

/**
 * «He olvidado la contraseña»: Supabase manda el enlace de recuperación al
 * email, que vuelve a `redirectTo` (/admin/recuperar). La pantalla dice lo
 * mismo exista o no la cuenta (no se revela quién la tiene). El límite de
 * Supabase (un correo por cuenta cada 60 s) sólo salta con una cuenta que
 * existe: también se calla, o el aviso distinto la delataría (T283 audit).
 */
export async function requestPasswordRecovery(email: string, redirectTo: string): Promise<void> {
  const sb = await client();
  const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (!error) return;
  const { code = '', status } = error as { code?: string; status?: number };
  if (code === 'user_not_found' || code === 'otp_disabled') return;
  if (status === 429 || /rate_limit|too_many/.test(code)) return;
  throw error;
}

/** Abre la sesión de recuperación que trae el enlace del email (aal1). */
export async function startRecoverySession(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  const sb = await client();
  const { error } = await sb.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw error;
}

export async function adminSignOut(): Promise<void> {
  const sb = await client();
  await sb.auth.signOut({ scope: 'local' });
}

/** El token de la sesión, para las rutas del servidor del Admin. */
export async function adminAccessToken(): Promise<string | null> {
  const sb = await client();
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}

/** El cliente con la sesión del Admin (aal2) para las secciones reales. */
export function adminClient(): Promise<BoiaSupabase> {
  return client();
}
