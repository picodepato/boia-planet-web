import { t } from '../landing/texts';
import {
  MERCHANDISE_CONTACT,
  MERCHANDISE_PRODUCTS,
  MERCHANDISE_SAMPLE_NOTICE,
  type MerchandiseContact,
} from './catalog';
import { ProductGallery } from './product-gallery';
import './merchandise.css';

/**
 * Shared sample showcase for the home and Ibiza's internal shop. «Comprar» is
 * a disclosure, not a checkout (decision 11): it says the products are only
 * sold at the party and points to Instagram (the contact the Admin set, plan
 * 017 T192). It works without JavaScript.
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
          return (
            <li key={name} className="merchandise__card">
              {product ? <ProductGallery product={product} /> : null}
              <div className="merchandise__copy">
                <span className="merchandise__badge">Muestra</span>
                <h3>{name}</h3>
                {product ? <p>{product.description}</p> : null}
                <details className="merchandise__buy" data-testid="merchandise-buy">
                  <summary
                    className="button merchandise__buy-button"
                    aria-label={t('store.buy.aria', { name })}
                  >
                    {t('store.buy')}
                  </summary>
                  <p className="merchandise__buy-message" data-testid="merchandise-buy-message">
                    {t('store.buy.message')}{' '}
                    <a
                      href={contact.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t('store.buy.instagram.aria', {
                        handle: contact.handle,
                      })}
                    >
                      {contact.handle}
                    </a>
                  </p>
                </details>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
