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
  // Sello de goma «ARTISTA» en el anverso (plan 016 T186, muestra)
  'carnet.card.artistStamp': 'ARTISTA',
  'carnet.card.artistStampSub': 'BOIA · ALICANTE',
  // El enlace de artistas (T186)
  'carnet.artistLink.opening': 'Abriendo tu alta de artista…',
  'carnet.artistLink.go': 'Crear mi Carnet de artista',
  'carnet.artistLink.bad': 'Este enlace de artista no es válido.',
  'carnet.artistLink.notice':
    'Has entrado con el enlace de artistas: si está vigente, tu Carnet será de artista.',
  // El enlace personal para reclamar una ficha de artista (plan 031 T296, muestra)
  'carnet.claim.checking': 'Comprobando tu enlace…',
  'carnet.claim.title': 'Reclama tu perfil de {name} en BOIA',
  'carnet.claim.lead':
    'Crea tu Carnet BOIA con tu email (o entra con el tuyo, si ya lo tienes): tu Carnet quedará unido a tu perfil de artista, con tu apodo, tu foto y tu música.',
  'carnet.claim.go': 'Crear mi Carnet o entrar',
  'carnet.claim.useMine': 'Unir a mi Carnet ({nickname})',
  'carnet.claim.joining': 'Uniendo tu Carnet…',
  'carnet.claim.joined':
    'Hecho: tu Carnet está unido a tu perfil de {name}. En /artistas sales con tu apodo.',
  'carnet.claim.seeCarnet': 'Ver mi Carnet',
  'carnet.claim.invalidTitle': 'Este enlace no vale',
  'carnet.claim.invalid':
    'Puede que ya se usara, que caducara o que BOIA haya creado otro más nuevo. Pide uno nuevo a BOIA. Mientras, puedes crear tu Carnet como cualquier socio.',
  'carnet.claim.rejected': 'No se pudo unir: {detail} Pide ayuda a BOIA.',
  'carnet.claim.alreadyJoined': 'tu Carnet ya está unido a otro perfil.',
  'carnet.claim.offline': 'No hay conexión. Prueba otra vez en un momento.',
  'carnet.claim.local':
    'En esta versión de prueba no hay cuentas: este enlace sólo funciona en la web con cuentas. Puedes crear tu Carnet en este navegador como cualquier socio.',
  'carnet.claim.normal': 'Crear mi Carnet',
  'carnet.claim.notice':
    'Has entrado con tu enlace de artista: al crear tu Carnet, se unirá a tu perfil de {name}.',
  // «¿Eres uno de estos artistas?»: la solicitud que revisa BOIA (plan 031 T297, muestra)
  'carnet.request.title': '¿Eres uno de estos artistas?',
  'carnet.request.lead':
    'Si ya tienes perfil en /artistas, elígelo: BOIA revisará tu solicitud y, si es tuyo, lo unirá a tu Carnet.',
  'carnet.request.loading': 'Buscando los perfiles de artista…',
  'carnet.request.search': 'Busca tu nombre',
  'carnet.request.noMatch': 'Ningún perfil sin reclamar con ese nombre.',
  'carnet.request.none': 'Ahora no hay perfiles de artista sin reclamar.',
  'carnet.request.review': 'Elegir uno no lo une todavía: BOIA comprueba antes que eres tú.',
  'carnet.request.new': 'No, soy nuevo',
  'carnet.request.sent': 'Solicitud enviada: BOIA la revisará. (Perfil: {name})',
  'carnet.request.cancel': 'Retirar solicitud',
  'carnet.request.cancelled': 'Solicitud retirada.',
  'carnet.request.cancelError': 'No se pudo retirar. Prueba otra vez en un momento.',
  'carnet.request.offline': 'No hay conexión. Prueba otra vez en un momento.',
  'carnet.request.errorClaimed': 'Ese perfil ya es de otro Carnet. Elige otro o sigue como nuevo.',
  'carnet.request.errorRequested':
    'Otra persona ya ha pedido ese perfil y BOIA la está revisando. Si es tuyo, escribe a BOIA.',
  'carnet.request.errorPending': 'Ya tienes una solicitud pendiente.',
  'carnet.request.errorJoined': 'Tu Carnet ya está unido a un perfil.',
  'carnet.request.errorGeneric': 'No se pudo enviar la solicitud. Pide ayuda a BOIA.',
  // El enlace a su música al crear el Carnet de artista (plan 019 T217, decisión 10)
  'carnet.music.label': 'Tu música',
  'carnet.music.placeholder': 'https://soundcloud.com/…',
  'carnet.music.hint':
    'Un enlace: Spotify, SoundCloud, Bandcamp o, si no, Instagram. Sale como botón en la lista de artistas.',
  'carnet.music.detected': 'Enlace de {platform}.',
  'carnet.music.invalid': 'Pega un enlace de Spotify, SoundCloud, Bandcamp o Instagram.',
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
  'stamp.pointsAwarded': '+{points} puntos',
  'stamp.nowRank': 'Ahora eres {rank}.º en el ranking.',
  'stamp.rankUnavailable': 'Tu puesto no está disponible ahora. Puedes consultarlo en el ranking.',
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
  'sello.metaTitle': 'Sello de la fiesta', // T91 (la plantilla del layout añade «· BOIA.PLANET»)
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
