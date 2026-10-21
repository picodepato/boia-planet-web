/**
 * La lista de una fiesta, del lado del socio (plan 034 T309, Álvaro
 * 2026-10-21): el diálogo para apuntarse o borrarse (un trozo perezoso de
 * `lib/lista`) y el botón de /mar. Lo que enseña el botón de la landing va
 * aparte, en `es-lista-boton.ts`, para no pasar del presupuesto de la landing
 * (T14). Las dos entran en el catálogo entero (`es.ts`). Todo `muestra`
 * hasta que Álvaro lo apruebe.
 */
export const esLista = {
  'lista.joinAria': 'Apuntarse en la lista de {name}',
  // En /mar, con su icono, como «🎟️ Comprar entrada».
  'lista.joinMar': '📝 Apuntarse en la lista',

  'lista.loading': 'Mirando la lista…',
  'lista.error': 'No hemos podido abrir la lista. Prueba otra vez en un rato.',
  'lista.failed': 'No ha salido. Prueba otra vez.',
  'lista.close': 'Cerrar',

  // Apuntarse
  'lista.name.label': 'Tu nombre en la lista',
  'lista.name.hint': 'De {min} a {max} caracteres. Es el que buscarán en la puerta.',
  'lista.name.invalid': 'El nombre tiene que tener de {min} a {max} caracteres.',
  'lista.confirm': 'Apuntarme',
  'lista.confirming': 'Apuntando…',

  // Ya apuntado
  'lista.mine.title': 'Estás en la lista',
  'lista.mine.body': 'Te apuntaste el {date} como «{name}».',
  'lista.leave': 'Borrarme de la lista',
  'lista.leave.ask': '¿Seguro que te borras? Tu sitio queda libre para otra persona.',
  'lista.leave.yes': 'Sí, borrarme',
  'lista.leave.no': 'No, me quedo',
  'lista.leaving': 'Borrando…',
  'lista.left': 'Te has borrado de la lista. Puedes volver a apuntarte mientras siga abierta.',

  // Sin sitio o fuera de hora
  'lista.full': 'Lista completa',
  'lista.full.body': 'Ya no quedan sitios en la lista.',
  'lista.closed': 'Lista cerrada',
  'lista.closed.body': 'Ya no se puede apuntar ni borrar nadie.',

  // Sin Carnet
  'lista.carnet.title': 'Para apuntarte necesitas el Carnet BOIA',
  'lista.carnet.body': 'Sácatelo (es gratis) y vuelves a la lista.',
  'lista.carnet.create': 'Sacarme el Carnet',
  'lista.carnet.createAndBack': 'Crear Carnet y volver a la lista',
} as const;

export type ListaKey = keyof typeof esLista;
