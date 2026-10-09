import { z } from 'zod';

/**
 * Store products (decision 11 of plan 017, T201). Each product shows an
 * ordered list of images that the store rotates: the product alone, other
 * angles, and worn by a model. The list is data (`apps/web/lib/merchandise/
 * products.json`), so repointing an image never touches code. Nothing is sold
 * online: pressing buy shows how to get one at the party.
 */
export const productImageKindSchema = z.enum(['alone', 'angle', 'model']);
export type ProductImageKind = z.infer<typeof productImageKindSchema>;

export const productImageSchema = z.object({
  /** Path under `public/` (or an absolute URL). */
  src: z.string().min(1),
  kind: productImageKindSchema,
  alt: z.string().min(1),
});
export type ProductImage = z.infer<typeof productImageSchema>;

export const merchandiseProductSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  /** Who makes it, shown under the name («Hecha a mano por …»). Optional. */
  maker: z.string().min(1).optional(),
  description: z.string().min(1),
  /** Price in whole euro cents (2026-10-08, decision 9). */
  priceCents: z.number().int().nonnegative(),
  /**
   * What «Comprar» explains (decision 9): `party`, sold only by hand at the
   * party; `reserve`, out of stock, reserved by an Instagram DM and brought
   * to the next event.
   */
  sale: z.enum(['party', 'reserve']),
  /** Rotation order; the first one is what shows without JavaScript. */
  images: z.array(productImageSchema).min(1),
});
export type MerchandiseProduct = z.infer<typeof merchandiseProductSchema>;

export const merchandiseCatalogSchema = z.object({
  /** Where to ask for a product (decision 11: Instagram). */
  contact: z.object({ handle: z.string().min(1), url: z.url() }),
  products: z.array(merchandiseProductSchema).min(1),
});
export type MerchandiseCatalogData = z.infer<typeof merchandiseCatalogSchema>;
