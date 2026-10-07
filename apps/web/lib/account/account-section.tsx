'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../i18n';
import './account.css';
import { AccountExportButton } from './export-button';
import { trapTab } from './focus';
import { accountLayer } from './layer';
import { resetLocalGuest } from './guest';
import { deleteAccount, setNewsOptIn, signOut } from './session';
import { showAccountNotice, useAccount } from './use-account';

/**
 * «Tu cuenta» al final del Mi Carnet propio (plan 008, T89; marco 14 de
 * T87): el email (sólo lo ve su dueño), las noticias de BOIA (se quitan con
 * un toque, decisión 3), cuándo se aceptó la política, cerrar sesión y
 * borrar la cuenta escribiendo el apodo. Al salir o borrar, este navegador
 * vuelve a ser un invitado nuevo. Sin sesión no pinta nada.
 *
 * «Descargar mis datos» (plan 017 T193, REQ-IDE-050): con cuenta, aquí; en
 * modo local (D-20), es lo único que se pinta (sólo va bajo el Carnet propio).
 */
export function AccountSection() {
  const account = useAccount();
  const [saved, setSaved] = useState<'saved' | 'error' | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  if (account.status === 'local') {
    return (
      <section className="cuenta" data-testid="cuenta-local" aria-labelledby="cuenta-local-titulo">
        <h3 id="cuenta-local-titulo">{t('account.export.button')}</h3>
        <AccountExportButton withAccount={false} />
      </section>
    );
  }
  if (account.status !== 'member' && account.status !== 'incomplete') return null;

  const news = account.consents.news?.granted ?? false;
  const privacy = account.consents.privacy;

  const toggleNews = (value: boolean) => {
    setSaved(null);
    setNewsOptIn(value).then(
      () => setSaved('saved'),
      () => setSaved('error'),
    );
  };

  const leave = async () => {
    setBusy(true);
    try {
      await signOut();
      await resetLocalGuest();
      showAccountNotice('account.signedOut');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="cuenta" data-testid="cuenta" aria-labelledby="cuenta-titulo">
      <h3 id="cuenta-titulo">{t('account.heading')}</h3>
      <p className="cuenta__label">{t('account.email')}</p>
      <p className="cuenta__email" data-testid="cuenta-email">
        {account.email}
      </p>
      <label className="acceso-check">
        <input
          type="checkbox"
          checked={news}
          data-testid="cuenta-noticias"
          onChange={(e) => toggleNews(e.target.checked)}
        />
        <span>{t('account.news')}</span>
      </label>
      <p className="cuenta__saved" role="status" data-testid="cuenta-guardado">
        {saved === 'saved' ? t('account.saved') : saved === 'error' ? t('account.saveError') : ''}
      </p>
      {privacy ? (
        <p className="cuenta__muted" data-testid="cuenta-politica">
          {t('account.privacyAccepted', {
            version: privacy.version,
            date: new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(
              new Date(privacy.at),
            ),
          })}
        </p>
      ) : null}
      <AccountExportButton withAccount />
      <div className="cuenta__actions">
        <button
          type="button"
          className="acceso-ghost"
          disabled={busy}
          data-testid="cuenta-cerrar-sesion"
          onClick={() => void leave()}
        >
          {t('account.signOut')}
        </button>
        {account.profile ? (
          <button
            type="button"
            className="cuenta__delete"
            data-testid="cuenta-borrar"
            onClick={() => setConfirming(true)}
          >
            {t('account.delete')}
          </button>
        ) : null}
      </div>
      {confirming && account.profile ? (
        <DeleteDialog nickname={account.profile.nickname} onCancel={() => setConfirming(false)} />
      ) : null}
    </section>
  );
}

function DeleteDialog({ nickname, onCancel }: { nickname: string; onCancel: () => void }) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const matches = typed.trim().toLowerCase() === nickname.trim().toLowerCase();

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    field.current?.focus();
    return () => before?.focus?.({ preventScroll: true });
  }, []);

  const confirm = async () => {
    if (!matches || busy) return;
    setBusy(true);
    setError(false);
    try {
      await deleteAccount();
    } catch {
      setError(true);
      setBusy(false);
      return;
    }
    await resetLocalGuest().catch(() => undefined);
    showAccountNotice('account.deleted');
  };

  return createPortal(
    // Dentro de la hoja del Carnet en el árbol de React: los clics no llegan a
    // su fondo (que la cerraría).
    <div className="acceso acceso--centro" onClick={(e) => e.stopPropagation()}>
      <div
        ref={box}
        className="acceso__sheet cuenta-borrar"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        aria-describedby={`${id}-b`}
        data-testid="cuenta-borrar-dialogo"
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') onCancel();
          trapTab(e, box.current);
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={`${id}-t`} className="acceso__title">
          {t('account.delete.title')}
        </h2>
        <div id={`${id}-b`}>
          <p className="acceso-text">{t('account.delete.body')}</p>
          <p className="acceso-text">{t('account.delete.keep')}</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void confirm();
          }}
        >
          <label className="acceso-label" htmlFor={`${id}-n`}>
            {t('account.delete.confirmLabel')}
          </label>
          <input
            ref={field}
            id={`${id}-n`}
            className="acceso-input"
            autoComplete="off"
            value={typed}
            data-testid="cuenta-borrar-apodo"
            onChange={(e) => setTyped(e.target.value)}
          />
          {error ? (
            <p className="acceso-error" role="alert">
              {t('account.delete.error')}
            </p>
          ) : null}
          <button
            type="submit"
            className="acceso-danger"
            disabled={!matches || busy}
            data-testid="cuenta-borrar-confirmar"
          >
            {t('account.delete')}
          </button>
          <button type="button" className="acceso-ghost" onClick={onCancel}>
            {t('account.delete.cancel')}
          </button>
        </form>
      </div>
    </div>,
    accountLayer(),
  );
}
