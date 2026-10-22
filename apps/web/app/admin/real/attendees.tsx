'use client';

import { useCallback, useState } from 'react';
import { type EventAttendeeRow, type GuestListApi, GuestListError } from '../../../lib/guestlist';
import { t } from '../../../lib/i18n';
import { StatusLine } from '../ui';
import { useRun } from '../use-admin';
import { download, when } from './common';
import { attendeesCsv } from './csv';
import { type AttendeesSummary, attendeesCsvName, attendeesSummary } from './guest-list-model';

function errorText(e: unknown): string {
  if (e instanceof GuestListError) {
    if (e.code === 'forbidden') return t('admin.real.error.forbidden');
    if (e.code === 'unknown_event') return t('admin.real.error.unknownEvent');
  }
  return e instanceof Error ? e.message : String(e);
}

/**
 * «Entraron» de una fiesta en el Admin (plan 037 T317): todas las personas
 * cuyo Carnet se leyó en la puerta (lector, enlace o a mano), estén o no en
 * la lista, con «Descargar CSV». Vale para cualquier fiesta, vaya o no en
 * lista. Se carga al abrirla. Sin Supabase, sobre la asistencia de este
 * navegador (D-20).
 */
export function AttendeesPanel({ api, event }: { api: GuestListApi; event: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<EventAttendeeRow[] | null>(null);
  const [listMode, setListMode] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { status: line, busy, run } = useRun();

  const load = useCallback(async () => {
    try {
      const [list, st] = await Promise.all([api.admin.attendees(event), api.admin.status(event)]);
      setRows(list);
      setListMode(st.enabled);
      setLoadError(null);
    } catch (e) {
      setLoadError(errorText(e));
    }
  }, [api, event]);

  const csv = () =>
    void run(async () => {
      let list: EventAttendeeRow[];
      try {
        list = await api.admin.attendees(event);
      } catch (e) {
        throw new Error(errorText(e));
      }
      setRows(list);
      download(
        new Blob([attendeesCsv(list, listMode)], { type: 'text/csv;charset=utf-8' }),
        attendeesCsvName(event),
      );
    }, t('admin.attendees.csvReady'));

  return (
    <details
      className="admin-details"
      data-testid={`entraron-${event}`}
      onToggle={(e) => {
        const now = (e.currentTarget as HTMLDetailsElement).open;
        setOpen(now);
        if (now) void load();
      }}
    >
      <summary>{t('admin.attendees.title')}</summary>
      {!open ? null : loadError ? (
        <p className="admin-status admin-status--error" role="alert">
          {loadError}
        </p>
      ) : !rows ? (
        <p>{t('empty.loading')}</p>
      ) : (
        <div className="admin-lista">
          <p className="admin-meta">{t('admin.attendees.hint')}</p>
          <div className="admin-row">
            <button
              type="button"
              className="admin-button admin-button--ghost"
              disabled={busy || rows.length === 0}
              onClick={csv}
              data-testid={`entraron-csv-${event}`}
            >
              {t('admin.attendees.csv')}
            </button>
          </div>
          <StatusLine status={line} />
          <AttendeesView summary={attendeesSummary(rows)} rows={rows} listMode={listMode} />
        </div>
      )}
    </details>
  );
}

/** El contador y la tabla (sin estado: se prueba renderizándola). */
export function AttendeesView({
  summary,
  rows,
  listMode,
}: {
  summary: AttendeesSummary;
  rows: readonly EventAttendeeRow[];
  listMode: boolean;
}) {
  return (
    <>
      <p
        className="admin-meta"
        data-testid="entraron-resumen"
        data-total={summary.total}
        data-en-lista={summary.onList}
        data-sin-lista={summary.offList}
      >
        {listMode
          ? t('admin.attendees.count', {
              n: summary.total,
              onList: summary.onList,
              offList: summary.offList,
            })
          : t('admin.attendees.countNoList', { n: summary.total })}
      </p>
      {rows.length === 0 ? (
        <p className="admin-meta" data-testid="entraron-vacia">
          {t('admin.attendees.empty')}
        </p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table" data-testid="entraron-tabla">
            <thead>
              <tr>
                <th scope="col">{t('admin.attendees.col.nickname')}</th>
                <th scope="col">{t('admin.attendees.col.email')}</th>
                <th scope="col">{t('admin.attendees.col.listName')}</th>
                <th scope="col">{t('admin.attendees.col.time')}</th>
                <th scope="col">{t('admin.attendees.col.source')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.userId}
                  data-testid="entraron-fila"
                  data-en-lista={r.listName !== null ? 'si' : 'no'}
                >
                  <td>{r.nickname ?? '—'}</td>
                  <td>{r.email ?? '—'}</td>
                  <td>{r.listName ?? (listMode ? t('admin.attendees.notOnList') : '—')}</td>
                  <td>{when(r.scannedAt)}</td>
                  <td>{t(`admin.attendees.source.${r.source}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
