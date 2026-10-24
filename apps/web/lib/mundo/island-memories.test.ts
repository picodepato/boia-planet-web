import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { islandMemoryGalleries } from '../admin/world';
import { EVENTS_PATH, photosHref } from '../landing/eventos';
import type { BoiaRepository } from '@boia/store';
import { liveContent, refreshLiveContent, resetLiveContentForTests } from '../landing/live-content';
import { SAMPLE_CONTENT } from '../landing/sample-content';
import { IslandMemories, IslandUpcoming } from './place-panels';

/**
 * REQ-AVE-014, recuerdos y próximos eventos en la isla: el panel de una isla
 * enseña sus fiestas pasadas como recuerdo, con fotos o sin ellas, y ninguna
 * tarjeta enlaza a comprar entradas de una fiesta que ya pasó. Se mira con el
 * contenido de muestra en una fecha en la que todas sus fiestas han pasado.
 */

const islands = [
  ...new Set(SAMPLE_CONTENT.events.flatMap((e) => (e.islandId ? [e.islandId] : []))),
];
const last = Math.max(...SAMPLE_CONTENT.events.map((e) => Date.parse(e.startsAt)));
const AFTER_ALL = new Date(last + 30 * 24 * 3600 * 1000);
// Only the anchors: React also emits <link rel="preload" href=…> for a real poster image.
/**
 * La muestra ya no trae fotos de eventos (plan 048 T328: sólo el álbum real,
 * sin evento): una fiesta con isla recibe un álbum con una foto real.
 */
const remembered = SAMPLE_CONTENT.events.find((e) => e.islandId)!;
const WITH_ALBUM = {
  ...SAMPLE_CONTENT,
  albums: [
    ...(SAMPLE_CONTENT.albums ?? []),
    { id: 'album-recuerdo', title: 'Recuerdo', date: remembered.startsAt, eventId: remembered.id },
  ],
  photos: [{ ...SAMPLE_CONTENT.photos[0]!, albumId: 'album-recuerdo' }, ...SAMPLE_CONTENT.photos],
};
const hrefs = (html: string) => [...html.matchAll(/<a\s[^>]*?href="([^"]+)"/g)].map((m) => m[1]!);

afterEach(() => {
  vi.useRealTimers();
  resetLiveContentForTests();
});

describe('recuerdos y próximos eventos en la isla (REQ-AVE-014)', () => {
  it('con y sin fotos: cada fiesta pasada sale como recuerdo y ninguna tarjeta enlaza a sus entradas', async () => {
    await refreshLiveContent({
      content: { home: async () => WITH_ALBUM },
    } as unknown as BoiaRepository);
    vi.useFakeTimers();
    vi.setSystemTime(AFTER_ALL);
    const memories = islands.flatMap((id) =>
      islandMemoryGalleries(id, liveContent(AFTER_ALL), AFTER_ALL).map((m) => ({
        island: id,
        ...m,
      })),
    );
    const withPhotos = memories.find((m) => m.photos.length > 0);
    const without = memories.find((m) => m.photos.length === 0);
    expect(withPhotos, 'un recuerdo con fotos').toBeDefined();
    expect(without, 'un recuerdo sin fotos').toBeDefined();

    for (const m of [withPhotos!, without!]) {
      const html = renderToStaticMarkup(createElement(IslandMemories, { placeId: m.island }));
      expect(html).toContain(`data-evento="${m.event.id}"`);
      expect(html.includes(`recuerdo-fotos-${m.event.id}`)).toBe(m.photos.length > 0);
      // Sólo la página del evento (sin compra, ya terminado) o la galería de fotos.
      for (const href of hrefs(html)) {
        expect(href.startsWith(`${EVENTS_PATH}/`) || href.startsWith(photosHref()), href).toBe(
          true,
        );
      }
      expect(html).not.toMatch(/comprar|checkout|ticket/i);
      // Y «Próximos eventos» no ofrece fiestas que ya pasaron.
      expect(renderToStaticMarkup(createElement(IslandUpcoming, { islandId: m.island }))).toBe('');
    }
  });
});
