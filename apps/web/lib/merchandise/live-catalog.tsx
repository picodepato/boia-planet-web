'use client';

import type { HomeContent } from '@boia/contracts';
import { useLiveHome } from '../landing/use-live-home';
import { MerchandiseCatalog } from './catalog-view';

const productNames = (content: HomeContent) => {
  const store = content.blocks.find((b) => b.type === 'store');
  return store?.type === 'store' ? store.products : [];
};

/** Follow the same local Admin content as the home, without a purchase or account gate. */
export function LiveMerchandiseCatalog({ initial }: { initial: readonly string[] }) {
  const { view } = useLiveHome(initial, productNames);
  return <MerchandiseCatalog products={view} />;
}
