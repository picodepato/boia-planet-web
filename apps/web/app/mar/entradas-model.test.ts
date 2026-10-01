import { type BoiaEvent, type HomeContent, canBuy, effectiveEvents } from '@boia/contracts';
import { describe, expect, it } from 'vitest';
import { resolveTicketsPanel } from '../../lib/landing/resolve';
import { SAMPLE_CONTENT } from '../../lib/landing/sample-content';
import { worldTickets } from './entradas-model';

/**
 * «Entradas» dentro del mar 3D (T58): el panel «Elige tu evento» enseña lo
 * mismo que el de la landing, con 0, 1 o 3 eventos a la venta, y cada uno
 * con su isla en el mapa si la tiene.
 */

const DAY = 24 * 3600 * 1000;
const at = (e: BoiaEvent) => Date.parse(e.startsAt);
// Un evento de la muestra que se vende la víspera: el molde de los de la prueba.
const template = SAMPLE_CONTENT.events.find((e) =>
  canBuy(effectiveEvents([e], new Date(at(e) - DAY))[0]!),
)!;
const NOW = new Date(at(template) - DAY);

/** Copias del molde, días después, todas a la venta en NOW. */
function onSale(n: number): BoiaEvent[] {
  const shift = (iso: string | undefined, k: number) =>
    iso ? new Date(Date.parse(iso) + k * DAY).toISOString() : iso;
  return Array.from({ length: n }, (_, k) => ({
    ...template,
    id: `${template.id}-t58-${k}`,
    slug: `${template.slug}-t58-${k}`,
    startsAt: shift(template.startsAt, k)!,
    ...(template.endsAt ? { endsAt: shift(template.endsAt, k)! } : {}),
  }));
}

const contentWith = (events: BoiaEvent[]): HomeContent => ({
  ...SAMPLE_CONTENT,
  events: effectiveEvents(events, NOW),
});

const islandOf = (id: string) => (id.endsWith('-0') ? 'isla-uno' : null);

describe('el panel de Entradas del mar (REQ-ENT-037)', () => {
  it('la muestra tiene un evento que se vende', () => {
    expect(template).toBeDefined();
  });

  it('con 0 eventos a la venta: sin entradas que inventar', () => {
    const view = worldTickets(contentWith([]), NOW, islandOf);
    expect(view.entries).toEqual([]);
    expect(view.onSale).toBe(false);
  });

  it('con 1 evento a la venta: ése, comprable y con su isla', () => {
    const [only] = onSale(1);
    const view = worldTickets(contentWith([only!]), NOW, islandOf);
    expect(view.onSale).toBe(true);
    expect(view.entries.map((x) => x.event.id)).toEqual([only!.id]);
    expect(view.entries[0]!.buyable).toBe(true);
    expect(view.entries[0]!.placeId).toBe('isla-uno');
  });

  it('con 3 eventos a la venta: los tres, como el panel de la landing', () => {
    const three = onSale(3);
    const content = contentWith(three);
    const view = worldTickets(content, NOW, islandOf);
    const landing = resolveTicketsPanel(content, NOW);
    expect(view.entries.map((x) => x.event.id)).toEqual(
      [landing.featured, ...landing.others].filter(Boolean).map((e) => e!.id),
    );
    expect(new Set(view.entries.map((x) => x.event.id))).toEqual(new Set(three.map((e) => e.id)));
    expect(view.entries.filter((x) => x.featured).length).toBeLessThanOrEqual(1);
    expect(view.entries.every((x) => x.buyable)).toBe(true);
    expect(view.entries.filter((x) => x.placeId).map((x) => x.event.id)).toEqual([three[0]!.id]);
  });

  it('con la muestra: los mismos eventos que el panel de Tickets de la landing', () => {
    const content = { ...SAMPLE_CONTENT, events: effectiveEvents(SAMPLE_CONTENT.events, NOW) };
    const landing = resolveTicketsPanel(content, NOW);
    const view = worldTickets(content, NOW, () => null);
    expect(view.onSale).toBe(landing.onSale);
    expect(view.entries.map((x) => x.event.id)).toEqual(
      [landing.featured, ...landing.others].filter(Boolean).map((e) => e!.id),
    );
  });
});
