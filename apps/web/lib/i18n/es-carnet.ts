/**
 * Textos del Carnet como tarjeta ID-1, el escaneo del QR de la fiesta y la
 * página /sello (plan 008, T91). Claves y textos de
 * docs/propuestas/2026-10-03-carnet.md («i18n keys», aprobado por Hernán);
 * las que no estaban allí van marcadas «T91». Todo `muestra` hasta que
 * Álvaro lo apruebe.
 */
export const esCarnet = {
  // La tarjeta
  'carnet.card.aria': 'Carnet BOIA de {nickname}',
  'carnet.card.docMember': 'Carnet de miembro',
  'carnet.card.docArtist': 'Carnet de artista',
  'carnet.card.number': 'Nº de miembro',
  'carnet.card.nickname': 'Apodo',
  'carnet.card.rank': 'Rango',
  'carnet.card.points': 'Puntos',
  'carnet.card.since': 'Miembro desde',
  'carnet.card.qrAlt': 'QR de tu Carnet público',
  'carnet.card.qrAltOther': 'QR del Carnet de {nickname}',
  'carnet.card.specimen': 'MUESTRA',
  'carnet.card.noNumber': '—',
  'carnet.card.economyNotice':
    'Los rangos y los puntos son de muestra: BOIA los ajustará antes de abrir.', // T91

  // El giro
  'carnet.flip.toBack': 'Ver sellos',
  'carnet.flip.toFront': 'Ver anverso',
  'carnet.flip.announceBack': 'Reverso: {n} sellos',
  'carnet.flip.announceFront': 'Anverso',

  // Los sellos
  'carnet.stamps.countNone': 'Ninguno todavía',
  'carnet.stamps.countOne': '1 fiesta',
  'carnet.stamps.countMany': '{n} fiestas',
  'carnet.stamps.firstSlot': 'Aquí va tu primer sello',
  'carnet.stamps.more': '+{n}',
  'carnet.stamps.moreLabel': 'sellos más',
  'carnet.stamps.moreAria': 'y {n} sellos más',
  'carnet.stamps.seeAll': 'Ver tus sellos',
  'carnet.stamps.sheetTitle': 'Tus sellos · {n}',
  'carnet.stamps.itemAria': '{event}, {date}',
  'carnet.stamps.place': 'ALICANTE',
  'carnet.stamps.sample': 'muestra', // T91
  'carnet.stamps.listAria': 'Sellos, {n} fiestas', // T91
  'carnet.stamps.closeSheet': 'Cerrar tus sellos', // T91

  // Bajo la tarjeta
  'carnet.share': 'Compartir',
  'carnet.share.copied': 'Enlace copiado', // T91
  'carnet.section.answers': 'Sus respuestas',
  'carnet.section.answersOwn': 'Tus respuestas', // T91
  'carnet.section.badges': 'Insignias y logros',
  'carnet.section.ship': 'Barco',
  'carnet.section.bottle': 'Tu botella',

  // /carnet y /carnet/<id> (T91: antes, texto suelto en el componente)
  'carnet.page.back': 'Volver al mar', // T91
  'carnet.page.loading': 'Cargando…', // T91
  'carnet.page.noneTitle': 'Aún no tienes Carnet', // T91
  'carnet.page.noneBody':
    'Tu Carnet BOIA es tu identidad musical en el mar. Se crea en un momento.', // T91
  'carnet.page.notFoundOnline': 'Este enlace no lleva a ningún Carnet. Puede que lo hayan borrado.', // T91

  // Escanear
  'scan.button': 'Escanear sello',
  'scan.pre.title': 'Escanear sello',
  'scan.pre.body':
    'Para leer el QR de la fiesta necesitamos tu cámara. Solo se usa mientras escaneas; no se guarda ni se envía ninguna imagen.',
  'scan.pre.open': 'Abrir la cámara',
  'scan.pre.alt':
    '¿Prefieres no darle permiso? Apunta al QR con la cámara de tu móvil y abre el enlace: el sello llega igual.',
  'scan.aim.title': 'Apunta al QR de la fiesta',
  'scan.aim.body': 'Está en la entrada y en la barra.',
  'scan.cancel': 'Cancelar',
  'scan.close.aria': 'Cerrar la cámara',
  'scan.torch.on': 'Encender la linterna',
  'scan.torch.off': 'Apagar la linterna',
  'scan.found.title': 'Sello encontrado',
  'scan.found.saving': 'Guardando en tu Carnet…',
  'scan.denied.title': 'No podemos usar la cámara',
  'scan.denied.body':
    'El navegador tiene bloqueado el permiso. Actívalo en los ajustes del sitio (el candado junto a la dirección) y vuelve a intentarlo.',
  'scan.noCamera.title': 'Este dispositivo no tiene cámara',
  'scan.noCamera.body':
    'No encontramos ninguna cámara en este dispositivo. Abre BOIA.PLANET en tu móvil para escanear.', // T91
  'scan.retry': 'Volver a intentarlo',
  'scan.phoneAlt':
    'O usa la cámara de tu móvil: apunta al QR de la fiesta y abre el enlace. El sello llega igual.',
  'scan.dialog.aria': 'Escanear el QR de la fiesta', // T91
  'scan.starting': 'Abriendo la cámara…', // T91

  // El sello
  'stamp.received': 'Sello de {event} en tu Carnet. +{points} puntos.',
  'stamp.pointsChip': 'Puntos {from} → {to}',
  'stamp.newRank': 'Ahora eres {rank}',
  'stamp.err.early.title': 'Este sello abre durante la fiesta',
  'stamp.err.early.body':
    'El QR de {event} vale el {date}, de {from} a {to}. Vuelve a escanearlo esa noche.',
  'stamp.err.late.title': 'Este sello ya cerró',
  'stamp.err.late.body': 'Valía el {date}, de {from} a {to}.',
  'stamp.err.ok': 'Entendido',
  'stamp.err.already.title': 'Ya tienes este sello',
  'stamp.err.already.body':
    'El sello de {event} está en tu Carnet desde las {time}. Hay uno por fiesta.',
  'stamp.err.already.bodyNoTime': 'El sello de {event} ya está en tu Carnet. Hay uno por fiesta.', // T91
  'stamp.err.invalid.title': 'Este QR no es un sello de BOIA',
  'stamp.err.invalid.body':
    'Puede ser otro código del local o un QR antiguo. Busca el cartel con el QR de la fiesta, en la entrada o en la barra.',
  'stamp.err.offline.title': 'No hay conexión',
  'stamp.err.offline.body': 'Tu sello no se ha guardado: vuelve a escanear cuando tengas red.',
  'stamp.err.local.title': 'Sellos con QR, en la versión con cuentas', // T91
  'stamp.rescan': 'Volver a escanear',
  'stamp.thisParty': 'esta fiesta', // T91

  // /sello
  'sello.metaTitle': 'Sello de la fiesta · BOIA.PLANET', // T91
  'sello.label': 'Sello de la fiesta',
  'sello.meta': '{date} · {from}–{to} · {place}',
  'sello.checking': 'Comprobando el sello…',
  'sello.guest': 'Guarda el sello en tu Carnet. Necesitamos tu email para saber que eres tú.',
  'sello.signIn': 'Entrar con mi email', // T91
  'sello.done': 'Sellado. +{points} puntos en tu Carnet.',
  'sello.toCarnet': 'Ver mi Carnet',
  'sello.toSea': 'Zarpar al mar',
  'sello.toHome': 'Ir a BOIA.PLANET',
  'sello.localOnly':
    'Los sellos con QR necesitan la versión con cuentas. Esta versión de prueba guarda todo en tu navegador.',
} as const;
