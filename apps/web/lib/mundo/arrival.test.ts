import { WORLD_REGISTRY, type WorldObject } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { PHOTOS_PLACE_ID, STORE_PLACE_ID } from '../landing/access';
import { MAR_PATH, placeHref, readPlaceRequest, withoutPlaceRequest } from '../world-handoff';
import { ARRIVAL_HEADING, approachPoint, arrivalPoint, planArrival } from './arrival';

/**
 * Llegar a un lugar sin conducir (T44, REQ-ENT-034, REQ-AVE-022): los
 * accesos de la landing llevan a los lugares del mapa compartido, en todos
 * los mundos, al punto seguro fuera de sus radios, con su panel.
 */

type Params = Record<string, unknown>;
const contentOf = (o: WorldObject) =>
  o.behaviors.find((b) => b.type === 'content')?.params as Params | undefined;
const reach = (o: WorldObject) =>
  Math.max(
    o.geometry.proximityRadius ?? 0,
    o.geometry.activation?.radius ?? 0,
    o.geometry.collision?.radius ?? 0,
  );

const worlds = WORLD_REGISTRY.ids().map((id) => WORLD_REGISTRY.get(id));
const everyEvent = () => true;

describe('llegada a un lugar con ?ir= (REQ-ENT-034)', () => {
  for (const w of worlds) {
    const objects = w.config.objects;

    it(`${w.id}: Fotos llega al Puerto de Fotos y abre su galería`, () => {
      const photos = objects.find((o) => o.identity.id === PHOTOS_PLACE_ID)!;
      expect(contentOf(photos)?.target).toBe('photos');
      const plan = planArrival(objects, { placeId: PHOTOS_PLACE_ID }, everyEvent)!;
      expect(plan.panel).toMatchObject({
        kind: 'place',
        objectId: PHOTOS_PLACE_ID,
        target: 'photos',
      });
    });

    it(`${w.id}: Tienda llega a la isla tienda y abre su escaparate`, () => {
      const plan = planArrival(objects, { placeId: STORE_PLACE_ID }, everyEvent)!;
      expect(plan.panel).toMatchObject({ kind: 'place', target: 'store' });
    });

    it(`${w.id}: una isla de evento abre el evento pedido o, si no existe, el suyo`, () => {
      const island = objects.find((o) => contentOf(o)?.target === 'event')!;
      const own = contentOf(island)!.ref as string;
      const asked = planArrival(
        objects,
        { placeId: island.identity.id, eventId: 'otro' },
        () => true,
      );
      expect(asked?.panel).toEqual({
        kind: 'event',
        objectId: island.identity.id,
        eventId: 'otro',
      });
      const fallback = planArrival(
        objects,
        { placeId: island.identity.id, eventId: 'no-existe' },
        (id) => id === own,
      );
      expect(fallback?.panel).toEqual({
        kind: 'event',
        objectId: island.identity.id,
        eventId: own,
      });
    });

    it(`${w.id}: el punto seguro queda fuera de todos los radios (sin premios, REQ-ENT-039)`, () => {
      for (const id of [PHOTOS_PLACE_ID, STORE_PLACE_ID]) {
        const o = objects.find((x) => x.identity.id === id)!;
        const p = approachPoint(o);
        expect(Math.hypot(p.x - o.position.x, p.y - o.position.y)).toBeGreaterThan(reach(o));
      }
    });
  }

  it('un lugar que no existe no mueve el barco', () => {
    expect(planArrival(worlds[0]!.config.objects, { placeId: 'no-existe' }, everyEvent)).toBeNull();
  });

  it('la llegada empieza lejos y acaba en el punto seguro, mirando al lugar', () => {
    const plan = planArrival(worlds[0]!.config.objects, { placeId: PHOTOS_PLACE_ID }, everyEvent)!;
    expect(arrivalPoint(plan, 0)).toEqual(plan.from);
    expect(arrivalPoint(plan, 1)).toEqual(plan.to);
    expect(plan.heading).toBe(ARRIVAL_HEADING);
    expect(Math.hypot(plan.from.x - plan.to.x, plan.from.y - plan.to.y)).toBeGreaterThan(0);
  });
});

describe('enlace «abrir el mar en un lugar»', () => {
  it('ida y vuelta, y se quita de la URL al llegar', () => {
    const href = placeHref('allday', { eventId: 'halloween-2026' });
    const url = new URL(href, 'http://x');
    expect(url.pathname).toBe(MAR_PATH);
    expect(readPlaceRequest(url.search)).toEqual({ placeId: 'allday', eventId: 'halloween-2026' });
    expect(readPlaceRequest('?mundo=acuarela')).toBeNull();
    expect(withoutPlaceRequest(`${href}&mundo=acuarela`)).toBe(`${MAR_PATH}?mundo=acuarela`);
  });
});
