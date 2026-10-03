'use client';

import { useCallback, useEffect, useState } from 'react';
import { t } from '../../../lib/i18n';
import type { BoiaSupabase } from '../../../lib/supabase/browser';
import { SectionHead, StatusLine } from '../ui';
import { useRun } from '../use-admin';
import { NeedsAdmin, must, useAdminSupabase, when } from './common';

interface ReportRow {
  id: string;
  bottle_id: string;
  reason: string | null;
  created_at: string;
  bottles: {
    id: string;
    message: string;
    status: string;
    user_id: string;
    created_at: string;
  } | null;
}

interface ReportedBottle {
  id: string;
  message: string;
  status: string;
  author: string | null;
  createdAt: string;
  reports: { id: string; reason: string | null; at: string }[];
}

/** Los reportes abiertos, agrupados por botella (la más reportada primero). */
async function readReported(sb: BoiaSupabase): Promise<ReportedBottle[]> {
  const rows = (await must(
    sb
      .from('bottle_reports')
      .select(
        'id, bottle_id, reason, created_at, bottles(id, message, status, user_id, created_at)',
      )
      .is('resolved_at', null)
      .order('created_at', { ascending: true })
      .limit(500),
  )) as unknown as ReportRow[];
  const byBottle = new Map<string, ReportedBottle & { userId: string }>();
  for (const r of rows) {
    if (!r.bottles) continue;
    const b =
      byBottle.get(r.bottle_id) ??
      ({
        id: r.bottles.id,
        message: r.bottles.message,
        status: r.bottles.status,
        author: null,
        createdAt: r.bottles.created_at,
        userId: r.bottles.user_id,
        reports: [],
      } as ReportedBottle & { userId: string });
    b.reports.push({ id: r.id, reason: r.reason, at: r.created_at });
    byBottle.set(r.bottle_id, b);
  }
  const list = [...byBottle.values()];
  const ids = [...new Set(list.map((b) => b.userId))];
  if (ids.length) {
    const carnets = await must(sb.from('carnets').select('user_id, nickname').in('user_id', ids));
    const nick = new Map((carnets ?? []).map((c) => [c.user_id, c.nickname]));
    for (const b of list) b.author = nick.get(b.userId) ?? null;
  }
  return list.sort((a, b) => b.reports.length - a.reports.length);
}

const STATUS: Record<string, string> = {
  active: t('admin.moderation.enElMar'),
  retired: t('admin.moderation.retiradaPorSuAutor'),
  removed: t('admin.moderation.retiradaPorModeracion'),
};

function BottleCard({
  sb,
  b,
  onChanged,
}: {
  sb: BoiaSupabase;
  b: ReportedBottle;
  onChanged: () => void;
}) {
  const [reason, setReason] = useState(b.reports.find((r) => r.reason)?.reason ?? '');
  const { status, busy, run } = useRun();
  return (
    <li className="admin-card" data-testid={`botella-real-${b.id}`} data-estado={b.status}>
      <p>«{b.message}»</p>
      <p className="admin-meta">
        {b.author ?? t('admin.moderation.sinApodo')} · {STATUS[b.status] ?? b.status} ·{' '}
        {when(b.createdAt)} · {t('admin.real.botellas.reports', { n: b.reports.length })}
      </p>
      <ul className="admin-reports">
        {b.reports.map((r) => (
          <li key={r.id}>
            {r.reason ?? t('admin.moderation.sinMotivo')} · {when(r.at)}{' '}
            <button
              type="button"
              className="admin-link"
              disabled={busy}
              data-testid={`botella-real-descartar-${r.id}`}
              onClick={() =>
                void run(async () => {
                  await must(
                    sb.rpc('admin_dismiss_bottle_report', { p_report: r.id, p_reason: reason }),
                  );
                  onChanged();
                }, t('admin.moderation.reporteDescartado'))
              }
            >
              {t('admin.moderation.descartar')}
            </button>
          </li>
        ))}
      </ul>
      <div className="admin-row admin-row--end">
        <label className="admin-field">
          <span className="admin-field__label">{t('admin.real.reason')}</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            data-testid={`botella-real-motivo-${b.id}`}
          />
        </label>
        <button
          type="button"
          className="admin-button admin-button--danger"
          disabled={busy}
          data-testid={`botella-real-retirar-${b.id}`}
          onClick={() =>
            void run(async () => {
              await must(sb.rpc('admin_remove_bottle', { p_bottle: b.id, p_reason: reason }));
              onChanged();
            }, t('admin.moderation.botellaRetiradaDelMar'))
          }
        >
          {t('bottle.retire')}
        </button>
      </div>
      <StatusLine status={status} />
    </li>
  );
}

/** Moderación de botellas con datos reales (T94, decisión 12, REQ-ADM-027). */
export function RealBottles() {
  const sb = useAdminSupabase();
  const [list, setList] = useState<ReportedBottle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    try {
      setList(await readReported(sb));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [sb]);

  useEffect(() => {
    void load();
  }, [load, revision]);

  return (
    <section data-testid="botellas-reales">
      <SectionHead title={t('admin.real.botellas.title')} lead={t('admin.real.botellas.lead')} />
      <NeedsAdmin>
        {error ? (
          <p className="admin-status admin-status--error" role="alert">
            {error}
          </p>
        ) : null}
        {done ? (
          <p
            className="admin-status admin-status--ok"
            role="status"
            data-testid="botellas-reales-ok"
          >
            {done}
          </p>
        ) : null}
        {!list || !sb ? (
          <p>{t('empty.loading')}</p>
        ) : list.length === 0 ? (
          <p className="admin-meta" data-testid="botellas-reales-vacio">
            {t('admin.real.botellas.empty')}
          </p>
        ) : (
          <ul className="admin-list">
            {list.map((b) => (
              <BottleCard
                key={`${b.id}|${b.reports.length}`}
                sb={sb}
                b={b}
                onChanged={() => {
                  setDone(t('admin.real.botellas.updated'));
                  setRevision((r) => r + 1);
                }}
              />
            ))}
          </ul>
        )}
      </NeedsAdmin>
    </section>
  );
}
