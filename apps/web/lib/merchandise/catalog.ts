import type { MerchandiseCatalogData, MerchandiseProduct } from '@boia/contracts';
import data from './products.json' with { type: 'json' };

/** Concept photos only. No stock, price or online purchase is implied. */
export const MERCHANDISE_PATH = '/tienda';
export const MERCHANDISE_NOTICE = 'Solo se vende en mano en la fiesta';
export const MERCHANDISE_SAMPLE_NOTICE =
  'Fotos y diseños de muestra. Los productos finales pueden cambiar.';

/**
 * Products and their rotating images (T201). The list lives in
 * `products.json` so images can be repointed without code; its shape is
 * `merchandiseCatalogSchema` (checked by `catalog.test.ts`, not here: no zod
 * in the landing's critical path).
 */
const catalog = data as MerchandiseCatalogData;
export const MERCHANDISE_PRODUCTS: readonly MerchandiseProduct[] = catalog.products;
/** Where buyers ask for a product (decision 11). */
export const MERCHANDISE_CONTACT = catalog.contact;
