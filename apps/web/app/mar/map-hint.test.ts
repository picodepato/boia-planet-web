import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { t } from '../../lib/i18n';
import {
  MAP_HINT_MS,
  type MapHintEvent,
  type MapHintTimers,
  mapHintReducer,
  scheduleMapHint,
} from './map-hint';
import { MapHintView } from './map-hint-view';

/** Lo que pasa con la pista en una secuencia de eventos, desde que empieza cerrada. */
const run = (events: MapHintEvent[]): boolean[] => {
  let visible = false;
  return events.map((e) => {
    visible = mapHintReducer(visible, e);
    return visible;
  });
};

/** Un reloj de prueba: avanza a mano y dispara lo que toca. */
function fakeClock() {
  let now = 0;
  let next = 1;
  const due = new Map<number, { at: number; fn: () => void }>();
  const timers: MapHintTimers = {
    set: (fn, ms) => {
      const id = next++;
      due.set(id, { at: now + ms, fn });
      return id;
    },
    clear: (id) => {
      due.delete(id);
    },
  };
  const advance = (ms: number) => {
    now += ms;
    for (const [id, d] of [...due]) {
      if (d.at <= now) {
        due.delete(id);
        d.fn();
      }
    }
  };
  return { timers, advance, pending: () => due.size };
}

/** La pista como la lleva la pantalla: el reducer y su efecto al abrir o cerrar el mapa. */
function screen() {
  const clock = fakeClock();
  let hint = false;
  let mapOpen = false;
  let cancel = () => {};
  const send = (e: MapHintEvent) => {
    hint = mapHintReducer(hint, e);
  };
  const setMap = (open: boolean) => {
    if (open === mapOpen) return;
    cancel();
    mapOpen = open;
    cancel = scheduleMapHint(open, send, clock.timers);
  };
  return {
    clock,
    send,
    setMap,
    get hint() {
      return hint;
    },
    get mapOpen() {
      return mapOpen;
    },
  };
}

describe('la pista del mapa (T275)', () => {
  it('sale al abrir el mapa y se va sola a los 2,5 s, con el mapa abierto', () => {
    expect(MAP_HINT_MS).toBe(2500);
    expect(run(['map-opened', 'timeout'])).toEqual([true, false]);
  });

  it('se va al tocarla, sin cerrar el mapa', () => {
    expect(run(['map-opened', 'tap'])).toEqual([true, false]);
  });

  it('sale una vez por apertura: al volver a abrir el mapa, otra vez', () => {
    expect(run(['map-opened', 'timeout', 'map-closed', 'map-opened', 'timeout'])).toEqual([
      true,
      false,
      false,
      true,
      false,
    ]);
  });

  it('no vuelve si se abre una ficha mientras sale', () => {
    expect(run(['map-opened', 'sheet-opened'])).toEqual([true, false]);
  });
});

describe('la pista del mapa con su reloj (T275)', () => {
  it('desaparece a los 2,5 s y el mapa sigue abierto', () => {
    const s = screen();
    s.setMap(true);
    expect(s.hint).toBe(true);
    s.clock.advance(MAP_HINT_MS - 1);
    expect(s.hint).toBe(true);
    s.clock.advance(1);
    expect(s.hint).toBe(false);
    expect(s.mapOpen).toBe(true);
    // No vuelve sola mientras el mapa siga abierto.
    s.clock.advance(MAP_HINT_MS * 4);
    expect(s.hint).toBe(false);
  });

  it('tocarla la quita y no deja nada programado que la traiga', () => {
    const s = screen();
    s.setMap(true);
    s.send('tap');
    expect(s.hint).toBe(false);
    s.clock.advance(MAP_HINT_MS);
    expect(s.hint).toBe(false);
    expect(s.mapOpen).toBe(true);
  });

  it('cerrar el mapa antes de tiempo cancela su salida; al reabrirlo, sale otra vez entera', () => {
    const s = screen();
    s.setMap(true);
    s.clock.advance(1000);
    s.setMap(false);
    expect(s.hint).toBe(false);
    expect(s.clock.pending()).toBe(0);
    s.setMap(true);
    s.clock.advance(MAP_HINT_MS - 1);
    expect(s.hint).toBe(true);
    s.clock.advance(1);
    expect(s.hint).toBe(false);
  });
});

describe('la pista y el «Cerrar» del mapa en pantalla (T275)', () => {
  const render = (hint: boolean) =>
    renderToStaticMarkup(
      createElement(MapHintView, { hint, onHint: () => {}, onClose: () => {} }),
    );

  it('son dos botones separados: la pista no lleva el «Cerrar»', () => {
    const html = render(true);
    const hint = html.match(/<button[^>]*data-testid="mar-mapa-pista"[^>]*>(.*?)<\/button>/);
    expect(hint).not.toBeNull();
    expect(hint![1]).toContain(t('mar.client.tocaUnaIslaPara'));
    expect(hint![1]).not.toContain(t('mar.client.cerrarMapa'));
    expect(hint![1]).not.toContain('mar-mapa-cerrar');
    const close = html.match(/<button([^>]*data-testid="mar-mapa-cerrar"[^>]*)>(.*?)<\/button>/);
    // T280: un botón pequeño con una ✕ dibujada; su nombre va en `aria-label`.
    expect(close![1]).toContain(`aria-label="${t('mar.client.cerrarMapa')}"`);
    expect(close![2]).toMatch(/^<svg[^>]*aria-hidden="true"/);
  });

  it('sin la pista, el «Cerrar» del mapa sigue', () => {
    const html = render(false);
    expect(html).not.toContain('mar-mapa-pista');
    expect(html).not.toContain(t('mar.client.tocaUnaIslaPara'));
    expect(html).toContain('data-testid="mar-mapa-cerrar"');
  });
});
