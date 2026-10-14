import { SAMPLE_LINK_BASE } from '@boia/contracts/links';
import {
  type BoiaEvent,
  type HomeContent,
  EVENT_STATE_BEHAVIOR,
  buyButtonShown,
  upcomingEvents,
} from '@boia/contracts';
import { DEFAULT_TIME_ZONE, isoToLocal, localToIso } from '../admin/dates';
import { t } from '../i18n';
import { canonicalOf, ogEventImage, SITE_URL } from '../seo';
import { eventHref } from './eventos';
import { socialLinks } from './resolve';

/**
 * Datos estructurados (JSON-LD) de la home para Google (plan 030 T287):
 * `Organization`, `WebSite` y un `MusicEvent` por evento próximo. Una función
 * pura sobre el mismo contenido que pinta la landing; el servidor la mete en
 * el HTML. Compacto a propósito: cuenta en el presupuesto de la landing.
 */

const ORG_ID = `${SITE_URL}/#org`;
const SCHEMA = 'https://schema.org/';
const ALICANTE = { '@type': 'PostalAddress', addressLocality: 'Alicante', addressCountry: 'ES' };
const ORG_BASE = { '@type': 'Organization', '@id': ORG_ID, name: 'BOIA', url: SITE_URL };

/**
 * Disponibilidad de la entrada de un evento. «Tickets todavía no
 * disponibles» (plan 030 T292) es `PreOrder`.
 */
export function offerAvailability(event: BoiaEvent): string {
  if (event.state === 'sold_out') return `${SCHEMA}SoldOut`;
  if (event.ticketsNotYet) return `${SCHEMA}PreOrder`;
  return `${SCHEMA}InStock`;
}

const EVENT_STATUS: Partial<Record<BoiaEvent['state'], string>> = {
  postponed: 'EventPostponed',
  cancelled: 'EventCancelled',
};

/** La fecha con el desfase de la zona del evento (Europe/Madrid): «…T23:00:00+01:00». */
const zoned = (iso: string, timeZone: string): string =>
  localToIso(isoToLocal(iso, timeZone), timeZone) ?? iso;

/** ¿Es un enlace de muestra (sandbox)? No se publica a Google. */
const isSandbox = (url: string): boolean => url.startsWith(SAMPLE_LINK_BASE);

function offerOf(event: BoiaEvent): Record<string, unknown> | undefined {
  const cents = event.boxOfficeOnly?.doorPriceCents ?? event.priceCents;
  const link = event.ticketUrl && !isSandbox(event.ticketUrl) ? event.ticketUrl : undefined;
  if (cents === undefined && !link && !buyButtonShown(event)) return undefined;
  const dead = event.state === 'cancelled' || event.state === 'postponed';
  return {
    '@type': 'Offer',
    url: link ?? canonicalOf(eventHref(event.slug)),
    // Un precio de muestra (D-06) no se publica: sólo el real.
    ...(cents !== undefined && !event.priceSample
      ? { price: (cents / 100).toFixed(2), priceCurrency: 'EUR' }
      : {}),
    ...(dead ? {} : { availability: offerAvailability(event) }),
  };
}

function eventNode(
  event: BoiaEvent,
  content: Pick<HomeContent, 'artists'>,
  organizer: Record<string, unknown> = { '@id': ORG_ID },
): Record<string, unknown> {
  const tz = event.timeZone || DEFAULT_TIME_ZONE;
  // Nunca la dirección de una secret location (REQ-COM-013): sólo la ciudad.
  const known = event.placeAnnounced && !/secret/i.test(event.placeLabel);
  const performers = event.artistIds
    .map((id) => content.artists.find((a) => a.id === id)?.name)
    .filter((n): n is string => n !== undefined)
    .map((name) => ({ '@type': 'PerformingGroup', name }));
  const offer = offerOf(event);
  return {
    '@type': 'MusicEvent',
    name: event.name,
    url: canonicalOf(eventHref(event.slug)),
    startDate: zoned(event.startsAt, tz),
    ...(event.endsAt ? { endDate: zoned(event.endsAt, tz) } : {}),
    eventStatus: `${SCHEMA}${EVENT_STATUS[event.state] ?? 'EventScheduled'}`,
    eventAttendanceMode: `${SCHEMA}OfflineEventAttendanceMode`,
    location: {
      '@type': 'Place',
      name: known ? event.placeLabel : 'Alicante',
      address: ALICANTE,
    },
    image: canonicalOf(ogEventImage(event.slug)),
    ...(event.description ? { description: event.description } : {}),
    ...(performers.length > 0 ? { performer: performers } : {}),
    ...(offer ? { offers: offer } : {}),
    organizer,
  };
}

/**
 * El `MusicEvent` de la ficha de un evento (`/eventos/[slug]`), el mismo nodo
 * que en la home con el organizador dentro. null si ya pasó o es borrador.
 */
export function eventStructuredData(
  event: BoiaEvent,
  content: Pick<HomeContent, 'artists'>,
): Record<string, unknown> | null {
  if (!EVENT_STATE_BEHAVIOR[event.state].listed) return null;
  return { '@context': 'https://schema.org', ...eventNode(event, content, ORG_BASE) };
}

/** El grafo JSON-LD de la home (pásalo por `jsonLdString` para el `<script>`). */
export function homeStructuredData(content: HomeContent, now: Date): Record<string, unknown> {
  const social = socialLinks(content);
  const sameAs = [social.instagram, social.spotify, social.whatsapp].filter(
    (u): u is string => u !== null && !isSandbox(u),
  );
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        ...ORG_BASE,
        logo: canonicalOf('/icons/icon-512.png'),
        address: ALICANTE,
        ...(sameAs.length > 0 ? { sameAs } : {}),
      },
      {
        '@type': 'WebSite',
        name: t('site.title'),
        url: SITE_URL,
        inLanguage: 'es',
        publisher: { '@id': ORG_ID },
      },
      ...upcomingEvents(content.events, now).map((e) => eventNode(e, content)),
    ],
  };
}

/** JSON compacto y seguro dentro de `<script>` (`<` escapado). */
export const jsonLdString = (data: unknown): string =>
  JSON.stringify(data).replace(/</g, '\\u003c');
