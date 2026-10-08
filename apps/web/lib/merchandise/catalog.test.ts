import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { merchandiseCatalogSchema } from '@boia/contracts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { t } from '../landing/texts';
import { MERCHANDISE_CONTACT, MERCHANDISE_PRODUCTS, formatPrice } from './catalog';
import { MerchandiseCatalog } from './catalog-view';
import data from './products.json' with { type: 'json' };
import { nextImageIndex } from './rotation';

const PUBLIC = join(__dirname, '../../public');

describe('store products (plan 017 T201, decision 11)', () => {
  it('products.json follows the contract', () => {
    expect(merchandiseCatalogSchema.safeParse(data).success).toBe(true);
  });

  it('every product has its image alone, another angle and on a model, all present as WebP', () => {
    for (const product of MERCHANDISE_PRODUCTS) {
      expect(product.images.length).toBeGreaterThanOrEqual(3);
      expect(product.images[0]!.kind).toBe('alone');
      for (const kind of ['alone', 'angle', 'model'] as const) {
        expect(product.images.some((i) => i.kind === kind)).toBe(true);
      }
      for (const image of product.images) {
        expect(image.src).toMatch(/\.webp$/);
        expect(existsSync(join(PUBLIC, image.src))).toBe(true);
      }
      expect(new Set(product.images.map((i) => i.src)).size).toBe(product.images.length);
    }
  });

  it('buyers are sent to BOIA on Instagram (decision 9 of 2026-10-08)', () => {
    expect(MERCHANDISE_CONTACT).toEqual({
      handle: '@boia.planet',
      url: 'https://www.instagram.com/boia.planet/',
    });
  });

  it('the store has the 3 products, each with its price and its «Comprar» case (decision 9)', () => {
    expect(MERCHANDISE_PRODUCTS).toHaveLength(3);
    for (const p of MERCHANDISE_PRODUCTS) {
      expect(Number.isInteger(p.priceCents)).toBe(true);
      expect(['party', 'reserve']).toContain(p.sale);
    }
    // Both cases are on show in the sample.
    expect(new Set(MERCHANDISE_PRODUCTS.map((p) => p.sale))).toEqual(new Set(['party', 'reserve']));
    // Intl puts a no-break space before the euro sign.
    expect(formatPrice(2000).replace(/\s/g, ' ')).toBe('20 €');
    expect(formatPrice(450).replace(/\s/g, ' ')).toBe('4,50 €');
  });

  it('rotation goes through every image and back to the first', () => {
    expect(nextImageIndex(0, 3)).toBe(1);
    expect(nextImageIndex(2, 3)).toBe(0);
    expect(nextImageIndex(0, 0)).toBe(0);
  });

  it('renders every image lazily, the first one visible, name, price and the message of each case', () => {
    const html = renderToStaticMarkup(createElement(MerchandiseCatalog, {}));
    const imgs = html.match(/<img [^>]*>/g) ?? [];
    const total = MERCHANDISE_PRODUCTS.reduce((n, p) => n + p.images.length, 0);
    expect(imgs).toHaveLength(total);
    for (const img of imgs) expect(img).toContain('loading="lazy"');
    expect(imgs.filter((img) => img.includes('is-active'))).toHaveLength(
      MERCHANDISE_PRODUCTS.length,
    );
    // Without JavaScript there is no button: «Comprar» is a disclosure.
    expect(html).not.toContain('<button');
    expect(html).toContain('<details');
    const count = (s: string) => html.split(s).length - 1;
    const party = MERCHANDISE_PRODUCTS.filter((p) => p.sale === 'party').length;
    const reserve = MERCHANDISE_PRODUCTS.length - party;
    expect(count(t('store.buy.party'))).toBe(party);
    expect(count(t('store.buy.reserve'))).toBe(reserve);
    // Only the reservations link to the Instagram DM.
    expect(count(`href="${MERCHANDISE_CONTACT.url}"`)).toBe(reserve);
    for (const p of MERCHANDISE_PRODUCTS) {
      expect(html).toContain(`>${p.name}</h3>`);
      expect(html).toContain(`>${formatPrice(p.priceCents)}</p>`);
    }
  });

  it('the placeholder sample files stay marked as muestra', () => {
    const readme = readFileSync(join(PUBLIC, 'contenido/tienda/README.md'), 'utf8');
    for (const product of MERCHANDISE_PRODUCTS) {
      for (const image of product.images) {
        expect(image.src).toContain('muestra');
        expect(readme).toContain(image.src.split('/').pop()!);
      }
    }
  });
});
