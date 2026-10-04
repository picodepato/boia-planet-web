import { HARBOR_PLACE_ID, HARBOR_REF, WORLD_REGISTRY } from '@boia/world';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { t } from '../../lib/i18n';
import { upcomingEvents } from '../../lib/mundo/place-panels';
import { IslandBlock, Sheet, type SheetState } from './sheet';

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
