import { MERCHANDISE_PRODUCTS, MERCHANDISE_SAMPLE_NOTICE } from './catalog';
import './merchandise.css';

/** Shared sample showcase for the home and Ibiza's internal shop. */
export function MerchandiseCatalog({ products }: { products?: readonly string[] }) {
  const names = products ?? MERCHANDISE_PRODUCTS.map((p) => p.name);
  return (
    <div className="merchandise" data-testid="merchandise-catalog">
      <p className="merchandise__sample">{MERCHANDISE_SAMPLE_NOTICE}</p>
      <ul className="merchandise__grid">
        {names.map((name) => {
          const product = MERCHANDISE_PRODUCTS.find((p) => p.name === name);
          return (
            <li key={name} className="merchandise__card">
              {product ? (
                // Local compressed samples, deliberately deferred below the landing's critical content.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.image}
                  alt={product.alt}
                  width={800}
                  height={800}
                  loading="lazy"
                  decoding="async"
                />
              ) : null}
              <div className="merchandise__copy">
                <span className="merchandise__badge">Muestra</span>
                <h3>{name}</h3>
                {product ? <p>{product.description}</p> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
