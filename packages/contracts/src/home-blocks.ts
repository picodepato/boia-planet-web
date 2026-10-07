import { z } from 'zod';

/**
 * Bloques de la home (REQ-ENT-030, REQ-ENT-033). El Admin (REQ-ADM-017) los
 * ordena, activa, oculta y programa sin tocar código ni borrar eventos: la
 * lista es dato. El contenido (eventos, artistas, fotos) vive en sus propias
 * colecciones; un bloque sólo guarda su configuración.
 */
export const HOME_BLOCK_TYPES = [
  'hero',
  'priority_event',
  'upcoming_events',
  'artists',
  'philosophy',
  'photos',
  'store',
  'contact',
  'footer',
] as const;

export const homeBlockTypeSchema = z.enum(HOME_BLOCK_TYPES);
export type HomeBlockType = z.infer<typeof homeBlockTypeSchema>;

const blockBase = {
  id: z.string().min(1),
  /** Mostrar u ocultar sin borrar. */
  visible: z.boolean(),
  /** Programación opcional: ISO 8601 con zona. Fuera de la ventana no se muestra. */
  showFrom: z.iso.datetime({ offset: true }).optional(),
  showUntil: z.iso.datetime({ offset: true }).optional(),
};

const link = z.object({ label: z.string().min(1), url: z.url() });
export type ExternalLink = z.infer<typeof link>;

export const heroBlockSchema = z.object({
  ...blockBase,
  type: z.literal('hero'),
  title: z.string().min(1),
  /** Frase de posicionamiento [pendiente Álvaro]. */
  positioning: z.string().min(1),
});

export const priorityEventBlockSchema = z.object({
  ...blockBase,
  type: z.literal('priority_event'),
  /** Evento elegido por el Admin; si no está vigente se resuelve otro (REQ-COM-009). */
  eventId: z.string().optional(),
});

export const upcomingEventsBlockSchema = z.object({
  ...blockBase,
  type: z.literal('upcoming_events'),
  limit: z.number().int().positive().default(6),
  /** Exclusión manual que no borra el evento (REQ-COM-011). */
  excludeEventIds: z.array(z.string()).default([]),
});

export const artistsBlockSchema = z.object({
  ...blockBase,
  type: z.literal('artists'),
  /** 5 s (D-07, REQ-COM-026). */
  rotationMs: z.number().int().min(1000).default(5000),
  intro: z.string().optional(),
});

export const philosophyBlockSchema = z.object({
  ...blockBase,
  type: z.literal('philosophy'),
  /** Versión breve del manifiesto [pendiente Álvaro] (REQ-COM-030). */
  paragraphs: z.array(z.string().min(1)),
  verbs: z.array(z.object({ verb: z.string().min(1), text: z.string().min(1) })),
});

export const photosBlockSchema = z.object({
  ...blockBase,
  type: z.literal('photos'),
  albumId: z.string().optional(),
  limit: z.number().int().positive().default(6),
});

export const storeBlockSchema = z.object({
  ...blockBase,
  type: z.literal('store'),
  /** Internal showcase; retain old external values when reading existing content. */
  url: z.union([z.url(), z.literal('/tienda')]),
  products: z.array(z.string().min(1)),
  /**
   * Where buyers ask for a product (plan 017 T192, decision 11): the handle
   * and its link in «Comprar». Unset: the one in the web's products.json.
   */
  contact: z.object({ handle: z.string().min(1), url: z.url() }).optional(),
});

export const contactBlockSchema = z.object({
  ...blockBase,
  type: z.literal('contact'),
  email: z.email().optional(),
  links: z.array(link),
});

export const footerBlockSchema = z.object({
  ...blockBase,
  type: z.literal('footer'),
  officialLinks: z.array(link),
});

export const homeBlockSchema = z.discriminatedUnion('type', [
  heroBlockSchema,
  priorityEventBlockSchema,
  upcomingEventsBlockSchema,
  artistsBlockSchema,
  philosophyBlockSchema,
  photosBlockSchema,
  storeBlockSchema,
  contactBlockSchema,
  footerBlockSchema,
]);

export type HomeBlock = z.infer<typeof homeBlockSchema>;
export type HomeBlockOf<T extends HomeBlockType> = Extract<HomeBlock, { type: T }>;

export const homeBlocksSchema = z.array(homeBlockSchema).superRefine((blocks, ctx) => {
  const seen = new Set<string>();
  for (const [i, b] of blocks.entries()) {
    if (seen.has(b.id))
      ctx.addIssue({ code: 'custom', message: `id repetido: ${b.id}`, path: [i] });
    seen.add(b.id);
  }
});

/** ¿El bloque está activo y dentro de su ventana de programación? */
export function isBlockScheduled(block: HomeBlock, now: Date): boolean {
  if (!block.visible) return false;
  const t = now.getTime();
  if (block.showFrom && new Date(block.showFrom).getTime() > t) return false;
  if (block.showUntil && new Date(block.showUntil).getTime() <= t) return false;
  return true;
}
