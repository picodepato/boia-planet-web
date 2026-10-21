'use client';

import { useCallback, useState } from 'react';
import {
  type GuestListAdminRow,
  type GuestListApi,
  GuestListError,
  type GuestListStatus,
} from '../../../lib/guestlist';
import { t } from '../../../lib/i18n';
import { StatusLine } from '../ui';
import { useRun } from '../use-admin';
import { download, when } from './common';
import { guestListCsv } from './csv';
import {
  type GuestListForm,
  type GuestListSummary,
  formOf,
  guestListCsvName,
  guestListSummary,
  settingsOf,
} from './guest-list-model';

/** El texto para el equipo de un error de la lista. */
function guestListErrorText(e: unknown): string {
  if (e instanceof GuestListError) {
    if (e.code === 'forbidden') return t('admin.real.error.forbidden');
    if (e.code === 'unknown_event') return t('admin.real.error.unknownEvent');
  }
  return e instanceof Error ? e.message : String(e);
}

async function guarded<T>(work: Promise<T>): Promise<T> {
  try {
    return await work;
  } catch (e) {
    throw new Error(guestListErrorText(e));
  }
}

/**
 * «Lista» de una fiesta en el Admin (plan 034 T310): poner o quitar el modo
 * lista, el tope, la hora de cierre y el interruptor abierta/cerrada; la
 * lista con nombre, apodo, email, cuándo se apuntó y si entró; borrar una
 * inscripción (con confirmación) y «Descargar CSV». Se carga al abrirla.
 * Sin Supabase va sobre la lista de este navegador (D-20); con cuentas, las
 * RPC del Admin (rol admin con segundo factor).
 */
export function GuestListPanel({ api, event }: { api: GuestListApi; event: string }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<GuestListStatus | null>(null);
  const [rows, setRows] = useState<GuestListAdminRow[] | null>(null);
  const [form, setForm] = useState<GuestListForm | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { status: line, busy, run } = useRun();

  const load = useCallback(async () => {
    try {
      const [st, list] = await Promise.all([api.admin.status(event), api.admin.list(event)]);
      setStatus(st);
      setRows(list);
      setForm(formOf(st));
      setLoadError(null);
    } catch (e) {
      setLoadError(guestListErrorText(e));
    }
  }, [api, event]);

  const save = () =>
    void run(async () => {
      if (!form) return;
      const parsed = settingsOf(form);
      if (!parsed.ok) throw new Error(t(parsed.error));
      const st = await guarded(api.admin.updateSettings(event, parsed.settings));
      setStatus(st);
      setForm(formOf(st));
    }, t('admin.guestList.saved'));

  const remove = (row: GuestListAdminRow) => {
    if (!window.confirm(t('admin.guestList.removeConfirm', { name: row.listName }))) return;
    void run(async () => {
      await guarded(api.admin.remove(event, row.userId));
      await load();
    }, t('admin.guestList.removed'));
  };

  const csv = () =>
    void run(async () => {
      const list = await guarded(api.admin.list(event));
      setRows(list);
      download(
        new Blob([guestListCsv(list)], { type: 'text/csv;charset=utf-8' }),
        guestListCsvName(event),
      );
    }, t('admin.guestList.csvReady'));

  return (
    <details
      className="admin-details"
      data-testid={`lista-${event}`}
      onToggle={(e) => {
        const now = (e.currentTarget as HTMLDetailsElement).open;
        setOpen(now);
        if (now) void load();
      }}
    >
      <summary>{t('admin.guestList.title')}</summary>
      {!open ? null : loadError ? (
        <p className="admin-status admin-status--error" role="alert">
          {loadError}
        </p>
      ) : !status || !rows || !form ? (
        <p>{t('empty.loading')}</p>
      ) : (
        <div className="admin-lista">
          <p className="admin-meta">{t('admin.guestList.hint')}</p>
          <div className="admin-row">
            <label className="admin-check">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                data-testid={`lista-modo-${event}`}
              />
              {t('admin.guestList.enabled')}
            </label>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={form.open}
                onChange={(e) => setForm({ ...form, open: e.target.checked })}
                data-testid={`lista-abierta-${event}`}
              />
              {t('admin.guestList.open')}
            </label>
          </div>
          <div className="admin-grid">
            <label className="admin-field">
              <span className="admin-field__label">{t('admin.guestList.cap')}</span>
              <input
                type="number"
                min={1}
                max={100000}
                inputMode="numeric"
                value={form.cap}
                onChange={(e) => setForm({ ...form, cap: e.target.value })}
                data-testid={`lista-tope-${event}`}
              />
            </label>
            <label className="admin-field">
              <span className="admin-field__label">{t('admin.guestList.closes')}</span>
              <input
                type="datetime-local"
                value={form.closes}
                onChange={(e) => setForm({ ...form, closes: e.target.value })}
                data-testid={`lista-cierre-${event}`}
              />
              <span className="admin-field__hint">{t('admin.guestList.closesHint')}</span>
            </label>
          </div>
          <div className="admin-row">
            <button
              type="button"
              className="admin-button"
              disabled={busy}
              onClick={save}
              data-testid={`lista-guardar-${event}`}
            >
              {t('admin.guestList.save')}
            </button>
            <button
              type="button"
              className="admin-button admin-button--ghost"
              disabled={busy || rows.length === 0}
              onClick={csv}
              data-testid={`lista-csv-${event}`}
            >
              {t('admin.guestList.csv')}
            </button>
          </div>
          <StatusLine status={line} />
          <GuestListView
            summary={guestListSummary(status, rows)}
            rows={rows}
            busy={busy}
            onRemove={remove}
          />
        </div>
      )}
    </details>
  );
}

/** El resumen y la tabla de la lista (sin estado: se prueba renderizándola). */
export function GuestListView({
  summary,
  rows,
  busy = false,
  onRemove,
}: {
  summary: GuestListSummary;
  rows: readonly GuestListAdminRow[];
  busy?: boolean;
  onRemove?: (row: GuestListAdminRow) => void;
}) {
  return (
    <>
      <p
        className="admin-meta"
        data-testid="lista-resumen"
        data-apuntados={summary.count}
        data-entraron={summary.scanned}
      >
        {summary.cap === null
          ? t('admin.guestList.countNoCap', { n: summary.count, scanned: summary.scanned })
          : t('admin.guestList.count', {
              n: summary.count,
              cap: summary.cap,
              scanned: summary.scanned,
            })}
      </p>
      {rows.length === 0 ? (
        <p className="admin-meta" data-testid="lista-vacia">
          {t('admin.guestList.empty')}
        </p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table" data-testid="lista-tabla">
            <thead>
              <tr>
                <th scope="col">{t('admin.guestList.col.name')}</th>
                <th scope="col">{t('admin.guestList.col.nickname')}</th>
                <th scope="col">{t('admin.guestList.col.email')}</th>
                <th scope="col">{t('admin.guestList.col.date')}</th>
                <th scope="col">{t('admin.guestList.col.attended')}</th>
                <th scope="col">
                  <span className="visually-hidden">{t('admin.guestList.col.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId} data-testid="lista-fila" data-entro={r.attended ? 'si' : 'no'}>
                  <td>{r.listName}</td>
                  <td>{r.nickname ?? '—'}</td>
                  <td>{r.email ?? '—'}</td>
                  <td>{when(r.createdAt)}</td>
                  <td>{r.attended ? t('admin.guestList.attendedYes') : '—'}</td>
                  <td>
                    {onRemove ? (
                      <button
                        type="button"
                        className="admin-link"
                        disabled={busy}
                        onClick={() => onRemove(r)}
                        data-testid="lista-borrar"
                      >
                        {t('admin.guestList.remove')}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
