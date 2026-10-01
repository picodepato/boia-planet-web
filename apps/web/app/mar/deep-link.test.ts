import { describe, expect, it } from 'vitest';
import { CARNET_FROM_LANDING } from '../(landing)/components/buy-button';
import { CARNET_CREATE_HREF, PHOTOS_SAIL_HREF, ticketsSailHref } from '../../lib/landing/access';
import { voyageHref } from '../../lib/mundo/autopilot';
import { MAR_CARNET_HREF, MAR_PATH, eventSailHref } from '../../lib/world-handoff';
import { MAR_PANELS, hasMarLinks, marPanel, readMarLinks, withoutMarLinks } from './deep-link';

/**
 * Enlaces profundos de /mar (T55): lo que piden la landing, las fichas de
 * evento, el Carnet y las tarjetas de descuento llega al mar 3D y se quita de
 * la URL al consumirse.
 */

const searchOf = (href: string) => new URL(href, 'http://x').search;

describe('readMarLinks', () => {
  it('los enlaces de la landing van a /mar y el mar los entiende', () => {
    for (const href of [PHOTOS_SAIL_HREF, ticketsSailHref('allday', 'ev'), CARNET_CREATE_HREF]) {
      expect(new URL(href, 'http://x').pathname).toBe(MAR_PATH);
      expect(hasMarLinks(readMarLinks(searchOf(href))), href).toBe(true);
    }
    expect(readMarLinks(searchOf(ticketsSailHref('allday', 'ev')))).toEqual({
      sail: { placeId: 'allday', eventId: 'ev' },
      menu: null,
    });
    expect(readMarLinks(searchOf(CARNET_CREATE_HREF))).toEqual({ sail: null, menu: 'carnet' });
    expect(CARNET_CREATE_HREF).toBe(MAR_CARNET_HREF);
    // «Ver Mi Carnet» tras la compra de prueba de la landing.
    expect(CARNET_FROM_LANDING).toBe(MAR_CARNET_HREF);
  });

  it('`?evento=` sin lugar es el viaje a la isla del evento (también «Ir a la isla»)', () => {
    for (const href of [eventSailHref('ev x'), voyageHref('ev x')]) {
      expect(readMarLinks(searchOf(href)).sail).toEqual({ eventId: 'ev x' });
    }
  });

  it('sin enlaces, nada que consumir', () => {
    const links = readMarLinks('?mundo=acuarela&cerca=fotos');
    expect(links).toEqual({ sail: null, menu: null });
    expect(hasMarLinks(links)).toBe(false);
  });
});

describe('marPanel', () => {
  it('los paneles del mar y los nombres del Menú del 2D', () => {
    for (const p of MAR_PANELS) expect(marPanel(p)).toBe(p);
    expect(marPanel('welcome')).toBe('bienvenida');
    expect(marPanel('Ajustes')).toBe('ajustes');
    expect(marPanel('ranking')).toBeNull();
    expect(marPanel(null)).toBeNull();
  });
});

describe('withoutMarLinks', () => {
  it('quita los enlaces y deja lo demás', () => {
    expect(withoutMarLinks('/mar?ir=fotos&evento=e&menu=carnet&piloto=1&mundo=acuarela#x')).toBe(
      '/mar?mundo=acuarela#x',
    );
    expect(withoutMarLinks('/mar?menu=carnet')).toBe('/mar');
  });
});
