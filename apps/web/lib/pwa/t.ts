import { fill } from '../i18n/core';
import { esPwa, type PwaKey } from '../i18n/es-pwa';

/**
 * Traduce sólo las claves de la app instalable (plan 027 T264): como
 * `lib/radio/ui/t.ts`, para que el aviso perezoso no arrastre el catálogo
 * entero a la landing.
 */
export function t(key: PwaKey, vars?: Record<string, string | number>): string {
  return fill(esPwa[key], vars);
}
