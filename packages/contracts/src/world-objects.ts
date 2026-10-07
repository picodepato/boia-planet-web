import { z } from 'zod';

/**
 * Objetos nuevos del mundo creados en el Admin sin código (plan 017 T190,
 * REQ-ADM-010 a REQ-ADM-012) y sus plantillas. Aquí va sólo la forma del
 * dato que se guarda; lo que un comportamiento admite (sus parámetros y
 * rangos seguros) lo comprueba `@boia/world` al componer el mundo, y la web
 * (`apps/web/lib/admin/objects.ts`) traduce un objeto a un lugar del mapa.
 *
 * Un objeto nuevo es como cualquier lugar: id estable, categoría (que sólo
 * aporta valores por defecto), arte, posición, geometría, comportamientos,
 * parámetros y enlaces (evento, logro, premio o destino). En borrador no sale
 * en el mar; publicado, sí, en todos los mundos.
 */

const finite = z.number().finite();

/** Id de un objeto nuevo: un id de lugar (minúsculas, dígitos, «-», «_»). */
export const worldObjectIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9_-]{0,79}$/, 'id: minúsculas, dígitos, «-» o «_»');

/** Un comportamiento del catálogo de `@boia/world` con sus parámetros. */
export const objectBehaviorSchema = z.object({
  type: z.string().min(1).max(40),
  params: z.record(z.string(), z.unknown()).default({}),
});
export type ObjectBehavior = z.infer<typeof objectBehaviorSchema>;

/** Formatos de archivo que admite un asset subido (REQ-ADM-012). */
export const OBJECT_ASSET_TYPES = [
  'image/png',
  'image/webp',
  'image/jpeg',
  'model/gltf-binary',
] as const;
export type ObjectAssetType = (typeof OBJECT_ASSET_TYPES)[number];

/** Un archivo guardado de un asset: el original o una variante optimizada. */
export const assetFileSchema = z.object({
  /** Dónde está: `local-photo:<clave>` en este navegador, o una URL https. */
  ref: z.string().min(1).max(300),
  type: z.enum(OBJECT_ASSET_TYPES),
  bytes: z.number().int().nonnegative(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
export type AssetFile = z.infer<typeof assetFileSchema>;

/**
 * El arte de un objeto: un id de la biblioteca (`placeholder:<forma>` mientras
 * no hay arte propio) o un archivo subido y validado, del que se guarda el
 * original y sus variantes optimizadas.
 */
export const objectAssetSchema = z.object({
  /** Lo que pinta el objeto: el id de la biblioteca o la variante principal. */
  ref: z.string().min(1).max(300),
  /** Nombre del archivo subido, tal cual. */
  fileName: z.string().min(1).max(200).optional(),
  original: assetFileSchema.optional(),
  variants: z.array(assetFileSchema).max(4).default([]),
});
export type ObjectAsset = z.infer<typeof objectAssetSchema>;

const point = z.object({ x: finite, y: finite });

/** Lo que una plantilla conserva de un objeto: todo menos id, nombre y posición. */
export const objectSpecSchema = z.object({
  category: z.string().min(1).max(40),
  asset: objectAssetSchema,
  scale: finite.positive().max(10).default(1),
  /** Radio de la huella que choca o activa (u del mapa). */
  hitbox: finite.positive().max(2000).optional(),
  /** `collision`: el casco choca con ella; `activation`: se atraviesa y activa. */
  hitboxKind: z.enum(['collision', 'activation']).default('collision'),
  /** Radio en el que se activa al acercarse (u del mapa). */
  proximityRadius: finite.positive().max(2000).optional(),
  zone: z.string().min(1).max(40).optional(),
  /** Punto seguro: donde vuelve el barco si se queda atrapado junto al objeto. */
  safePoint: point.optional(),
  behaviors: z.array(objectBehaviorSchema).max(12).default([]),
  /** Parámetros del lugar (los que lee el motor por fuera de los comportamientos). */
  params: z.record(z.string(), z.unknown()).default({}),
  /** Textos del panel del objeto, por clave (`kicker`, `body`). */
  texts: z.record(z.string(), z.string().max(400)).default({}),
  /** Lo que se asocia al objeto (paso 8): cada uno se vuelve un comportamiento. */
  links: z
    .object({
      eventId: z.string().min(1).max(80).optional(),
      achievementTrigger: z.string().min(1).max(80).optional(),
      reward: z
        .object({
          kind: z.enum(['coins', 'points']),
          amount: z.number().int().min(1).max(10000),
        })
        .optional(),
      destination: point.optional(),
    })
    .default({}),
});
export type ObjectSpec = z.infer<typeof objectSpecSchema>;
export type ObjectSpecInput = z.input<typeof objectSpecSchema>;

export const OBJECT_STATUSES = ['draft', 'published'] as const;
export type ObjectStatus = (typeof OBJECT_STATUSES)[number];

/** Un objeto nuevo del mundo, con su estado (borrador o publicado). */
export const worldObjectSchema = objectSpecSchema.extend({
  id: worldObjectIdSchema,
  name: z.string().trim().min(1).max(80),
  x: finite,
  y: finite,
  status: z.enum(OBJECT_STATUSES).default('draft'),
  /** La plantilla de la que salió, si salió de una. */
  templateId: z.string().min(1).max(80).optional(),
  sample: z.boolean().default(false),
});
export type WorldObjectRecord = z.infer<typeof worldObjectSchema>;
export type WorldObjectRecordInput = z.input<typeof worldObjectSchema>;

/**
 * Una plantilla (REQ-ADM-011): un objeto sin id ni posición que conserva
 * comportamientos y parámetros. Las de serie las pone la web; éstas son las
 * que guarda o duplica el Admin.
 */
export const objectTemplateSchema = z.object({
  id: worldObjectIdSchema,
  name: z.string().trim().min(1).max(80),
  spec: objectSpecSchema,
  /** De qué plantilla u objeto sale (si es una copia). */
  from: z.string().min(1).max(80).optional(),
  sample: z.boolean().default(false),
});
export type ObjectTemplate = z.infer<typeof objectTemplateSchema>;
export type ObjectTemplateInput = z.input<typeof objectTemplateSchema>;
