import type { GuestListApi, GuestListStatus } from '@boia/store';
import { HALLOWEEN_EVENT_ID, SONIDO_EVENT_ID } from '@boia/store';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { BuyButton } from '../../app/(landing)/components/buy-button';
import { SAMPLE_CONTENT } from '../landing/sample-content';
import {
  CARNET_PATH,
  OPEN_PARAM,
  RETURN_PARAM,
  returnHere,
  returnPath,
  signupUrl,
  wantsCreate,
} from '../scanner/carnet-url';
import { liveListEvent, resolveLiveList, takeOpen, type LiveListDeps } from './live';
import { inListMode, listEventOf, listNotice } from './model';
import { tl } from './t';

/**
 * La lista según el Admin (plan 034 T311): con cuentas manda el estado vivo
 * (`status()`), con el contenido sólo como lo primero que se pinta y lo de la
 * demo; y la vuelta a la lista (o la compra) tras sacarse el Carnet en /carnet.
 */

const events = SAMPLE_CONTENT.events;
const halloween = listEventOf(events.find((e) => e.id === HALLOWEEN_EVENT_ID)!);
const sonido = listEventOf(events.find((e) => e.id === SONIDO_EVENT_ID)!);
const LATER = '2026-10-31T23:45:00+01:00';

function status(over: Partial<GuestListStatus> = {}): GuestListStatus {
  return {
    event: halloween.slug,
    enabled: true,
    cap: 40,
    closesAt: LATER,
    open: true,
    pastClosing: false,
    closed: false,
    full: false,
    mine: null,
    ...over,
  };
}

function deps(s: GuestListStatus | Error, over: Partial<LiveListDeps> = {}): LiveListDeps {
  const api = {
    status: vi.fn(async () => {
      if (s instanceof Error) throw s;
      return s;
    }),
  } as unknown as GuestListApi;
  return {
    accounts: true,
    client: async () => api,
    events: async () => [halloween, sonido],
    ...over,
  };
}

function button(eventId: string, guestList: ReturnType<typeof liveListEvent> | undefined) {
  return renderToStaticMarkup(
    createElement(BuyButton, {
      eventId,
      eventName: eventId,
      ticketUrl: undefined,
      guestList: guestList ?? undefined,
      source: 'tickets_panel',
    }),
  );
}

describe('la lista en vivo manda sobre el contenido', () => {
  it('la muestra: Halloween va en lista por el contenido; Sonido, no', () => {
    expect(inListMode(halloween)).toBe(true);
    expect(inListMode(sonido)).toBe(false);
  });

  it('el Admin la pone en lista: «Apuntarse en la lista» con su hora de cierre', () => {
    const live = liveListEvent(sonido, status({ closesAt: LATER }))!;
    expect(inListMode(live)).toBe(true);
    expect(live.guestList?.closesAt).toBe(LATER);
    expect(live.guestList?.cap).toBe(40);
    const html = button(sonido.id, live);
    expect(html).toContain(tl('lista.join'));
    expect(html).toContain(listNotice(LATER, sonido.timeZone)!);
    expect(html).not.toContain(`comprar-${sonido.id}`);
  });

  it('otra hora en el Admin, otra hora en el aviso; sin hora, sin aviso', () => {
    const moved = liveListEvent(halloween, status({ closesAt: LATER }))!;
    expect(moved.guestList?.closesAt).toBe(LATER);
    expect(moved.guestList?.closesAt).not.toBe(halloween.guestList?.closesAt);
    expect(button(halloween.id, moved)).toContain(tl('lista.notice', { time: '23:45' }));
    const none = liveListEvent(halloween, status({ closesAt: null, cap: null }))!;
    expect(none.guestList?.closesAt).toBeUndefined();
    expect(none.guestList?.cap).toBe(halloween.guestList?.cap);
    expect(button(halloween.id, none)).not.toContain(
      listNotice(halloween.guestList!.closesAt, halloween.timeZone)!,
    );
  });

  it('el Admin la quita de la lista: vuelve la compra de siempre', () => {
    expect(liveListEvent(halloween, status({ enabled: false }))).toBeNull();
    const html = button(halloween.id, null);
    expect(html).toContain(`comprar-${halloween.id}`);
    expect(html).not.toContain(tl('lista.join'));
  });

  it('con cuentas, resolveLiveList pide el estado de esa fiesta', async () => {
    const on = deps(status({ event: sonido.slug }));
    const live = await resolveLiveList(sonido.id, on);
    expect(live && inListMode(live)).toBe(true);
    expect((await on.client())!.status).toHaveBeenCalledWith(sonido.id);
    expect(await resolveLiveList(halloween.id, deps(status({ enabled: false })))).toBeNull();
    const closed = await resolveLiveList(halloween.id, deps(status({ open: false, closed: true })));
    expect(closed?.guestList?.open).toBe(false);
  });

  it('la demo (sin cuentas) se queda con el contenido y no pregunta', async () => {
    const d = deps(status({ enabled: false }), { accounts: false });
    const client = vi.fn(d.client);
    expect(await resolveLiveList(halloween.id, { ...d, client })).toBeUndefined();
    expect(client).not.toHaveBeenCalled();
  });

  it('sin cliente, si falla o si la fiesta no está: se queda el contenido', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await resolveLiveList(halloween.id, deps(status(), { client: async () => null }))).toBe(
      undefined,
    );
    expect(await resolveLiveList(halloween.id, deps(new Error('red')))).toBeUndefined();
    expect(await resolveLiveList('otra', deps(status()))).toBeUndefined();
    warn.mockRestore();
  });
});

describe('volver a la lista tras sacarse el Carnet', () => {
  const ORIGIN = 'https://boiaplanet.net';

  it('el alta lleva la vuelta a esta página con la fiesta abierta', () => {
    const back = returnHere({ pathname: '/eventos/halloween', search: '?x=1' }, halloween.id);
    expect(back).toBe(`/eventos/halloween?x=1&${OPEN_PARAM}=${halloween.id}`);
    const url = new URL(signupUrl(ORIGIN, back));
    expect(url.pathname).toBe(CARNET_PATH);
    expect(wantsCreate(url.search)).toBe(true);
    expect(url.searchParams.get(RETURN_PARAM)).toBe(back);
    expect(returnPath(url.search)).toBe(back);
    // Sin vuelta, el QR de alta de siempre.
    expect(signupUrl(ORIGIN)).toBe(`${ORIGIN}${CARNET_PATH}?crear=1`);
    expect(returnPath(new URL(signupUrl(ORIGIN)).search)).toBeNull();
  });

  it('sólo se vuelve a una ruta de esta web', () => {
    const q = (v: string) => `?${RETURN_PARAM}=${encodeURIComponent(v)}`;
    expect(returnPath(q('/?abrir=x'))).toBe('/?abrir=x');
    for (const bad of ['https://otro.example/', '//otro.example/x', '/\\otro.example', 'x', '']) {
      expect(returnPath(q(bad)), bad).toBeNull();
    }
  });

  it('al volver, la fiesta se abre una sola vez y se quita de la dirección', () => {
    const replaceState = vi.fn();
    const href = `https://boiaplanet.net/eventos/halloween?x=1&${OPEN_PARAM}=${halloween.id}#a`;
    expect(takeOpen(halloween.id, { href }, { replaceState })).toBe(true);
    expect(replaceState).toHaveBeenCalledWith(null, '', '/eventos/halloween?x=1#a');
    expect(takeOpen(sonido.id, { href }, { replaceState })).toBe(false);
    expect(takeOpen(halloween.id, { href: 'https://boiaplanet.net/' }, { replaceState })).toBe(
      false,
    );
    expect(replaceState).toHaveBeenCalledTimes(1);
  });
});
