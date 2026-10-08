/**
 * Textos de lib/landing y lib/ticketing (T49), por clave `<carpeta>.<archivo>.<texto>`:
 * la parte de la web pública del catálogo (es-web.ts). Todo `muestra` hasta
 * que Álvaro lo apruebe.
 */
export const esLibWeb = {
  // Plan 019 T215 (decisiones 1 y 6): «Solo en puerta», con el Carnet como requisito. Muestra.
  'ticketing.boxOffice.label': 'Solo en puerta · {euros} € con carnet',
  'ticketing.boxOffice.labelNoPrice': 'Solo en puerta · con carnet',
  'ticketing.boxOffice.message':
    'No hay venta online: la entrada se paga en la puerta y para entrar hace falta el Carnet BOIA.',
  'ticketing.boxOffice.invite': '¿Aún no tienes Carnet?',
  'ticketing.boxOffice.carnet': 'Hazte el tuyo',
  'ticketing.boxOffice.buyAria': 'Comprar entradas para {name}',
  'landing.signOut': 'Cerrar sesión',
  'landing.signOut.failed': 'No se pudo cerrar sesión. Inténtalo de nuevo.',
  'media.video.load': 'Cargar vídeo: {nombre}',
  'landing.access.sonido': 'Sonido',
  'landing.access.entrarEnElWhatsapp': 'Entrar en el WhatsApp',
  'landing.access.entrarEnElWhatsapp2': 'Entrar en el WhatsApp de BOIA (se abre en otra pestaña)',
  'landing.access.verSuIslaEn': 'Ver su isla en el mar',
  'landing.access.irEnBarcoAl': 'Ir en barco a la Isla de Benidorm, la de las fotos',
  'landing.access.irEnBarcoA': 'Ir en barco a Botiga Ibiza, la isla tienda',
  'landing.cardCopy.borrador': 'Borrador',
  'landing.cardCopy.finalizado': 'Finalizado',
  'landing.cardCopy.verTodasLasFotos': 'Ver todas las fotos en la Galería',
  'landing.invitations.invitacionACrearTu': 'Invitación a crear tu Carnet',
  'ticketing.copy.comprarEntradasParaCompra': 'Comprar entradas para {name} (compra de prueba)',
  'ticketing.copy.versionDePruebaNo':
    'Versión de prueba: no se cobra nada ni se emite una entrada real. Al confirmar, el sello del evento se añade a tu Carnet, guardado sólo en este navegador.',
  'ticketing.copy.preparandoLaCompraDe': 'Preparando la compra de prueba…',
  'ticketing.copy.noEncontramosEsteEvento': 'No encontramos este evento.',
  'ticketing.copy.esteEventoYaNo': 'Este evento ya no está a la venta.',
  'ticketing.copy.noSePudoCompletar':
    'No se pudo completar la compra de prueba. Inténtalo de nuevo.',
  'ticketing.copy.noSePudoAbrir': 'No se pudo abrir la compra de prueba.',
  'ticketing.copy.estaCompraYaEstaba':
    'Esta compra ya estaba confirmada: su sello ya está en tu Carnet.',
  'ticketing.copy.yaTeniasElSello': 'Ya tenías el sello de este evento: cada evento deja uno.',
  'ticketing.copy.logroConseguido': 'Logro conseguido: {title}',
  'ticketing.copy.ahorras': 'Ahorras {euros}',
  'ticketing.copy.seAplicaSoloAl': 'Se aplica solo al comprar.',
  // Plan 019 T215 (decisión 1): el Carnet es el requisito para comprar. Muestra.
  'ticketing.carnet.requiredTitle': 'Para comprar entradas necesitas el Carnet BOIA',
  'ticketing.carnet.requiredBody':
    'Créalo en 30 s, sin email: tu Carnet se guarda en este navegador. Luego sigues con la compra.',
  'ticketing.carnet.create': 'Crear Carnet',
  'ticketing.carnet.nickname': 'Tu apodo',
  'ticketing.carnet.nicknameHint':
    'De {min} a {max} caracteres. Es lo que verán los demás en tu Carnet y en el ranking.',
  'ticketing.carnet.createAndBack': 'Crear Carnet y volver a la compra',
  'ticketing.carnet.creating': 'Creando tu Carnet…',
  'ticketing.carnet.back': 'Volver',
  'ticketing.carnet.nicknameTaken': 'Ese apodo ya lo tiene otra persona: prueba con otro.',
  'ticketing.carnet.failed': 'No se pudo crear el Carnet. Inténtalo de nuevo.',
} as const;
