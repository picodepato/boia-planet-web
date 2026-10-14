/**
 * Números de Carnet (plan 029 T282, Álvaro 2026-10-14): seguidos desde el 10.
 * El 0 es del Admin (Carnet 000) y del 1 al 9 quedan reservados: ningún alta
 * los toma sola; el Admin sí puede dar uno a mano (≥ 1, libre).
 *
 * Funciones puras, las mismas reglas que en Supabase
 * (`private.next_member_number`, migración 20261014100200): el contador
 * guarda el último número dado; el siguiente es el primero libre por encima
 * de él y nunca por debajo del 10.
 */

/** El primer número que da un alta. */
export const MEMBER_NUMBER_FIRST = 10;
/** El mayor número que se puede poner a mano (el mismo tope que el servidor). */
export const MEMBER_NUMBER_MAX = 99_999_999;

/**
 * El siguiente número de un alta: el primero libre por encima de `counter`
 * (el último dado; sin contador, ninguno) y desde el 10. Salta los que ya
 * tiene alguien (p. ej. los que el Admin dio a mano por delante).
 */
export function nextMemberNumber(
  counter: number | null | undefined,
  taken: Iterable<number>,
): number {
  const busy = new Set(taken);
  const last = typeof counter === 'number' && Number.isInteger(counter) ? counter : 0;
  let n = Math.max(last, MEMBER_NUMBER_FIRST - 1) + 1;
  while (busy.has(n)) n++;
  return n;
}

export type MemberNumberProblem = 'invalid' | 'taken';

/**
 * ¿Puede el Admin poner `n` a un Carnet? Entero de 1 a `MEMBER_NUMBER_MAX`
 * (el 0 es del Carnet del Admin) y que no lo tenga otro. `own` es el número
 * que ya lleva ese Carnet: ponerle el suyo no es un problema.
 */
export function memberNumberProblem(
  n: unknown,
  taken: Iterable<number>,
  own: number | null | undefined = null,
): MemberNumberProblem | null {
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > MEMBER_NUMBER_MAX) {
    return 'invalid';
  }
  if (n === own) return null;
  for (const t of taken) if (t === n) return 'taken';
  return null;
}

/**
 * Da número a los Carnets guardados que no lo tienen (los creados antes de
 * T282), por orden de alta, sin tocar los que ya lo tienen. Devuelve el
 * contador al día. Cambia `carnets` en el sitio.
 */
export function numberUnnumbered(
  carnets: Record<string, { memberNumber?: number | undefined; memberSince: string }>,
  counter: number | null | undefined,
): number {
  const all = Object.values(carnets);
  const taken = all.flatMap((c) => (c.memberNumber === undefined ? [] : [c.memberNumber]));
  let last = typeof counter === 'number' ? counter : 0;
  const missing = all
    .filter((c) => c.memberNumber === undefined)
    .sort((a, b) => a.memberSince.localeCompare(b.memberSince));
  for (const c of missing) {
    const n = nextMemberNumber(last, taken);
    c.memberNumber = n;
    taken.push(n);
    last = n;
  }
  return last;
}
