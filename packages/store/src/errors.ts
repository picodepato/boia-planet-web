/**
 * Errores del repositorio. `code` es contrato (la interfaz decide el texto a
 * partir de él); `message` es para el desarrollador.
 */
export type StoreErrorCode =
  /** Datos que no cumplen la forma o los límites (apodo, 140 caracteres…). */
  | 'invalid'
  /** El id no existe (evento, botella, logro, cosmético, descuento…). */
  | 'not_found'
  /** Existe pero no se puede: no es tuyo, evento no comprable, logro inactivo. */
  | 'forbidden'
  /** Choca con algo que ya existe: segunda botella activa, apodo en uso. */
  | 'conflict'
  /** No hay monedas suficientes (gastar nunca deja el saldo en negativo). */
  | 'insufficient_coins'
  /** Hace falta el Carnet (apodo) para escribir botellas o reportar. */
  | 'no_carnet';

export class StoreError extends Error {
  readonly code: StoreErrorCode;
  constructor(code: StoreErrorCode, message: string) {
    super(message);
    this.name = 'StoreError';
    this.code = code;
  }
}

export function isStoreError(e: unknown, code?: StoreErrorCode): e is StoreError {
  return e instanceof StoreError && (code === undefined || e.code === code);
}

/** Mensaje de un `conflict` por un apodo que ya lleva otro miembro. */
export const NICKNAME_TAKEN_MESSAGE = 'apodo en uso';
/** Mensaje de un `conflict` al crear un Carnet que ya existe. */
export const CARNET_EXISTS_MESSAGE = 'ya hay Carnet';

/**
 * ¿El apodo ya es de otro miembro? Sólo eso (T293): en local, el `conflict`
 * de `checkNickname`; con cuenta, el rechazo `nickname_taken` del servidor.
 * Ningún otro choque se cuenta como apodo ocupado.
 */
export function isNicknameTaken(e: unknown): boolean {
  if (!isStoreError(e, 'conflict')) return false;
  const reason = (e as { reason?: unknown }).reason;
  return reason === undefined ? e.message === NICKNAME_TAKEN_MESSAGE : reason === 'nickname_taken';
}
