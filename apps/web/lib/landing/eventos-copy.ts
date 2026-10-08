/**
 * Textos de la ficha de evento, de «Fotos y eventos» y del estado de las
 * islas (T42), tomados de docs/propuestas/textos-zonas.md (zonas 4, 11, 17 y
 * 30). Todos `muestra` [pendiente Álvaro, P22]. Viven aquí hasta que la T49
 * los pase al catálogo i18n con estas mismas claves. Lo poco que pinta la
 * landing está en `card-copy.ts`.
 */
import { EVENT_CARD_COPY, PHOTOS_HOME_COPY } from './card-copy';
import { t } from '../i18n/eventos';

export const EVENTOS_COPY = {
  state: EVENT_CARD_COPY.state,
  /** `event.soldOut.body`, `event.postponed.body`, `event.cancelled.body`. */
  stateBody: {
    sold_out: t('event.soldOut.body'),
    postponed: EVENT_CARD_COPY.postponed,
    cancelled: EVENT_CARD_COPY.cancelled,
    finished: t('island.event.memory'),
  },
  soon: t('event.soon'),
  /** `tickets.sailToIsland` */
  sailToIsland: t('tickets.sailToIsland'),
  /** `tickets.satellite.*` (D-23, O7). */
  warmup: EVENT_CARD_COPY.warmup,
  warmupLink: t('tickets.satellite.linkAllDay'),
  warmupNone: EVENT_CARD_COPY.warmupNone,
  /** El cartel que falta (P19; plan 019 T215, decisión 5). */
  posterSoon: t('event.page.posterMissing'),
  /** La ubicación sin anunciar (plan 019 T215). */
  placeSoon: t('event.page.placeMissing'),
  /** «En puerta, con carnet»: el precio de un evento «Solo en puerta». */
  doorPrice: t('event.page.doorPrice'),
  /** La ticketera que vende el evento (plan 019 T215). */
  provider: t('event.page.provider'),
  /** «Consigue un descuento»: entra en el mundo como «Zarpar» (decisión 5). */
  getDiscount: t('event.page.getDiscount'),
  /** Comprar pide el Carnet BOIA (decisión 1). */
  carnetNeeded: t('event.page.carnetNeeded'),
  carnetCta: t('event.page.carnetCta'),
  posterAlt: (name: string) => t('landing.eventosCopy.cartelDe', { name }),
  details: t('landing.eventosCopy.verElEvento'),
  detailsAria: (name: string) => t('landing.eventosCopy.verLaFichaDe', { name }),
  when: t('landing.eventosCopy.cuando'),
  where: t('landing.eventosCopy.donde'),
  format: t('landing.eventosCopy.formato'),
  price: t('landing.eventosCopy.precio'),
  priceSample: t('landing.eventosCopy.precioDeMuestra'),
  lineup: t('event.lineup'),
  lineupSoon: t('event.page.artistsMissing'),
  activities: t('landing.eventosCopy.actividades'),
  memories: t('landing.eventosCopy.recuerdos'),
  memoriesPhotos: t('landing.eventosCopy.verSusFotos'),
  upcoming: t('island.upcoming.heading'),
  back: t('artists.page.back'),
  allTickets: t('landing.eventosCopy.todasLasEntradas'),
  sampleNotice: t('site.sampleNotice'),
  loading: t('landing.eventosCopy.buscandoElEvento'),
  notFound: t('landing.eventosCopy.noEncontramosEsteEvento'),
  /** Islas (zona 11). */
  island: {
    memoriesHeading: t('island.memories.heading'),
    memoriesEmpty: t('island.memories.empty'),
    photosCta: t('island.photos.cta'),
    soldOut: t('island.event.soldOut'),
    memory: t('island.event.memory'),
    upcomingHeading: t('island.upcoming.heading'),
    steer: t('landing.eventosCopy.rumboASuIsla'),
  },
} as const;

/** «Fotos y eventos» (zona 30 de textos-zonas). */
export const FOTOS_COPY = {
  heading: t('photos.heading'),
  homeAll: PHOTOS_HOME_COPY.all,
  homeAllAria: PHOTOS_HOME_COPY.allAria,
  pageTitle: t('nav.photos'),
  pageLead: t('photos.page.lead'),
  placeholder: t('photos.placeholder'),
  empty: t('photos.empty'),
  emptyIsland: t('island.memories.empty'),
  general: t('landing.eventosCopy.boiaEnGeneral'),
  islandsNav: t('landing.eventosCopy.galerias'),
  byIsland: t('photos.filter.island'),
  byEvent: t('photos.filter.event'),
  back: t('artists.page.back'),
  eventPage: t('landing.eventosCopy.fichaDelEvento'),
  count: (n: number) =>
    n === 1 ? t('landing.eventosCopy.n1Foto') : t('landing.eventosCopy.nFotos', { n }),
} as const;
