/**
 * Códigos de respaldo del TOTP del Admin (plan 017 T193, REQ-ADM-002). Los
 * genera el servidor (`admin_generate_backup_codes`, migración
 * 20261007100400): 10 de un solo uso, «XXXXX-XXXXX» con un alfabeto de 32
 * caracteres sin I, O, 0 ni 1. Aquí sólo se limpia lo que escribe el Admin y
 * se prepara la copia para guardarla.
 */

/** El alfabeto de los códigos (el mismo que la migración). */
export const BACKUP_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const BACKUP_CODE_LENGTH = 10;
export const BACKUP_CODE_COUNT = 10;

/** Sin espacios ni guiones y en mayúsculas, como lo compara el servidor. */
export function normalizeBackupCode(input: string): string {
  return input.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

/** ¿Tiene forma de código de respaldo? (10 caracteres del alfabeto). */
export function looksLikeBackupCode(input: string): boolean {
  const code = normalizeBackupCode(input);
  return (
    code.length === BACKUP_CODE_LENGTH && [...code].every((c) => BACKUP_CODE_ALPHABET.includes(c))
  );
}

/** El texto para guardar los códigos (descarga .txt), uno por línea. */
export function backupCodesText(codes: readonly string[], heading: string, at: Date): string {
  return [heading, at.toISOString().slice(0, 10), '', ...codes, ''].join('\n');
}
