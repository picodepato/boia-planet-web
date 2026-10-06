import {
  BOARD_REF,
  HARBOR_PLACE_ID,
  HARBOR_REF,
  LIGHTHOUSE_PLACE_ID,
  WORLD_REGISTRY,
} from '@boia/world';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { t } from '../../lib/i18n';
import { upcomingEvents } from '../../lib/mundo/place-panels';
import { IslandBlock, Sheet, type SheetState } from './sheet';
import { BOARD_CARDS, boardDestinations } from '../../lib/mundo/board';
import { MarTablon } from './tablon';

/**
 * La ficha del Puerto de Alicante (T108): la de un lugar, con «Cambiar de
 * barco» (abre la tienda «Barco») y sin «Próximos eventos». Las demás islas
 * sin evento siguen igual.
 */

const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config;
const harbor = world.objects.find((o) => o.identity.id === HARBOR_PLACE_ID)!;
const harborContent = harbor.behaviors.find((b) => b.type === 'content')!.params as {
  target: 'info';
  ref: string;
};
const noop = () => {};

function sheet(state: SheetState, onShips?: () => void): string {
  return renderToStaticMarkup(
    createElement(Sheet, {
      state,
      object: harbor,
      distance: null,
      onClose: noop,
      onCourse: noop,
      onPreview: noop,
      onBuy: noop,
      onSteerEvent: () => false,
      onGoToIsland: noop,
      ...(onShips ? { onShips } : {}),
    }),
  );
}

const arrival = (revisit = false): SheetState => ({
  kind: 'content',
  placeId: HARBOR_PLACE_ID,
  target: harborContent.target,
  ref: harborContent.ref,
  ...(revisit ? { revisit: true } : {}),
});

describe('el tablón compacto y la ficha de viaje compartida (T168)', () => {
  it('al llegar sale recogido con la línea y todos los botones, sin explicaciones', () => {
    const html = renderToStaticMarkup(
      createElement(Sheet, {
        state: { kind: 'content', placeId: LIGHTHOUSE_PLACE_ID, target: 'info', ref: BOARD_REF },
        object: world.objects.find((o) => o.identity.id === LIGHTHOUSE_PLACE_ID),
        world,
        distance: null,
        onClose: noop,
        onCourse: noop,
        onPreview: noop,
        onBuy: noop,
        onSteerEvent: () => false,
        onGoToIsland: noop,
      }),
    );
    expect(html).toContain('data-expandida="no"');
    expect(html).toContain(t('mar.tablon.intro'));
    for (const card of BOARD_CARDS) {
      expect(html).toContain(`data-testid="tablon-ir-${card}"`);
      expect(html).not.toContain(t(`mar.tablon.${card}.linea`));
    }
    expect(html).not.toContain('aria-pressed');
  });

  it('desplegado explica cada juego y usa iconos de la familia del menú', () => {
    const html = renderToStaticMarkup(
      createElement(MarTablon, { world, expanded: true, onPreview: noop }),
    );
    for (const card of BOARD_CARDS) {
      expect(html).toContain(t(`mar.tablon.${card}.linea`));
      expect(html).toContain(t(`mar.tablon.${card}.titulo`));
      expect(html).toContain(`data-testid="tablon-ir-${card}"`);
    }
    expect(html).toContain('class="boia-icon');
    expect(html).not.toContain('tablon-rumbo');
  });

  it('cada destino tiene la ficha preview del minimapa con ambos viajes a la vista', () => {
    const destinations = boardDestinations(world.objects);
    for (const card of BOARD_CARDS) {
      const id = destinations[card]!;
      const object = world.objects.find((o) => o.identity.id === id)!;
      const html = renderToStaticMarkup(
        createElement(Sheet, {
          state: { kind: 'preview', placeId: id },
          object,
          world,
          distance: null,
          onClose: noop,
          onCourse: noop,
          onFly: noop,
          onPreview: noop,
          onBuy: noop,
          onSteerEvent: () => false,
          onGoToIsland: noop,
        }),
      );
      expect(html).toContain(`data-lugar="${id}"`);
      expect(html).toContain('data-expandida="no"');
      expect(html).toContain(
        renderToStaticMarkup(
          createElement('h2', { className: 'mar-sheet__title' }, object.identity.name),
        ),
      );
      expect(html).toContain(t('mar.sheet.navegar'));
      expect(html).toContain(t('mar.sheet.irEnNave'));
    }
  });
});

describe('la ficha del Puerto de Alicante', () => {
  it('su contenido es el de un puerto (`info` con la referencia del puerto)', () => {
    expect(harborContent).toMatchObject({ target: 'info', ref: HARBOR_REF });
  });

  it('al llegar: su nombre, «Puerto» y el botón «Cambiar de barco»', () => {
    const html = sheet(arrival(), noop);
    expect(html).toContain(harbor.identity.name);
    expect(html).toContain('data-testid="puerto-barcos"');
    expect(html).toContain(t('mar.sheet.puerto.cambiarBarco'));
    const kicker = (harbor.content?.texts as Record<string, string> | undefined)?.kicker;
    expect(html).toContain(
      t('mar.sheet.puerto.kicker', { v1: kicker ?? t('mar.sheet.puerto.nombre') }),
    );
    expect(html).not.toContain('data-testid="isla-explorar"');
  });

  it('en otra visita, además, «Explorar la isla» (REQ-AVE-013)', () => {
    const html = sheet(arrival(true), noop);
    expect(html).toContain('data-testid="puerto-barcos"');
    expect(html).toContain('data-testid="isla-explorar"');
    // El botón principal es el del barco.
    expect(html.indexOf('puerto-barcos')).toBeLessThan(html.indexOf('isla-explorar'));
  });

  it('sin quien abra la tienda, sin botón; y otra isla `info` no lo lleva', () => {
    expect(sheet(arrival())).not.toContain('puerto-barcos');
    const other: SheetState = { ...arrival(), ref: 'otra-cosa' } as SheetState;
    expect(sheet(other, noop)).not.toContain('puerto-barcos');
  });

  it('desplegada: el botón, sin «Próximos eventos»; una isla cualquiera sí los tiene', () => {
    const props = {
      placeId: HARBOR_PLACE_ID,
      object: harbor,
      revisit: false,
      onSteer: () => false,
    };
    const port = renderToStaticMarkup(
      createElement(IslandBlock, {
        ...props,
        harbor: true,
        actions: createElement('button', { 'data-testid': 'puerto-barcos' }),
      }),
    );
    expect(port).toContain('data-puerto="si"');
    expect(port).toContain('data-testid="puerto-barcos"');
    expect(port).not.toContain('data-testid="panel-proximos"');
    const island = renderToStaticMarkup(createElement(IslandBlock, props));
    expect(island.includes('data-testid="panel-proximos"')).toBe(
      upcomingEvents(HARBOR_PLACE_ID).length > 0,
    );
  });
});
