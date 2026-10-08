import {
  type Album,
  type Artist,
  type BoiaEvent,
  type Photo,
  canBuy,
  commonIslandId,
  effectiveEvents,
  eventKicker,
  isIslandlessSatellite,
  nextAllDay,
  upcomingEvents,
} from '@boia/contracts';
import { MAR_PATH, eventSailHref } from '../world-handoff';

/**
 * Ficha compartible de cada evento (`/eventos/<slug>`, REQ-COM-012,
 * REQ-ENT-036) y la Galería (`/galeria`, antes «Fotos y eventos», REQ-COM-031), sin E/S ni
 * React: lo que el servidor pinta con la muestra y el navegador con el
 * repositorio. Los estados salen de las fechas en `now` (REQ-COM-004).
 */

export const EVENTS_PATH = '/eventos';
export const PHOTOS_PATH = '/galeria';

export const eventHref = (slug: string) => `${EVENTS_PATH}/${encodeURIComponent(slug)}`;
export const photosHref = (anchor?: string) =>
  anchor ? `${PHOTOS_PATH}#${encodeURIComponent(anchor)}` : PHOTOS_PATH;

/** Lo mínimo de un evento para enlazarlo desde otro. */
export interface EventLink {
  id: string;
  name: string;
  slug: string;
  startsAt: string;
  timeZone: string;
}

const linkOf = (e: BoiaEvent): EventLink => ({
  id: e.id,
  name: e.name,
  slug: e.slug,
  startsAt: e.startsAt,
  timeZone: e.timeZone,
});

/** El evento que abre ahora una isla: el próximo vigente ligado a ella. */
export function islandCurrentEvent(
  islandId: string,
  events: readonly BoiaEvent[],
  now: Date,
): BoiaEvent | undefined {
  return upcomingEvents(events, now).find((e) => e.islandId === islandId);
}

/** Isla donde vive un evento: la suya o, si es un satélite sin isla, la común (O7). */
export function eventIslandId(
  event: BoiaEvent,
  events: readonly BoiaEvent[],
  now: Date,
): string | undefined {
  if (event.islandId) return event.islandId;
  return isIslandlessSatellite(event) ? commonIslandId(events, now) : undefined;
}

/**
 * «Ir a su isla»: el mar con el barco navegando hacia la isla (`?evento=` del
 * evento que la isla abre ahora, T55; sin evento vigente, el mar sin más). No
 * concede nada al llegar (REQ-ENT-039).
 */
export function islandHref(
  event: BoiaEvent,
  events: readonly BoiaEvent[],
  now: Date,
): string | null {
  const islandId = eventIslandId(event, events, now);
  if (!islandId) return null;
  const current = islandCurrentEvent(islandId, events, now);
  return current ? eventSailHref(current.id) : MAR_PATH;
}

/** Ancla de la galería de un evento en /fotos: la de su isla o, sin isla, la suya. */
export function galleryAnchor(event: Pick<BoiaEvent, 'islandId' | 'slug'>): string {
  return event.islandId ?? event.slug;
}

export interface EventPageView {
  /** El evento con su estado de `now`. */
  event: BoiaEvent;
  kicker: string;
  buyable: boolean;
  /** Nombres del cartel, en el orden del evento. */
  lineup: string[];
  islandHref: string | null;
  /** Un satélite sin isla: calienta para el próximo All Day (null si no hay). */
  warmup: { next: EventLink | null } | null;
  /** Fotos del evento (recuerdos) y su galería en /fotos. */
  photos: Photo[];
  photosHref: string | null;
  /** Otros próximos eventos (para agotado, pospuesto, cancelado y finalizado). */
  upcoming: EventLink[];
}

export interface EventPageInput {
  events: readonly BoiaEvent[];
  artists: readonly Artist[];
  albums: readonly Album[];
  photos: readonly Photo[];
}

/** La ficha de `slug`, o null si no existe o es un borrador (no se publica). */
export function eventPageView(
  content: EventPageInput,
  slug: string,
  now: Date,
): EventPageView | null {
  const events = effectiveEvents(content.events, now);
  const event = events.find((e) => e.slug === slug);
  if (!event || event.state === 'draft') return null;
  const albums = new Set(content.albums.filter((a) => a.eventId === event.id).map((a) => a.id));
  const photos = content.photos.filter((p) => albums.has(p.albumId));
  const warmup = isIslandlessSatellite(event)
    ? { next: ((n) => (n ? linkOf(n) : null))(nextAllDay(events, now)) }
    : null;
  return {
    event,
    kicker: eventKicker(event),
    buyable: canBuy(event),
    lineup: event.artistIds
      .map((id) => content.artists.find((a) => a.id === id)?.name)
      .filter((n): n is string => n !== undefined),
    islandHref: islandHref(event, events, now),
    warmup,
    photos,
    photosHref: event.islandId || photos.length > 0 ? photosHref(galleryAnchor(event)) : null,
    upcoming: upcomingEvents(events, now)
      .filter((e) => e.id !== event.id)
      .slice(0, 3)
      .map(linkOf),
  };
}

/** Slugs con ficha propia (todo menos los borradores). */
export function publicEventSlugs(events: readonly BoiaEvent[]): string[] {
  return events.filter((e) => e.state !== 'draft').map((e) => e.slug);
}

// ---------------------------------------------------------------------------
// «Fotos y eventos»

export interface GalleryIsland {
  id: string;
  name: string;
}

export interface GallerySection {
  album: Album;
  /** El evento del álbum, si lo tiene. */
  event: EventLink | null;
  photos: Photo[];
}

export interface Gallery {
  /** Ancla en /fotos: id de isla, slug de evento o `general`. */
  id: string;
  kind: 'island' | 'event' | 'general';
  /** Nombre de la isla o del evento; vacío en la general (lo pone la página). */
  title: string;
  sections: GallerySection[];
  count: number;
}

export const GENERAL_GALLERY = 'general';

/**
 * Una galería por isla (siempre, aunque esté vacía: «Ver fotos de la isla»
 * lleva a su ancla), una por evento sin isla que tenga álbum y una general
 * con los álbumes sin evento ni isla. Los álbumes de borradores no salen.
 * Dentro de cada galería, lo más reciente primero.
 */
export function photoGalleries(
  content: { events: readonly BoiaEvent[]; albums: readonly Album[]; photos: readonly Photo[] },
  islands: readonly GalleryIsland[],
): Gallery[] {
  const events = new Map(content.events.map((e) => [e.id, e]));
  const byAlbum = new Map<string, Photo[]>();
  for (const p of content.photos) byAlbum.set(p.albumId, [...(byAlbum.get(p.albumId) ?? []), p]);

  const islandSections = new Map<string, GallerySection[]>(islands.map((i) => [i.id, []]));
  const eventGalleries = new Map<string, { event: BoiaEvent; sections: GallerySection[] }>();
  const general: GallerySection[] = [];

  for (const album of content.albums) {
    const event = album.eventId ? events.get(album.eventId) : undefined;
    if (event?.state === 'draft') continue;
    const section: GallerySection = {
      album,
      event: event ? linkOf(event) : null,
      photos: byAlbum.get(album.id) ?? [],
    };
    const islandId = event?.islandId ?? (event ? undefined : album.islandId);
    if (islandId && islandSections.has(islandId)) {
      islandSections.get(islandId)!.push(section);
    } else if (event) {
      const g = eventGalleries.get(event.id) ?? { event, sections: [] };
      g.sections.push(section);
      eventGalleries.set(event.id, g);
    } else {
      general.push(section);
    }
  }

  const albumDate = (s: GallerySection) => s.album.date ?? s.event?.startsAt ?? '';
  const newestFirst = (list: GallerySection[]) =>
    [...list].sort((a, b) => albumDate(b).localeCompare(albumDate(a)));
  const gallery = (
    id: string,
    kind: Gallery['kind'],
    title: string,
    sections: GallerySection[],
  ): Gallery => ({
    id,
    kind,
    title,
    sections: newestFirst(sections),
    count: sections.reduce((n, s) => n + s.photos.length, 0),
  });

  return [
    ...islands.map((i) => gallery(i.id, 'island', i.name, islandSections.get(i.id) ?? [])),
    ...[...eventGalleries.values()]
      .sort((a, b) => b.event.startsAt.localeCompare(a.event.startsAt))
      .map((g) => gallery(g.event.slug, 'event', g.event.name, g.sections)),
    ...(general.length > 0 ? [gallery(GENERAL_GALLERY, 'general', '', general)] : []),
  ];
}
