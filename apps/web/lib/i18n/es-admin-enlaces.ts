/**
 * Textos de la sección «Enlaces» del Admin (plan 017 T192): el contacto de
 * «Comprar» de la tienda, el correo y los enlaces de Contacto y los enlaces
 * oficiales del pie. Todo `muestra` hasta que Álvaro lo apruebe.
 */
export const esAdminEnlaces = {
  'admin.links.nav': 'Enlaces',
  'admin.links.title': 'Enlaces de la tienda, el contacto y el pie',
  'admin.links.lead':
    'Cambia las etiquetas y las direcciones sin código. Va al borrador: se ve en la vista previa y, en la web, al «Publicar».',
  'admin.links.store': 'Tienda: contacto de «Comprar»',
  'admin.links.store.hint':
    'Sale en el mensaje de «Comprar» de cada producto. Deja los dos vacíos para volver al de serie ({handle}).',
  'admin.links.store.handle': 'Usuario de Instagram',
  'admin.links.store.url': 'Enlace',
  'admin.links.store.default': 'De serie',
  'admin.links.contact': 'Contacto',
  'admin.links.contact.email': 'Correo',
  'admin.links.contact.email.hint': 'Vacío: sin correo.',
  'admin.links.footer': 'Pie de página: enlaces oficiales',
  'admin.links.footer.hint':
    'Un enlace con «Spotify» en la etiqueta sale como «Escúchalo en Spotify»; uno con «WhatsApp», en la invitación del pie.',
  'admin.links.label': 'Etiqueta',
  'admin.links.url': 'Dirección (https://…)',
  'admin.links.add': 'Añadir enlace',
  'admin.links.remove': 'Quitar {label}',
  'admin.links.row': 'Enlace {n}',
  'admin.links.save': 'Guardar en el borrador',
  'admin.links.saved': 'Guardado en el borrador.',
  'admin.links.audit.store': 'enlace de la tienda',
  'admin.links.audit.contact': 'enlaces de contacto',
  'admin.links.audit.footer': 'enlaces del pie',
  'admin.links.error.label': 'El enlace {n} necesita una etiqueta.',
  'admin.links.error.labelLong': 'La etiqueta del enlace {n} admite hasta {max} caracteres.',
  'admin.links.error.url':
    'La dirección de «{label}» (enlace {n}) no es una página web: empieza por https://.',
  'admin.links.error.repeated': 'La dirección de «{label}» está repetida.',
  'admin.links.error.tooMany': 'Como mucho {max} enlaces.',
  'admin.links.error.handle':
    'El usuario de Instagram sólo lleva letras, números, puntos y guiones bajos (hasta 30).',
  'admin.links.error.storeUrl':
    'El enlace de la tienda no es una página web: empieza por https://.',
  'admin.links.error.email': 'El correo no es válido.',
  'admin.links.error.noBlock': 'La página principal no tiene bloque «{type}».',
} as const;
