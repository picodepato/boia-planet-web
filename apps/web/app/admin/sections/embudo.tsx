'use client';

import type { FunnelCountsResult } from '@boia/db/rpc';
import { useCallback, useEffect, useState } from 'react';
import {
  FUNNEL_STEPS,
  FUNNEL_WINDOWS,
  type FunnelCountRow,
  funnelSummary,
} from '../../../lib/analytics/funnel';
import { funnelDay, readLocalFunnelCounts } from '../../../lib/analytics/local-counts';
import { type MessageKey, t as msg } from '../../../lib/i18n';
import { NeedsAdmin, must, useAdminSupabase, useMaybeRealAdmin } from '../real/common';
import { SectionHead, StatusLine } from '../ui';
import type { AdminContext, Status } from '../use-admin';

/** Lo que pinta el panel: qué día es hoy y las filas de los últimos 30 días. */
interface FunnelData {
  today: string;
  rows: FunnelCountRow[];
}

const LONGEST = Math.max(...FUNNEL_WINDOWS);

/**
 * «Embudo» (plan 032 T301, REQ-ARQ-019): por paso, lo contado en los
 * últimos 7 y 30 días y el % del paso anterior. Con cuentas lo lee
 * `admin_funnel_counts` (sólo un admin); en la demo, los contadores de este
 * navegador.
 */
export function FunnelSection(_props: { ctx: AdminContext }) {
  const real = useMaybeRealAdmin();
  return (
    <section>
      <SectionHead
        title={msg('admin.gestion.funnel.title')}
        lead={msg('admin.gestion.funnel.lead')}
      />
      {real ? (
        <NeedsAdmin>
          <FunnelPanel real />
        </NeedsAdmin>
      ) : (
        <FunnelPanel real={false} />
      )}
    </section>
  );
}

function FunnelPanel({ real }: { real: boolean }) {
  const sb = useAdminSupabase();
  const [data, setData] = useState<FunnelData | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const load = useCallback(async () => {
    try {
      if (real) {
        if (!sb) throw new Error(msg('admin.real.error.network'));
        const r = (await must(
          sb.rpc('admin_funnel_counts', { p_days: LONGEST }),
        )) as unknown as FunnelCountsResult;
        setData({ today: r.today, rows: r.rows });
      } else {
        setData({ today: funnelDay(), rows: readLocalFunnelCounts() });
      }
      setStatus({ kind: 'idle' });
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
    }
  }, [real, sb]);
  useEffect(() => {
    void load();
  }, [load]);

  const summaries = data
    ? FUNNEL_WINDOWS.map((days) => funnelSummary(data.rows, data.today, days))
    : null;
  return (
    <div className="admin-card" data-testid="embudo">
      <p className="admin-meta">
        {real ? msg('admin.gestion.funnel.real') : msg('admin.gestion.funnel.local')}
      </p>
      {summaries ? (
        <table className="admin-table" data-testid="embudo-tabla">
          <thead>
            <tr>
              <th scope="col">{msg('admin.gestion.funnel.step')}</th>
              {FUNNEL_WINDOWS.map((days) => (
                <FunnelWindowHead key={days} days={days} />
              ))}
            </tr>
          </thead>
          <tbody>
            {FUNNEL_STEPS.map((event, i) => (
              <tr key={event} data-testid={`embudo-${event}`}>
                <th scope="row">{msg(`admin.gestion.funnel.step.${event}` as MessageKey)}</th>
                {summaries.map((s, w) => {
                  const step = s[i]!;
                  return [
                    <td key={`n${w}`} data-testid={`embudo-${event}-${FUNNEL_WINDOWS[w]}`}>
                      {step.count.toLocaleString('es-ES')}
                    </td>,
                    <td key={`p${w}`}>
                      {step.pctFromPrev === null
                        ? msg('admin.gestion.funnel.noPct')
                        : `${step.pctFromPrev.toLocaleString('es-ES')} %`}
                    </td>,
                  ];
                })}
              </tr>
            ))}
          </tbody>
        </table>
      ) : status.kind === 'idle' ? (
        <p>{msg('empty.loading')}</p>
      ) : null}
      <button type="button" className="admin-button" onClick={() => void load()}>
        {msg('admin.gestion.funnel.refresh')}
      </button>
      <StatusLine status={status} />
    </div>
  );
}

function FunnelWindowHead({ days }: { days: number }) {
  return (
    <>
      <th scope="col">{msg('admin.gestion.funnel.window', { days })}</th>
      <th scope="col">{msg('admin.gestion.funnel.pct')}</th>
    </>
  );
}
