'use client';

import type { HomeContent } from '@boia/contracts';
import { useLiveHome } from '../landing/use-live-home';
import { type MerchandiseContact, merchandiseContact } from './catalog';
import { MerchandiseCatalog } from './catalog-view';

interface StoreView {
  products: readonly string[];
  contact: MerchandiseContact;
}

const storeView = (content: HomeContent): StoreView => {
  const store = content.blocks.find((b) => b.type === 'store');
  return store?.type === 'store'
    ? { products: store.products, contact: merchandiseContact(store) }
    : { products: [], contact: merchandiseContact(null) };
};

/** Follow the same local Admin content as the home, without a purchase or account gate. */
export function LiveMerchandiseCatalog({ initial }: { initial: StoreView }) {
  const { view } = useLiveHome(initial, storeView);
  return <MerchandiseCatalog products={view.products} contact={view.contact} />;
}
