import { MAR_PATH, MENU_PARAM } from '../world-handoff';

/**
 * «Zarpar» entra en el juego (T64, D-24): de la entrada de la landing al mar
 * 3D, con la bienvenida de la boia de la entrada abierta (el panel de a
 * bordo `bienvenida`, que `/mar` abre por enlace y quita de la URL al
 * arrancar).
 */
export const ZARPAR_HREF = `${MAR_PATH}?${MENU_PARAM}=bienvenida`;

declare global {
  interface Window {
    /** `performance.now()` al zarpar desde la entrada, en esta pestaña. */
    __boiaZarpar?: number;
  }
}

/** La entrada va a zarpar: el mar, al arrancar, sabe que viene de ella. */
export function markZarpar(): void {
  window.__boiaZarpar = performance.now();
}

/**
 * ¿Se llegó al mar zarpando desde la entrada, en esta misma pestaña (sin
 * recarga)? Se consume: sólo cuenta para el primer arranque.
 */
export function takeZarpar(): boolean {
  if (typeof window === 'undefined' || window.__boiaZarpar === undefined) return false;
  delete window.__boiaZarpar;
  return true;
}
