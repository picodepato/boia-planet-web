'use client';

import type { TrashList, TrashPurgeResult } from '@boia/db/rpc';
import { useCallback, useEffect, useState } from 'react';
import { t } from '../../../lib/i18n';
import { StatusLine } from '../ui';
import { useRun } from '../use-admin';
import { NeedsAdmin, must, useAdminSupabase, when } from './common';

/**
 * Socios y fiestas borrados con cuentas (plan 020 T230, decisión 6): lo que
 * se borra en «Socios y emails» y en «Fiestas y QR» va a la papelera de la
 * base de datos (`admin_list_trash`), se devuelve durante el plazo y lo
 * purga el flujo diario (o «Purgar lo caducado»).
 */
export function RealDeletedTrash() {
  const sb = useAdminSupabase();
  const [list, setList] = useState<TrashList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [purged, setPurged] = useState<TrashPurgeResult | null>(null);
  const { status, busy, run } = useRun();

  const load = useCallback(async () => {
    if (!sb) return;
    try {
      setList((await must(sb.rpc('admin_list_trash', { p_limit: 200 }))) as unknown as TrashList);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [sb]);

  useEffect(() => {
    void load();
  }, [load, revision]);

  const reload = () => setRevision((r) => r + 1);
  const span = (deleted: string, expires: string) =>
    t('admin.real.trash.when', { day: when(deleted), until: when(expires) });

  return (
    <section data-testid="papelera-real">
      <h2>{t('admin.real.trash.title')}</h2>
      <NeedsAdmin>
        <p className="admin-lead">{t('admin.real.trash.lead', { days: list?.days ?? 30 })}</p>
        {error ? (
          <p className="admin-status admin-status--error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="admin-row">
          <button
            type="button"
            className="admin-button admin-button--ghost"
            disabled={busy || !sb}
            data-testid="papelera-real-purgar"
            onClick={() =>
              void run(async () => {
                setPurged(
                  (await must(sb!.rpc('admin_purge_expired_trash'))) as unknown as TrashPurgeResult,
                );
                reload();
              }, t('admin.real.trash.purgeDone'))
            }
          >
            {t('admin.real.trash.purge')}
          </button>
        </div>
        {purged ? (
          <p className="admin-meta" data-testid="papelera-real-purgado">
            {t('admin.real.trash.purged', {
              members: purged.members,
              events: purged.events,
              kept: purged.events_kept,
            })}
          </p>
        ) : null}
        <StatusLine status={status} />
        {!list || !sb ? (
          <p>{t('empty.loading')}</p>
        ) : (
          <>
            <h3>{t('admin.real.trash.members')}</h3>
            <ul className="admin-list" data-testid="papelera-real-socios">
              {list.members.map((m) => (
                <li
                  key={m.user_id}
                  className="admin-card admin-row admin-row--between"
                  data-testid={`papelera-socio-${m.user_id}`}
                >
                  <span>
                    <strong>{m.nickname ?? t('admin.real.trash.noCarnet')}</strong>
                    {m.member_number ? ` · nº ${m.member_number}` : ''} · {m.email}
                    <br />
                    <span className="admin-meta">
                      {span(m.deleted_at, m.expires_at)} · {m.reason}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="admin-button admin-button--ghost"
                    disabled={busy}
                    data-testid={`papelera-socio-devolver-${m.user_id}`}
                    onClick={() =>
                      void run(async () => {
                        await must(
                          sb.rpc('admin_restore_member', {
                            p_user: m.user_id,
                            p_reason: t('admin.real.trash.restoreReason'),
                          }),
                        );
                        reload();
                      }, t('admin.real.trash.memberRestored'))
                    }
                  >
                    {t('admin.real.trash.restore')}
                  </button>
                </li>
              ))}
              {list.members.length === 0 ? (
                <li className="admin-meta">{t('admin.real.trash.noMembers')}</li>
              ) : null}
            </ul>
            <h3>{t('admin.real.trash.events')}</h3>
            <ul className="admin-list" data-testid="papelera-real-fiestas">
              {list.events.map((e) => (
                <li
                  key={e.id}
                  className="admin-card admin-row admin-row--between"
                  data-testid={`papelera-fiesta-${e.slug}`}
                >
                  <span>
                    <strong>{e.title}</strong> · {e.slug} · {when(e.starts_at)}
                    <br />
                    <span className="admin-meta">
                      {span(e.deleted_at, e.expires_at)}
                      {e.reason ? ` · ${e.reason}` : ''}
                    </span>
                    {e.kept ? (
                      <>
                        <br />
                        <span className="admin-meta">{t('admin.real.trash.kept')}</span>
                      </>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    className="admin-button admin-button--ghost"
                    disabled={busy}
                    data-testid={`papelera-fiesta-devolver-${e.slug}`}
                    onClick={() =>
                      void run(async () => {
                        await must(
                          sb.rpc('admin_restore_event', {
                            p_id: e.id,
                            p_reason: t('admin.real.trash.restoreReason'),
                          }),
                        );
                        reload();
                      }, t('admin.real.trash.eventRestored'))
                    }
                  >
                    {t('admin.real.trash.restore')}
                  </button>
                </li>
              ))}
              {list.events.length === 0 ? (
                <li className="admin-meta">{t('admin.real.trash.noEvents')}</li>
              ) : null}
            </ul>
          </>
        )}
      </NeedsAdmin>
    </section>
  );
}
