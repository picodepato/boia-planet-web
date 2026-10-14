import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CARNET_NEWS_ACCOUNTS, CarnetRequired } from './checkout';
import { CHECKOUT_COPY } from './copy';

/**
 * El aviso de antes de comprar sin Carnet (plan 030 T288): dice claro que sin
 * Carnet no se entra en la fiesta; con cuentas, que al crearlo se pueden
 * aceptar las noticias por email; en modo local, el alta rápida sin email.
 */
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'");
const render = (accounts: boolean) =>
  renderToStaticMarkup(createElement(CarnetRequired, { accounts }));

describe('aviso «Necesitas el Carnet BOIA»', () => {
  it('dice que el Carnet es obligatorio para entrar', () => {
    for (const accounts of [false, true]) {
      const html = render(accounts);
      expect(html).toContain('data-testid="checkout-carnet-requerido"');
      expect(html).toContain('data-testid="checkout-carnet-entrar"');
      expect(text(html)).toContain(CHECKOUT_COPY.carnet.requiredTitle);
      expect(text(html)).toContain(CHECKOUT_COPY.carnet.requiredEnter);
    }
    expect(CHECKOUT_COPY.carnet.requiredEnter).toMatch(/obligatorio para entrar/i);
  });

  it('con cuentas habla de las noticias si las aceptas; sin cuentas, del alta sin email', () => {
    const accounts = text(render(true));
    expect(accounts).toContain(CARNET_NEWS_ACCOUNTS);
    expect(CARNET_NEWS_ACCOUNTS).toMatch(/próximas fiestas/);
    expect(accounts).not.toContain(CHECKOUT_COPY.carnet.requiredBody);
    const local = text(render(false));
    expect(local).toContain(CHECKOUT_COPY.carnet.requiredBody);
    expect(local).not.toContain(CARNET_NEWS_ACCOUNTS);
  });
});
