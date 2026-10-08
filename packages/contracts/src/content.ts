import { z } from 'zod';
import { eventSchema, imageRefSchema } from './events';
import { homeBlocksSchema } from './home-blocks';

/** Personas detrás del sonido (v14 §18, REQ-COM-027, REQ-COM-028). */
export const artistSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  genres: z.array(z.string().min(1)).min(1),
  /**
   * Foto (P17), también la del Carnet del artista. Sin foto aprobada, avatar
   * neutro. Las de Álvaro van en `/contenido/artistas/<id>.webp`
   * (docs/contenido-real.md, plan 007 T82); también vale una URL https.
   */
  photoUrl: imageRefSchema.optional(),
  /** The artist on Spotify: a plain link, nothing loaded from Spotify (plan 007 T79). */
  spotifyUrl: z.url().optional(),
});
export type Artist = z.infer<typeof artistSchema>;

/**
 * Una foto subida en el Admin de la demo (plan 017 T189, decisión 4): el
 * archivo se queda en este navegador (IndexedDB) y la foto lo nombra con
 * `local-photo:<clave>`. Con cuentas, la foto es una URL https del bucket.
 */
export const LOCAL_PHOTO_PREFIX = 'local-photo:';
export const localPhotoRefSchema = z.string().regex(/^local-photo:[A-Za-z0-9_-]{1,120}$/);

export function isLocalPhotoRef(src: string | undefined | null): src is string {
  return typeof src === 'string' && src.startsWith(LOCAL_PHOTO_PREFIX);
}

/** La clave del archivo en el navegador de una referencia `local-photo:`. */
export function localPhotoKey(src: string): string {
  return src.slice(LOCAL_PHOTO_PREFIX.length);
}

/**
 * Dónde está un archivo de la galería: URL (https o del bucket), un archivo
 * de este navegador (`local-photo:`) o una ruta propia (`/api/art/…`, los
 * clips de muestra de plan 019 T216).
 */
export const mediaRefSchema = z.union([
  localPhotoRefSchema,
  z.url().refine((u) => !u.startsWith(LOCAL_PHOTO_PREFIX)),
  z.string().regex(/^\/(?!\/)\S+$/),
]);

/** Qué es una pieza de la Galería (plan 019 T216, decisión 8): foto o clip de vídeo mudo. */
export const MEDIA_KINDS = ['image', 'video'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

/**
 * Pieza de un álbum: una foto o un clip corto (mp4, siempre sin sonido). El
 * texto alternativo es obligatorio (REQ-COM-031). Un clip lleva su póster
 * (un fotograma), que es lo que se ve mientras no se reproduce.
 */
export const photoSchema = z.object({
  id: z.string().min(1),
  albumId: z.string().min(1),
  alt: z.string().min(1),
  /** Foto (sin decir, foto) o clip. */
  kind: z.enum(MEDIA_KINDS).optional(),
  /** La imagen o el clip. */
  src: mediaRefSchema.optional(),
  /** El póster de un clip (una imagen). */
  poster: mediaRefSchema.optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  /**
   * Selección de Álvaro (D-23, respuesta 6): la home enseña sólo estas; el
   * resto se ve en la Galería (`/galeria`, REQ-COM-031).
   */
  selection: z.boolean().default(false),
});
export type Photo = z.infer<typeof photoSchema>;

/** Álbum de fotos y vídeos, opcionalmente ligado a un evento (REQ-COM-001, REQ-ADM-019). */
export const albumSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  eventId: z.string().optional(),
  /**
   * Isla del álbum si no es de un evento («Tardes en la cala»). Si es de un
   * evento, su galería es la de la isla del evento (REQ-COM-031).
   */
  islandId: z.string().optional(),
  /** Fecha del álbum en ISO 8601 con zona. */
  date: z.iso.datetime({ offset: true }).optional(),
  coverPhotoId: z.string().optional(),
  sample: z.boolean().default(false),
});
export type Album = z.infer<typeof albumSchema>;

/**
 * El álbum de un evento (T189): uno por evento, con id estable, al que el
 * Admin sube las fotos de la isla cuando el evento pasa a recuerdo.
 */
export function eventAlbumId(eventId: string): string {
  return `album-${eventId}`;
}

/** Las fotos de un evento: las de sus álbumes (`album.eventId`), en su orden. */
export function eventPhotos(
  eventId: string,
  albums: readonly Album[],
  photos: readonly Photo[],
): Photo[] {
  const ids = new Set(albums.filter((a) => a.eventId === eventId).map((a) => a.id));
  return photos.filter((p) => ids.has(p.albumId));
}

/**
 * Descuento compartible (REQ-COM-020 a REQ-COM-022). Se esconde en el mundo
 * (restos, tesoros, náufragos) por su id; el hallazgo se premia una vez
 * (REQ-COM-021) y el código caducado se muestra como tal.
 */
export const discountSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  /** Texto corto: «-10 % en el All Day de primavera». */
  label: z.string().min(1),
  eventId: z.string().optional(),
  kind: z.enum(['percent', 'amount']),
  /** Porcentaje (1–100) o importe en céntimos. */
  value: z.number().int().positive(),
  startsAt: z.iso.datetime({ offset: true }).optional(),
  endsAt: z.iso.datetime({ offset: true }).optional(),
  conditions: z.string().optional(),
  /** Enlace del producto o de la tienda (un descuento de tienda lo valida la tienda, O8). */
  url: z.url().optional(),
  /**
   * Para qué vale (REQ-COM-020, O8): `event` descuenta entradas (de `eventId`
   * o, sin él, de cualquier evento) y lleva «Ir a la isla»; `store` es de la
   * tienda externa: se copia y lleva «Ir a la tienda», nunca se aplica a una
   * entrada.
   */
  scope: z.enum(['event', 'store']).default('event'),
  /**
   * Prioridad (REQ-COM-020): si varios valen para la misma compra, se aplica
   * el de prioridad más alta y, a igual prioridad, el que más descuenta.
   */
  priority: z.number().int().min(0).max(100).default(0),
  /**
   * Lugar del mapa compartido donde se esconde (id estable, D-20): el Admin lo
   * elige y el lugar pasa a entregar este código (REQ-COM-020). Sin él, sólo
   * lo entregan los lugares que ya lo nombran en el mapa.
   */
  hiddenAt: z.string().min(1).optional(),
  sample: z.boolean().default(false),
});
export type Discount = z.infer<typeof discountSchema>;
export type DiscountInput = z.input<typeof discountSchema>;

export type DiscountStatus = 'upcoming' | 'active' | 'expired';

/**
 * Estado de un código encontrado en «Mis códigos» (REQ-COM-021, D-23):
 * `used` si ya se aplicó en una compra (uno por visitante en la versión de
 * prueba); si no, su vigencia.
 */
export type FoundDiscountState = DiscountStatus | 'used';

export function foundDiscountState(found: {
  status: DiscountStatus;
  usedAt: string | null;
}): FoundDiscountState {
  return found.usedAt ? 'used' : found.status;
}

/** Vigencia de un descuento en `now` (REQ-COM-021: los caducados se marcan). */
export function discountStatus(discount: Discount, now: Date): DiscountStatus {
  const t = now.getTime();
  if (discount.startsAt && t < new Date(discount.startsAt).getTime()) return 'upcoming';
  if (discount.endsAt && t >= new Date(discount.endsAt).getTime()) return 'expired';
  return 'active';
}

export const promotionSchema = z.object({
  id: z.string().min(1),
  eventId: z.string().optional(),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  published: z.boolean(),
});
export type Promotion = z.infer<typeof promotionSchema>;

/** Todo lo que la home necesita para pintarse. Lo publicado, no borradores. */
export const homeContentSchema = z.object({
  blocks: homeBlocksSchema,
  events: z.array(eventSchema),
  artists: z.array(artistSchema),
  photos: z.array(photoSchema),
  /**
   * Álbumes (T189): ligan las fotos a su evento o isla, para los recuerdos
   * de cada isla del mar. Opcional: la home no los usa.
   */
  albums: z.array(albumSchema).optional(),
  promotions: z.array(promotionSchema),
});
export type HomeContent = z.infer<typeof homeContentSchema>;
export type HomeContentInput = z.input<typeof homeContentSchema>;

/** ¿Hay alguna promoción publicada y vigente? (REQ-ENT-028) */
export function hasActivePromotion(promotions: readonly Promotion[], now: Date): boolean {
  const t = now.getTime();
  return promotions.some(
    (p) => p.published && new Date(p.startsAt).getTime() <= t && t < new Date(p.endsAt).getTime(),
  );
}
