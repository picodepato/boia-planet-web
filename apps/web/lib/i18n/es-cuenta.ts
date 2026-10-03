/**
 * Textos de la cuenta con email (plan 008, T89): la hoja de acceso (email,
 * código de 6 cifras, cuenta nueva con apodo y consentimientos), «Tu cuenta»
 * en Mi Carnet y el hueco del Carnet del invitado. Claves y textos de
 * docs/propuestas/2026-10-03-carnet.md («i18n keys», aprobado por Hernán);
 * las que no estaban allí van marcadas «T89». Todo `muestra` hasta que
 * Álvaro lo apruebe; la política de privacidad, hasta P21.
 */
export const esCuenta = {
  // El Carnet del invitado (con Supabase)
  'carnet.guest.slotTitle': 'Tu Carnet BOIA',
  'carnet.guest.slotBody': 'Apodo, nº de miembro, rango, puntos y los sellos de tus fiestas.',
  'carnet.guest.body':
    'Tu Carnet es tu identidad en el mar: lo que contestas, tu barco y los sellos de las fiestas a las que vas.',
  'carnet.guest.emailNote':
    'Te pediremos un email para guardarlo. Navegar y jugar no lo necesitan.',

  // Hoja de acceso
  'auth.back': 'Volver',
  'auth.close': 'Cerrar', // T89
  'auth.sheet.aria': 'Entrar con tu email', // T89
  'auth.steps': 'Paso {n} de {total}', // T89
  'auth.title.carnet': 'Guarda tu Carnet',
  'auth.title.skin': 'Guarda tu compra',
  'auth.title.stamp': 'Guarda tu sello',
  'auth.title.ranking': 'Entra en el ranking',
  'auth.why.carnet':
    'Tu Carnet se guarda en tu cuenta: no se pierde si cambias de móvil o borras el navegador.',
  'auth.why.skin': 'Lo que compras se guarda en tu cuenta: lo tendrás en cualquier dispositivo.',
  'auth.why.stamp':
    'El sello de {event} va a tu Carnet. Para guardarlo necesitamos saber que eres tú.',
  'auth.why.stampAny':
    'El sello de la fiesta va a tu Carnet. Para guardarlo necesitamos saber que eres tú.', // T89
  'auth.why.ranking': 'Para entrar en el ranking, tus tiempos y puntos tienen que ir a tu nombre.',
  'auth.email.label': 'Tu email',
  'auth.email.placeholder': 'nombre@correo.com',
  'auth.email.help': 'Te mandamos un código de 6 cifras. Sin contraseñas.',
  'auth.email.send': 'Enviarme el código',
  'auth.email.sending': 'Enviando…', // T89
  'auth.email.private': 'Tu email nunca es público: en BOIA te ven por tu apodo.',
  'auth.email.invalid': 'Revisa el email: le falta algo después de la arroba (por ejemplo, .com).',
  'auth.email.sendError': 'No hemos podido enviar el código. Prueba otra vez en un momento.', // T89
  'auth.notNow': 'Ahora no',
  'auth.code.sentTo': 'Te hemos enviado un código a {email}.',
  'auth.code.change': 'Cambiar',
  'auth.code.label': 'Código de 6 cifras',
  'auth.code.help': 'Al escribir la sexta cifra se comprueba solo. Mira también en spam.',
  'auth.code.checking': 'Comprobando el código…', // T89
  'auth.code.resendIn': 'Reenviar el código en {time}',
  'auth.code.resend': 'Reenviar el código',
  'auth.code.resendReady': 'Ya puedes reenviar el código',
  'auth.code.resent': 'Te hemos enviado otro código.', // T89
  'auth.code.wrong': 'Ese código no es correcto. Revisa el último correo de BOIA.',
  'auth.code.expired': 'Ese código ha caducado. Te enviamos uno nuevo.',
  'auth.code.tooMany': 'Demasiados intentos. Espera unos minutos y pide otro código.',
  'auth.error.network': 'No hay conexión. Revisa la red y vuelve a intentarlo.', // T89
  'auth.error.unknown': 'Algo ha fallado. Vuelve a intentarlo en un momento.', // T89
  'auth.new.title': 'Crea tu Carnet',
  'auth.new.lead': 'Último paso: así te verán en BOIA.',
  'auth.new.nickname': 'Apodo',
  'auth.new.nicknameHelp': 'De 2 a 30 caracteres. Es público; tu email no.',
  'auth.new.nicknameFree': 'Libre',
  'auth.new.nicknameTaken': 'Ese apodo ya lo tiene otra persona. Prueba con otro.',
  'auth.new.nicknameBlocked': 'Ese apodo no se puede usar. Prueba con otro.',
  'auth.new.nicknameChecking': 'Comprobando…', // T89
  'auth.new.privacy': 'He leído y acepto la {link} (muestra).',
  'auth.new.privacyLink': 'política de privacidad',
  'auth.new.news':
    'Quiero recibir noticias de BOIA por email: fiestas y entradas. Puedo darme de baja cuando quiera.',
  'auth.new.create': 'Crear mi cuenta',
  'auth.new.creating': 'Creando tu cuenta…', // T89
  'auth.new.missingPrivacy': 'Falta aceptar la política de privacidad.',
  'auth.new.missingNickname': 'Elige un apodo libre.',
  'auth.welcome': 'Ya eres miembro de BOIA, nº {number}.',
  'auth.merged': 'Hemos pasado a tu cuenta lo que tenías en este navegador: {items}.',
  'auth.merged.points': '{n} puntos', // T89
  'auth.merged.onePoint': '1 punto', // T89
  'auth.merged.achievements': '{n} logros', // T89
  'auth.merged.oneAchievement': '1 logro', // T89
  'auth.merged.ship': 'tu barco', // T89
  'auth.merged.times': 'tus récords del circuito', // T89
  'auth.merged.and': 'y', // T89
  'auth.continue': 'Seguir',
  'auth.signedIn': 'Has entrado como {nickname}',

  // Tu cuenta (al final de Mi Carnet)
  'account.heading': 'Tu cuenta',
  'account.email': 'Email (solo lo ves tú)',
  'account.news': 'Recibir noticias de BOIA por email',
  'account.saved': 'Guardado',
  'account.saveError': 'No se ha podido guardar. Vuelve a intentarlo.', // T89
  'account.privacyAccepted': 'Aceptaste la política de privacidad (versión {version}) el {date}.',
  'account.signOut': 'Cerrar sesión',
  'account.signedOut': 'Has cerrado sesión. Tu Carnet sigue guardado en tu cuenta.',
  'account.signIn': 'Entrar',
  'account.signInToSee': 'Entra con tu email para verlo.',
  'account.delete': 'Borrar mi cuenta',
  'account.delete.title': '¿Borrar tu cuenta?',
  'account.delete.body':
    'Se borran para siempre tu Carnet, tus sellos, tus puntos y monedas, tus tiempos del ranking, tus compras del barco y tu botella. Tu email sale de la lista de BOIA.',
  'account.delete.keep': 'No se puede deshacer. Las entradas que compraste siguen valiendo.',
  'account.delete.confirmLabel': 'Escribe tu apodo para confirmar',
  'account.delete.cancel': 'Cancelar',
  'account.delete.error': 'No se ha podido borrar la cuenta. Vuelve a intentarlo.', // T89
  'account.deleted': 'Tu cuenta se ha borrado.',

  // /legal/privacidad con cuentas (T89): qué se recoge y para qué. Sin
  // Supabase la página sigue con los textos de la versión de prueba (es-zonas).
  'legal.privacy.account.intro':
    'Navegar, jugar y leer en BOIA.PLANET no piden nada. Te pedimos un email sólo cuando guardas algo: tu Carnet, una compra del barco, el sello de una fiesta o tu puesto en el ranking. Desde ese momento lo que guardas va a tu cuenta, en nuestro servidor, para que no se pierda.',
  'legal.privacy.account.what':
    'Qué se guarda: tu email, para entrar con un código de 6 cifras (sin contraseñas); tu Carnet (apodo, número de miembro, foto o avatar y respuestas); tus puntos, monedas, logros, sellos, tiempos del circuito, descuentos y compras del barco; tu botella; cuándo y en qué versión aceptaste esta política, y si quieres recibir noticias. Al entrar, lo que tenías en este navegador pasa a tu cuenta.',
  'legal.privacy.account.public':
    'Qué es público: tu apodo, tu Carnet, tus puestos en el ranking y tu botella. Tu email nunca: en BOIA te ven por tu apodo.',
  'legal.privacy.account.notAsked':
    'Qué no te pedimos: ni contraseña, ni teléfono, ni datos de pago.',
  'legal.privacy.account.where':
    'Dónde: en la base de datos de BOIA.PLANET, en los servidores de nuestro proveedor (Supabase), que la guarda por encargo nuestro. En tu navegador quedan tu sesión y una copia de tu progreso.',
  'legal.privacy.account.why':
    'Para qué: para que tu Carnet y tu progreso estén en cualquier dispositivo, para los rankings y los sellos de las fiestas y, sólo si marcas la casilla, para mandarte noticias de BOIA por email (fiestas y entradas).',
  'legal.privacy.account.basis':
    'Base legal: tu consentimiento al crear la cuenta (esta política, obligatoria; las noticias, aparte, opcionales y sin marcar) y lo necesario para darte el servicio que pides.',
  'legal.privacy.account.sharing':
    'No vendemos ni cedemos tus datos. Si pulsas un enlace a Instagram, WhatsApp, la tienda o la ticketera, esos servicios tienen su propia política.',
  'legal.privacy.account.retention':
    'Cuánto tiempo: mientras tengas la cuenta. Puedes borrarla cuando quieras en Mi Carnet («Borrar mi cuenta») y se borra todo; las noticias se quitan con un toque en el mismo sitio.',
  'legal.privacy.account.rights':
    'Tus derechos: acceso, rectificación, supresión, oposición, limitación y portabilidad. En Mi Carnet puedes editar tu Carnet, dejar de recibir noticias y borrar tu cuenta; para lo demás, escribe a privacidad@boia.example. También puedes reclamar ante la Agencia Española de Protección de Datos.',
  'legal.privacy.account.updated': 'Última actualización: 3 de octubre de 2026.',
} as const;
