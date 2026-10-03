'use client';

import type { RankingPage, RankingRow } from '@boia/db/rpc';
import { formatRaceTime } from '@boia/engine/circuit';
import { useCallback, useEffect, useState } from 'react';
import { t } from '../../../lib/i18n';
import type { BoiaSupabase } from '../../../lib/supabase/browser';
import { SectionHead, StatusLine } from '../ui';
import { useRun } from '../use-admin';
import { NeedsAdmin, must, useAdminSupabase, when } from './common';

const PAGE = 50;

interface Circuit {
  id: string;
  version: number;
  name: string;
}

interface LedgerRow {
  id: string;
  kind: string;
  points_delta: number;
  coins_delta: number;
  source_ref: string | null;
  action: string | null;
  reason: string | null;
  created_at: string;
  compensates_id: string | null;
}

/** Un motivo y «Anular» (lo mismo para un tiempo y para unos puntos). */
function VoidButton({
  testId,
  onVoid,
}: {
  testId: string;
  onVoid: (reason: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const { status, busy, run } = useRun();
  return (
    <span className="admin-void">
      <button
        type="button"
        className="admin-button admin-button--ghost"
        disabled={busy}
        data-testid={testId}
        onClick={() => setOpen((v) => !v)}
      >
        {t('admin.real.rankings.void')}
      </button>
      {open ? (
        <span className="admin-row">
          <label className="admin-field admin-field--inline">
            <span className="admin-field__label">{t('admin.real.reason')}</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              data-testid={`${testId}-motivo`}
            />
          </label>
          <button
            type="button"
            className="admin-button admin-button--danger"
            disabled={busy || reason.trim().length < 3}
            data-testid={`${testId}-confirmar`}
            onClick={() =>
              void run(async () => {
                await onVoid(reason.trim());
                setOpen(false);
              }, t('admin.real.rankings.voided'))
            }
          >
            {t('admin.real.rankings.voidConfirm')}
          </button>
        </span>
      ) : null}
      {status.kind !== 'idle' ? <StatusLine status={status} /> : null}
    </span>
  );
}

function usePaged(
  sb: BoiaSupabase | null,
  fetchPage: (sb: BoiaSupabase, offset: number) => Promise<RankingPage>,
  deps: readonly unknown[],
) {
  const [rows, setRows] = useState<RankingRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const get = useCallback(fetchPage, deps);
  useEffect(() => {
    if (!sb) return;
    let alive = true;
    get(sb, 0).then(
      (p) => {
        if (!alive) return;
        setRows(p.rows);
        setTotal(p.total);
        setError(null);
      },
      (e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      alive = false;
    };
  }, [sb, get, revision]);
  const more = () => {
    if (!sb || !rows) return;
    void get(sb, rows.length).then(
      (p) => {
        setTotal(p.total);
        setRows((cur) => {
          const seen = new Set((cur ?? []).map((r) => r.user_id));
          return [...(cur ?? []), ...p.rows.filter((r) => !seen.has(r.user_id))];
        });
      },
      (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
    );
  };
  return { rows, total, error, more, reload: () => setRevision((r) => r + 1) };
}

function RaceTimes({ sb }: { sb: BoiaSupabase | null }) {
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [pick, setPick] = useState('');
  useEffect(() => {
    if (!sb) return;
    void must(
      sb.from('circuits').select('id, version, name').eq('is_active', true).order('id'),
    ).then(
      (cs) => {
        const list = (cs ?? []) as Circuit[];
        setCircuits(list);
        setPick((p) => p || (list[0] ? `${list[0].id}@${list[0].version}` : ''));
      },
      () => setCircuits([]),
    );
  }, [sb]);
  const [id, v] = pick.split('@');
  const version = Number(v);
  const page = usePaged(
    pick ? sb : null,
    async (c, offset) =>
      (await must(
        c.rpc('ranking_race', {
          p_circuit: id!,
          p_version: version,
          p_limit: PAGE,
          p_offset: offset,
        }),
      )) as unknown as RankingPage,
    [pick],
  );
  return (
    <div data-testid="rankings-tiempos">
      <h3>{t('admin.real.rankings.times')}</h3>
      <label className="admin-field">
        <span className="admin-field__label">{t('admin.real.rankings.circuit')}</span>
        <select
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          data-testid="rankings-circuito"
        >
          {circuits.map((c) => (
            <option key={`${c.id}@${c.version}`} value={`${c.id}@${c.version}`}>
              {c.name} · v{c.version}
            </option>
          ))}
        </select>
      </label>
      {page.error ? (
        <p className="admin-status admin-status--error" role="alert">
          {page.error}
        </p>
      ) : null}
      {!page.rows ? (
        <p>{t('empty.loading')}</p>
      ) : (
        <>
          <p className="admin-meta">
            {t('admin.real.rankings.count', { shown: page.rows.length, total: page.total })}
          </p>
          <ol className="admin-list">
            {page.rows.map((r) => (
              <li
                key={r.user_id}
                className="admin-row admin-row--between"
                data-testid={`rankings-tiempo-${r.user_id}`}
              >
                <span>
                  {r.position}. <strong>{r.nickname}</strong> · {formatRaceTime(r.value)}
                  {r.best_at ? <span className="admin-meta"> · {when(r.best_at)}</span> : null}
                </span>
                <VoidButton
                  testId={`rankings-anular-tiempo-${r.user_id}`}
                  onVoid={async (reason) => {
                    if (!sb) return;
                    await must(
                      sb.rpc('admin_void_race_time', {
                        p_user: r.user_id,
                        p_circuit: id!,
                        p_version: version,
                        p_reason: reason,
                      }),
                    );
                    page.reload();
                  }}
                />
              </li>
            ))}
          </ol>
          {page.rows.length < page.total ? (
            <button type="button" className="admin-button admin-button--ghost" onClick={page.more}>
              {t('ranking.more')}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

function Ledger({
  sb,
  userId,
  onChanged,
}: {
  sb: BoiaSupabase;
  userId: string;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<LedgerRow[] | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    void must(
      sb
        .from('ledger_transactions')
        .select(
          'id, kind, points_delta, coins_delta, source_ref, action, reason, created_at, compensates_id',
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(200),
    ).then(
      (r) => alive && setRows((r ?? []) as LedgerRow[]),
      () => alive && setRows([]),
    );
    return () => {
      alive = false;
    };
  }, [sb, userId, revision]);
  if (!rows) return <p>{t('empty.loading')}</p>;
  const compensated = new Set(rows.flatMap((r) => (r.compensates_id ? [r.compensates_id] : [])));
  return (
    <ul className="admin-list admin-ledger" data-testid={`rankings-libro-${userId}`}>
      {rows.map((e) => {
        const voided = compensated.has(e.id);
        return (
          <li
            key={e.id}
            className="admin-row admin-row--between"
            data-testid={`rankings-entrada-${e.id}`}
          >
            <span>
              {when(e.created_at)} · {e.kind}
              {e.action ? ` (${e.action})` : ''} · {e.source_ref ?? '—'} ·{' '}
              {t('admin.real.rankings.delta', { points: e.points_delta, coins: e.coins_delta })}
              {e.kind === 'compensation' && e.reason ? ` · ${e.reason}` : ''}
              {voided ? (
                <span className="admin-badge">{t('admin.real.rankings.voidedBadge')}</span>
              ) : null}
            </span>
            {e.kind !== 'compensation' && !voided && e.points_delta > 0 ? (
              <VoidButton
                testId={`rankings-anular-puntos-${e.id}`}
                onVoid={async (reason) => {
                  await must(sb.rpc('admin_void_points', { p_tx: e.id, p_reason: reason }));
                  setRevision((r) => r + 1);
                  onChanged();
                }}
              />
            ) : null}
          </li>
        );
      })}
      {rows.length === 0 ? <li className="admin-meta">{t('admin.real.empty')}</li> : null}
    </ul>
  );
}

function Points({ sb }: { sb: BoiaSupabase | null }) {
  const [open, setOpen] = useState<string | null>(null);
  const page = usePaged(
    sb,
    async (c, offset) =>
      (await must(
        c.rpc('ranking_points', { p_limit: PAGE, p_offset: offset }),
      )) as unknown as RankingPage,
    [],
  );
  return (
    <div data-testid="rankings-puntos">
      <h3>{t('admin.real.rankings.points')}</h3>
      {page.error ? (
        <p className="admin-status admin-status--error" role="alert">
          {page.error}
        </p>
      ) : null}
      {!page.rows || !sb ? (
        <p>{t('empty.loading')}</p>
      ) : (
        <>
          <p className="admin-meta">
            {t('admin.real.rankings.count', { shown: page.rows.length, total: page.total })}
          </p>
          <ol className="admin-list">
            {page.rows.map((r) => (
              <li key={r.user_id} data-testid={`rankings-socio-${r.user_id}`}>
                <div className="admin-row admin-row--between">
                  <span>
                    {r.position}. <strong>{r.nickname}</strong> · {r.value}{' '}
                    {t('admin.real.rankings.pointsUnit')}
                  </span>
                  <button
                    type="button"
                    className="admin-button admin-button--ghost"
                    data-testid={`rankings-ver-${r.user_id}`}
                    onClick={() => setOpen((o) => (o === r.user_id ? null : r.user_id))}
                  >
                    {open === r.user_id
                      ? t('admin.real.rankings.hideEntries')
                      : t('admin.real.rankings.showEntries')}
                  </button>
                </div>
                {open === r.user_id ? (
                  <Ledger sb={sb} userId={r.user_id} onChanged={page.reload} />
                ) : null}
              </li>
            ))}
          </ol>
          {page.rows.length < page.total ? (
            <button type="button" className="admin-button admin-button--ghost" onClick={page.more}>
              {t('ranking.more')}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

/** Rankings (T94, decisiones 7, 8 y 11, REQ-ADM-028): anular un tiempo o unos puntos con motivo. */
export function RankingsSection() {
  const sb = useAdminSupabase();
  return (
    <section data-testid="rankings">
      <SectionHead title={t('admin.real.rankings.title')} lead={t('admin.real.rankings.lead')} />
      <NeedsAdmin>
        <RaceTimes sb={sb} />
        <Points sb={sb} />
      </NeedsAdmin>
    </section>
  );
}
