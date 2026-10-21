import type { GuestListSignup } from '@boia/store';
import { fill } from '../i18n/core';
import { esLista, type ListaKey } from '../i18n/es-lista';
import { esListaBoton, type ListaBotonKey } from '../i18n/es-lista-boton';
import { listClosingTime } from './model';

/**
 * Los textos del diálogo de la lista (plan 034 T309): un trozo perezoso, fuera
 * de la ruta crítica de la landing. También las claves del botón.
 */
export function tl(key: ListaKey | ListaBotonKey, vars?: Record<string, string | number>): string {
  const all: Record<ListaKey | ListaBotonKey, string> = { ...esListaBoton, ...esLista };
  return fill(all[key], vars);
}

/** «21 de octubre a las 10:05»: cuándo se apuntó, en la zona horaria de la fiesta. */
export function signupDate(createdAt: string, timeZone: string): string {
  const d = new Date(createdAt);
  const day = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', timeZone }).format(
    d,
  );
  return `${day}, ${listClosingTime(createdAt, timeZone)}`;
}

/** «Te apuntaste el 21 de octubre, 10:05 como «Pepa».» */
export function signupLine(signup: GuestListSignup, timeZone: string): string {
  return tl('lista.mine.body', {
    date: signupDate(signup.createdAt, timeZone),
    name: signup.listName,
  });
}
