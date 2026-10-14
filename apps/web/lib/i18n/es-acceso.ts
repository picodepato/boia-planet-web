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

  // Admin con cuentas: email de la cuenta del Carnet 000 + contraseña + TOTP
  // (desde T278 se escribe el email: la base ya no lo da por «000»)
  'admin.real.carnet.title': 'Entrar al Admin',
  'admin.real.carnet.lead':
    'Entra con el email y la contraseña de la cuenta del Admin (la del Carnet 000). Después te pediremos el código de tu app de autenticación.',
  'admin.real.carnet.email': 'Email de la cuenta del Admin',
  'admin.real.carnet.password': 'Contraseña',
  'admin.real.carnet.enter': 'Entrar',
  'admin.real.carnet.wrong': 'El email o la contraseña no son correctos.',
  'admin.real.carnet.useEmail': 'Soy del equipo: entrar con el código del email',
  'admin.real.carnet.useCarnet': 'Entrar con email y contraseña',

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

  // Cambiar la contraseña del Admin y recuperarla (plan 029 T283)
  'admin.real.password.title': 'Cambiar contraseña',
  'admin.real.password.lead':
    'La contraseña de la cuenta del Admin. Sólo se puede cambiar con la sesión completa (contraseña y código de la app). Mínimo {min} caracteres.',
  'admin.real.password.new': 'Contraseña nueva',
  'admin.real.password.again': 'Repite la contraseña nueva',
  'admin.real.password.save': 'Cambiar contraseña',
  'admin.real.password.saving': 'Cambiando…',
  'admin.real.password.done':
    'Contraseña cambiada. Úsala la próxima vez que entres; las otras sesiones abiertas se han cerrado.',
  'admin.real.password.empty': 'Escribe la contraseña nueva.',
  'admin.real.password.short': 'Tiene que tener al menos {min} caracteres.',
  'admin.real.password.mismatch': 'Las dos contraseñas no coinciden.',
  'admin.real.password.weak': 'Esa contraseña es demasiado fácil. Prueba con otra más larga.',
  'admin.real.password.same': 'Es la misma que ya tienes. Elige otra.',
  'admin.real.password.needsAal2': 'Entra otra vez con el código de la app para cambiarla.',
  'admin.real.password.error': 'No se pudo cambiar. Vuelve a probar.',
  'admin.real.forgot.link': 'He olvidado la contraseña',
  'admin.real.forgot.title': 'Recuperar la contraseña',
  'admin.real.forgot.lead':
    'Escribe el email de la cuenta del Admin y te mandamos un enlace para elegir una contraseña nueva.',
  'admin.real.forgot.send': 'Enviar el enlace',
  'admin.real.forgot.sent':
    'Si esa cuenta existe, te hemos mandado un enlace a {email}. Ábrelo en este mismo navegador. Si en unos minutos no ha llegado, mira en spam o vuelve a pedirlo más tarde.',
  'admin.real.forgot.back': 'Volver a entrar',
  'admin.real.recover.title': 'Elige tu contraseña nueva',
  'admin.real.recover.checking': 'Comprobando el enlace…',
  'admin.real.recover.invalid':
    'El enlace no vale, caducó o ya se usó. Pide otro desde «He olvidado la contraseña».',
  'admin.real.recover.totpLead':
    'Para cambiar la contraseña, escribe primero el código de tu app de autenticación.',
  'admin.real.recover.totpCode': 'Código de la app',
  'admin.real.recover.totpNext': 'Continuar',
  'admin.real.recover.done': 'Contraseña cambiada. Ya puedes entrar al Admin con ella.',
  'admin.real.recover.enter': 'Ir al Admin',
  'admin.real.recover.noAccounts': 'Esta página sólo existe cuando la web tiene cuentas.',

  // «Descargar mis datos» (REQ-IDE-050)
  'account.export.button': 'Descargar mis datos',
  'account.export.lead':
    'Un archivo JSON con todo lo de tu Carnet y tu progreso: sólo lo tuyo, sin contraseñas ni códigos.',
  'account.export.busy': 'Preparando…',
  'account.export.done': 'Descargado.',
  'account.export.error': 'No se ha podido preparar la descarga. Vuelve a intentarlo.',
} as const;
