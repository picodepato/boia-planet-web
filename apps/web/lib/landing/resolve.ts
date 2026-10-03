import {
  canBuy,
  commonIslandId,
  effectiveEvents,
  hasActivePromotion,
  isIslandlessSatellite,
  nextAllDay,
  isBlockScheduled,
  resolvePriorityEvent,
  upcomingEvents,
  type Artist,
  type BoiaEvent,
  type HomeBlock,
  type HomeBlockOf,
  type HomeContent,
  type Photo,
} from '@boia/contracts';
import { shuffledOrder } from './rotation';

/**
 * De bloque configurado a lo que se pinta. Devuelve `null` cuando el bloque
 * no debe verse: oculto, fuera de su programación o sin contenido publicado
 * útil (REQ-ENT-030).
 */
export type ResolvedBlock =
  | (HomeBlockOf<'hero'> & { hasPromotions: boolean })
  | (HomeBlockOf<'priority_event'> & { event: BoiaEvent })
  | (HomeBlockOf<'upcoming_events'> & { events: BoiaEvent[] })
  | (HomeBlockOf<'artists'> & { rotation: Artist[]; alphabetical: Artist[] })
  | HomeBlockOf<'philosophy'>
  | (HomeBlockOf<'photos'> & { photos: Photo[] })
  | HomeBlockOf<'store'>
  | ContactView
  | HomeBlockOf<'footer'>;

/**
 * El bloque Contacto con la Filosofía dentro (T65, decisión del 2026-10-02):
 * el enlace «Contacto» del juego lleva a las dos cosas. Cada una sigue siendo
 * su bloque en el Admin (textos, visible, programación); se pintan juntas en
 * la sección de Contacto, con la Filosofía primero.
 */
export type ContactView = HomeBlockOf<'contact'> & {
  philosophy?: HomeBlockOf<'philosophy'>;
};

/** La Filosofía que se ve (visible, en su programación y con texto); si no, null. */
function shownPhilosophy(content: HomeContent, now: Date): HomeBlockOf<'philosophy'> | null {
  const block = content.blocks.find((b): b is HomeBlockOf<'philosophy'> => b.type === 'philosophy');
  if (!block || !isBlockScheduled(block, now)) return null;
  return block.paragraphs.length > 0 || block.verbs.length > 0 ? block : null;
}

/** Con un bloque Contacto, la Filosofía va dentro de él y no por separado (T65). */
const hasContactBlock = (content: HomeContent) => content.blocks.some((b) => b.type === 'contact');

/** Semilla fija: el orden de rotación es el mismo en servidor y cliente. */
export const ARTIST_ORDER_SEED = 2026;

/** Artistas de la A a la Z (lista completa en /artistas y orden alfabético del bloque). */
export function alphabeticalArtists<A extends { name: string }>(artists: readonly A[]): A[] {
  return [...artists].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export function resolveBlock(
  block: HomeBlock,
  content: HomeContent,
  now: Date,
): ResolvedBlock | null {
  if (!isBlockScheduled(block, now)) return null;

  switch (block.type) {
    case 'hero':
      return { ...block, hasPromotions: hasActivePromotion(content.promotions, now) };

    case 'priority_event': {
      const event = resolvePriorityEvent(content.events, block.eventId, now);
      return event ? { ...block, event } : null;
    }

    case 'upcoming_events': {
      // Si el bloque del evento prioritario se ve, no se repite en la lista.
      const priority = shownPriorityEvent(content, now);
      const exclude = priority ? [...block.excludeEventIds, priority.id] : block.excludeEventIds;
      const events = upcomingEvents(content.events, now, exclude).slice(0, block.limit);
      return events.length > 0 ? { ...block, events } : null;
    }

    case 'artists': {
      if (content.artists.length === 0) return null;
      const order = shuffledOrder(content.artists.length, ARTIST_ORDER_SEED);
      const rotation = order.map((i) => content.artists[i]!);
      const alphabetical = alphabeticalArtists(content.artists);
      return { ...block, rotation, alphabetical };
    }

    case 'philosophy':
      // Va dentro de Contacto (T65); sola, sólo en un contenido sin bloque Contacto.
      if (hasContactBlock(content)) return null;
      return block.paragraphs.length > 0 || block.verbs.length > 0 ? block : null;

    case 'photos': {
      // Sólo la selección de Álvaro (D-23, respuesta 6); el resto, en /fotos.
      const photos = content.photos
        .filter((p) => p.selection)
        .filter((p) => block.albumId === undefined || p.albumId === block.albumId)
        .slice(0, block.limit);
      return photos.length > 0 ? { ...block, photos } : null;
    }

    case 'store':
      return block;

    case 'contact': {
      // Oculto o fuera de programación, Contacto se lleva su Filosofía con él.
      const philosophy = shownPhilosophy(content, now);
      if (philosophy) return { ...block, philosophy };
      return block.email !== undefined || block.links.length > 0 ? block : null;
    }

    case 'footer':
      return block;
  }
}

/** Evento prioritario tal y como lo muestra su bloque, si el bloque está activo. */
export function shownPriorityEvent(content: HomeContent, now: Date): BoiaEvent | undefined {
  const block = content.blocks.find(
    (b): b is HomeBlockOf<'priority_event'> => b.type === 'priority_event',
  );
  if (!block || !isBlockScheduled(block, now)) return undefined;
  return resolvePriorityEvent(content.events, block.eventId, now);
}

/**
 * Contenido del panel de Tickets (REQ-ENT-037): el evento prioritario vigente
 * (aunque esté agotado o próximamente, con su estado) y todos los próximos con
 * compra disponible. `onSale` es falso si no hay nada que comprar: entonces
 * el panel dice «Próximamente» sin inventar entradas.
 */
export function resolveTicketsPanel(content: HomeContent, now: Date): TicketsView {
  const priorityBlock = content.blocks.find(
    (b): b is HomeBlockOf<'priority_event'> => b.type === 'priority_event',
  );
  const featured = resolvePriorityEvent(content.events, priorityBlock?.eventId, now);
  const others = upcomingEvents(content.events, now)
    .filter((e) => canBuy(e))
    .filter((e) => e.id !== featured?.id);
  const onSale = others.length > 0 || (featured !== undefined && canBuy(featured));
  // Los satélites sin isla enlazan al próximo All Day (REQ-COM-010, O7).
  const hasSatellite = [featured, ...others].some((e) => e && isIslandlessSatellite(e));
  const next = hasSatellite ? nextAllDay(content.events, now) : undefined;
  return {
    featured,
    others,
    onSale,
    nextAllDay: next ? { name: next.name, slug: next.slug } : null,
  };
}

export interface TicketsView {
  featured: BoiaEvent | undefined;
  others: BoiaEvent[];
  onSale: boolean;
  /** El próximo All Day, para la línea de los satélites; null si no hay. */
  nextAllDay: { name: string; slug: string } | null;
}

/** id de ancla de cada tipo de bloque, para enlazar sólo secciones que existen. */
const ANCHORS: Partial<Record<string, string>> = {
  artists: 'artistas',
  philosophy: 'filosofia',
  store: 'tienda',
  photos: 'fotos',
};

/** Qué secciones de la cabecera existen con este contenido. */
export function landingSections(content: HomeContent, now: Date): string[] {
  return [
    ...new Set(
      content.blocks
        .filter((b) => b.type !== 'footer')
        .map((b) => resolveBlock(b, content, now))
        .flatMap((b) =>
          !b ? [] : b.type === 'contact' && b.philosophy ? [ANCHORS.philosophy] : [ANCHORS[b.type]],
        )
        .filter((a): a is string => a !== undefined),
    ),
  ];
}

/**
 * La home ya resuelta, lista para pintar: bloques visibles en su orden, pie,
 * secciones de la cabecera, panel de Tickets y qué eventos se pueden comprar.
 * El servidor la calcula con la muestra; el navegador sólo carga este módulo
 * (y con él los esquemas de `@boia/contracts` y zod) cuando llega el contenido
 * del repositorio, fuera de la ruta crítica de la landing (REQ-ARQ-014, T29).
 */
export interface HomeView {
  main: ResolvedBlock[];
  footer: ResolvedBlock[];
  sections: string[];
  tickets: TicketsView;
  artists: Artist[];
  /** ids de los eventos con compra disponible (`canBuy`). */
  buyable: string[];
  /** Enlaces oficiales para cabecera y pie (REQ-ENT-032, O13); `null` si no hay. */
  social: SocialLinks;
  /**
   * Isla a la que lleva «Ver su isla en el mar» del panel de Tickets (T44,
   * REQ-ENT-034): la del evento destacado o, si no tiene (satélite), la
   * localización común (O7).
   */
  ticketsIsland: string;
}

export interface SocialLinks {
  instagram: string | null;
  whatsapp: string | null;
  /** BOIA's Spotify playlist (plan 007 T79; URL `muestra` until P15). */
  spotify: string | null;
}

/** Instagram, WhatsApp y Spotify de los enlaces del pie y de contacto, por su nombre. */
export function socialLinks(content: HomeContent): SocialLinks {
  const links = content.blocks.flatMap((b) =>
    b.type === 'footer' ? b.officialLinks : b.type === 'contact' ? b.links : [],
  );
  const find = (re: RegExp) => links.find((l) => re.test(l.label))?.url ?? null;
  return { instagram: find(/instagram/i), whatsapp: find(/whatsapp/i), spotify: find(/spotify/i) };
}

export function resolveHome(stored: HomeContent, now: Date): HomeView {
  // Cada evento con su estado de ahora (REQ-COM-004): lo pintado no depende
  // de que alguien cambie el estado a mano cuando pasa la fecha.
  const content: HomeContent = { ...stored, events: effectiveEvents(stored.events, now) };
  const resolved = (blocks: readonly HomeBlock[]) =>
    blocks.map((b) => resolveBlock(b, content, now)).filter((b): b is ResolvedBlock => b !== null);
  const tickets = resolveTicketsPanel(content, now);
  return {
    main: resolved(content.blocks.filter((b) => b.type !== 'footer')),
    footer: resolved(content.blocks.filter((b) => b.type === 'footer')),
    sections: landingSections(content, now),
    tickets,
    artists: content.artists,
    buyable: content.events.filter((e) => canBuy(e)).map((e) => e.id),
    social: socialLinks(content),
    ticketsIsland: tickets.featured?.islandId ?? commonIslandId(content.events, now),
  };
}
