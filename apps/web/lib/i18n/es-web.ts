/**
 * Textos de la web pública (landing, eventos, fotos, legales, checkout) en
 * español (D-03, REQ-ARQ-020). Es la parte del catálogo que viaja al
 * navegador en la landing: `lib/i18n/web.ts` traduce sólo con esto, para no
 * cargar los textos del 2D, /mar y el Admin (presupuesto de la landing,
 * T14). El catálogo entero está en `es.ts`. El inglés (L2) será otro archivo con las mismas
 * claves. El contenido administrable (eventos, artistas, bloques) no está
 * aquí: es dato. Todo el copy es `muestra` hasta que Álvaro lo apruebe
 * (docs/spec/10-filosofia.md, §31.2).
 */
import { esGaleria } from './es-galeria';
import { esLibWeb } from './es-lib-web';
import { esZonasWeb } from './es-zonas-web';

/** Claves de la web anteriores a textos-zonas.md; las de allí mandan si se repiten. */
const base = {
  'site.title': 'BOIA.PLANET',
  'site.description':
    'BOIA Underground Music Festival: entradas para los All Day BOIA y un universo para explorar en barco.',
  'site.sampleNotice': 'Contenido de muestra pendiente de aprobación.',

  'nav.label': 'Navegación principal',
  'nav.home': 'Ir al inicio',
  'nav.menu': 'Menú',
  'nav.tickets': 'Entradas',
  'nav.zarpar': 'Zarpar',
  'nav.artists': 'Artistas',
  'nav.philosophy': 'Filosofía',
  'nav.store': 'Tienda',
  'nav.photos': 'Galería',
  'nav.skipToContent': 'Saltar al contenido',

  'hero.brand': 'BOIA.PLANET',
  'hero.explore': 'Zarpar',
  // T187: invitación bajo Zarpar, muestra.
  'hero.explore.discountHint': 'Consigue descuentos',
  'hero.explore.withPromotions': 'Encuentra descuentos para tus entradas',
  'hero.explore.withoutPromotions': 'Descubre eventos y secretos navegando',
  'hero.explore3d': 'Navegar en 3D',
  'hero.explore3d.sub': 'Nuevo · zoom libre y mapa interactivo',
  'hero.tickets': 'Entradas',
  // Plan 007 T79 (docs/propuestas/2026-10-03-landing-scroll.md §11), muestra.
  'hero.scrollHint': 'Desliza para bajar al mar',
  'hero.place': 'BOIA · Alicante',
  'hero.coords': '38.3452° N, 0.4815° O',

  'event.state.coming_soon': 'Próximamente',
  'event.state.on_sale': 'A la venta',
  'event.state.sold_out': 'Agotado',
  'event.state.postponed': 'Pospuesto',
  'event.state.cancelled': 'Cancelado',
  'event.buy': 'Comprar entradas',
  'event.buy.aria': 'Comprar entradas para {name} (se abre la ticketera en otra pestaña)',
  'event.soon': 'Entradas próximamente',
  // Plan 019 (T215, T224): la ubicación sin anunciar; aquí y no en
  // es-lib-eventos porque también la pintan la tarjeta de la landing y el
  // checkout. Muestra.
  'event.page.placeMissing': 'La ubicación todavía no está anunciada',
  'event.lineup': 'Cartel',

  'priority.heading': 'Próximo evento',
  // Plan 007 T82: the poster slot of the priority event (P19) and the mark of a
  // sandbox link (P15). muestra.
  'priority.posterSoon': 'Cartel próximamente',
  'priority.posterAlt': 'Cartel de {name}',
  'link.sample': 'muestra',
  'upcoming.heading': 'Próximos eventos',

  'tickets.heading': 'Elige tu evento',
  'tickets.close': 'Cerrar',
  'tickets.empty': 'Próximamente. Todavía no hay entradas a la venta.',
  'tickets.featured': 'Evento destacado',
  'tickets.islandInvite': 'También puedes encontrar sorpresas navegando hasta su isla',

  'artists.heading': 'Personas detrás del sonido',
  'artists.intro':
    'Música sin un único género. Estas son algunas de las personas que la hacen sonar.',
  'artists.all': 'Ver todos los artistas',
  'artists.azLabel': 'Artistas de la A a la Z',
  'artists.page.title': 'Todos los artistas',
  'artists.page.lead': '{count} artistas, de la A a la Z. Lista provisional.',
  'artists.page.back': 'Volver al inicio',
  'artists.genres': 'Géneros',
  // Plan 007 T79: plain links to Spotify, nothing loaded from it. muestra.
  'artists.spotify': 'Escúchalo en Spotify',
  'artists.spotify.aria': 'Escucha la lista de BOIA en Spotify (se abre en otra pestaña)',
  // Cada artista (plan 019 T217, decisión 10): su Carnet y su música.
  'artist.carnet': 'Ver carnet',
  'artist.carnet.aria': 'Ver el carnet de {name}',
  'artist.music.aria': '{name} en {platform} (se abre en otra pestaña)',
  'artist.music.spotify': 'Spotify',
  'artist.music.soundcloud': 'SoundCloud',
  'artist.music.bandcamp': 'Bandcamp',
  'artist.music.instagram': 'Instagram',

  'philosophy.heading': 'Filosofía',

  'photos.heading': 'Galería',
  'photos.placeholder': 'Foto de muestra',
  'photos.display': 'Lo que pasó la última vez',

  'store.heading': 'Tienda',
  'store.intro': 'Camisetas, tote bags y pegatinas de BOIA.',
  'store.cta': 'Ir a la tienda',
  'store.cta.aria': 'Ir a la tienda de BOIA (se abre en otra pestaña)',
  'store.internal.aria': 'Ver la tienda de BOIA',
  // Plan 017 T201 (decisión 11), muestra: comprar no es un checkout.
  'store.buy': 'Comprar',
  'store.buy.aria': 'Comprar {name}',
  // Plan 019 T214 (decisión 9), muestra: los dos casos de «Comprar».
  'store.sale.party': 'Solo en la fiesta',
  'store.sale.reserve': 'Sin existencias: se reserva',
  'store.buy.party':
    'Este solo se vende en mano en la fiesta: búscalo en el puesto de BOIA en el próximo evento.',
  'store.buy.reserve':
    'Ahora no nos quedan. Resérvalo con un mensaje directo en Instagram y te lo llevamos al próximo evento:',
  'store.buy.reserve.cta': 'Escribir a {handle}',
  'store.buy.instagram.aria': '{handle} en Instagram (se abre en otra pestaña)',
  'store.page.title': 'Tienda BOIA',
  'store.page.lead': 'Un poco de la fiesta para llevar.',
  'store.page.nav': 'Navegación de la tienda',
  'store.page.home': 'BOIA, inicio',
  'store.page.backHome': 'Volver a la página principal',
  'store.page.backSea': 'Volver al mar',
  'store.gallery.label': 'Fotos de {name}',
  'store.gallery.show': '{name}: {kind}',
  // Plan 020 T227 (decisión 5): las fotos se pasan deslizando; flechas para quien no desliza.
  'store.gallery.prev': 'Foto anterior de {name}',
  'store.gallery.next': 'Foto siguiente de {name}',
  // Plan 020 T227 (decisión 5): lo que se vende en mano también se reserva por Instagram.
  'store.buy.party.reserve': 'Si no quieres quedarte sin él, resérvalo por Instagram:',
  'store.maker.prefix': 'Hecha a mano por',
  'store.image.alone': 'el producto',
  'store.image.angle': 'otro ángulo',
  'store.image.model': 'con modelo',

  'contact.heading': 'Contacto',
  'contact.email': 'Escríbenos',
  'contact.data': 'Datos de contacto',

  'footer.official': 'Enlaces oficiales de BOIA',
  'footer.legal': 'Información legal',
  'footer.privacy': 'Privacidad',
  'footer.cookies': 'Preferencias de cookies',
  'footer.copyright': '© BOIA, Alicante',
  'footer.replayIntro': 'Ver la introducción',
  // T214: the footer's column labels (noartmusic.com's [bracketed] headers).
  'footer.col.listen': 'escucha',
  'footer.col.join': 'únete',
  'footer.col.follow': 'síguenos',
  'footer.col.legal': 'legal',
  'footer.col.site': 'la web',

  'intro.skip': 'Saltar animación',
  'intro.label': 'Introducción animada',

  'legal.back': 'Volver al inicio',
  'legal.cookies.body':
    'Esta web no usa cookies de analítica ni de publicidad. La medición de visitas es anónima y no se guarda en tu navegador.',

  'common.newTab': '(se abre en otra pestaña)',
} as const;

/** La web pública: sus claves, las de textos-zonas.md que usa y las de lib/landing y lib/ticketing. */
export const esWeb = { ...base, ...esZonasWeb, ...esLibWeb, ...esGaleria } as const;

export type WebKey = keyof typeof esWeb;

/**
 * Las claves de la landing que el Admin deja cambiar («Textos y música»,
 * REQ-ADM-019): las de la web anteriores a T49, no las del 2D, /mar ni el
 * propio Admin.
 */
export const LANDING_TEXT_KEYS = Object.keys(base) as WebKey[];
