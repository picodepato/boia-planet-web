import type { Metadata } from 'next';
import Link from 'next/link';
import { LiveMerchandiseCatalog } from '../../../lib/merchandise/live-catalog';
import { MERCHANDISE_NOTICE } from '../../../lib/merchandise/catalog';
import { SAMPLE_CONTENT } from '../../../lib/landing/sample-content';
import { BrandLogo } from '../components/brand-logo';

export const metadata: Metadata = { title: 'Tienda · BOIA', description: MERCHANDISE_NOTICE };

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
        <nav className="merchandise-page__nav" aria-label="Navegación de la tienda">
          <Link
            className="merchandise-page__brand"
            href="/?intro=0"
            prefetch={false}
            aria-label="BOIA, inicio"
          >
            <BrandLogo />
          </Link>
          <Link
            href={fromSea ? '/mar' : '/?intro=0#tienda'}
            prefetch={false}
            data-testid="merchandise-back"
          >
            {fromSea ? 'Volver al mar' : 'Volver a la página principal'}
          </Link>
        </nav>
        <h1 id="merchandise-title" className="section__title">
          Tienda BOIA
        </h1>
        <p className="section__lead">Un poco de la fiesta para llevar.</p>
        <p className="merchandise-notice">{MERCHANDISE_NOTICE}</p>
        <LiveMerchandiseCatalog initial={store?.type === 'store' ? store.products : []} />
      </div>
    </main>
  );
}
