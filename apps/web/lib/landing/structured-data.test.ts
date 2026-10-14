import { describe, expect, it } from 'vitest';
import { SAMPLE_CONTENT } from './sample-content';
import {
  eventStructuredData,
  homeStructuredData,
  jsonLdString,
  offerAvailability,
} from './structured-data';

const NOW = new Date('2026-10-14T12:00:00+02:00');
const graph = (now = NOW) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  homeStructuredData(SAMPLE_CONTENT, now)['@graph'] as Record<string, any>[];
const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/;

describe('homeStructuredData', () => {
  it('Organization, WebSite y un MusicEvent por evento próximo, sin pasados ni borradores', () => {
    const g = graph();
    expect(g.map((n) => n['@type'])).toEqual([
      'Organization',
      'WebSite',
      'MusicEvent',
      'MusicEvent',
      'MusicEvent',
    ]);
    expect(g.slice(2).map((e) => e.name)).toEqual([
      'HALLOWEEN IN THE CLUB',
      'ALL DAY BOIA',
      'BOIA Nochevieja',
    ]);
  });

  it('fechas ISO con offset, URLs absolutas y organizador', () => {
    const g = graph();
    for (const e of g.slice(2)) {
      expect(e.startDate).toMatch(ISO);
      if (e.endDate) expect(e.endDate).toMatch(ISO);
      expect(e.url).toMatch(/^https:\/\/boiaplanet\.net\/eventos\//);
      expect(e.image).toMatch(/^https:\/\/boiaplanet\.net\/og\/eventos\/.+\.png$/);
      expect(e.location['@type']).toBe('Place');
      expect(e.location.address['@type']).toBe('PostalAddress');
      expect(e.organizer).toEqual({ '@id': g[0]?.['@id'] });
      expect(e.offers.url).toMatch(/^https:\/\/boiaplanet\.net\//);
      // Los precios de la muestra son de muestra (D-06): no se publican.
      expect(e.offers.price).toBeUndefined();
      expect(e.offers.priceCurrency).toBeUndefined();
      expect(e.offers.availability).toBe('https://schema.org/InStock');
    }
  });

  it('un precio real sí sale; las fechas en UTC se pasan a la hora de Madrid', () => {
    const ev = {
      ...SAMPLE_CONTENT.events[0]!,
      priceSample: false,
      priceCents: 1250,
      boxOfficeOnly: undefined,
      startsAt: '2026-10-31T22:00:00Z',
      endsAt: '2027-07-01T20:00:00.000Z',
    };
    const g = homeStructuredData({ ...SAMPLE_CONTENT, events: [ev] }, NOW)['@graph'] as Record<
      string,
      any // eslint-disable-line @typescript-eslint/no-explicit-any
    >[];
    const e = g[2]!;
    expect(e.offers).toMatchObject({ price: '12.50', priceCurrency: 'EUR' });
    expect(e.startDate).toBe('2026-10-31T23:00:00+01:00');
    expect(e.endDate).toBe('2027-07-01T22:00:00+02:00');
  });

  it('la ficha de un evento lleva su propio MusicEvent, con el organizador dentro', () => {
    const ev = SAMPLE_CONTENT.events.find((e) => e.state === 'on_sale')!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ld = eventStructuredData(ev, SAMPLE_CONTENT) as Record<string, any>;
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('MusicEvent');
    expect(ld.name).toBe(ev.name);
    expect(ld.startDate).toMatch(ISO);
    expect(ld.organizer).toMatchObject({ '@type': 'Organization', name: 'BOIA' });
    expect(ld.image).toBe(`https://boiaplanet.net/og/eventos/${ev.slug}.png`);
    expect(eventStructuredData({ ...ev, state: 'finished' }, SAMPLE_CONTENT)).toBeNull();
    expect(eventStructuredData({ ...ev, state: 'draft' }, SAMPLE_CONTENT)).toBeNull();
  });

  it('no publica la ubicación secreta ni enlaces sandbox', () => {
    const json = jsonLdString(homeStructuredData(SAMPLE_CONTENT, NOW));
    expect(json).not.toMatch(/secret|example\.com/i);
  });

  it('pasado el evento, ya no sale', () => {
    const names = graph(new Date('2027-01-05T12:00:00+01:00')).map((n) => n.name);
    expect(names).not.toContain('BOIA Nochevieja');
  });

  it('la disponibilidad sale de un solo punto', () => {
    const ev = SAMPLE_CONTENT.events[0]!;
    expect(offerAvailability(ev)).toBe('https://schema.org/InStock');
    expect(offerAvailability({ ...ev, state: 'sold_out' })).toBe('https://schema.org/SoldOut');
  });

  it('el JSON no se puede cerrar con </script>', () => {
    expect(jsonLdString({ a: '</script>' })).not.toContain('</script>');
  });
});
