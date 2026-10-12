/**
 * Lo que decide el visor a pantalla completa de la Galería (plan 029 T277),
 * sin DOM para poder probarlo: pasar a la pieza anterior o siguiente, qué
 * gesto es un deslizamiento, qué tecla hace qué, la barra de progreso de un
 * clip y a dónde va el foco con el tabulador (el visor lo atrapa).
 */

/** Cuánto hay que deslizar (px) para que cuente como gesto y no como un toque. */
export const SWIPE_MIN = 48;
/** Hacia abajo, algo más, para no cerrar sin querer al deslizar de lado. */
export const SWIPE_CLOSE_MIN = 80;
/** El eje principal tiene que ganar al otro por esta razón. */
export const SWIPE_DOMINANCE = 1.5;

export type ViewerAction = 'next' | 'prev' | 'close';

/** El índice de la pieza anterior (-1) o siguiente (+1): da la vuelta por los extremos. */
export function stepIndex(index: number, total: number, dir: 1 | -1): number {
  if (total <= 0) return 0;
  return (((index + dir) % total) + total) % total;
}

/**
 * Un deslizamiento de dedo: de lado, anterior o siguiente (deslizar a la
 * izquierda trae la siguiente); hacia abajo, cerrar. Diagonales flojas y
 * toques, nada.
 */
export function swipeAction(dx: number, dy: number): ViewerAction | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax >= SWIPE_MIN && ax > ay * SWIPE_DOMINANCE) return dx < 0 ? 'next' : 'prev';
  if (dy >= SWIPE_CLOSE_MIN && ay > ax * SWIPE_DOMINANCE) return 'close';
  return null;
}

export type KeyAction = ViewerAction | 'toggle-play' | 'toggle-sound';

/**
 * Qué hace una tecla. El espacio sólo alterna la reproducción si el foco no
 * está en un botón o en la barra (ahí ya hace lo suyo).
 */
export function keyAction(key: string, onControl = false): KeyAction | null {
  switch (key) {
    case 'Escape':
      return 'close';
    case 'ArrowRight':
      return 'next';
    case 'ArrowLeft':
      return 'prev';
    case ' ':
    case 'Spacebar':
      return onControl ? null : 'toggle-play';
    case 'm':
    case 'M':
      return 'toggle-sound';
    default:
      return null;
  }
}

/** Posición de un clip como fracción 0–1 (0 si aún no se conoce la duración). */
export function clipProgress(current: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(current)) return 0;
  return Math.min(1, Math.max(0, current / duration));
}

/** «0:07» para una posición en segundos. */
export function clipTime(seconds: number): string {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * El tabulador dentro del visor: al pasar del último al primero (o al revés
 * con Mayús) el foco da la vuelta en vez de salir a la página. Devuelve a
 * dónde mandar el foco, o null si se deja al navegador.
 */
export function trapFocusTarget(
  shift: boolean,
  index: number,
  count: number,
): 'first' | 'last' | null {
  if (count <= 0) return null;
  if (index < 0) return shift ? 'last' : 'first';
  if (!shift && index === count - 1) return 'first';
  if (shift && index === 0) return 'last';
  return null;
}
