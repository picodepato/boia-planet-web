/**
 * Textos del Admin con cuentas (plan 008, T94, decisión 11): la entrada con
 * el código del email y el TOTP, «sin acceso», y las cuatro secciones sobre
 * datos reales (Fiestas y QR, Socios y emails, Moderación de botellas y
 * Rankings). Todo `muestra` hasta que Álvaro lo apruebe.
 */
export const esAdminReal = {
  // Imagen del sello en la demo local (sección Eventos)
  'admin.events.selloUrl': 'Imagen del sello (URL, opcional)',
  'admin.events.selloUrlHint':
    'Va dentro del sello de goma del Carnet. Vacío: el sello generado. Con cuentas se sube en «Fiestas y QR».',

  // Entrada
  'admin.real.login.loading': 'Comprobando la sesión…',
  'admin.real.login.loadError': 'No se pudo comprobar la sesión. Vuelve a cargar la página.',
  'admin.real.login.title': 'Entrar al Admin',
  'admin.real.login.lead':
    'Te mandamos un código de 6 cifras al email. Después, el código de tu app de autenticación.',
  'admin.real.login.email': 'Email',
  'admin.real.login.send': 'Enviar código',
  'admin.real.login.sent':
    'Si {email} tiene cuenta, le llega un código de 6 cifras. Caduca en 10 minutos.',
  'admin.real.login.code': 'Código del email',
  'admin.real.login.enter': 'Entrar',
  'admin.real.login.otherEmail': 'Usar otro email',
  'admin.real.login.wrong': 'Ese código no es correcto.',
  'admin.real.login.expired': 'El código ha caducado. Pide otro.',
  'admin.real.login.tooMany': 'Demasiados intentos. Espera un poco y vuelve a probar.',
  'admin.real.login.invalidEmail': 'Escribe un email válido.',
  'admin.real.login.network': 'Sin conexión. Vuelve a probar.',
  'admin.real.login.unknown': 'No se pudo. Vuelve a probar.',
  'admin.real.totp.title': 'Segundo paso: tu app de autenticación',
  'admin.real.totp.enrollLead':
    'Es tu primera vez: escanea el QR con tu app de autenticación (Google Authenticator, 1Password, Authy…) y escribe el código de 6 cifras que te da.',
  'admin.real.totp.verifyLead': 'Escribe el código de 6 cifras de tu app de autenticación.',
  'admin.real.totp.qrAlt': 'QR para dar de alta BOIA.PLANET en tu app de autenticación',
  'admin.real.totp.secret': 'Si no puedes escanear, escribe esta clave en la app:',
  'admin.real.totp.code': 'Código de la app',
  'admin.real.totp.wrong': 'Ese código no es correcto o ya ha caducado. Prueba con el siguiente.',
  'admin.real.totp.setupError': 'No se pudo preparar el segundo paso. Vuelve a cargar la página.',
  'admin.real.signedInAs': 'Has entrado como {email}.',
  'admin.real.signedInRole': 'Has entrado como {email} ({role}).',
  'admin.real.signOut': 'Cerrar sesión',
  'admin.real.noAccess.title': 'Sin acceso',
  'admin.real.noAccess.lead':
    '{email} no tiene un rol en el equipo de BOIA. Si deberías tenerlo, pídeselo a quien gestiona el Admin.',

  // El Admin con cuentas
  'admin.real.bannerTitle': 'Admin con cuentas',
  'admin.real.banner':
    'Fiestas y QR, Socios y emails, Moderación (Carnets y botellas) y Rankings trabajan sobre los datos reales. El resto de secciones sigue siendo la demo de este navegador.',
  'admin.real.nav.fiestas': 'Fiestas y QR',
  'admin.real.nav.socios': 'Socios y emails',
  'admin.real.nav.moderacion': 'Moderación',
  'admin.real.nav.rankings': 'Rankings',
  'admin.real.editorOnly':
    'Esta sección trabaja con datos reales y pide el rol admin o propietario.',
  'admin.real.search': 'Buscar',
  'admin.real.empty': 'Nada por aquí.',
  'admin.real.reason': 'Motivo',
  'admin.real.error.forbidden': 'No tienes permiso (hace falta el rol admin con el segundo paso).',
  'admin.real.error.reasonRequired': 'Escribe un motivo (3 letras como mínimo).',
  'admin.real.error.unknownMember': 'Esa cuenta ya no existe o no tiene Carnet.',
  'admin.real.error.unknownEvent': 'Esa fiesta no existe.',
  'admin.real.error.invalidWindow': 'La ventana necesita inicio y fin, en ese orden.',
  'admin.real.error.invalidImage': 'La imagen tiene que ser una copia guardada aquí.',
  'admin.real.error.notFound': 'Ya no está: vuelve a cargar.',
  'admin.real.error.invalidEntry': 'Una compensación no se anula.',
  'admin.real.error.numberTaken': 'Ese número ya es de otro socio: elige uno libre.',
  'admin.real.error.invalidNumber': 'El número de socio es un entero de 1 en adelante.',
  'admin.real.error.coinsSpent':
    'Las monedas de esa entrada ya se gastaron: no se puede deshacer entera.',
  'admin.real.error.network': 'Sin conexión. Vuelve a probar.',
  'admin.real.error.bottleConflict': 'Su autor ya tiene otra botella en el mar: no puede volver.',
  'admin.real.error.nicknameTaken': 'Su apodo ya es de otra persona: no se puede devolver.',
  'admin.real.error.invalidStatus': 'Eso ya cambió: vuelve a cargar.',

  // Fiestas y QR
  'admin.real.fiestas.title': 'Fiestas y QR',
  'admin.real.fiestas.lead':
    'Cada fiesta tiene un QR fijo para su sello: vale sólo dentro de su ventana y da un sello por cuenta. Regenerar el código invalida el QR anterior.',
  'admin.real.fiestas.qrHeading': 'QR del sello',
  'admin.real.fiestas.from': 'Vale desde',
  'admin.real.fiestas.until': 'Vale hasta',
  'admin.real.fiestas.saveWindow': 'Guardar ventana',
  'admin.real.fiestas.createCode': 'Crear el QR',
  'admin.real.fiestas.regenerate': 'Regenerar código',
  'admin.real.fiestas.regenerateWarning':
    'El QR anterior deja de valer en cuanto lo regeneres: habrá que imprimir o proyectar el nuevo.',
  'admin.real.fiestas.regenerateConfirm': 'Sí, regenerar',
  'admin.real.fiestas.windowSaved': 'Ventana guardada.',
  'admin.real.fiestas.codeCreated': 'QR creado.',
  'admin.real.fiestas.regenerated': 'Código nuevo: el QR anterior ya no vale.',
  'admin.real.fiestas.window': 'Vale de {from} a {until} (hora de Madrid).',
  'admin.real.fiestas.noCode': 'Esta fiesta aún no tiene QR de sello.',
  'admin.real.fiestas.qrAria': 'QR del sello de {title}',
  'admin.real.fiestas.qrCaption': 'Escanéalo con la cámara y llévate el sello en tu Carnet BOIA',
  'admin.real.fiestas.project': 'Proyectar QR',
  'admin.real.fiestas.closeProjector': 'Cerrar',
  'admin.real.fiestas.png': 'Descargar PNG',
  'admin.real.fiestas.pngReady': 'PNG descargado.',
  'admin.real.fiestas.print': 'Imprimir o PDF',
  'admin.real.fiestas.imageHeading': 'Imagen del sello',
  'admin.real.fiestas.imageHint':
    'PNG, WebP o JPEG de 512 × 512 px o más y 2 MB como mucho. Funciona mejor un logo o un dibujo con mucho contraste sobre fondo claro: una foto sale como una mancha.',
  'admin.real.fiestas.upload': 'Subir archivo',
  'admin.real.fiestas.fromUrl': 'O traerla de una URL',
  'admin.real.fiestas.fetch': 'Traer imagen',
  'admin.real.fiestas.removeImage': 'Quitar imagen',
  'admin.real.fiestas.imageSaved': 'Imagen del sello guardada.',
  'admin.real.fiestas.imageRemoved': 'Imagen quitada: vuelve el sello generado.',
  'admin.real.fiestas.reasonUpload': 'imagen del sello subida',
  'admin.real.fiestas.reasonUrl': 'imagen del sello traída de una URL',
  'admin.real.fiestas.reasonRemove': 'imagen del sello quitada',
  'admin.real.fiestas.image.type': 'Sólo PNG, WebP o JPEG.',
  'admin.real.fiestas.image.size': 'La imagen pasa de 2 MB.',
  'admin.real.fiestas.image.small': 'La imagen tiene que medir al menos 512 × 512 px.',
  'admin.real.fiestas.image.url':
    'Esa URL no vale: tiene que ser https y de fuera de la red local.',
  'admin.real.fiestas.image.fetch': 'No se pudo traer la imagen de esa URL.',

  // Socios y emails
  'admin.real.socios.title': 'Socios y emails',
  'admin.real.socios.lead':
    'Las cuentas con su alta, su apodo y su consentimiento de noticias (fecha y versión). El email nunca es público.',
  'admin.real.socios.csv': 'Exportar CSV (con noticias)',
  'admin.real.socios.csvReady': 'CSV descargado: sólo quien aceptó recibir noticias.',
  'admin.real.socios.search': 'Email o apodo',
  'admin.real.socios.newsOnly': 'Sólo con noticias',
  'admin.real.socios.count': '{shown} de {total}',
  'admin.real.socios.noCarnet': '(sin Carnet)',
  'admin.real.socios.artistBadge': 'artista',
  'admin.real.socios.signedUp': 'alta {date}',
  'admin.real.socios.newsYes': 'noticias: sí desde {date} ({version})',
  'admin.real.socios.newsNo': 'noticias: no',
  'admin.real.socios.privacy': 'política {version} ({date})',
  'admin.real.socios.noPrivacy': 'sin política aceptada',
  'admin.real.socios.markArtist': 'Marcar como artista',
  'admin.real.socios.unmarkArtist': 'Quitar artista',
  'admin.real.socios.reasonArtist': 'marcado como artista en el Admin',
  'admin.real.socios.reasonUnartist': 'artista quitado en el Admin',
  'admin.real.socios.marked': 'Su Carnet ya es de artista.',
  'admin.real.socios.unmarked': 'Su Carnet vuelve a ser de miembro.',
  'admin.real.socios.delete': 'Borrar Carnet',
  'admin.real.socios.deleteWarning':
    'Vas a borrar la cuenta de «{who}» y todo lo suyo (Carnet, puntos, sellos, tiempos, botellas). No se puede deshacer; queda una línea en la auditoría con el motivo.',
  'admin.real.socios.deleted': 'Cuenta borrada.',
  // Número de socio (plan 016 T186)
  'admin.real.socios.number': 'Cambiar nº',
  'admin.real.socios.numberLabel': 'Nº de socio nuevo (libre)',
  'admin.real.socios.numberSave': 'Guardar número',
  'admin.real.socios.numberReason': 'número cambiado en el Admin',
  'admin.real.socios.numberSaved': 'Número cambiado; queda en la auditoría.',
  // Enlace de artistas (T186)
  'admin.real.artistLink.title': 'Enlace de artistas',
  'admin.real.artistLink.lead':
    'Un único enlace: quien crea su Carnet con él es artista. Al cambiarlo, el anterior deja de valer.',
  'admin.real.artistLink.none': 'Todavía no hay enlace.',
  'admin.real.artistLink.since': 'Enlace vigente desde {date}.',
  'admin.real.artistLink.create': 'Crear enlace',
  'admin.real.artistLink.rotate': 'Cambiar enlace',
  'admin.real.artistLink.confirm': 'Sí, cambiarlo (el anterior deja de valer)',
  'admin.real.artistLink.reason': 'enlace de artistas cambiado en el Admin',
  'admin.real.artistLink.created': 'Enlace nuevo listo.',
  'admin.real.artistLink.copyNow':
    'Cópialo ahora: sólo se guarda cifrado y no se vuelve a ver. Si se pierde, crea otro.',
  'admin.real.artistLink.copy': 'Copiar',
  'admin.real.artistLink.copied': 'Copiado.',

  // Moderación de botellas
  'admin.real.botellas.title': 'Botellas reportadas',
  'admin.real.botellas.lead':
    'Las botellas del mar con reportes sin revisar. Retirarla la quita del mar para todos; descartar un reporte la deja.',
  'admin.real.botellas.empty': 'No hay botellas reportadas sin revisar.',
  'admin.real.botellas.reports': '{n} reporte(s) sin revisar',
  'admin.real.botellas.updated': 'Hecho. Queda en la auditoría.',
  'admin.real.botellas.removedTitle': 'Retiradas por moderación',
  'admin.real.botellas.removedEmpty': 'Ninguna botella retirada.',

  // Rankings
  'admin.real.rankings.title': 'Rankings',
  'admin.real.rankings.lead':
    'Anular una entrada (un tiempo, una partida del Cañón o del Castillo) la saca de su ranking hasta que su dueño la mejore; se puede devolver. Anular unos puntos los compensa en el libro. Todo con motivo y en la auditoría.',
  'admin.real.rankings.times': 'Tiempos por circuito',
  'admin.real.rankings.circuit': 'Circuito',
  'admin.real.rankings.points': 'Puntos de siempre',
  'admin.real.rankings.pointsUnit': 'puntos',
  'admin.real.rankings.count': '{shown} de {total}',
  'admin.real.rankings.void': 'Anular',
  'admin.real.rankings.voidConfirm': 'Anular con este motivo',
  'admin.real.rankings.voided': 'Anulado. Queda en la auditoría.',
  'admin.real.rankings.voidedBadge': 'anulada',
  'admin.real.rankings.showEntries': 'Ver entradas',
  'admin.real.rankings.hideEntries': 'Ocultar entradas',
  'admin.real.rankings.delta': '{points} puntos, {coins} monedas',
  'admin.real.rankings.games': 'Cañón y Castillo',
  'admin.real.rankings.board': 'Tabla',
  'admin.real.rankings.canon': 'Cañón · {board}',
  'admin.real.rankings.castle': 'Castillo · {board}',
  'admin.real.rankings.race': 'Carrera · {circuit} v{version}',
  'admin.real.rankings.score': '{value} puntos',
  'admin.real.rankings.voidedTitle': 'Anuladas',
  'admin.real.rankings.voidedEmpty': 'No hay entradas anuladas.',
  'admin.real.rankings.restore': 'Devolver',
  'admin.real.rankings.restored': 'Devuelta a su ranking. Queda en la auditoría.',
} as const;
