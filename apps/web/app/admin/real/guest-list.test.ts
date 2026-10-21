import { MemoryStorage, createLocalGuestList, createLocalRepository } from '@boia/store';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { GuestListAdminRow, GuestListStatus } from '../../../lib/guestlist';
import { t } from '../../../lib/i18n';
import { BOM, GUEST_LIST_CSV_COLUMNS, guestListCsv } from './csv';
import { GuestListView } from './guest-list';
import { formOf, guestListCsvName, guestListSummary, settingsOf } from './guest-list-model';
import { when } from './common';

/**
 * La lista de cada fiesta en el Admin (plan 034 T310): el resumen, la tabla
 * (nombre, apodo, email, fecha, entró), el CSV con las mismas columnas y el
 * formulario de los ajustes. Sobre la lista de la demo (D-20); las RPC del
 * Admin, contra la base en packages/db/src/supabase/guest-list.supabase.ts.
 */

const row = (p: Partial<GuestListAdminRow>): GuestListAdminRow => ({
  userId: 'u1',
  listName: 'Ana y Bea',
  nickname: 'Grumete Ana',
  email: 'ana@example.test',
  createdAt: '2026-10-21T10:00:00Z',
  attended: false,
  attendedAt: null,
  ...p,
});

const status = (p: Partial<GuestListStatus> = {}): GuestListStatus => ({
  event: 'halloween-2026',
  enabled: true,
  cap: 100,
  closesAt: '2026-10-31T21:30:00Z',
  open: true,
  pastClosing: false,
  closed: false,
  full: false,
  mine: null,
  count: 2,
  ...p,
});

describe('la tabla de la lista', () => {
  it('apuntados / tope / han entrado, y una fila por inscripción', () => {
    const rows = [
      row({}),
      row({ userId: 'u2', listName: '=Pepe', email: null, attended: true, nickname: null }),
    ];
    const summary = guestListSummary(status(), rows);
    expect(summary).toEqual({ count: 2, cap: 100, scanned: 1 });
    const html = renderToStaticMarkup(createElement(GuestListView, { summary, rows }));
    expect(html).toContain(t('admin.guestList.count', { n: 2, cap: 100, scanned: 1 }));
    for (const key of [
      'admin.guestList.col.name',
      'admin.guestList.col.nickname',
      'admin.guestList.col.email',
      'admin.guestList.col.date',
      'admin.guestList.col.attended',
    ] as const) {
      expect(html).toContain(`>${t(key)}<`);
    }
    expect(html.match(/data-testid="lista-fila"/g)).toHaveLength(2);
    expect(html).toContain('ana@example.test');
    expect(html).toContain('Grumete Ana');
    expect(html).toContain(when(rows[0]!.createdAt));
    expect(html).toContain('data-entro="si"');
    expect(html).toContain('data-entro="no"');
  });

  it('sin nadie: lo dice; sin tope conocido, sin «de …»', () => {
    const html = renderToStaticMarkup(
      createElement(GuestListView, {
        summary: guestListSummary(status({ count: 0, cap: null }), []),
        rows: [],
      }),
    );
    expect(html).toContain(t('admin.guestList.empty'));
    expect(html).toContain(t('admin.guestList.countNoCap', { n: 0, scanned: 0 }));
    expect(html).not.toContain('lista-tabla');
  });

  it('con «Borrar» sólo si se puede borrar', () => {
    const rows = [row({})];
    const summary = guestListSummary(status(), rows);
    const without = renderToStaticMarkup(createElement(GuestListView, { summary, rows }));
    expect(without).not.toContain('lista-borrar');
    const withRemove = renderToStaticMarkup(
      createElement(GuestListView, { summary, rows, onRemove: () => {} }),
    );
    expect(withRemove).toContain('data-testid="lista-borrar"');
  });
});

describe('el CSV de la lista', () => {
  it('las mismas columnas que la tabla, con «entro» y fórmulas escapadas', () => {
    const csv = guestListCsv([
      row({}),
      row({ userId: 'u2', listName: '=Pepe', nickname: null, email: null, attended: true }),
    ]);
    expect(csv.startsWith(BOM)).toBe(true);
    const lines = csv.slice(BOM.length).trim().split('\r\n');
    expect(lines[0]).toBe(GUEST_LIST_CSV_COLUMNS.join(','));
    expect(GUEST_LIST_CSV_COLUMNS).toHaveLength(5);
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe(
      '"Ana y Bea","Grumete Ana","ana@example.test","2026-10-21T10:00:00Z","no"',
    );
    expect(lines[2]).toBe(`"'=Pepe","","","2026-10-21T10:00:00Z","sí"`);
  });

  it('el nombre del archivo lleva la fiesta y el día', () => {
    expect(guestListCsvName('halloween-2026', new Date('2026-10-21T10:00:00Z'))).toBe(
      'boia-lista-halloween-2026-2026-10-21.csv',
    );
  });
});

describe('los ajustes de la lista', () => {
  it('del estado al formulario y vuelta', () => {
    const form = formOf(status());
    expect(form).toMatchObject({ enabled: true, cap: '100', open: true });
    const back = settingsOf(form);
    expect(back).toEqual({
      ok: true,
      settings: { enabled: true, cap: 100, closesAt: '2026-10-31T21:30:00.000Z', open: true },
    });
  });

  it('sin hora: null; un tope que no vale, error', () => {
    expect(settingsOf({ enabled: true, cap: '5', closes: '', open: false })).toEqual({
      ok: true,
      settings: { enabled: true, cap: 5, closesAt: null, open: false },
    });
    for (const cap of ['0', '1.5', 'muchos', '100001']) {
      expect(settingsOf({ enabled: true, cap, closes: '', open: true })).toEqual({
        ok: false,
        error: 'admin.guestList.error.cap',
      });
    }
  });

  it('en la demo: el Admin cambia los ajustes y ve quién entró', async () => {
    const repo = createLocalRepository({ storage: new MemoryStorage(), watch: false });
    const mine = await repo.carnet.create({ nickname: 'Grumete Demo' });
    const api = createLocalGuestList({
      repo,
      storage: new MemoryStorage(),
      now: () => new Date('2026-10-30T12:00:00Z'),
    });
    const party = (await repo.content.list('events')).find((e) => e.guestList)!;
    await api.join(party.id, 'Demo');
    await repo.admin.stampCarnet(mine.userId, party.id, { source: 'door' });
    const parsed = settingsOf({ ...formOf(await api.admin.status(party.id)), cap: '7' });
    if (!parsed.ok) throw new Error(parsed.error);
    const st = await api.admin.updateSettings(party.id, parsed.settings);
    expect(st).toMatchObject({ cap: 7, count: 1 });
    const rows = await api.admin.list(party.id);
    expect(guestListSummary(st, rows)).toEqual({ count: 1, cap: 7, scanned: 1 });
    expect(rows[0]).toMatchObject({ listName: 'Demo', nickname: 'Grumete Demo', attended: true });
  });
});
