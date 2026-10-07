/**
 * Textos de la entrada al Admin con el Carnet 000, los códigos de respaldo
 * del TOTP y «Descargar mis datos» (plan 017 T193, decisiones 6 y 9). Todo
 * `muestra` hasta que Álvaro lo apruebe.
 */
export const esAcceso = {
  // Admin de la demo (modo local): Carnet 000 + contraseña
  'admin.demoLogin.title': 'Entrar al Admin',
  'admin.demoLogin.lead':
    'Entra con el Carnet del Admin (el número 000) y su contraseña. Es la versión de prueba: los cambios se quedan en este navegador.',
  'admin.demoLogin.carnet': 'Número de Carnet',
  'admin.demoLogin.password': 'Contraseña',
  'admin.demoLogin.enter': 'Entrar',
  'admin.demoLogin.checking': 'Comprobando…',
  'admin.demoLogin.wrong': 'El número de Carnet o la contraseña no son correctos.',
  'admin.demoLogin.signOut': 'Salir del Admin',

  // Admin con cuentas: Carnet 000 + contraseña + TOTP
  'admin.real.carnet.title': 'Entrar al Admin',
  'admin.real.carnet.lead':
    'Entra con el Carnet del Admin (el número 000) y la contraseña de su cuenta. Después te pediremos el código de tu app de autenticación.',
  'admin.real.carnet.number': 'Número de Carnet',
  'admin.real.carnet.password': 'Contraseña',
  'admin.real.carnet.enter': 'Entrar',
  'admin.real.carnet.wrong': 'El número de Carnet o la contraseña no son correctos.',
  'admin.real.carnet.useEmail': 'Soy del equipo: entrar con el código del email',
  'admin.real.carnet.useCarnet': 'Entrar con el Carnet 000',

  // Códigos de respaldo
  'admin.real.backup.useLink': '¿Sin el móvil? Usa un código de respaldo',
  'admin.real.backup.useTitle': 'Código de respaldo',
  'admin.real.backup.useLead':
    'Escribe uno de tus códigos de respaldo. Cada código vale una sola vez: después darás de alta tu app de autenticación otra vez.',
  'admin.real.backup.code': 'Código de respaldo',
  'admin.real.backup.use': 'Usar el código',
  'admin.real.backup.wrong': 'Ese código no vale o ya se usó.',
  'admin.real.backup.used':
    'Código aceptado. Te quedan {left}. Ahora da de alta tu app de autenticación con el QR.',
  'admin.real.backup.back': 'Volver al código de la app',
  'admin.real.nav.seguridad': 'Seguridad',
  'admin.real.backup.title': 'Códigos de respaldo',
  'admin.real.backup.lead':
    'Si pierdes el móvil con la app de autenticación, entras con la contraseña y uno de estos códigos. Cada uno vale una vez.',
  'admin.real.backup.left': 'Te quedan {left} códigos sin usar.',
  'admin.real.backup.none': 'Todavía no tienes códigos de respaldo.',
  'admin.real.backup.generate': 'Generar códigos nuevos',
  'admin.real.backup.regenerateWarn': 'Los códigos anteriores dejarán de valer.',
  'admin.real.backup.showOnce':
    'Guárdalos ahora en un sitio seguro: no se vuelven a enseñar. Sólo se guarda su huella.',
  'admin.real.backup.download': 'Descargar (.txt)',
  'admin.real.backup.fileHeading': 'BOIA.PLANET · códigos de respaldo del Admin (un solo uso)',
  'admin.real.backup.error': 'No se pudo. Vuelve a probar.',

  // «Descargar mis datos» (REQ-IDE-050)
  'account.export.button': 'Descargar mis datos',
  'account.export.lead':
    'Un archivo JSON con todo lo de tu Carnet y tu progreso: sólo lo tuyo, sin contraseñas ni códigos.',
  'account.export.busy': 'Preparando…',
  'account.export.done': 'Descargado.',
  'account.export.error': 'No se ha podido preparar la descarga. Vuelve a intentarlo.',
} as const;
