/**
 * Textos del Admin para el acceso completo, la papelera de cambios y la
 * analítica de visitas (plan 019 T223, decisión 17), con el panel «Embudo»
 * (plan 032 T301). Todo `muestra` hasta que
 * Álvaro lo apruebe.
 */
export const esAdminGestion = {
  // Acceso completo: como mucho FULL_ACCESS_LIMIT personas
  'admin.gestion.users.limit':
    'Como mucho {limit} personas con acceso completo (administrador o propietario). El propietario, el del Carnet 000, es una de ellas; los editores no cuentan. Lo impide la base de datos: para dar el acceso completo a otra persona, quítaselo antes a una.',
  'admin.gestion.users.count': 'Con acceso completo ahora: {count} de {limit}.',
  'admin.gestion.users.full': 'Ya están las {limit}: no entra nadie más con acceso completo.',

  // Papelera de cambios
  'admin.gestion.trash.lead':
    'Lo cambiado o borrado desde el Admin se puede deshacer durante {days} días. Después se va solo. Purgar a mano no se puede deshacer.',
  'admin.gestion.trash.changesTitle': 'Cambiado',
  'admin.gestion.trash.changesLead':
    '«Deshacer» deja lo que tocó un cambio como estaba antes. Deshacer también es un cambio: se puede deshacer a su vez. Lo que se creó con ese cambio pasa a «Borrado».',
  'admin.gestion.trash.deletedTitle': 'Borrado',
  'admin.gestion.trash.kind.edit': 'Cambiado',
  'admin.gestion.trash.kind.create': 'Creado',
  'admin.gestion.trash.kind.order': 'Orden cambiado',
  'admin.gestion.trash.kind.reset': 'Vuelto a la muestra',
  'admin.gestion.trash.kind.discard': 'Borrador descartado',
  'admin.gestion.trash.when': 'el {day} · se puede deshacer hasta el {until}',
  'admin.gestion.trash.order': 'orden',
  'admin.gestion.trash.wholeArea': 'toda el área',
  'admin.gestion.trash.undo': 'Deshacer',
  'admin.gestion.trash.undone': 'Deshecho: está como antes de ese cambio.',
  'admin.gestion.trash.noChanges': 'Ningún cambio dentro del plazo.',
  'admin.gestion.trash.realNote':
    'Con cuentas, esta papelera guarda lo que se cambia en el contenido de este Admin. Los socios y las fiestas borrados están arriba, en «Socios y fiestas borrados». Lo de las demás secciones con datos reales (Carnets, botellas, Las Calitas, rankings) se devuelve desde su propia sección (una respuesta retirada o el enlace a la música de un artista, desde la papelera de moderación de Carnets) y queda en la auditoría de la base de datos.',

  // Analítica de visitas
  'admin.gestion.analytics.title': 'Analítica de visitas',
  'admin.gestion.analytics.lead':
    'El embudo de visitas, anónimo, en nuestros propios contadores: sólo cuántas visitas pasan por cada paso cada día. Sin cookies, sin datos personales y sin terceros. Apagada, la web no manda nada. Los números, en «Embudo».',
  'admin.gestion.analytics.toggle': 'Analítica de visitas encendida',
  'admin.gestion.analytics.on': 'Encendida.',
  'admin.gestion.analytics.off': 'Apagada: no sale ningún evento.',
  'admin.gestion.analytics.local': 'En la versión de prueba vale sólo para este navegador.',
  'admin.gestion.analytics.real': 'Vale para toda la web.',
  'admin.gestion.analytics.reason': 'analítica de visitas',

  // Embudo (plan 032 T301): los contadores propios
  'admin.gestion.funnel.nav': 'Embudo',
  'admin.gestion.funnel.title': 'Embudo de visitas',
  'admin.gestion.funnel.lead':
    'Cuántas visitas pasan por cada paso, de la portada a la ticketera. Cada paso cuenta una vez por visita. Sin cookies ni datos personales: sólo la suma de cada día. Sólo cuenta con la analítica encendida (Integraciones). Como cualquiera puede sumar, los números son orientativos.',
  'admin.gestion.funnel.step': 'Paso',
  'admin.gestion.funnel.window': 'Últimos {days} días',
  'admin.gestion.funnel.pct': '% del anterior',
  'admin.gestion.funnel.noPct': '—',
  'admin.gestion.funnel.refresh': 'Actualizar',
  'admin.gestion.funnel.local': 'En la versión de prueba cuenta sólo lo de este navegador.',
  'admin.gestion.funnel.real': 'Cuenta toda la web. Los días son los de Alicante.',
  'admin.gestion.funnel.step.landing_view': 'Ve la portada',
  'admin.gestion.funnel.step.explore_start': 'Entra en el mar',
  'admin.gestion.funnel.step.discount_found': 'Encuentra un descuento',
  'admin.gestion.funnel.step.tickets_panel_open': 'Abre «Entradas»',
  'admin.gestion.funnel.step.ticket_click_out': 'Va a la ticketera',
  // Plan 032 T303: textos que estaban sueltos en los componentes del Admin y el menú.
  'admin.mission.vaAOtra': '({n} va a otra isla que {name})',
  'admin.mission.vanAOtra': '({n} van a otra isla que {name})',
  'admin.mission.terminada': 'terminada',
  'admin.mission.terminadas': 'terminadas',
  'admin.moderation.reporte': 'reporte',
  'admin.moderation.reportes': 'reportes',
  'admin.moderation.sinRevisar': '({n} sin revisar)',
  'admin.moderation.resuelto': 'resuelto: {resolution}',
  'admin.moderation.pendiente': 'pendiente',
  'admin.texts.ambiente': 'ambiente',
  'admin.texts.efecto': 'efecto',
  'admin.draftPreview.nCambios': '{n} cambios',
  'admin.real.numeroSocio': ' · nº {n}',
  'menu.ajustes.proximamente': '(próximamente)',
} as const;
