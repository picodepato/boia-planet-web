'use client';

import type { AdminCarnetPage, AdminCarnetRow } from '@boia/db/rpc';
import { useCallback, useEffect, useState } from 'react';
import {
  CARNET_ACTION_LABEL,
  carnetActions,
  carnetBadges,
  needsReason,
} from '../../../lib/admin/moderation';
import { t } from '../../../lib/i18n';
import type { BoiaSupabase } from '../../../lib/supabase/browser';
import { SectionHead, StatusLine } from '../ui';
import { useRun } from '../use-admin';
import { NeedsAdmin, must, useAdminSupabase } from './common';

const PAGE = 50;

function CarnetCard({
  sb,
  row,
  onChanged,
}: {
  sb: BoiaSupabase;
  row: AdminCarnetRow;
  onChanged: () => void;
}) {
  const [reason, setReason] = useState('');
  const { status, busy, run } = useRun();
  const badges = carnetBadges({
    hidden: !!row.hidden_at,
    nickname: row.nickname_moderated,
    avatar: row.avatar_moderated,
  });
  return (
    <li
      className="admin-card"
      data-testid={`carnet-real-${row.user_id}`}
      data-oculto={row.hidden_at ? 'si' : 'no'}
      data-apodo={row.nickname_moderated ? 'retirado' : 'visible'}
      data-foto={row.avatar_moderated ? 'retirada' : 'visible'}
    >
      <div className="admin-row admin-row--between">
        <div>
          <p>
            <strong>{row.nickname}</strong>
            {row.member_number
              ? ` · ${t('admin.moderation.carnets.number', { n: row.member_number })}`
              : ''}
            {badges.map((k) => (
              <span key={k} className="admin-badge">
                {t(k)}
              </span>
            ))}
          </p>
          {row.original_nickname ? (
            <p className="admin-meta">
              {t('admin.moderation.carnets.original', { nickname: row.original_nickname })}
            </p>
          ) : null}
        </div>
        <a className="admin-link" href={`/carnet/${row.user_id}`}>
          {t('admin.moderation.carnets.view')}
        </a>
      </div>
      <div className="admin-row admin-row--end">
        <label className="admin-field">
          <span className="admin-field__label">{t('admin.real.reason')}</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            data-testid={`carnet-real-motivo-${row.user_id}`}
          />
        </label>
        {carnetActions(row).map((action) => (
          <button
            key={action}
            type="button"
            className={needsReason(action) ? 'admin-button admin-button--danger' : 'admin-button'}
            disabled={busy || (needsReason(action) && reason.trim().length < 3)}
            data-testid={`carnet-real-${action}-${row.user_id}`}
            onClick={() =>
              void run(async () => {
                await must(
                  sb.rpc('admin_moderate_carnet', {
                    p_user: row.user_id,
                    p_action: action,
                    p_reason: reason.trim(),
                  }),
                );
                onChanged();
              }, t('admin.moderation.carnets.done'))
            }
          >
            {t(CARNET_ACTION_LABEL[action])}
          </button>
        ))}
      </div>
      <StatusLine status={status} />
    </li>
  );
}

/**
 * Carnets con datos reales (plan 017 T191, REQ-ADM-031): buscar un Carnet,
 * ocultarlo o mostrarlo, retirar o devolver su apodo y su foto.
 */
export function RealCarnets() {
  const sb = useAdminSupabase();
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [onlyModerated, setOnlyModerated] = useState(false);
  const [page, setPage] = useState<AdminCarnetPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const load = useCallback(
    async (offset: number): Promise<AdminCarnetPage> => {
      if (!sb) return { total: 0, rows: [] };
      return (await must(
        sb.rpc('admin_list_carnets', {
          p_search: applied,
          p_moderated_only: onlyModerated,
          p_limit: PAGE,
          p_offset: offset,
        }),
      )) as unknown as AdminCarnetPage;
    },
    [sb, applied, onlyModerated],
  );

  useEffect(() => {
    let alive = true;
    load(0).then(
      (p) => {
        if (!alive) return;
        setPage(p);
        setError(null);
      },
      (e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      alive = false;
    };
  }, [load, revision]);

  return (
    <section data-testid="carnets-reales">
      <SectionHead
        title={t('admin.moderation.carnets.allHeading')}
        lead={t('admin.moderation.carnets.allLead')}
      />
      <NeedsAdmin>
        <form
          className="admin-row admin-row--end"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(search.trim());
          }}
        >
          <label className="admin-field">
            <span className="admin-field__label">{t('admin.moderation.carnets.search')}</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="carnets-reales-buscar"
            />
          </label>
          <button
            type="submit"
            className="admin-button admin-button--ghost"
            data-testid="carnets-reales-buscar-ok"
          >
            {t('admin.real.search')}
          </button>
          <label className="admin-check">
            <input
              type="checkbox"
              checked={onlyModerated}
              onChange={(e) => setOnlyModerated(e.target.checked)}
              data-testid="carnets-reales-moderados"
            />
            {t('admin.moderation.carnets.moderatedOnly')}
          </label>
        </form>
        {error ? (
          <p className="admin-status admin-status--error" role="alert">
            {error}
          </p>
        ) : null}
        {!page || !sb ? (
          <p>{t('empty.loading')}</p>
        ) : (
          <>
            <p className="admin-meta">
              {t('admin.real.rankings.count', { shown: page.rows.length, total: page.total })}
            </p>
            <ul className="admin-list">
              {page.rows.map((row) => (
                <CarnetCard
                  key={`${row.user_id}|${row.hidden_at}|${row.nickname_moderated}|${row.avatar_moderated}`}
                  sb={sb}
                  row={row}
                  onChanged={() => setRevision((r) => r + 1)}
                />
              ))}
              {page.rows.length === 0 ? (
                <li className="admin-meta">{t('admin.moderation.carnets.none')}</li>
              ) : null}
            </ul>
            {page.rows.length < page.total ? (
              <button
                type="button"
                className="admin-button admin-button--ghost"
                onClick={() =>
                  void load(page.rows.length).then(
                    (more) =>
                      setPage((cur) => {
                        const seen = new Set((cur?.rows ?? []).map((r) => r.user_id));
                        return {
                          total: more.total,
                          rows: [
                            ...(cur?.rows ?? []),
                            ...more.rows.filter((r) => !seen.has(r.user_id)),
                          ],
                        };
                      }),
                    (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
                  )
                }
              >
                {t('ranking.more')}
              </button>
            ) : null}
          </>
        )}
      </NeedsAdmin>
    </section>
  );
}
