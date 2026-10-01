import type { MenuSection } from '../types';
import { ajustesSection } from './ajustes';
import { barcoSection } from './barco';
import { carnetSection } from './carnet';
import { controlesSection } from './controles';
import { descuentosSection } from './descuentos';
import { logrosSection } from './logros';
import { mundosSection } from './mundos';
import { rankingSection } from './ranking';
import { welcomeSection } from './welcome';

/**
 * Secciones del Menú de a bordo, en el orden de la barra (§19). Una sección
 * nueva es un módulo más en esta carpeta y una línea aquí; las de `tools`
 * se agrupan al final, tras la separación.
 */
export const MENU_SECTIONS: readonly MenuSection[] = [
  welcomeSection,
  carnetSection,
  logrosSection,
  descuentosSection,
  mundosSection,
  barcoSection,
  rankingSection,
  controlesSection,
  ajustesSection,
];

/** Orden final: primero progreso, luego herramientas, respetando el orden de la lista. */
export function orderedSections(list: readonly MenuSection[] = MENU_SECTIONS): MenuSection[] {
  return [
    ...list.filter((s) => s.group === 'progress'),
    ...list.filter((s) => s.group === 'tools'),
  ];
}
