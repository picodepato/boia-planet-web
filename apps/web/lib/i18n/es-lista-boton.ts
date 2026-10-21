/**
 * «Apuntarse en la lista» de la landing y la ficha (plan 034 T309, Álvaro
 * 2026-10-21): sólo lo que se ve junto al botón, que va en la ruta crítica de
 * la landing (presupuesto de T14). El diálogo, en `es-lista.ts`. Todo
 * `muestra` hasta que Álvaro lo apruebe.
 */
export const esListaBoton = {
  'lista.join': 'Apuntarse en la lista',
  // El precio en la puerta, junto al botón (Halloween: «5 € con carnet en puerta»).
  'lista.doorPrice': '{euros} € con carnet en puerta',
  // La hora de cierre sale de los ajustes de la fiesta.
  'lista.notice': 'La lista vale hasta las {time}; después, por orden de llegada',
} as const;

export type ListaBotonKey = keyof typeof esListaBoton;
