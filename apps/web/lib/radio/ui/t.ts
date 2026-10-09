import { fill } from '../../i18n/core';
import { esRadio, type RadioKey } from '../../i18n/es-radio';

/**
 * Traduce sólo las claves de la radio (plan 022 T247): como `lib/i18n/web.ts`
 * con la web, para que el trozo perezoso de la radio no arrastre el catálogo
 * entero (ni entre en la ruta crítica de la landing).
 */
export function t(key: RadioKey, vars?: Record<string, string | number>): string {
  return fill(esRadio[key], vars);
}
