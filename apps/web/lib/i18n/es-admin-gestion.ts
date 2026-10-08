/**
 * Textos del Admin para el acceso completo, la papelera de cambios y la
 * analítica de visitas (plan 019 T223, decisión 17). Todo `muestra` hasta que
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
    'Con cuentas, esta papelera guarda lo que se cambia en el contenido de este Admin. Lo de las secciones con datos reales (Carnets, botellas, Las Calitas, rankings) se devuelve desde su propia sección y queda en la auditoría de la base de datos.',

  // Analítica de visitas
  'admin.gestion.analytics.title': 'Analítica de visitas',
  'admin.gestion.analytics.lead':
    'El embudo de visitas, anónimo, en PostHog (UE): sin cookies y sin nada guardado en el navegador. Apagada, la web no manda ningún evento.',
  'admin.gestion.analytics.toggle': 'Analítica de visitas encendida',
  'admin.gestion.analytics.on': 'Encendida.',
  'admin.gestion.analytics.off': 'Apagada: no sale ningún evento.',
  'admin.gestion.analytics.noKey':
    'Falta la clave de PostHog (NEXT_PUBLIC_POSTHOG_KEY): aunque esté encendida, no sale nada hasta que Hernán la ponga.',
  'admin.gestion.analytics.local': 'En la versión de prueba vale sólo para este navegador.',
  'admin.gestion.analytics.real': 'Vale para toda la web.',
  'admin.gestion.analytics.reason': 'analítica de visitas',
} as const;
