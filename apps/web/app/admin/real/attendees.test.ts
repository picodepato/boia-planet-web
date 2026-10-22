import { MemoryStorage, createLocalGuestList, createLocalRepository } from '@boia/store';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { EventAttendeeRow } from '../../../lib/guestlist';
import { AttendeesView } from './attendees';
import { BOM, ATTENDEES_CSV_COLUMNS, attendeesCsv } from './csv';
import { attendeesCsvName, attendeesSummary } from './guest-list-model';

/**
 * «Entraron» en el Admin (plan 037 T317): el contador «en lista / sin lista»,
 * la tabla, el CSV con las mismas columnas y la demo sin Supabase (D-20). La
 * RPC `admin_event_attendees`, contra la base en
 * packages/db/src/supabase/event-attendees.supabase.ts.
 */

const row = (p: Partial<EventAttendeeRow>): EventAttendeeRow => ({
  userId: 'u1',
  nickname: 'Grumete Ana',
  email: 'ana@example.test',
  scannedAt: '2026-10-31T22:00:00Z',
  source: 'door',
  listName: 'Ana y Bea',
  ...p,
});

const rows = [
  row({}),
  row({ userId: 'u2', nickname: '=Pepe', email: null, listName: null, source: 'link' }),
  row({ userId: 'u3', nickname: 'Mano', listName: null, source: 'manual' }),
];

describe('el contador y la tabla', () => {
  it('cuenta los que entraron, los de la lista y los que no', () => {
    expect(attendeesSummary(rows)).toEqual({ total: 3, onList: 1, offList: 2 });
    expect(attendeesSummary([])).toEqual({ total: 0, onList: 0, offList: 0 });
  });

  it('fiesta en lista: «N han entrado (M en lista, K sin lista)» y «No estaba en la lista»', () => {
    const html = renderToStaticMarkup(
      createElement(AttendeesView, { summary: attendeesSummary(rows), rows, listMode: true }),
    );
    expect(html).toContain('3 han entrado (1 en lista, 2 sin lista)');
    expect(html.match(/No estaba en la lista/g)).toHaveLength(2);
    expect(html).toContain('Ana y Bea');
    for (const w of ['Puerta', 'Enlace', 'A mano']) expect(html).toContain(w);
    expect(html.match(/data-testid="entraron-fila"/g)).toHaveLength(3);
  });

  it('fiesta sin modo lista: «—» en vez de «No estaba en la lista»', () => {
    const only = [row({ listName: null })];
    const html = renderToStaticMarkup(
      createElement(AttendeesView, { summary: attendeesSummary(only), rows: only, listMode: false }),
    );
    expect(html).toContain('1 han entrado');
    expect(html).not.toContain('No estaba en la lista');
    expect(html).not.toContain('en lista,');
  });

  it('sin nadie, lo dice', () => {
    const html = renderToStaticMarkup(
      createElement(AttendeesView, { summary: attendeesSummary([]), rows: [], listMode: true }),
    );
    expect(html).toContain('entraron-vacia');
  });
});

describe('el CSV', () => {
  it('las columnas, «sí/no» de la lista y cómo entraron; fórmulas escapadas', () => {
    const csv = attendeesCsv(rows, true);
    expect(csv.startsWith(BOM)).toBe(true);
    const lines = csv.slice(1).trimEnd().split('\r\n');
    expect(lines[0]).toBe(ATTENDEES_CSV_COLUMNS.join(','));
    expect(ATTENDEES_CSV_COLUMNS).toEqual([
      'apodo',
      'email',
      'en_lista',
      'nombre_lista',
      'escaneado',
      'como',
    ]);
    expect(lines).toHaveLength(4);
    expect(lines[1]).toBe(
      '"Grumete Ana","ana@example.test","sí","Ana y Bea","2026-10-31T22:00:00Z","puerta"',
    );
    expect(lines[2]).toBe('"\'=Pepe","","no","","2026-10-31T22:00:00Z","enlace"');
    expect(lines[3]).toContain('"a mano"');
  });

  it('sin modo lista, «en_lista» va vacío', () => {
    const lines = attendeesCsv([row({ listName: null })], false).slice(1).trimEnd().split('\r\n');
    expect(lines[1]).toBe('"Grumete Ana","ana@example.test","","","2026-10-31T22:00:00Z","puerta"');
  });

  it('el nombre del archivo', () => {
    expect(attendeesCsvName('halloween-2026', new Date('2026-10-22T10:00:00Z'))).toBe(
      'boia-entraron-halloween-2026-2026-10-22.csv',
    );
  });
});

describe('la demo (sin Supabase)', () => {
  it('sale de la asistencia local: en lista y sin lista, una vez por cuenta', async () => {
    const repo = createLocalRepository({ storage: new MemoryStorage(), watch: false });
    const mine = await repo.carnet.create({ nickname: 'Grumete Demo' });
    const api = createLocalGuestList({
      repo,
      storage: new MemoryStorage(),
      now: () => new Date('2026-10-30T12:00:00Z'),
    });
    const events = await repo.content.list('events');
    const listed = events.find((e) => e.guestList)!;
    const plain = events.find((e) => !e.guestList && e.state !== 'draft' && e.state !== 'cancelled')!;

    expect(await api.admin.attendees(listed.id)).toEqual([]);

    await api.join(listed.id, 'Demo');
    const first = await repo.admin.stampCarnet(mine.userId, listed.id, { source: 'door' });
    await repo.admin.stampCarnet(mine.userId, listed.id, { source: 'door' });
    await repo.admin.stampCarnet(mine.userId, plain.id, { source: 'door' });

    const onList = await api.admin.attendees(listed.id);
    expect(onList).toEqual([
      {
        userId: mine.userId,
        nickname: 'Grumete Demo',
        email: null,
        scannedAt: first.at,
        source: 'door',
        listName: 'Demo',
      },
    ]);
    expect(attendeesSummary(onList)).toEqual({ total: 1, onList: 1, offList: 0 });

    const off = await api.admin.attendees(plain.id);
    expect(off).toHaveLength(1);
    expect(off[0]).toMatchObject({ userId: mine.userId, listName: null });
    expect(attendeesSummary(off)).toEqual({ total: 1, onList: 0, offList: 1 });
  });
});
