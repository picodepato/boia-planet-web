'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../../../lib/i18n';
import { QrCode } from '../../../lib/mundo/carnet/qr-code';
import { signupUrl } from '../../../lib/scanner/carnet-url';
import './door.css';

/**
 * El QR de alta (plan 019 T218, decisión 11): abre «Crear carnet» directamente
 * (`/carnet?crear=1`), para enseñarlo en la puerta de la fiesta. Se proyecta a
 * pantalla completa o se imprime (sólo el QR, su título y su línea).
 */
export function SignupQr({ compact = false }: { compact?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [big, setBig] = useState(false);
  useEffect(() => setUrl(signupUrl(window.location.origin)), []);
  if (!url) return null;
  return (
    <div className="puerta-alta" data-testid="qr-alta">
      {compact ? null : (
        <div className="puerta-alta__qr">
          <QrCode text={url} label={t('puerta.signup.aria')} />
        </div>
      )}
      <div className="puerta-alta__info">
        {compact ? null : (
          <p className="admin-meta">
            <code className="admin-fiesta__url" data-testid="qr-alta-url">
              {url}
            </code>
          </p>
        )}
        <div className="admin-row">
          <button
            type="button"
            className="admin-button admin-button--ghost"
            data-testid="qr-alta-proyectar"
            onClick={() => setBig(true)}
          >
            {compact ? t('puerta.signup.show') : t('admin.real.fiestas.project')}
          </button>
          {compact ? null : (
            <button
              type="button"
              className="admin-button admin-button--ghost"
              data-testid="qr-alta-imprimir"
              onClick={() => {
                setBig(true);
                setTimeout(() => window.print(), 50);
              }}
            >
              {t('admin.real.fiestas.print')}
            </button>
          )}
        </div>
      </div>
      {big ? <SignupProjector url={url} onClose={() => setBig(false)} /> : null}
    </div>
  );
}

function SignupProjector({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div
      className="admin-projector puerta-proyector"
      role="dialog"
      aria-modal="true"
      aria-label={t('puerta.signup.title')}
      data-testid="qr-alta-proyector"
    >
      <div className="admin-projector__qr">
        <QrCode text={url} label={t('puerta.signup.aria')} />
      </div>
      <p className="admin-projector__title">{t('puerta.signup.title')}</p>
      <p className="admin-projector__caption">{t('puerta.signup.caption')}</p>
      <button type="button" className="admin-button" onClick={onClose} autoFocus>
        {t('admin.real.fiestas.closeProjector')}
      </button>
    </div>,
    document.body,
  );
}
