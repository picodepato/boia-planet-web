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
} as const;
