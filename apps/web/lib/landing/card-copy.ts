import { t } from '../i18n/web';

/**
 * Los pocos textos de T42 que pinta la landing (tarjeta de evento y «Ver
 * todas» de las fotos), aparte de `eventos-copy.ts` para no cargar el resto en
 * su ruta crítica. De docs/propuestas/textos-zonas.md, `muestra`.
 */
export const EVENT_CARD_COPY = {
  /** Nombre de cada estado (los siete de REQ-COM-003). */
  state: {
    draft: t('landing.cardCopy.borrador'),
    coming_soon: t('event.state.coming_soon'),
    on_sale: t('event.state.on_sale'),
    sold_out: t('event.state.sold_out'),
    postponed: t('event.state.postponed'),
    cancelled: t('event.state.cancelled'),
    finished: t('landing.cardCopy.finalizado'),
  },
  /** `event.postponed.body`, `event.cancelled.body`. */
  postponed: t('event.postponed.body'),
  cancelled: t('event.cancelled.body'),
  /** `tickets.satellite.*` (D-23, O7). */
  warmup: t('tickets.satellite.warmup'),
  warmupNone: t('tickets.satellite.noAllDay'),
  /** La ubicación sin anunciar, como en la ficha y las islas (plan 019 T224). */
  placeSoon: t('event.page.placeMissing'),
} as const;

/** `photos.home.all` (zona 30). */
export const PHOTOS_HOME_COPY = {
  all: t('photos.home.all'),
  allAria: t('landing.cardCopy.verTodasLasFotos'),
} as const;
