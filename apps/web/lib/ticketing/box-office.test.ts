import { canBuy, doorPriceCents, eventSchema, EVENT_STATES } from '@boia/contracts';
import { HALLOWEEN_EVENT_ID, SAMPLE_DISCOUNTS } from '@boia/store';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SAMPLE_CONTENT } from '../landing/sample-content';
import { CARNET_CREATE_HREF } from '../landing/access';
import { t } from '../i18n/web';
import { BuyButton } from '../../app/(landing)/components/buy-button';
import { BoxOfficeDialog, boxOfficeLabel } from './box-office';

/**
 * «Solo en puerta» (plan 019 T215, decisiones 1 y 6): sin venta online; la
 * entrada se paga en la puerta y hace falta el Carnet BOIA. La regla vieja
 * (T199, «-2 € con Carnet») se fue.
 */

const events = SAMPLE_CONTENT.events;
const puerta = events.filter((e) => e.boxOfficeOnly);
const message = t('ticketing.boxOffice.message');
const euros = (cents: number) =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(cents / 100);

describe('Solo en puerta (decisión 6)', () => {
  it('sólo Halloween es de puerta, y dice «Solo en puerta · 5 € con carnet»', () => {
    expect(puerta.map((e) => e.id)).toEqual([HALLOWEEN_EVENT_ID]);
    const halloween = puerta[0]!;
    expect(eventSchema.parse(halloween).boxOfficeOnly).toEqual(halloween.boxOfficeOnly);
    const cents = doorPriceCents(halloween)!;
    expect(boxOfficeLabel(halloween)).toBe(t('ticketing.boxOffice.label', { euros: euros(cents) }));
    expect(boxOfficeLabel(halloween)).toBe('Solo en puerta · 5 € con carnet');
  });

  it('el precio en puerta es el suyo o, sin él, el del evento; sin ninguno, no se dice', () => {
    const base = { priceCents: 1200 };
    expect(doorPriceCents({ ...base, boxOfficeOnly: { doorPriceCents: 700 } })).toBe(700);
    expect(doorPriceCents({ ...base, boxOfficeOnly: {} })).toBe(1200);
    expect(doorPriceCents({ ...base, boxOfficeOnly: undefined })).toBeUndefined();
    expect(boxOfficeLabel({ boxOfficeOnly: {}, priceCents: undefined })).toBe(
      t('ticketing.boxOffice.labelNoPrice'),
    );
    // Un evento guardado con la regla vieja de T199 sigue siendo de puerta.
    const old = eventSchema.parse({ ...puerta[0], boxOfficeOnly: { carnetDiscountCents: 200 } });
    expect(old.boxOfficeOnly).toEqual({});
  });

  it('de puerta no necesita ticketera y sigue respetando los estados', () => {
    for (const state of EVENT_STATES) {
      expect(canBuy({ ...puerta[0]!, state, ticketUrl: undefined })).toBe(state === 'on_sale');
    }
    expect(canBuy({ ...puerta[0]!, boxOfficeOnly: undefined, ticketUrl: undefined })).toBe(false);
    expect(
      eventSchema.safeParse({ ...puerta[0], boxOfficeOnly: { doorPriceCents: -200 } }).success,
    ).toBe(false);
  });

  it('antes de hidratar muestra el aviso desplegable y el Carnet, sin enlace a la ticketera', () => {
    for (const e of puerta) {
      const html = renderToStaticMarkup(
        createElement(BuyButton, {
          eventId: e.id,
          eventName: e.name,
          ticketUrl: e.ticketUrl,
          boxOfficeOnly: e.boxOfficeOnly,
          priceCents: e.priceCents,
          source: 'tickets_panel',
        }),
      );
      expect(html).toContain('<details');
      expect(html).toContain(boxOfficeLabel(e));
      expect(html).toContain(message);
      expect(html).toContain(t('ticketing.boxOffice.carnet'));
      expect(html).toContain(`href="${CARNET_CREATE_HREF}"`);
      if (e.ticketUrl) expect(html).not.toContain(`href="${e.ticketUrl}"`);
    }
  });

  it('el diálogo del mar tiene el mismo mensaje y botón al Carnet, sin checkout', () => {
    const html = renderToStaticMarkup(
      createElement(BoxOfficeDialog, {
        eventName: puerta[0]!.name,
        event: puerta[0]!,
        carnet: { onOpen: () => {} },
        onClose: () => {},
        className: 'checkout--mar',
      }),
    );
    expect(html).toContain(boxOfficeLabel(puerta[0]!));
    expect(html).toContain(message);
    expect(html).toContain('data-testid="box-office-carnet"');
    expect(html).not.toContain('checkout-confirmar');
  });

  it('ningún código de descuento apunta a un evento de puerta (no se podría canjear online)', () => {
    const ids = new Set(puerta.map((e) => e.id));
    expect(SAMPLE_DISCOUNTS.filter((d) => d.eventId && ids.has(d.eventId))).toEqual([]);
  });

  it('los demás eventos conservan su enlace de checkout', () => {
    for (const e of events.filter((e) => !e.boxOfficeOnly && canBuy(e))) {
      const html = renderToStaticMarkup(
        createElement(BuyButton, {
          eventId: e.id,
          eventName: e.name,
          ticketUrl: e.ticketUrl,
          source: 'tickets_panel',
        }),
      );
      expect(html).toContain(`href="${e.ticketUrl}"`);
      expect(html).not.toContain('box-office-message');
    }
  });
});
