/**
 * Las Calitas (plan 019 T222, decisión 16): la isla de los comentarios en
 * /mar y su moderación en el Admin. Todo `muestra` hasta que Álvaro lo
 * apruebe.
 */
export const esCalitas = {
  // La ficha de la isla
  'calitas.kicker': 'Isla de los comentarios · muestra',
  'calitas.title': 'Las Calitas',
  'calitas.intro': 'La cala donde se charla: escribe, responde y vota lo que más te guste.',
  'calitas.open': 'Leer y comentar',
  'calitas.localNote':
    'Versión de prueba: ves los comentarios de muestra y los tuyos, que sólo ves tú en este navegador.',
  'calitas.sharedNote': 'Lo que escribas lo lee todo el mundo. Sin insultos ni datos de contacto.',
  'calitas.list': 'Comentarios',
  'calitas.empty': 'Aún no hay comentarios. ¡Escribe el primero!',
  // Escribir
  'calitas.form.label': 'Tu comentario',
  'calitas.form.placeholder': 'Escribe algo para la gente de BOIA…',
  'calitas.form.publish': 'Publicar',
  'calitas.form.count': '{n}/{max}',
  'calitas.posted': 'Publicado.',
  'calitas.reply': 'Responder',
  'calitas.reply.label': 'Tu respuesta a {author}',
  'calitas.reply.publish': 'Enviar respuesta',
  'calitas.reply.cancel': 'Cancelar',
  'calitas.replies': 'Respuestas',
  // Votar
  'calitas.vote.up': 'Votar a favor',
  'calitas.vote.down': 'Votar en contra',
  'calitas.vote.score': '{n} votos',
  // Autores y orden
  'calitas.author.you': 'Tú',
  'calitas.author.unknown': 'Alguien de BOIA',
  'calitas.author.sample': 'muestra',
  'calitas.order.label': 'Ordenar',
  'calitas.order.recent': 'Recientes',
  'calitas.order.top': 'Más votados',
  // Con cuentas
  'calitas.needAccount': 'Para comentar y votar hace falta tu Carnet BOIA.',
  'calitas.signIn': 'Hacer mi Carnet',
  // Errores
  'calitas.error.offensive':
    'Ese comentario lleva palabras que aquí no se dicen. Cámbialo y vuelve a probar.',
  'calitas.error.contact': 'Sin enlaces, emails ni teléfonos, por favor.',
  'calitas.error.length': 'El comentario tiene de 1 a {max} caracteres.',
  'calitas.error.limit': 'Has comentado mucho seguido. Espera un poco y vuelve.',
  'calitas.error.account': 'Hace falta tu Carnet BOIA para comentar y votar.',
  'calitas.error.gone': 'Ese comentario ya no está.',
  'calitas.error.own': 'Tu propio comentario no se vota.',
  'calitas.error.generic': 'No se pudo. Prueba otra vez.',

  // La moderación en el Admin
  'admin.calitas.heading': 'Comentarios de Las Calitas',
  'admin.calitas.lead':
    'Oculta lo que no deba leerse, con un motivo, o devuélvelo. Lo oculto desaparece de Las Calitas al momento; las respuestas de un comentario oculto se van con él.',
  'admin.calitas.localLead':
    'Versión de prueba: los comentarios de muestra y los escritos en este navegador.',
  'admin.calitas.empty': 'Sin comentarios.',
  'admin.calitas.onlyHidden': 'Sólo los ocultos',
  'admin.calitas.reply': 'Respuesta',
  'admin.calitas.hidden': 'Oculto',
  'admin.calitas.hiddenWhy': 'Oculto: {reason}',
  'admin.calitas.meta': '{author} · {date} · {score} votos',
  'admin.calitas.reason': 'Motivo',
  'admin.calitas.hide': 'Ocultar',
  'admin.calitas.show': 'Mostrar',
  'admin.calitas.hideDone': 'Comentario oculto.',
  'admin.calitas.showDone': 'Comentario visible otra vez.',
  'admin.calitas.reasonRequired': 'Ocultar pide un motivo (3 letras o más).',
} as const;
