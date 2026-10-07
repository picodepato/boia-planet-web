'use client';

import type { RankingPage, RankingRow, VoidedEntry } from '@boia/db/rpc';
import { formatRaceTime } from '@boia/engine/circuit';
import { useCallback, useEffect, useState } from 'react';
import { gameBoardOptions, scoreTarget, voidedBoardLabel } from '../../../lib/admin/moderation';
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

function RaceTimes({
  sb,
  revision,
  onChanged,
}: {
  sb: BoiaSupabase | null;
  revision: number;
  onChanged: () => void;
}) {
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
    [pick, revision],
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
                    onChanged();
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

/** Las tablas del Cañón y del Castillo: anular una partida (plan 017 T191). */
function GameScores({
  sb,
  revision,
  onChanged,
}: {
  sb: BoiaSupabase | null;
  revision: number;
  onChanged: () => void;
}) {
  const options = gameBoardOptions();
  const [pick, setPick] = useState(options[0]?.key ?? '');
  const option = options.find((o) => o.key === pick) ?? options[0];
  const page = usePaged(
    option ? sb : null,
    async (c, offset) => {
      const b = option!.board;
      const res =
        b.kind === 'canon'
          ? c.rpc('ranking_canon', {
              p_boss: b.boss,
              p_version: b.version,
              p_limit: PAGE,
              p_offset: offset,
            })
          : c.rpc('ranking_castle', {
              p_run_min: b.runMin,
              p_difficulty: b.difficulty,
              p_version: b.version,
              p_limit: PAGE,
              p_offset: offset,
            });
      try {
        return (await must(res)) as unknown as RankingPage;
      } catch (e) {
        // Una tabla que el servidor aún no tiene: vacía.
        if (e instanceof Error && e.message === 'unknown_board') {
          return { total: 0, limit: PAGE, offset, rows: [], mine: null } as unknown as RankingPage;
        }
        throw e;
      }
    },
    [pick, revision],
  );
  return (
    <div data-testid="rankings-juegos">
      <h3>{t('admin.real.rankings.games')}</h3>
      <label className="admin-field">
        <span className="admin-field__label">{t('admin.real.rankings.board')}</span>
        <select
          value={option?.key ?? ''}
          onChange={(e) => setPick(e.target.value)}
          data-testid="rankings-tabla"
        >
          {options.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
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
                data-testid={`rankings-partida-${r.user_id}`}
              >
                <span>
                  {r.position}. <strong>{r.nickname}</strong> ·{' '}
                  {t('admin.real.rankings.score', { value: r.value })}
                  {r.best_at ? <span className="admin-meta"> · {when(r.best_at)}</span> : null}
                </span>
                <VoidButton
                  testId={`rankings-anular-partida-${r.user_id}`}
                  onVoid={async (reason) => {
                    if (!sb || !option) return;
                    await must(
                      sb.rpc('admin_void_score', {
                        ...scoreTarget(option.board),
                        p_user: r.user_id,
                        p_reason: reason,
                      }),
                    );
                    onChanged();
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

/** Las entradas anuladas de todos los rankings, para devolverlas (plan 017 T191). */
function Voided({
  sb,
  revision,
  onChanged,
}: {
  sb: BoiaSupabase | null;
  revision: number;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<VoidedEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { status, busy, run } = useRun();
  useEffect(() => {
    if (!sb) return;
    let alive = true;
    void must(sb.rpc('admin_list_voided', { p_limit: 100 })).then(
      (d) => {
        if (!alive) return;
        setRows(d as unknown as VoidedEntry[]);
        setError(null);
      },
      (e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      alive = false;
    };
  }, [sb, revision]);
  return (
    <div data-testid="rankings-anuladas">
      <h3>{t('admin.real.rankings.voidedTitle')}</h3>
      {error ? (
        <p className="admin-status admin-status--error" role="alert">
          {error}
        </p>
      ) : null}
      {!rows ? (
        <p>{t('empty.loading')}</p>
      ) : rows.length === 0 ? (
        <p className="admin-meta">{t('admin.real.rankings.voidedEmpty')}</p>
      ) : (
        <ul className="admin-list">
          {rows.map((e) => (
            <li
              key={`${e.board}|${e.user_id}|${e.key}|${e.version}`}
              className="admin-row admin-row--between"
              data-testid={`rankings-anulada-${e.board}-${e.user_id}`}
            >
              <span>
                <strong>{e.nickname ?? t('admin.moderation.sinApodo')}</strong> ·{' '}
                {voidedBoardLabel(e)} ·{' '}
                {e.board === 'race'
                  ? formatRaceTime(e.value)
                  : t('admin.real.rankings.score', { value: e.value })}
                <span className="admin-meta">
                  {' '}
                  · {when(e.voided_at)}
                  {e.void_reason ? ` · ${e.void_reason}` : ''}
                </span>
              </span>
              <button
                type="button"
                className="admin-button admin-button--ghost"
                disabled={busy || !sb}
                data-testid={`rankings-devolver-${e.board}-${e.user_id}`}
                onClick={() =>
                  void run(async () => {
                    if (!sb) return;
                    await must(
                      sb.rpc('admin_restore_score', {
                        p_board: e.board,
                        p_user: e.user_id,
                        p_key: e.key,
                        p_version: e.version,
                      }),
                    );
                    onChanged();
                  }, t('admin.real.rankings.restored'))
                }
              >
                {t('admin.real.rankings.restore')}
              </button>
            </li>
          ))}
        </ul>
      )}
      <StatusLine status={status} />
    </div>
  );
}

/** Rankings (T94, decisiones 7, 8 y 11, REQ-ADM-028): anular un tiempo o unos puntos con motivo. */
export function RankingsSection() {
  const sb = useAdminSupabase();
  // Anular o devolver vuelve a leer las anuladas y las tablas.
  const [revision, setRevision] = useState(0);
  const changed = () => setRevision((r) => r + 1);
  return (
    <section data-testid="rankings">
      <SectionHead title={t('admin.real.rankings.title')} lead={t('admin.real.rankings.lead')} />
      <NeedsAdmin>
        <RaceTimes sb={sb} revision={revision} onChanged={changed} />
        <GameScores sb={sb} revision={revision} onChanged={changed} />
        <Voided sb={sb} revision={revision} onChanged={changed} />
        <Points sb={sb} />
      </NeedsAdmin>
    </section>
  );
}
