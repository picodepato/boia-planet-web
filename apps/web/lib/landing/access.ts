import { MAR_CARNET_HREF, MAR_PATH, placeHref } from '../world-handoff';
import { t } from '../i18n/web';

/**
 * Accesos de la landing que llevan el barco a su lugar (T44, REQ-ENT-034,
 * REQ-AVE-022) y los textos nuevos de cabecera y pie (REQ-ENT-029,
 * REQ-ENT-032, O13). La landing sigue siendo HTML: Tickets abre su panel,
 * Fotos y Tienda son secciones; con JavaScript, cada una ofrece además «ir en
 * barco», que abre el mar 3D con el barco navegando a su isla y su ficha al
 * llegar (T55; el sector navegable bajo demanda de REQ-ENT-038). Textos de
 * docs/propuestas/textos-zonas.md, `muestra`.
 */

/** Lugares del mapa compartido (ids estables, iguales en todos los mundos). */
export const PHOTOS_PLACE_ID = 'fotos';
export const STORE_PLACE_ID = 'tienda';

/** El mar con el barco rumbo al Puerto de Fotos y su galería al llegar. */
export const PHOTOS_SAIL_HREF = placeHref(PHOTOS_PLACE_ID);
/** El mar con el barco rumbo a la isla tienda y su escaparate al llegar. */
export const STORE_SAIL_HREF = placeHref(STORE_PLACE_ID);

/** El mar con el barco rumbo a la isla del evento y su ficha (con compra) al llegar. */
export function ticketsSailHref(islandId: string, eventId?: string): string {
  return placeHref(islandId, eventId ? { eventId } : {});
}

/** Mi Carnet desde la cabecera: la página del propio Carnet (o su invitación). */
export const CARNET_PAGE = '/carnet';
/** Los rankings desde el menú de la web (plan 017 T188): carrera, Cañón, Castillo y puntos. */
export const RANKING_PAGE = '/ranking';
/** Crear el Carnet desde la landing: Mi Carnet dentro del mar (T55). */
export const CARNET_CREATE_HREF = MAR_CARNET_HREF;

/** El mar a secas (sin isla a la que ir). */
export const SEA_HREF = MAR_PATH;

export const ACCESS_COPY = {
  carnet: t('nav.carnet'),
  ranking: t('nav.ranking'),
  sound: t('landing.access.sonido'),
  soundOn: t('nav.sound.on'),
  soundOff: t('nav.sound.off'),
  instagram: t('footer.instagram'),
  instagramAria: t('instagram.cta.aria'),
  whatsapp: 'WhatsApp',
  whatsappCta: t('landing.access.entrarEnElWhatsapp'),
  whatsappAria: t('landing.access.entrarEnElWhatsapp2'),
  /** `footer.invite.carnet`, `footer.invite.whatsapp` (zona 24 y 22). */
  footerCarnet: t('footer.invite.carnet'),
  footerCarnetCta: t('carnet.create'),
  footerWhatsapp: t('footer.invite.whatsapp'),
  footerInviteLabel: t('invite.join.title'),
  /** «Ir en barco»: el mismo contenido, en su isla del mar. */
  sailTickets: t('landing.access.verSuIslaEn'),
  sailPhotos: t('landing.access.irEnBarcoAl'),
  sailStore: t('landing.access.irEnBarcoA'),
} as const;
