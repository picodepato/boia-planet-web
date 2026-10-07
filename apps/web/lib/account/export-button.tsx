'use client';

import { useState } from 'react';
import { capturePlayerRepository, gameRepository } from '../repo';
import { t } from '../i18n';
import {
  buildAccountExport,
  buildLocalExport,
  downloadJson,
  exportFileName,
} from './export-data';
import { accountClient } from './session';

/**
 * «Descargar mis datos» (plan 017 T193, REQ-IDE-050): un JSON con lo de
 * quien lo pide. En modo local, lo de este navegador; con cuenta, además lo
 * que guarda el servidor (`export_my_data`).
 */
export function AccountExportButton({ withAccount }: { withAccount: boolean }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');

  const run = async () => {
    setState('busy');
    try {
      // El jugador de esta sesión (no cruza un cambio de cuenta a medias).
      const repo = await capturePlayerRepository(gameRepository());
      const now = new Date();
      const data = withAccount
        ? await buildAccountExport(
            repo,
            async () => {
              const sb = await accountClient();
              if (!sb) return null;
              const { data: server, error } = await sb.rpc('export_my_data');
              if (error) throw error;
              return server;
            },
            now,
          )
        : await buildLocalExport(repo, now);
      downloadJson(data, exportFileName(now));
      setState('done');
    } catch (e) {
      console.warn('[boia] descargar mis datos', e);
      setState('error');
    }
  };

  return (
    <div className="cuenta-export" data-testid="cuenta-exportar">
      <p className="cuenta__muted">{t('account.export.lead')}</p>
      <button
        type="button"
        className="acceso-ghost"
        disabled={state === 'busy'}
        data-testid="cuenta-exportar-boton"
        onClick={() => void run()}
      >
        {state === 'busy' ? t('account.export.busy') : t('account.export.button')}
      </button>
      <p className="cuenta__saved" role="status" data-testid="cuenta-exportar-estado">
        {state === 'done'
          ? t('account.export.done')
          : state === 'error'
            ? t('account.export.error')
            : ''}
      </p>
    </div>
  );
}
