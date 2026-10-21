import { describe, expect, it } from 'vitest';
import {
  createLocalGuestList,
  GUEST_LIST_KEY,
  GuestListError,
  guestListState,
  normalizeListName,
} from './guestlist';
import { HALLOWEEN_EVENT_ID, HALLOWEEN_LIST_CLOSES_AT, SAMPLE_EVENTS } from './sample';
import { MemoryStorage } from './storage';
import { fakeClock, makeRepo } from './test-helpers';

/**
 * La lista de una fiesta en la demo (plan 034 T308): las mismas reglas que
 * supabase/migrations/20261021200100_guest_lists.sql (probadas contra la
 * base en packages/db/src/supabase/guest-list.supabase.ts).
 */
const halloween = SAMPLE_EVENTS.find((e) => e.id === HALLOWEEN_EVENT_ID)!;
const notInList = SAMPLE_EVENTS.find(
  (e) => !e.guestList && e.state !== 'draft' && e.state !== 'cancelled',
)!;

function setup(withCarnet = true) {
  const { repo } = makeRepo();
  const clock = fakeClock('2026-10-21T10:00:00Z');
  const storage = new MemoryStorage();
  const make = () => createLocalGuestList({ repo, storage, now: clock.now });
  return {
    repo,
    clock,
    storage,
    make,
    gl: make(),
    carnet: withCarnet ? repo.carnet.create({ nickname: 'Pepa Lista' }) : Promise.resolve(null),
  };
}

/** Pone en la lista a otra cuenta (la demo sólo tiene la de este navegador). */
function seedOther(storage: MemoryStorage, userId: string) {
  const doc = JSON.parse(
    storage.getItem(GUEST_LIST_KEY) ?? '{"v":1,"settings":{},"signups":{}}',
  ) as { signups: Record<string, Record<string, unknown>> };
  doc.signups[halloween.id] = {
    ...(doc.signups[halloween.id] ?? {}),
    [userId]: { listName: 'Otra', createdAt: '2026-10-20T10:00:00.000Z' },
  };
  storage.setItem(GUEST_LIST_KEY, JSON.stringify(doc));
}

describe('el contenido de muestra', () => {
  it('Halloween va en lista: tope 100, cierra a las 22:30 del 31 en Alicante, abierta', () => {
    expect(halloween.guestList).toEqual({
      cap: 100,
      closesAt: HALLOWEEN_LIST_CLOSES_AT,
      open: true,
    });
    expect(new Date(HALLOWEEN_LIST_CLOSES_AT).toISOString()).toBe('2026-10-31T21:30:00.000Z');
  });
});

describe('reglas', () => {
  it('el nombre: sin espacios de más, el apodo si va vacío, de 2 a 30', () => {
    expect(normalizeListName('  Ana   y  Bea ', 'Pepa')).toBe('Ana y Bea');
    expect(normalizeListName('', 'Pepa')).toBe('Pepa');
    expect(normalizeListName(null, 'Pepa')).toBe('Pepa');
    expect(normalizeListName('A', 'Pepa')).toBeNull();
    expect(normalizeListName('x'.repeat(31), 'Pepa')).toBeNull();
    expect(normalizeListName('x'.repeat(30), 'Pepa')).toBe('x'.repeat(30));
  });

  it('cerrada con el interruptor o pasada la hora; llena al llegar al tope', () => {
    const s = { enabled: true, cap: 2, closesAt: '2026-10-31T21:30:00.000Z', open: true };
    const before = new Date('2026-10-31T21:29:59Z');
    const after = new Date('2026-10-31T21:30:00Z');
    expect(guestListState('x', s, 1, null, before)).toMatchObject({ closed: false, full: false });
    expect(guestListState('x', s, 2, null, before).full).toBe(true);
    expect(guestListState('x', s, 0, null, after)).toMatchObject({
      closed: true,
      pastClosing: true,
    });
    expect(guestListState('x', { ...s, open: false }, 0, null, before).closed).toBe(true);
    expect(guestListState('x', null, 0, null, before)).toMatchObject({
      enabled: false,
      closed: true,
    });
  });
});

describe('la lista en la demo (REQ-COM-037)', () => {
  it('sin Carnet no se apunta', async () => {
    const { gl } = setup(false);
    expect(await gl.join(halloween.slug)).toEqual({ kind: 'rejected', reason: 'carnet_required' });
    expect((await gl.status(halloween.slug)).mine).toBeNull();
  });

  it('una vez; la segunda devuelve la primera tal cual; sin nombre, el apodo', async () => {
    const { gl, clock, carnet } = setup();
    await carnet;
    const s0 = await gl.status(halloween.slug);
    expect(s0).toMatchObject({ enabled: true, cap: 100, open: true, closed: false, full: false });
    expect(s0).not.toHaveProperty('count');
    const first = await gl.join(halloween.slug);
    expect(first).toEqual({
      kind: 'created',
      signup: { listName: 'Pepa Lista', createdAt: '2026-10-21T10:00:00.000Z' },
    });
    clock.advance(60_000);
    const again = await gl.join(halloween.slug, 'Otro nombre');
    expect(again).toEqual({ kind: 'existing', signup: (first as { signup: unknown }).signup });
    expect(await gl.mine(halloween.slug)).toEqual({
      listName: 'Pepa Lista',
      createdAt: '2026-10-21T10:00:00.000Z',
    });
  });

  it('se guarda en este navegador: otra instancia lo ve', async () => {
    const { gl, make, carnet } = setup();
    await carnet;
    await gl.join(halloween.slug, 'Pepa y amigas');
    expect((await make().mine(halloween.slug))?.listName).toBe('Pepa y amigas');
  });

  it('nombre no válido, fiesta sin lista o desconocida: rechazo', async () => {
    const { gl, carnet } = setup();
    await carnet;
    expect(await gl.join(halloween.slug, 'A')).toEqual({
      kind: 'rejected',
      reason: 'invalid_name',
    });
    expect(await gl.join(notInList.slug)).toEqual({ kind: 'rejected', reason: 'not_enabled' });
    expect(await gl.join('no-existe')).toEqual({ kind: 'rejected', reason: 'unknown_event' });
    expect((await gl.status(notInList.slug)).enabled).toBe(false);
  });

  it('llena → full; borrarse libera el sitio y se puede volver', async () => {
    const { gl, storage, carnet } = setup();
    await carnet;
    await gl.admin.updateSettings(halloween.slug, {
      enabled: true,
      cap: 2,
      closesAt: HALLOWEEN_LIST_CLOSES_AT,
      open: true,
    });
    expect((await gl.join(halloween.slug, 'Yo')).kind).toBe('created');
    seedOther(storage, 'otra-cuenta');
    expect((await gl.status(halloween.slug)).full).toBe(true);
    expect(await gl.leave(halloween.slug)).toEqual({ kind: 'removed' });
    expect(await gl.leave(halloween.slug)).toEqual({ kind: 'not_signed_up' });
    seedOther(storage, 'tercera-cuenta');
    expect(await gl.join(halloween.slug)).toEqual({ kind: 'rejected', reason: 'full' });
    await gl.admin.remove(halloween.slug, 'tercera-cuenta');
    expect(await gl.join(halloween.slug, 'Yo otra vez')).toMatchObject({
      kind: 'created',
      signup: { listName: 'Yo otra vez' },
    });
  });

  it('el interruptor cerrado: ni apuntarse ni borrarse; ya apuntada, se le devuelve lo suyo', async () => {
    const { gl, carnet } = setup();
    await carnet;
    await gl.join(halloween.slug, 'Antes');
    await gl.admin.updateSettings(halloween.slug, {
      enabled: true,
      cap: 100,
      closesAt: HALLOWEEN_LIST_CLOSES_AT,
      open: false,
    });
    expect(await gl.leave(halloween.slug)).toEqual({ kind: 'rejected', reason: 'closed' });
    expect(await gl.join(halloween.slug)).toMatchObject({ kind: 'existing' });
    await gl.admin.remove(halloween.slug, (await carnet)!.userId);
    expect(await gl.join(halloween.slug)).toEqual({ kind: 'rejected', reason: 'closed' });
  });

  it('pasada la hora de cierre (22:30 del 31): ni apuntarse ni borrarse', async () => {
    const { gl, clock, carnet } = setup();
    await carnet;
    await gl.join(halloween.slug);
    clock.set('2026-10-31T21:30:00Z');
    const s = await gl.status(halloween.slug);
    expect(s).toMatchObject({ pastClosing: true, closed: true, open: true });
    expect(await gl.leave(halloween.slug)).toEqual({ kind: 'rejected', reason: 'closed' });
    await gl.admin.remove(halloween.slug, (await carnet)!.userId);
    expect(await gl.join(halloween.slug)).toEqual({ kind: 'rejected', reason: 'closed' });
  });

  it('el Admin: la lista con si entró por la puerta, el número y los ajustes', async () => {
    const { gl, repo, carnet } = setup();
    const me = (await carnet)!;
    await gl.join(halloween.slug, 'En la lista');
    expect((await gl.admin.list(halloween.slug))[0]).toMatchObject({
      userId: me.userId,
      listName: 'En la lista',
      nickname: 'Pepa Lista',
      email: null,
      attended: false,
      attendedAt: null,
    });
    await repo.admin.stampCarnet(me.userId, halloween.id, { source: 'door' });
    const [row] = await gl.admin.list(halloween.slug);
    expect(row).toMatchObject({ attended: true });
    expect(row!.attendedAt).not.toBeNull();
    expect(await gl.admin.status(halloween.slug)).toMatchObject({ count: 1, cap: 100 });
    await expect(
      gl.admin.updateSettings(halloween.slug, {
        enabled: true,
        cap: 0,
        closesAt: null,
        open: true,
      }),
    ).rejects.toBeInstanceOf(GuestListError);
    const off = await gl.admin.updateSettings(halloween.slug, {
      enabled: false,
      cap: 50,
      closesAt: null,
      open: true,
    });
    expect(off).toMatchObject({ enabled: false, cap: 50, closesAt: null, closed: true });
  });

  it('la puerta: en la lista, con qué nombre, y si pasó la hora (no bloquea)', async () => {
    const { gl, clock, carnet } = setup();
    const me = (await carnet)!;
    await gl.join(halloween.slug, 'Pepa +1');
    expect(await gl.door(halloween.slug, me.userId)).toEqual({
      enabled: true,
      onList: true,
      listName: 'Pepa +1',
      createdAt: '2026-10-21T10:00:00.000Z',
      closesAt: HALLOWEEN_LIST_CLOSES_AT,
      pastClosing: false,
    });
    clock.set('2026-10-31T23:00:00Z');
    expect(await gl.door(halloween.slug, me.userId)).toMatchObject({
      onList: true,
      pastClosing: true,
    });
    expect(await gl.door(halloween.slug, 'nadie')).toMatchObject({ onList: false, listName: null });
  });
});
