import { z } from 'zod';

/**
 * Los siete estados de un evento (v14 §49.4, REQ-COM-003). El evento y su isla
 * son entidades separadas: `islandId` es opcional y una isla sobrevive a sus
 * eventos (REQ-COM-002).
 */
export const EVENT_STATES = [
  'draft',
  'coming_soon',
  'on_sale',
  'sold_out',
  'postponed',
  'cancelled',
  'finished',
] as const;

export const eventStateSchema = z.enum(EVENT_STATES);
export type EventState = z.infer<typeof eventStateSchema>;

/**
 * Formato (REQ-COM-001, REQ-PRO-006): un All Day BOIA o una activación
 * satélite (§39.2: noches, clubs, previas). Un satélite sin isla propia vive
 * en la localización común (REQ-COM-010, D-23 O7).
 */
export const EVENT_FORMATS = ['all_day', 'satelite'] as const;
export const eventFormatSchema = z.enum(EVENT_FORMATS);
export type EventFormat = z.infer<typeof eventFormatSchema>;

/**
 * De dónde sale el estado (REQ-COM-004). `dates`: las fechas lo mueven solas
 * (próximamente → a la venta → finalizado); `manual`: el Admin lo fija a mano
 * y las fechas no lo tocan.
 */
export const EVENT_STATE_SOURCES = ['dates', 'manual'] as const;
export type EventStateSource = (typeof EVENT_STATE_SOURCES)[number];

/** Una imagen propia (`/…`, en `apps/web/public`) o externa (`https://…`). */
export const imageRefSchema = z.string().regex(/^(https?:\/\/|\/)\S+$/, 'ruta /… o URL https://…');
const isoOffset = z.iso.datetime({ offset: true });

export const eventSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  format: eventFormatSchema,
  /**
   * Serie de la que forma parte (`boia-club`…), con su nombre en las
   * tarjetas (`eventKicker`). Clave estable, no texto libre.
   */
  series: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  /** Inicio en ISO 8601 con zona horaria. */
  startsAt: isoOffset,
  /** Fin; sin él, `startsAt` + `EVENT_DEFAULT_HOURS`. Pasado el fin, finaliza. */
  endsAt: isoOffset.optional(),
  /** Apertura de la venta: antes, «próximamente»; después, «a la venta». */
  saleOpensAt: isoOffset.optional(),
  /** Zona IANA en la que se muestra la fecha. */
  timeZone: z.string().min(1),
  /** Texto público del lugar. Nunca la dirección de una secret location (REQ-COM-013). */
  placeLabel: z.string().min(1),
  /**
   * Estado guardado. Con `stateSource: 'dates'` las fechas deciden entre
   * próximamente, a la venta y finalizado (`eventState`); borrador, agotado,
   * pospuesto y cancelado los pone el Admin.
   */
  state: eventStateSchema,
  stateSource: z.enum(EVENT_STATE_SOURCES).default('dates'),
  description: z.string(),
  artistIds: z.array(z.string()),
  /** Actividades además de la música (comida, mercadillo…). */
  activities: z.array(z.string().min(1)).default([]),
  /**
   * Cartel (P19); sin él se enseña «Cartel próximamente». Los de Álvaro van
   * en `/contenido/carteles/<id>.webp` (docs/contenido-real.md, plan 007 T82).
   */
  posterUrl: imageRefSchema.optional(),
  /**
   * Imagen del sello de la fiesta en el Carnet (T87 «Image stamps», T94): va
   * dentro del tratamiento de sello de goma; sin ella, el sello generado.
   * Con cuentas es la copia propia que guarda el Admin en Supabase Storage
   * (`events.stamp_image_url`); en la demo local, una ruta o URL.
   */
  stampImageUrl: imageRefSchema.optional(),
  /** Precio de una entrada en céntimos (sale de `lib/ticketing/pricing.ts`, T42). */
  priceCents: z.number().int().nonnegative().optional(),
  /** El precio es de muestra hasta que Álvaro lo fije (D-06). */
  priceSample: z.boolean().default(true),
  /** Venta sólo en taquilla y descuento del Carnet, en céntimos. Muestra (T199). */
  boxOfficeOnly: z.object({ carnetDiscountCents: z.number().int().nonnegative() }).optional(),
  /** Enlace a la ticketera (adaptador o sandbox hasta que Álvaro contrate, D-06). */
  ticketUrl: z.url().optional(),
  islandId: z.string().optional(),
  /** Mensaje de pospuesto o cancelado (REQ-COM-008). */
  stateNote: z.string().optional(),
  /** Contenido de ejemplo hasta que Álvaro lo apruebe. */
  sample: z.boolean().default(false),
});
export type BoiaEvent = z.infer<typeof eventSchema>;
export type BoiaEventInput = z.input<typeof eventSchema>;

/**
 * Comportamiento de cada estado en la home y en Tickets (tabla de
 * docs/spec/06-comercial.md). `listed`: aparece en próximos eventos;
 * `purchasable`: muestra compra.
 */
export const EVENT_STATE_BEHAVIOR: Record<EventState, { listed: boolean; purchasable: boolean }> = {
  draft: { listed: false, purchasable: false },
  coming_soon: { listed: true, purchasable: false },
  on_sale: { listed: true, purchasable: true },
  sold_out: { listed: true, purchasable: false },
  postponed: { listed: true, purchasable: false },
  cancelled: { listed: true, purchasable: false },
  finished: { listed: false, purchasable: false },
};

/** Duración supuesta de un evento sin `endsAt`, en horas. `muestra`. */
export const EVENT_DEFAULT_HOURS = 12;

/** Isla de la localización común por defecto: la del All Day (REQ-COM-010, O7). */
export const ALL_DAY_ISLAND_ID = 'allday';

/** Fin del evento en ms. */
export function eventEndMs(e: Pick<BoiaEvent, 'startsAt' | 'endsAt'>): number {
  if (e.endsAt) return new Date(e.endsAt).getTime();
  return new Date(e.startsAt).getTime() + EVENT_DEFAULT_HOURS * 3_600_000;
}

type StateInput = Pick<BoiaEvent, 'state' | 'startsAt' | 'endsAt' | 'saleOpensAt'> & {
  stateSource?: EventStateSource | undefined;
};

/**
 * Estado de un evento en `now` (REQ-COM-004). A mano (`manual`), el guardado
 * tal cual. Por fechas: el borrador y el finalizado a mano se quedan; pasado
 * el fin, finaliza (salvo cancelado o pospuesto, que conservan su aviso);
 * agotado, pospuesto y cancelado no los sabe ninguna fecha; con apertura de
 * venta, antes es «próximamente» y después «a la venta»; sin ella, manda el
 * guardado.
 */
export function eventState(e: StateInput, now: Date): EventState {
  if ((e.stateSource ?? 'dates') === 'manual') return e.state;
  if (e.state === 'draft' || e.state === 'finished') return e.state;
  const t = now.getTime();
  const kept = e.state === 'cancelled' || e.state === 'postponed';
  if (t >= eventEndMs(e)) return kept ? e.state : 'finished';
  if (kept || e.state === 'sold_out') return e.state;
  if (e.saleOpensAt) return t < new Date(e.saleOpensAt).getTime() ? 'coming_soon' : 'on_sale';
  return e.state;
}

/** El evento con su estado de `now`. */
export function withEventState<E extends StateInput>(e: E, now: Date): E {
  const state = eventState(e, now);
  return state === e.state ? e : { ...e, state };
}

/** Todos los eventos con su estado de `now` (lo que ven la home, Tickets y las islas). */
export function effectiveEvents<E extends StateInput>(events: readonly E[], now: Date): E[] {
  return events.map((e) => withEventState(e, now));
}

/**
 * Un evento puede venderse sólo si está a la venta y tiene enlace de ticket.
 * Con `now`, el estado sale de las fechas; sin él, se usa el que trae.
 */
export function canBuy(event: BoiaEvent, now?: Date): boolean {
  const state = now ? eventState(event, now) : event.state;
  return (
    EVENT_STATE_BEHAVIOR[state].purchasable &&
    (event.boxOfficeOnly !== undefined || event.ticketUrl !== undefined)
  );
}

/** Estados que puede tener el evento prioritario: vigente, nunca cancelado ni pasado (REQ-COM-009). */
export function canBePriority(event: BoiaEvent, now: Date): boolean {
  const state = eventState(event, now);
  const vigente =
    state === 'coming_soon' || state === 'on_sale' || state === 'sold_out' || state === 'postponed';
  return vigente && new Date(event.startsAt).getTime() >= startOfDay(now).getTime();
}

/**
 * Próximos eventos para home y Tickets (REQ-COM-011): estado listado en
 * `now`, fecha no pasada, sin los excluidos a mano, ordenados por fecha. Salen
 * con su estado de `now`.
 */
export function upcomingEvents(
  events: readonly BoiaEvent[],
  now: Date,
  excludeIds: readonly string[] = [],
): BoiaEvent[] {
  const from = startOfDay(now).getTime();
  return effectiveEvents(events, now)
    .filter((e) => EVENT_STATE_BEHAVIOR[e.state].listed)
    .filter((e) => new Date(e.startsAt).getTime() >= from)
    .filter((e) => !excludeIds.includes(e.id))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/**
 * Evento prioritario: el elegido si sigue vigente; si no, el primer próximo
 * comprable; si no hay, el primer próximo. Nunca una campaña terminada. Sale
 * con su estado de `now`.
 */
export function resolvePriorityEvent(
  events: readonly BoiaEvent[],
  priorityEventId: string | undefined,
  now: Date,
): BoiaEvent | undefined {
  const chosen = events.find((e) => e.id === priorityEventId);
  if (chosen && canBePriority(chosen, now)) return withEventState(chosen, now);
  const upcoming = upcomingEvents(events, now).filter((e) => canBePriority(e, now));
  return upcoming.find((e) => canBuy(e)) ?? upcoming[0];
}

/** ¿Es un satélite sin isla propia (vive en la localización común)? */
export function isIslandlessSatellite(e: Pick<BoiaEvent, 'format' | 'islandId'>): boolean {
  return e.format === 'satelite' && !e.islandId;
}

/** El próximo All Day vigente (el más cercano), o ninguno. */
export function nextAllDay(events: readonly BoiaEvent[], now: Date): BoiaEvent | undefined {
  return upcomingEvents(events, now).find((e) => e.format === 'all_day' && e.state !== 'cancelled');
}

/**
 * Isla de la localización común de los satélites sin isla (REQ-COM-010, O7):
 * la del próximo All Day, o la isla All Day de siempre si no lo hay.
 */
export function commonIslandId(events: readonly BoiaEvent[], now: Date): string {
  return nextAllDay(events, now)?.islandId ?? ALL_DAY_ISLAND_ID;
}

/**
 * «Próximos eventos» de una isla (REQ-AVE-014, REQ-COM-005, O7): los
 * próximos ligados a ella y, si es la localización común, los satélites sin
 * isla, por fecha y con su estado de `now`. `excludeId` quita el que la isla
 * ya enseña arriba.
 */
export function islandUpcomingEvents(
  islandId: string,
  events: readonly BoiaEvent[],
  now: Date,
  excludeId?: string,
): BoiaEvent[] {
  const common = commonIslandId(events, now) === islandId;
  return upcomingEvents(events, now).filter(
    (e) => e.id !== excludeId && (e.islandId === islandId || (common && isIslandlessSatellite(e))),
  );
}

function startOfDay(d: Date): Date {
  const s = new Date(d.getTime());
  s.setUTCHours(0, 0, 0, 0);
  return s;
}
