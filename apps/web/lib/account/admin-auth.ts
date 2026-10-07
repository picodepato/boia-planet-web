/**
 * Entrar al Admin con cuentas (plan 008, T94, decisión 11): el código de 6
 * cifras del email y después el TOTP (Supabase MFA, `aal2`, D-10). La
 * primera vez se da de alta el TOTP con el QR de la app de autenticación.
 * Sin rol del equipo no se pide TOTP: «sin acceso».
 *
 * Plan 017 T193 (decisión 9): el Admin entra con el Carnet 000 y la
 * contraseña de su cuenta, y después el TOTP; si pierde el móvil, un código
 * de respaldo de un solo uso quita el TOTP y da de alta otro. El código del
 * email sigue para el resto del equipo.
 *
 * Usa el mismo cliente del navegador que la cuenta (`accountClient`): la
 * sesión del Admin es la de la cuenta con email.
 */
import type { BackupCodeUse, BackupCodesResult } from '@boia/db/rpc';
import { normalizeBackupCode } from '../admin/backup-codes';
import { ADMIN_CARNET_NUMBER, parseCarnetNumber } from '../admin/demo-auth';
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

/** El Carnet o la contraseña no valen (no se dice cuál). */
export class WrongCarnetLogin extends Error {
  constructor() {
    super('wrong_carnet_login');
  }
}

/**
 * Entrar con el Carnet 000 y la contraseña de su cuenta (plan 017 T193,
 * decisión 9). El servidor da el email de la cuenta del Carnet 000 (sólo de
 * ese número) y Supabase Auth comprueba la contraseña; después va el TOTP.
 */
export async function signInWithCarnet(carnet: string, password: string): Promise<void> {
  const number = parseCarnetNumber(carnet);
  if (number !== ADMIN_CARNET_NUMBER || !password) throw new WrongCarnetLogin();
  const sb = await client();
  const { data: email, error } = await sb.rpc('admin_sign_in_email', { p_number: number });
  if (error) throw error;
  if (!email) throw new WrongCarnetLogin();
  const res = await sb.auth.signInWithPassword({ email, password });
  if (res.error) {
    const code = (res.error as { code?: string }).code ?? '';
    if (code === 'invalid_credentials' || /invalid login credentials/i.test(res.error.message)) {
      throw new WrongCarnetLogin();
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
