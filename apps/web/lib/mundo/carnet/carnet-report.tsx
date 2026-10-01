'use client';

import { CARNET_REPORT_REASON_MAX, type CarnetView } from '@boia/store';
import { useState } from 'react';
import { gameRepository } from '../repo';
import { t } from '../../i18n';

/** Textos del reporte de Carnets (textos-zonas, zona 18; D-23 O9). muestra */
export const CARNET_REPORT_COPY = {
  report: t('carnet.report'),
  reason: t('carnet.report.reason'),
  send: t('bottle.report.send'),
  cancel: t('carnet.cancel'),
  done: t('carnet.report.done'),
  again: t('carnet.report.again'),
  failed: t('juego.carnetReport.noSePudoEnviar'),
} as const;

type State =
  { kind: 'closed' } | { kind: 'open' } | { kind: 'sent'; first: boolean } | { kind: 'error' };

/**
 * «Reportar» en el Carnet público de otra persona (REQ-ADM-040, O9): un
 * motivo opcional y listo; lo revisa la moderación del Admin. Una vez por
 * persona y Carnet. En la versión de prueba el reporte se queda en este
 * navegador, como todo (D-20).
 */
export function CarnetReport({ carnet }: { carnet: CarnetView }) {
  const [state, setState] = useState<State>({ kind: 'closed' });
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  if (carnet.isMine) return null;

  const send = async () => {
    setBusy(true);
    try {
      const r = await gameRepository().carnet.report(carnet.userId, reason.trim() || null);
      setState({ kind: 'sent', first: r.first });
    } catch (err) {
      console.warn('[boia] no se pudo reportar el Carnet', err);
      setState({ kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (state.kind === 'sent') {
    return (
      <p className="carnet-report-done" role="status" data-testid="carnet-reporte-hecho">
        {state.first ? CARNET_REPORT_COPY.done : CARNET_REPORT_COPY.again}
      </p>
    );
  }
  if (state.kind === 'closed') {
    return (
      <p className="carnet-report">
        <button
          type="button"
          className="juego-link"
          data-testid="carnet-reportar"
          onClick={() => setState({ kind: 'open' })}
        >
          {CARNET_REPORT_COPY.report}
        </button>
      </p>
    );
  }
  return (
    <form
      className="carnet-report is-open"
      data-testid="carnet-reporte"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <label>
        <span>{CARNET_REPORT_COPY.reason}</span>
        <textarea
          value={reason}
          maxLength={CARNET_REPORT_REASON_MAX}
          rows={2}
          data-testid="carnet-reporte-motivo"
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <div className="carnet-actions">
        <button
          type="submit"
          className="juego-button"
          disabled={busy}
          data-testid="carnet-reporte-enviar"
        >
          {CARNET_REPORT_COPY.send}
        </button>
        <button type="button" className="juego-link" onClick={() => setState({ kind: 'closed' })}>
          {CARNET_REPORT_COPY.cancel}
        </button>
      </div>
      {state.kind === 'error' ? (
        <p className="juego-muted" role="alert">
          {CARNET_REPORT_COPY.failed}
        </p>
      ) : null}
    </form>
  );
}
