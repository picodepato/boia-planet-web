import { canBuy } from '@boia/contracts';
import {
  createLocalGuestList,
  createLocalRepository,
  HALLOWEEN_EVENT_ID,
  HALLOWEEN_LIST_CLOSES_AT,
  MemoryStorage,
  SONIDO_EVENT_ID,
} from '@boia/store';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BuyButton } from '../../app/(landing)/components/buy-button';
import { marPurchase } from '../../app/mar/entradas-model';
import { t } from '../i18n';
import { esLista } from '../i18n/es-lista';
import { esListaBoton } from '../i18n/es-lista-boton';
import { SAMPLE_CONTENT } from '../landing/sample-content';
import { CHECKOUT_COPY } from '../ticketing/copy';
import { stateFor } from './guest-list-dialog';
import {
  inListMode,
  listClosingTime,
  listDoorPrice,
  listEventOf,
  listNotice,
  listPhase,
} from './model';
import { signupLine, tl } from './t';

/**
 * La lista del lado del socio (plan 034 T309): qué se enseña en vez de
 * «Comprar entrada» y qué dice el diálogo. Los datos y las reglas son de
 * T308 (`lib/guestlist`); aquí se usan con la demo de este navegador.
 */

const events = SAMPLE_CONTENT.events;
const halloween = events.find((e) => e.id === HALLOWEEN_EVENT_ID)!;
const status = (over: Partial<Parameters<typeof listPhase>[0]> = {}) => ({
  event: halloween.slug,
  enabled: true,
  cap: 100,
  closesAt: HALLOWEEN_LIST_CLOSES_AT,
  open: true,
  pastClosing: false,
  closed: false,
  full: false,
  mine: null,
  ...over,
});

describe('qué fiestas van en lista', () => {
  it('Halloween va en lista; las demás de la muestra, no', () => {
    expect(events.filter(inListMode).map((e) => e.id)).toEqual([HALLOWEEN_EVENT_ID]);
    expect(marPurchase(halloween)).toBe('guest_list');
    const sonido = events.find((e) => e.id === SONIDO_EVENT_ID)!;
    expect(marPurchase(sonido)).not.toBe('guest_list');
  });

  it('el precio en la puerta y el aviso de la hora, con la hora de los ajustes', () => {
    expect(listDoorPrice(halloween)).toBe('5 € con carnet en puerta');
    expect(listNotice(halloween.guestList!.closesAt, halloween.timeZone)).toBe(
      'La lista vale hasta las 22:30; después, por orden de llegada',
    );
    // Otra hora en los ajustes, otra hora en el aviso.
    expect(listNotice('2026-10-31T23:45:00+01:00', 'Europe/Madrid')).toBe(
      tl('lista.notice', { time: '23:45' }),
    );
    expect(listNotice(null, 'Europe/Madrid')).toBeNull();
    expect(listDoorPrice({ priceCents: undefined, boxOfficeOnly: undefined })).toBeNull();
    expect(listDoorPrice({ priceCents: 1250, boxOfficeOnly: undefined })).toBe(
      tl('lista.doorPrice', { euros: '12,5' }),
    );
  });

  it('las claves están en el catálogo entero', () => {
    for (const k of Object.keys(esLista) as (keyof typeof esLista)[]) {
      expect(t(k)).toBe(esLista[k]);
    }
    for (const k of Object.keys(esListaBoton) as (keyof typeof esListaBoton)[]) {
      expect(t(k)).toBe(esListaBoton[k]);
    }
  });
});

describe('el botón de la landing y la ficha', () => {
  it('Halloween: «Apuntarse en la lista», el precio en la puerta y el aviso; nada de compra', () => {
    const html = renderToStaticMarkup(
      createElement(BuyButton, {
        eventId: halloween.id,
        eventName: halloween.name,
        ticketUrl: halloween.ticketUrl,
        boxOfficeOnly: halloween.boxOfficeOnly,
        priceCents: halloween.priceCents,
        guestList: listEventOf(halloween),
        source: 'tickets_panel',
      }),
    );
    expect(html).toContain(tl('lista.join'));
    expect(html).toContain(`data-testid="lista-${halloween.id}"`);
    expect(html).toContain(listDoorPrice(halloween)!);
    expect(html).toContain(listNotice(HALLOWEEN_LIST_CLOSES_AT, halloween.timeZone)!);
    expect(html).not.toContain(`comprar-${halloween.id}`);
    expect(html).not.toContain('box-office');
    expect(html).not.toContain(CHECKOUT_COPY.buy);
  });

  it('una fiesta que no va en lista sigue con su compra de siempre', () => {
    for (const e of events.filter((e) => !inListMode(e) && canBuy(e) && !e.ticketsNotYet)) {
      const html = renderToStaticMarkup(
        createElement(BuyButton, {
          eventId: e.id,
          eventName: e.name,
          ticketUrl: e.ticketUrl,
          source: 'tickets_panel',
        }),
      );
      expect(html).toContain(`comprar-${e.id}`);
      expect(html).not.toContain(tl('lista.join'));
    }
  });

  it('al botón sólo viaja lo que la lista necesita', () => {
    expect(Object.keys(listEventOf(halloween)).sort()).toEqual(
      ['boxOfficeOnly', 'guestList', 'id', 'name', 'priceCents', 'slug', 'timeZone'].sort(),
    );
  });
});

describe('el diálogo', () => {
  it('cerrada manda sobre todo; luego apuntado, completa, sin Carnet y apuntarse', () => {
    const mine = { listName: 'Pepa', createdAt: '2026-10-21T08:05:00Z' };
    expect(listPhase(status({ closed: true, mine, full: true }), true)).toBe('closed');
    expect(listPhase(status({ mine, full: true }), true)).toBe('mine');
    expect(listPhase(status({ full: true }), false)).toBe('full');
    expect(listPhase(status(), false)).toBe('carnet');
    expect(listPhase(status(), true)).toBe('join');
    // Cerrada con inscripción: la enseña, sin botón de borrarse.
    expect(stateFor(status({ closed: true, mine }), 'Pepa')).toEqual({ kind: 'closed', mine });
  });

  it('la fecha y el nombre con los que se apuntó, en la hora de la fiesta', () => {
    const line = signupLine(
      { listName: 'La Pepa', createdAt: '2026-10-21T08:05:00Z' },
      'Europe/Madrid',
    );
    expect(line).toBe(tl('lista.mine.body', { date: '21 de octubre, 10:05', name: 'La Pepa' }));
    expect(listClosingTime('2026-10-21T08:05:00Z', 'Europe/Madrid')).toBe('10:05');
  });

  it('con la demo: apuntarse con otro nombre, verlo, borrarse y volver a poder', async () => {
    const repo = createLocalRepository({ storage: null, watch: false });
    let now = new Date('2026-10-21T12:00:00+02:00');
    const gl = createLocalGuestList({ repo, storage: null, now: () => now });

    // Sin Carnet: hace falta.
    expect(stateFor(await gl.status(halloween.slug), null).kind).toBe('carnet');

    await repo.carnet.create({ nickname: 'Grumete Lista' });
    const nickname = (await repo.carnet.mine())!.nickname;
    // Con Carnet: el nombre viene con el apodo.
    expect(stateFor(await gl.status(halloween.slug), nickname)).toMatchObject({
      kind: 'join',
      name: 'Grumete Lista',
      left: false,
    });

    const r = await gl.join(halloween.slug, 'La Pepa');
    expect(r).toMatchObject({ kind: 'created', signup: { listName: 'La Pepa' } });
    const again = stateFor(await gl.status(halloween.slug), nickname);
    expect(again).toMatchObject({ kind: 'mine', signup: { listName: 'La Pepa' }, asking: false });

    expect(await gl.leave(halloween.slug)).toEqual({ kind: 'removed' });
    expect(stateFor(await gl.status(halloween.slug), nickname, true)).toMatchObject({
      kind: 'join',
      left: true,
    });

    // Pasada la hora de cierre: «Lista cerrada», ni apuntarse ni borrarse.
    await gl.join(halloween.slug);
    now = new Date(Date.parse(HALLOWEEN_LIST_CLOSES_AT) + 60_000);
    expect(stateFor(await gl.status(halloween.slug), nickname)).toMatchObject({
      kind: 'closed',
      mine: { listName: 'Grumete Lista' },
    });
    expect(await gl.leave(halloween.slug)).toEqual({ kind: 'rejected', reason: 'closed' });
  });

  it('con la demo: llena, «Lista completa»; con el interruptor cerrado, «Lista cerrada»', async () => {
    // Dos navegadores con su Carnet y una misma lista guardada (la demo).
    const shared = new MemoryStorage();
    const now = () => new Date('2026-10-21T12:00:00+02:00');
    const repoA = createLocalRepository({ storage: null, watch: false });
    const repoB = createLocalRepository({ storage: null, watch: false });
    await repoA.carnet.create({ nickname: 'Grumete Uno' });
    await repoB.carnet.create({ nickname: 'Grumete Dos' });
    const a = createLocalGuestList({ repo: repoA, storage: shared, now });
    const b = createLocalGuestList({ repo: repoB, storage: shared, now });
    const settings = { enabled: true, cap: 1, closesAt: HALLOWEEN_LIST_CLOSES_AT, open: true };
    await a.admin.updateSettings(halloween.slug, settings);
    expect((await a.join(halloween.slug)).kind).toBe('created');
    expect(stateFor(await b.status(halloween.slug), 'Grumete Dos').kind).toBe('full');
    expect(await b.join(halloween.slug)).toEqual({ kind: 'rejected', reason: 'full' });

    await a.admin.updateSettings(halloween.slug, { ...settings, cap: 100, open: false });
    expect(stateFor(await b.status(halloween.slug), 'Grumete Dos')).toEqual({
      kind: 'closed',
      mine: null,
    });
  });
});
