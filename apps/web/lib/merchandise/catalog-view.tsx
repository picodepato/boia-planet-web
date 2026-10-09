import type { MerchandiseProduct } from '@boia/contracts';
import { t } from '../landing/texts';
import {
  MERCHANDISE_CONTACT,
  MERCHANDISE_PRODUCTS,
  MERCHANDISE_SAMPLE_NOTICE,
  formatPrice,
  type MerchandiseContact,
} from './catalog';
import { ProductGallery } from './product-gallery';
import './merchandise.css';

/** What «Comprar» says for each case (2026-10-08, decision 9). */
function BuyMessage({
  sale,
  contact,
}: {
  sale: MerchandiseProduct['sale'];
  contact: MerchandiseContact;
}) {
  // Plan 020 T227 (decision 5): what is sold in hand can also be reserved on Instagram.
  return (
    <p className="merchandise__buy-message" data-testid="merchandise-buy-message">
      {sale === 'party' ? (
        <>
          {t('store.buy.party')} {t('store.buy.party.reserve')}
        </>
      ) : (
        t('store.buy.reserve')
      )}{' '}
      <a
        className="merchandise__dm"
        href={contact.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('store.buy.instagram.aria', { handle: contact.handle })}
        data-testid="merchandise-dm"
      >
        {t('store.buy.reserve.cta', { handle: contact.handle })}
      </a>
    </p>
  );
}

/**
 * The store for the home and /tienda (T214, after noartmusic.com): the
 * products only, each with its photo, name and price. «Comprar» is a
 * disclosure, not a checkout (decision 9): it explains whether the product
 * is sold only at the party or, out of stock, is reserved by an Instagram DM
 * (the contact the Admin set, plan 017 T192) and brought to the next event;
 * the party-only ones also point to that DM to reserve (plan 020 T227).
 * It works without JavaScript.
 */
export function MerchandiseCatalog({
  products,
  contact = MERCHANDISE_CONTACT,
}: {
  products?: readonly string[];
  contact?: MerchandiseContact;
}) {
  const names = products ?? MERCHANDISE_PRODUCTS.map((p) => p.name);
  return (
    <div className="merchandise" data-testid="merchandise-catalog">
      <p className="merchandise__sample">{MERCHANDISE_SAMPLE_NOTICE}</p>
      <ul className="merchandise__grid">
        {names.map((name) => {
          const product = MERCHANDISE_PRODUCTS.find((p) => p.name === name);
          const sale = product?.sale ?? 'party';
          return (
            <li key={name} className="merchandise__card" data-sale={sale}>
              {product ? <ProductGallery product={product} /> : null}
              <div className="merchandise__copy">
                <h3 className="merchandise__name">{name}</h3>
                {product?.maker ? (
                  <p className="merchandise__maker" data-testid={`merchandise-maker-${product.id}`}>
                    {t('store.maker.prefix')} {product.maker}
                  </p>
                ) : null}
                {product ? (
                  <p className="merchandise__price" data-testid={`merchandise-price-${product.id}`}>
                    {formatPrice(product.priceCents)}
                  </p>
                ) : null}
                <p className="merchandise__sale">{t(`store.sale.${sale}`)}</p>
                <details className="merchandise__buy" data-testid="merchandise-buy">
                  <summary
                    className="button merchandise__buy-button"
                    aria-label={t('store.buy.aria', { name })}
                  >
                    {t('store.buy')}
                  </summary>
                  <BuyMessage sale={sale} contact={contact} />
                </details>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
