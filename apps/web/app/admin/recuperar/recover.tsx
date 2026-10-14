'use client';

import Link from 'next/link';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import {
  adminSignOut,
  setPasswordAfterRecovery,
  startRecoverySession,
  verifiedTotp,
  verifyTotp,
} from '../../../lib/account/admin-auth';
import { parseRecoveryLink } from '../../../lib/admin/password-change';
import { t } from '../../../lib/i18n';
import { PasswordForm } from '../real/password-form';

type Phase =
  | { step: 'checking' }
  | { step: 'invalid' }
  | { step: 'totp'; factorId: string }
  | { step: 'password' }
  | { step: 'done' };

/**
 * Elegir contraseña nueva desde el enlace del email (plan 029 T283). El
 * enlace trae la sesión en la URL; si la cuenta tiene TOTP se pide primero
 * (Supabase lo exige para cambiar la contraseña), después la contraseña dos
 * veces, y al acabar se cierra esa sesión.
 */
export function RecoverPassword() {
  const [phase, setPhase] = useState<Phase>({ step: 'checking' });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const link = parseRecoveryLink(window.location.hash);
      // Fuera la sesión de la barra de direcciones, valga o no.
      window.history.replaceState(null, '', window.location.pathname);
      if (link.kind !== 'session') {
        setPhase({ step: 'invalid' });
        return;
      }
      try {
        await startRecoverySession(link.accessToken, link.refreshToken);
        const factorId = await verifiedTotp();
        setPhase(factorId ? { step: 'totp', factorId } : { step: 'password' });
      } catch (e) {
        console.warn('[boia] admin: enlace de recuperación', e);
        setPhase({ step: 'invalid' });
      }
    })();
  }, []);

  return (
    <div className="admin" data-testid="admin-recuperar">
      <main className="admin-login">
        <div className="admin-card admin-login__card">
          <h2>{t('admin.real.recover.title')}</h2>
          {phase.step === 'checking' ? (
            <p role="status">{t('admin.real.recover.checking')}</p>
          ) : null}
          {phase.step === 'invalid' ? (
            <p
              className="admin-status admin-status--error"
              role="alert"
              data-testid="admin-recuperar-invalido"
            >
              {t('admin.real.recover.invalid')}
            </p>
          ) : null}
          {phase.step === 'totp' ? (
            <TotpStep factorId={phase.factorId} onDone={() => setPhase({ step: 'password' })} />
          ) : null}
          {phase.step === 'password' ? (
            <PasswordForm
              change={setPasswordAfterRecovery}
              onDone={() => {
                // Se cierra la sesión del enlace antes de ofrecer «Ir al Admin».
                void adminSignOut()
                  .catch(() => undefined)
                  .finally(() => setPhase({ step: 'done' }));
              }}
            />
          ) : null}
          {phase.step === 'done' ? (
            <p className="admin-status" role="status" data-testid="admin-recuperar-hecho">
              {t('admin.real.recover.done')}
            </p>
          ) : null}
          {phase.step === 'invalid' || phase.step === 'done' ? (
            <Link href="/admin" prefetch={false} data-testid="admin-recuperar-ir">
              {t('admin.real.recover.enter')}
            </Link>
          ) : null}
        </div>
      </main>
    </div>
  );
}

function TotpStep({ factorId, onDone }: { factorId: string; onDone: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(false);
    try {
      await verifyTotp(factorId, code);
      onDone();
    } catch {
      setError(true);
      setBusy(false);
    }
  };

  return (
    <form className="admin-form" onSubmit={(e) => void submit(e)}>
      <p className="admin-lead">{t('admin.real.recover.totpLead')}</p>
      <label className="admin-field">
        <span className="admin-field__label">{t('admin.real.recover.totpCode')}</span>
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          data-testid="admin-recuperar-totp"
        />
      </label>
      <button
        type="submit"
        className="admin-button"
        disabled={busy || code.length !== 6}
        data-testid="admin-recuperar-totp-seguir"
      >
        {t('admin.real.recover.totpNext')}
      </button>
      {error ? (
        <p className="admin-status admin-status--error" role="alert">
          {t('admin.real.totp.wrong')}
        </p>
      ) : null}
    </form>
  );
}
