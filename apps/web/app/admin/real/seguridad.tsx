'use client';

import { useCallback, useEffect, useState } from 'react';
import { backupCodesLeft, generateBackupCodes } from '../../../lib/account/admin-auth';
import { backupCodesText } from '../../../lib/admin/backup-codes';
import { t } from '../../../lib/i18n';
import { SectionHead } from '../ui';
import { download } from './common';

/**
 * Seguridad del Admin con cuentas (plan 017 T193, REQ-ADM-002): los códigos
 * de respaldo del TOTP. Se generan 10 de un solo uso, se enseñan una vez
 * (con descarga .txt) y el servidor sólo guarda su hash. Generar otros deja
 * sin valor los anteriores.
 */
export function SecuritySection() {
  const [left, setLeft] = useState<number | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setLeft(await backupCodesLeft());
    } catch (e) {
      console.warn('[boia] admin: códigos de respaldo', e);
      setError(true);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const generate = async () => {
    if (left && !window.confirm(t('admin.real.backup.regenerateWarn'))) return;
    setBusy(true);
    setError(false);
    try {
      setCodes(await generateBackupCodes());
      await refresh();
    } catch (e) {
      console.warn('[boia] admin: generar códigos', e);
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section data-testid="admin-seguridad">
      <SectionHead title={t('admin.real.backup.title')} lead={t('admin.real.backup.lead')} />
      <div className="admin-card">
        <p className="admin-meta" data-testid="admin-respaldo-quedan">
          {left === null
            ? ''
            : left > 0
              ? t('admin.real.backup.left', { left })
              : t('admin.real.backup.none')}
        </p>
        {left ? <p className="admin-meta">{t('admin.real.backup.regenerateWarn')}</p> : null}
        <button
          type="button"
          className="admin-button"
          disabled={busy}
          data-testid="admin-respaldo-generar"
          onClick={() => void generate()}
        >
          {t('admin.real.backup.generate')}
        </button>
        {codes ? (
          <div data-testid="admin-respaldo-codigos">
            <p className="admin-lead">{t('admin.real.backup.showOnce')}</p>
            <ol className="admin-backup-codes">
              {codes.map((c) => (
                <li key={c}>
                  <code>{c}</code>
                </li>
              ))}
            </ol>
            <button
              type="button"
              className="admin-button admin-button--ghost"
              onClick={() => {
                const now = new Date();
                download(
                  new Blob([backupCodesText(codes, t('admin.real.backup.fileHeading'), now)], {
                    type: 'text/plain;charset=utf-8',
                  }),
                  `boia-admin-codigos-respaldo-${now.toISOString().slice(0, 10)}.txt`,
                );
              }}
            >
              {t('admin.real.backup.download')}
            </button>
          </div>
        ) : null}
        {error ? (
          <p className="admin-status admin-status--error" role="alert">
            {t('admin.real.backup.error')}
          </p>
        ) : null}
      </div>
    </section>
  );
}
