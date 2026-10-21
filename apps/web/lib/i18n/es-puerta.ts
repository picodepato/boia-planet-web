/**
 * La puerta de la fiesta (plan 019 T218, decisión 11): el QR de alta, el
 * lector de la puerta (/admin/puerta) y «Sellar a mano» en el Admin. Todo
 * `muestra` hasta que Álvaro lo apruebe.
 */
export const esPuerta = {
  // El lector de la puerta (/admin/puerta)
  'puerta.metaTitle': 'Puerta · BOIA Admin',
  'puerta.title': 'Puerta',
  'puerta.back': 'Volver al Admin',
  'puerta.localNote':
    'Versión de prueba: el lector sella los Carnets de este navegador. Con cuentas, los de todos los socios.',
  'puerta.party': 'Fiesta',
  'puerta.count': 'Han entrado {n} a {party}.',
  'puerta.openCamera': 'Abrir el lector',
  'puerta.closeCamera': 'Cerrar el lector',
  'puerta.camera.denied':
    'La cámara está bloqueada. Actívala en los ajustes del navegador para esta web, o pega el enlace del Carnet aquí abajo.',
  'puerta.camera.none':
    'No encontramos una cámara. Pega el enlace del Carnet aquí abajo o lee una foto de su QR.',
  'puerta.stamping': 'Sellando…',
  'puerta.result.granted': 'Sellado: {nickname} ha entrado a {party}.',
  'puerta.result.already': '{nickname} ya tenía el sello de {party}.',
  'puerta.result.notCarnet': 'Ese QR no es el de un Carnet BOIA.',
  'puerta.result.unknown': 'Ese Carnet no existe o ya no está.',
  'puerta.result.error': 'No se pudo sellar: {message}',
  'puerta.typed': 'O pega el enlace del Carnet',
  'puerta.typedStamp': 'Sellar',
  'puerta.photo': 'O lee una foto del QR',

  // El QR de alta
  'puerta.signup.title': 'QR para crear el Carnet',
  'puerta.signup.caption': 'Escanéalo con la cámara y crea tu Carnet BOIA',
  'puerta.signup.aria': 'QR que abre «Crear carnet» en BOIA.PLANET',
  'puerta.signup.hint':
    'Abre «Crear carnet» directamente. Imprímelo o proyéctalo en la puerta para quien llega sin Carnet.',
  'puerta.signup.doorHint': '¿Llega alguien sin Carnet? Enséñale este QR.',
  'puerta.signup.show': 'Enseñar el QR de alta',

  // «Puerta y sellos» en el Admin
  'puerta.section.nav': 'Puerta y sellos',
  'puerta.section.title': 'Puerta y sellos',
  'puerta.section.lead':
    'Cada Carnet lleva su QR. En la puerta de cada fiesta, el lector lo escanea, apunta que ha venido y le pone el sello de la fiesta. El QR de la fiesta para que cada cual se selle sigue valiendo.',
  'puerta.section.scannerTitle': 'Lector de la puerta',
  'puerta.section.scannerHint':
    'Ábrelo en el móvil de quien está en la puerta: se elige la fiesta y se escanean los Carnets uno tras otro.',
  'puerta.section.openScanner': 'Abrir el lector de la puerta',
  'puerta.manual.title': 'Sellar a mano',
  'puerta.manual.hint':
    'Para quien vino y no pudo enseñar su Carnet. Un sello por fiesta; queda en la auditoría con el motivo.',
  'puerta.manual.search': 'Buscar Carnet (apodo)',
  'puerta.manual.member': 'Carnet',
  'puerta.manual.memberNumber': '{nickname} · nº {n}',
  'puerta.manual.reasonHint': 'Vino sin móvil',
  'puerta.manual.none': 'Ningún Carnet con ese apodo.',
  'puerta.manual.stamp': 'Poner el sello',
  'puerta.manual.done': 'Sello puesto.',

  // El enlace de la puerta (plan 034 T307): en el Admin…
  'puerta.links.title': 'Enlace de la puerta',
  'puerta.links.hint':
    'Un enlace secreto por fiesta: quien lo abra escanea Carnets en la puerta sin entrar al Admin. No caduca; deja de valer si lo revocas o si la fiesta se archiva o se cancela. Pásalo sólo a quien esté en la puerta.',
  'puerta.links.create': 'Crear enlace',
  'puerta.links.recreate': 'Crear otro (revoca el de ahora)',
  'puerta.links.created': 'Enlace creado. Cópialo ahora: luego no se puede volver a ver.',
  'puerta.links.copyNow': 'Cópialo ahora (luego no se vuelve a ver)',
  'puerta.links.copy': 'Copiar enlace',
  'puerta.links.copied': 'Copiado.',
  'puerta.links.live': '{party}: enlace activo desde {date}',
  'puerta.links.revoke': 'Revocar',
  'puerta.links.revoked': 'Enlace revocado: ya no abre el lector.',
  'puerta.links.none': 'Ninguna fiesta tiene enlace de la puerta ahora mismo.',
  // …y la página del enlace (/puerta/<código>)
  'puerta.link.metaTitle': 'Puerta · BOIA',
  'puerta.link.title': 'Puerta BOIA',
  'puerta.link.checking': 'Comprobando el enlace…',
  'puerta.link.invalid':
    'Este enlace de la puerta ya no vale: lo han revocado o la fiesta ya no está abierta. Pide uno nuevo al equipo.',
  'puerta.link.gone': 'Este enlace de la puerta ya no vale.',
  'puerta.link.offline': 'No hay conexión con BOIA. Revisa la red y vuelve a abrir el enlace.',
  'puerta.link.localNote':
    'Versión de prueba: este enlace sólo vale en este navegador y sella sus Carnets.',
  'puerta.link.hint':
    'Abre el lector y enseña cada Carnet a la cámara: sella una vez por fiesta y te dice quién ha entrado.',
  'puerta.link.camera.denied':
    'La cámara está bloqueada. Actívala en los ajustes del navegador para esta web, o lee una foto del QR aquí abajo.',
  'puerta.link.camera.none':
    'No encontramos una cámara. Lee una foto del QR del Carnet aquí abajo.',
  // La lista de la fiesta tras leer un Carnet (plan 034 T310), en los dos lectores.
  'puerta.list.on': 'En lista como {name}',
  'puerta.list.off': 'No está en la lista',
  'puerta.list.late': '{text} · pasada la hora de lista ({time})',
} as const;
