'use client';

import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../i18n/web';
import './account.css';
import { trapTab } from './focus';
import { accountLayer } from './layer';
import { showAccountNotice } from './use-account';

/**
 * El único «Cerrar sesión» (plan 029 T284): la landing, «Tu cuenta» de Mi
 * Carnet y el menú de /mar lo abren igual. Primero pregunta («Tu progreso
 * queda guardado en tu cuenta. En este móvil empiezas de cero.»); al
 * confirmar, manda lo pendiente, cierra la sesión y deja este dispositivo
 * como en la primera visita (`signOutAndReset`).
 *
 *   const out = useSignOutFlow();
 *   <button onClick={out.ask}>Cerrar sesión</button>
 *   {out.dialog}
 */
export function useSignOutFlow(opts: { onDone?: () => void } = {}): {
  ask: () => void;
  busy: boolean;
  failed: boolean;
  dialog: ReactNode;
} {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const { onDone } = opts;

  const confirm = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      // A demanda: el borrado trae la tienda (@boia/store), que la landing no necesita hasta aquí.
      const { signOutAndReset } = await import('./reset-device');
      await signOutAndReset();
      setOpen(false);
      showAccountNotice('account.signedOut');
      onDone?.();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [busy, onDone]);

  const ask = useCallback(() => {
    setFailed(false);
    setOpen(true);
  }, []);

  return {
    ask,
    busy,
    failed,
    dialog: open ? (
      <SignOutConfirm
        busy={busy}
        failed={failed}
        onConfirm={() => void confirm()}
        onCancel={() => setOpen(false)}
      />
    ) : null,
  };
}

/** La pregunta antes de cerrar sesión, en la capa de la cuenta. */
export function SignOutConfirm({
  busy,
  failed,
  onConfirm,
  onCancel,
}: {
  busy: boolean;
  failed: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const no = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    no.current?.focus({ preventScroll: true });
    return () => before?.focus?.({ preventScroll: true });
  }, []);

  // Esc sólo cierra la pregunta (antes que la hoja o el menú que hay debajo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  return createPortal(
    // Puede abrirse dentro de una hoja (Mi Carnet, el menú): sus clics no llegan a su fondo.
    <div
      className="acceso acceso--centro"
      data-testid="cuenta-salir"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={box}
        className="acceso__sheet"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        aria-describedby={`${id}-b`}
        onKeyDown={(e) => {
          e.stopPropagation();
          trapTab(e, box.current);
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={`${id}-t`} className="acceso__title">
          {t('cuenta.salir.pregunta')}
        </h2>
        <p id={`${id}-b`} className="acceso-text" data-testid="cuenta-salir-texto">
          {t('cuenta.salir.texto')}
        </p>
        {failed ? (
          <p className="acceso-error" role="alert" data-testid="cuenta-salir-fallo">
            {t('cuenta.salir.fallo')}
          </p>
        ) : null}
        <button
          type="button"
          className="acceso-primary"
          disabled={busy}
          data-testid="cuenta-salir-si"
          onClick={onConfirm}
        >
          {t('cuenta.salir.si')}
        </button>
        <button
          ref={no}
          type="button"
          className="acceso-ghost"
          disabled={busy}
          data-testid="cuenta-salir-no"
          onClick={onCancel}
        >
          {t('cuenta.salir.no')}
        </button>
      </div>
    </div>,
    accountLayer(),
  );
}
