import { readFileSync } from 'node:fs';
import { MemoryStorage, createLocalGuestList, createLocalRepository } from '@boia/store';
import { RPC_REJECTIONS } from '@boia/db/rpc';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { t } from '../../../lib/i18n';
import { carnetPath } from '../../../lib/mundo/carnet/share';
import {
  type DoorOutcome,
  doorListView,
  listText,
  listTime,
  localDoor,
  stampFromQr,
  withList,
} from './backend';
import { DoorScanner } from './door-scanner';
import { linkStampFromQr, localLinkDoor, localLinksAdmin } from './links';

/**
 * La lista de la fiesta en la puerta (plan 034 T310): tras leer un Carnet, los
 * dos lectores (el del equipo y el del enlace) dicen «En lista como …» o «No
 * está en la lista» si la fiesta va en lista; pasada la hora de cierre, lo
 * mismo con el aviso. Nada se bloquea. Contra la base:
 * packages/db/src/supabase/door-link-guest-list.supabase.ts.
 */
const ORIGIN = 'http://localhost:3000';

async function setup(nowIso: string) {
  const repo = createLocalRepository({ storage: new MemoryStorage(), watch: false });
  const mine = await repo.carnet.create({ nickname: 'Grumete Lista' });
  const now = () => new Date(nowIso);
  const lists = createLocalGuestList({ repo, storage: new MemoryStorage(), now });
  const events = await repo.content.list('events');
  const party = events.find((e) => e.guestList)!;
  const plain = events.find((e) => !e.guestList && e.state !== 'draft' && e.state !== 'cancelled')!;
  return { repo, mine, lists, party, plain, qr: `${ORIGIN}${carnetPath(mine.userId)}` };
}

const closes = (iso: string, deltaMs: number) => new Date(Date.parse(iso) + deltaMs).toISOString();

describe('el texto de la lista en la puerta', () => {
  it('en lista, fuera de lista y pasada la hora (con la hora de Alicante)', () => {
    const at = '2026-10-31T21:30:00Z'; // 22:30 en Alicante
    expect(listTime(at)).toBe('22:30');
    expect(listText({ onList: true, listName: 'Ana', closesAt: at, pastClosing: false })).toBe(
      t('puerta.list.on', { name: 'Ana' }),
    );
    expect(listText({ onList: false, listName: null, closesAt: at, pastClosing: false })).toBe(
      t('puerta.list.off'),
    );
    const late = listText({ onList: true, listName: 'Ana', closesAt: at, pastClosing: true });
    expect(late).toBe(
      t('puerta.list.late', { text: t('puerta.list.on', { name: 'Ana' }), time: '22:30' }),
    );
    expect(late).toContain('Ana');
    expect(late).toContain('22:30');
  });

  it('una fiesta que no va en lista no dice nada', () => {
    expect(
      doorListView({
        enabled: false,
        onList: false,
        listName: null,
        closesAt: null,
        pastClosing: false,
      }),
    ).toBeNull();
  });

  it('si la lista falla, la puerta sigue con el sello', async () => {
    const outcome: DoorOutcome = { kind: 'granted', nickname: 'A', party: 'P', at: 'x' };
    const r = await withList(
      outcome,
      async () => {
        throw new Error('red');
      },
      'u',
    );
    expect(r).toEqual(outcome);
    expect(await withList({ kind: 'unknown' }, async () => null, 'u')).toEqual({
      kind: 'unknown',
    });
  });
});

describe('el lector del equipo', () => {
  it('en lista: sella y dice con qué nombre', async () => {
    const { repo, lists, party, qr } = await setup('2026-10-30T12:00:00Z');
    await lists.join(party.id, 'Ana y Bea');
    const r = await stampFromQr(localDoor(repo, lists), qr, party.id);
    expect(r).toMatchObject({
      kind: 'granted',
      list: { onList: true, listName: 'Ana y Bea', pastClosing: false },
    });
    const html = renderToStaticMarkup(
      createElement(DoorScanner, { onText: async () => {}, outcome: r, busy: false }),
    );
    expect(html).toContain('data-testid="puerta-lista"');
    expect(html).toContain('data-lista="si"');
    expect(html).toContain(t('puerta.list.on', { name: 'Ana y Bea' }));
  });

  it('pasada la hora de cierre: sella igual, con el nombre y el aviso', async () => {
    const { repo, mine, party, qr } = await setup('2026-10-30T12:00:00Z');
    // La misma lista (el mismo almacenamiento): antes de la hora se apunta;
    // la puerta la lee ya pasada la hora de cierre.
    const shared = new MemoryStorage();
    const before = createLocalGuestList({
      repo,
      storage: shared,
      now: () => new Date('2026-10-30T12:00:00Z'),
    });
    await before.join(party.id, 'Ana');
    const after = closes(party.guestList!.closesAt!, 60_000);
    const lateLists = createLocalGuestList({ repo, storage: shared, now: () => new Date(after) });
    const r = await stampFromQr(localDoor(repo, lateLists), qr, party.id);
    expect(r).toMatchObject({
      kind: 'granted',
      list: { onList: true, listName: 'Ana', pastClosing: true },
    });
    expect((await repo.carnet.get(mine.userId))?.stamps.map((s) => s.eventId)).toEqual([
      party.id,
    ]);
    if (r.kind !== 'granted') throw new Error('sin sello');
    expect(listText(r.list!)).toContain(listTime(party.guestList!.closesAt!));
  });

  it('no está en la lista: lo dice y sella igual; otra fiesta, sin lista', async () => {
    const { repo, lists, party, plain, qr } = await setup('2026-10-30T12:00:00Z');
    const off = await stampFromQr(localDoor(repo, lists), qr, party.id);
    expect(off).toMatchObject({ kind: 'granted', list: { onList: false, listName: null } });
    const html = renderToStaticMarkup(
      createElement(DoorScanner, { onText: async () => {}, outcome: off, busy: false }),
    );
    expect(html).toContain('data-lista="no"');
    expect(html).toContain(t('puerta.list.off'));
    const none = await stampFromQr(localDoor(repo, lists), qr, plain.id);
    expect(none.kind).toBe('granted');
    expect('list' in none && none.list).toBeFalsy();
    expect(
      renderToStaticMarkup(
        createElement(DoorScanner, { onText: async () => {}, outcome: none, busy: false }),
      ),
    ).not.toContain('puerta-lista');
  });
});

describe('el lector del enlace', () => {
  it('dice el nombre de lista y nada más (ni email)', async () => {
    const { repo, lists, party, qr } = await setup('2026-10-30T12:00:00Z');
    await lists.join(party.id, 'Ana y Bea');
    const storage = new MemoryStorage();
    const token = await localLinksAdmin(repo, storage).create(party.id);
    const door = localLinkDoor(repo, storage, token, lists);
    const r = await linkStampFromQr(door, qr);
    expect(r).toMatchObject({ kind: 'granted', list: { onList: true, listName: 'Ana y Bea' } });
    if (r.kind !== 'granted') throw new Error('sin sello');
    expect(Object.keys(r.list!).sort()).toEqual([
      'closesAt',
      'listName',
      'onList',
      'pastClosing',
    ]);
    // Leído otra vez: ya tenía el sello, y sigue diciendo la lista.
    expect(await linkStampFromQr(door, qr)).toMatchObject({
      kind: 'already',
      list: { onList: true },
    });
  });
});

describe('la migración del enlace con la lista, como texto', () => {
  const read = (path: string) =>
    readFileSync(new URL(`../../../../../${path}`, import.meta.url), 'utf8');
  const SQL = read('supabase/migrations/20261021300100_door_link_guest_list.sql');
  const TYPES = read('packages/db/src/database.types.ts');

  it('sin cuenta, con el código; sólo el nombre de lista', () => {
    expect(SQL).toContain(
      'grant execute on function public.door_link_guest_list(text, uuid) to anon, authenticated;',
    );
    expect(SQL).toContain('private.live_door_link(p_token)');
    // Ni email, ni apodo, ni fecha de inscripción en lo que devuelve.
    expect(SQL).not.toMatch(/'email'|nickname|'created_at'/);
    for (const m of SQL.matchAll(/raise exception '([a-z_]+)'/g)) {
      expect(RPC_REJECTIONS).toContain(m[1]);
    }
    expect(TYPES).toMatch(/door_link_guest_list: \{\s*Args: \{\s*p_token: string;/);
  });
});
