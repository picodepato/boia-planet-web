import { type Discount, EVENT_STATE_BEHAVIOR, discountSchema, eventState } from '@boia/contracts';
import {
  type BoiaRepository,
  SAMPLE_ACHIEVEMENTS,
  SAMPLE_DISCOUNTS,
  SAMPLE_EVENTS,
  createLocalRepository,
} from '@boia/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CapturedEvent } from '../analytics';
import { purchaseNotices } from './notices';
import { applicableDiscount, discountCents, quoteFor, samplePriceCents } from './pricing';
import { TICKET_TRIGGER, createSandboxTicketing } from './sandbox';

const DAY = 24 * 3600 * 1000;
const onSale = SAMPLE_EVENTS.filter((e) => EVENT_STATE_BEHAVIOR[e.state].purchasable);
const notOnSale = SAMPLE_EVENTS.filter((e) => !EVENT_STATE_BEHAVIOR[e.state].purchasable);
const finished = SAMPLE_EVENTS.filter((e) => e.state === 'finished');
const discounts = SAMPLE_DISCOUNTS.map((d) => discountSchema.parse(d));
// El descuento del náufrago: el de un evento a la venta que caduca.
const naufrago = discounts.find(
  (d) => d.endsAt !== undefined && onSale.some((e) => e.id === d.eventId),
)!;
const naufragoEvent = onSale.find((e) => e.id === naufrago.eventId)!;
const ticketAchievement = SAMPLE_ACHIEVEMENTS.find((a) => a.trigger === TICKET_TRIGGER)!;
// «Ahora»: una semana antes de que caduque el descuento del náufrago.
const VALID = new Date(Date.parse(naufrago.endsAt!) - 7 * DAY);
const EXPIRED = new Date(Date.parse(naufrago.endsAt!) + DAY);
// Otro evento que siga a la venta en `VALID` (el estado sale de las fechas, T42).
const otherEvent = onSale.find(
  (e) => e.id !== naufrago.eventId && eventState(e, VALID) === 'on_sale',
)!;

function setup(now = VALID) {
  const repo = createLocalRepository({ storage: null, now: () => now });
  let n = 0;
  const tickets = createSandboxTicketing(repo, {
    now: () => now,
    newPurchaseId: (eventId) => `prueba-${eventId}-${++n}`,
  });
  return { repo, tickets };
}

async function start(tickets: ReturnType<typeof setup>['tickets'], eventId: string) {
  const r = await tickets.start(eventId);
  if (!r.ok) throw new Error(`no se pudo empezar la compra: ${r.reason}`);
  return r.session;
}

async function stampsOf(repo: BoiaRepository, eventId: string) {
  return (await repo.progress.stamps()).filter((s) => s.eventId === eventId);
}

describe('compra de prueba: sello una vez por id de compra (REQ-COM-035)', () => {
  it('muestra tiene lo que estas pruebas necesitan', () => {
    expect(onSale.length).toBeGreaterThanOrEqual(2);
    expect(finished.length).toBeGreaterThan(0);
    expect(naufrago).toBeDefined();
    expect(ticketAchievement).toBeDefined();
  });

  it('confirmar dos veces la misma compra (seguidas o a la vez) deja un solo sello', async () => {
    const { repo, tickets } = setup();
    const session = await start(tickets, otherEvent.id);

    const first = await tickets.confirm!(session);
    expect(first).toMatchObject({ firstConfirmation: true, stamp: 'granted' });
    const again = await tickets.confirm!(session);
    expect(again).toMatchObject({ firstConfirmation: false, stamp: 'duplicate' });
    const both = await Promise.all([tickets.confirm!(session), tickets.confirm!(session)]);
    for (const o of both) expect(o.stamp).toBe('duplicate');

    const stamps = await stampsOf(repo, otherEvent.id);
    expect(stamps).toHaveLength(1);
    expect(stamps[0]!.purchaseId).toBe(session.purchaseId);
    expect(await repo.purchases.list()).toHaveLength(1);
  });

  it('dos confirmaciones a la vez de una compra nueva también dejan un solo sello', async () => {
    const { repo, tickets } = setup();
    const session = await start(tickets, otherEvent.id);
    const outcomes = await Promise.all([tickets.confirm!(session), tickets.confirm!(session)]);
    expect(outcomes.map((o) => o.stamp).sort()).toEqual(['duplicate', 'granted']);
    expect(await stampsOf(repo, otherEvent.id)).toHaveLength(1);
  });

  it('otra compra del mismo evento no da un segundo sello', async () => {
    const { repo, tickets } = setup();
    await tickets.confirm!(await start(tickets, otherEvent.id));
    const second = await start(tickets, otherEvent.id);
    const outcome = await tickets.confirm!(second);
    expect(outcome).toMatchObject({ firstConfirmation: true, stamp: 'already_stamped' });
    expect(await stampsOf(repo, otherEvent.id)).toHaveLength(1);
    expect(await repo.purchases.list()).toHaveLength(2);
  });

  it('completa el logro de la entrada una vez; sus puntos llegan al reclamarlo', async () => {
    const { repo, tickets } = setup();
    const before = await repo.progress.balances();
    const a = await tickets.confirm!(await start(tickets, naufragoEvent.id));
    expect(a.achievement).toEqual({
      id: ticketAchievement.id,
      title: ticketAchievement.title,
      granted: true,
    });
    const b = await tickets.confirm!(await start(tickets, otherEvent.id));
    expect(b.achievement?.granted).toBe(false);

    const got = (await repo.progress.achievements()).find(
      (x) => x.definition.id === ticketAchievement.id,
    );
    expect(got).toMatchObject({ obtained: true, state: 'ready' });
    // Completar no da nada: el premio llega al reclamar (D-22).
    expect(await repo.progress.balances()).toEqual(before);
    expect((await repo.progress.claimAchievement(ticketAchievement.id)).claimed).toBe(true);
    const after = await repo.progress.balances();
    expect(after.points - before.points).toBe(ticketAchievement.points);
  });

  it('los avisos del mar salen sólo con lo recién conseguido', async () => {
    const { tickets } = setup();
    const session = await start(tickets, otherEvent.id);
    const first = purchaseNotices(await tickets.confirm!(session), session.event.name);
    expect(first.map((n) => n.kind)).toEqual(['reward', 'achievement']);
    expect(first[0]!.body).toBe(otherEvent.name);
    expect(purchaseNotices(await tickets.confirm!(session), session.event.name)).toEqual([]);
  });
});

describe('eventos que no se venden', () => {
  it('un evento que no está a la venta (también finalizado) no abre compra', async () => {
    const { repo, tickets } = setup();
    for (const e of notOnSale) {
      const r = await tickets.start(e.id);
      expect(r, e.id).toMatchObject({ ok: false, reason: 'not_on_sale' });
    }
    await expect(tickets.start('no-existe')).resolves.toMatchObject({
      ok: false,
      reason: 'not_found',
    });
    expect(await repo.purchases.list()).toEqual([]);
  });
});

describe('descuento del náufrago: sólo con un código válido', () => {
  it('sin encontrarlo, precio de muestra entero', async () => {
    const { tickets } = setup();
    const s = await start(tickets, naufragoEvent.id);
    expect(s.quote.discount).toBeNull();
    expect(s.quote.totalCents).toBe(samplePriceCents(naufragoEvent.id));
    expect(s.quote.sample).toBe(true);
  });

  it('encontrado y vigente, se aplica a su evento y la compra lo registra', async () => {
    const { repo, tickets } = setup();
    await repo.progress.findDiscount(naufrago.id);
    const s = await start(tickets, naufragoEvent.id);
    const price = samplePriceCents(naufragoEvent.id);
    expect(s.quote.discount?.id).toBe(naufrago.id);
    expect(s.quote.discount?.code).toBe(naufrago.code);
    expect(s.quote.totalCents).toBe(price - discountCents(naufrago, price));
    expect(s.quote.totalCents).toBeLessThan(price);

    const outcome = await tickets.confirm!(s);
    expect(outcome.stamp).toBe('granted');
    const [purchase] = await repo.purchases.list();
    expect(purchase?.discountId).toBe(naufrago.id);
    expect(purchase?.amountCents).toBe(s.quote.totalCents);
  });

  it('no se aplica a otro evento', async () => {
    const { repo, tickets } = setup();
    await repo.progress.findDiscount(naufrago.id);
    const s = await start(tickets, otherEvent.id);
    expect(s.quote.discount?.id).not.toBe(naufrago.id);
  });

  it('caducado, no se aplica', async () => {
    const { repo, tickets } = setup(EXPIRED);
    await repo.progress.findDiscount(naufrago.id);
    const s = await start(tickets, naufragoEvent.id);
    expect(s.quote.discount).toBeNull();
    expect(s.quote.totalCents).toBe(samplePriceCents(naufragoEvent.id));
  });

  it('applicableDiscount: evento, vigencia y el mayor de los válidos', () => {
    const price = 2000;
    const base: Discount = { ...naufrago, startsAt: undefined, endsAt: undefined };
    const pct = { discount: { ...base, id: 'pct', kind: 'percent' as const, value: 10 } };
    const eur = { discount: { ...base, id: 'eur', kind: 'amount' as const, value: 500 } };
    const other = { discount: { ...pct.discount, id: 'otro', eventId: otherEvent.id } };
    const later = {
      discount: {
        ...eur.discount,
        id: 'luego',
        startsAt: new Date(VALID.getTime() + DAY).toISOString(),
      },
    };
    const id = naufragoEvent.id;
    expect(applicableDiscount(id, [], price, VALID)).toBeNull();
    expect(applicableDiscount(id, [other], price, VALID)).toBeNull();
    expect(applicableDiscount(id, [later], price, VALID)).toBeNull();
    expect(applicableDiscount(id, [pct], price, VALID)).toMatchObject({ id: 'pct', cents: 200 });
    expect(applicableDiscount(id, [pct, eur, other], price, VALID)).toMatchObject({
      id: 'eur',
      cents: 500,
    });
    // Un importe mayor que el precio deja el total en cero, nunca en negativo.
    const huge = { discount: { ...eur.discount, value: price * 3 } };
    expect(quoteFor(id, [huge], VALID).totalCents).toBe(0);
  });
});

describe('compra dentro del mar 3D (T58)', () => {
  type FakeWindow = { location: { pathname: string }; __boiaAnalytics?: CapturedEvent[] };
  afterEach(() => vi.unstubAllGlobals());

  it('el sandbox lleva el origen «world» hasta purchase_confirmed, con el código aplicado', async () => {
    const win: FakeWindow = { location: { pathname: '/mar' } };
    vi.stubGlobal('window', win);
    const { repo, tickets } = setup();
    await repo.progress.findDiscount(naufrago.id);
    const r = await tickets.start(naufragoEvent.id, { source: 'world' });
    if (!r.ok) throw new Error(r.reason);
    expect(r.session.source).toBe('world');
    expect(r.session.quote.discount?.id).toBe(naufrago.id);
    await tickets.confirm!(r.session);
    const confirmed = win.__boiaAnalytics?.filter((e) => e.event === 'purchase_confirmed');
    expect(confirmed).toHaveLength(1);
    expect(confirmed![0]!.properties).toMatchObject({
      eventId: naufragoEvent.id,
      provider: 'sandbox',
      discountId: naufrago.id,
      source: 'world',
      $pathname: '/mar',
    });
  });

  it('sin origen (la landing), la compra no lo inventa', async () => {
    const win: FakeWindow = { location: { pathname: '/' } };
    vi.stubGlobal('window', win);
    const { tickets } = setup();
    const s = await start(tickets, otherEvent.id);
    expect(s.source).toBeUndefined();
    await tickets.confirm!(s);
    const confirmed = win.__boiaAnalytics?.find((e) => e.event === 'purchase_confirmed');
    expect(confirmed).toBeDefined();
    expect(confirmed!.properties).not.toHaveProperty('source');
  });
});
