/**
 * El botín de las élites (plan 012, T135; decisión 2 del plan): al caer una
 * élite, con `chance` sale uno de tres objetos, el tipo a partes iguales.
 * Flotan un rato en el agua y se cogen tocándolos (el imán de notas no los
 * arrastra):
 *
 * - **Imán total** (`iman`): todas las notas del mar vuelan al barco.
 * - **Llama** (`llama`): `durationS` s de una llama corta delante del barco;
 *   a un enemigo común o élite le quita toda su vida en `killS` s de
 *   contacto; a minibosses y bosses, un daño fijo por segundo (el
 *   `bossFight.flameDps` de T137, con `flameDamage(…, { bossDps })`).
 * - **Salvavidas** (`salvavidas`): achica `waterFraction` de la capacidad
 *   del barco. (La carta rara de antes se llama ahora «Segunda vida».)
 *
 * Datos puros, sin azar: la tirada la hace la simulación con su generador.
 * Todo es `muestra`.
 */

export type DropId = 'iman' | 'llama' | 'salvavidas';
export const DROP_IDS: readonly DropId[] = ['iman', 'llama', 'salvavidas'];

export interface FlameDef {
  /** s que dura la llama. */
  durationS: number;
  /** u desde el centro del barco hasta la punta de la llama. */
  range: number;
  /** rad a cada lado del rumbo del barco. */
  halfAngle: number;
  /** s de contacto en que un común o una élite pierde toda su vida. */
  killS: number;
}

export interface DropsDef {
  /** Probabilidad (0…1) de que una élite derrotada suelte un objeto. */
  chance: number;
  /** Los objetos que pueden salir; uno de ellos, a partes iguales. */
  types: readonly DropId[];
  /** u: un objeto se coge cuando el casco llega a esta distancia de su centro. */
  radius: number;
  /** s que flota antes de hundirse sin coger. */
  lifeS: number;
  /** Objetos flotando a la vez como mucho (al soltar otro, el más viejo se hunde). */
  max: number;
  llama: FlameDef;
  salvavidas: {
    /** Fracción de la capacidad de agua que achica (0…1). */
    waterFraction: number;
  };
}

/** Lo que la llama puede quemar: un común o élite (por su vida máxima) o un boss. */
export interface FlameTarget {
  readonly maxHp: number;
  /**
   * Miniboss o boss final (T137): el daño fijo por segundo que le hace la
   * llama (`bossFight.flameDps`); sin valor, es un común o una élite.
   */
  readonly bossDps?: number;
}

/**
 * El daño de la llama a `target` en `dt` s de contacto: a un común o élite,
 * su vida máxima repartida en `killS` s (cae justo a los `killS` s); a un
 * miniboss o boss, `bossDps · dt` (no un % de su vida).
 */
export function flameDamage(def: FlameDef, target: FlameTarget, dt: number): number {
  if (!(dt > 0)) return 0;
  if (target.bossDps !== undefined) return Math.max(0, target.bossDps) * dt;
  return (target.maxHp * dt) / Math.max(1e-6, def.killS);
}

/**
 * ¿Toca la llama un círculo de radio `r` a (dx, dy) u del barco? La llama
 * es un sector de radio `range` y medio ángulo `halfAngle` hacia `heading`;
 * el círculo cuenta si su borde entra (su radio se suma al alcance y abre
 * el ángulo lo que ocupa a esa distancia).
 */
export function inFlame(def: FlameDef, heading: number, dx: number, dy: number, r: number): boolean {
  const d = Math.hypot(dx, dy);
  if (d > def.range + r) return false;
  if (d <= r) return true;
  let a = Math.atan2(dy, dx) - heading;
  a = Math.atan2(Math.sin(a), Math.cos(a));
  return Math.abs(a) <= def.halfAngle + Math.asin(Math.min(1, r / d));
}
