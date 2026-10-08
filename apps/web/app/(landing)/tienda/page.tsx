import type { Metadata } from 'next';
import Link from 'next/link';
import { t } from '../../../lib/landing/texts';
import { LiveMerchandiseCatalog } from '../../../lib/merchandise/live-catalog';
import { MERCHANDISE_NOTICE, merchandiseContact } from '../../../lib/merchandise/catalog';
import { SAMPLE_CONTENT } from '../../../lib/landing/sample-content';
import { BrandLogo } from '../components/brand-logo';

export const metadata: Metadata = {
  title: `${t('store.page.title')} · BOIA`,
  description: MERCHANDISE_NOTICE,
};

/**
 * The store page (T214): the landing's store on its own sheet, in the same
 * format (decision 9), with the way back to the home or to the sea.
 */
export default async function MerchandisePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const fromSea = (await searchParams).from === 'mar';
  const store = SAMPLE_CONTENT.blocks.find((b) => b.type === 'store');
  return (
    <main id="contenido" className="section merchandise-page" aria-labelledby="merchandise-title">
      <div className="section__inner">
        <nav className="merchandise-page__nav" aria-label={t('store.page.nav')}>
          <Link
            className="merchandise-page__brand"
            href="/?intro=0"
            prefetch={false}
            aria-label={t('store.page.home')}
          >
            <BrandLogo />
          </Link>
          <Link
            className="sheet-more"
            href={fromSea ? '/mar' : '/?intro=0#tienda'}
            prefetch={false}
            data-testid="merchandise-back"
          >
            {fromSea ? t('store.page.backSea') : t('store.page.backHome')}
          </Link>
        </nav>
        <div className="sheet-head">
          <h1 id="merchandise-title" className="section__title sheet-head__title">
            {t('store.page.title')}
          </h1>
        </div>
        <p className="section__lead">{t('store.page.lead')}</p>
        <LiveMerchandiseCatalog
          initial={{
            products: store?.type === 'store' ? store.products : [],
            contact: merchandiseContact(store?.type === 'store' ? store : null),
          }}
        />
      </div>
    </main>
  );
}
