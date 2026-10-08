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
/** Where buyers ask for a product (decision 11): the default when the Admin sets none. */
export const MERCHANDISE_CONTACT = catalog.contact;

export type MerchandiseContact = MerchandiseCatalogData['contact'];

/** «20 €», «4,50 €»: the price of a product, from its cents (decision 9). */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/**
 * The contact «Comprar» shows (plan 017 T192): the one the Admin set on the
 * home's store block, or `products.json`'s when it set none.
 */
export function merchandiseContact(
  store?: { contact?: MerchandiseContact | undefined } | null,
): MerchandiseContact {
  return store?.contact ?? MERCHANDISE_CONTACT;
}
